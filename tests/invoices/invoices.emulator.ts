// Client invoices (lib/invoices-server.ts) against the Firestore emulator. Run: npm run test:invoices-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { checkPay, clientCheck, listInvoices, makeDrafts, markPaid, publicInvoice, refreshDraft, saveInvoiceSettings, sendInvoice, sendInvoiceReminders, voidInvoice, weekInvoiced } from "../../lib/invoices-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fin = { uid: "u_fin", email: "fin@team.test", owner: false, finance: true, product: false };
const notFin = { ...fin, uid: "u_eng", finance: false };
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));
const mails: { to: string; subject: string; text: string }[] = [];
const send = async (m: { to: string; subject: string; text: string }) => { mails.push(m); return true; };

(async () => {
  await db.doc("timeProjects/p1").set({ name: "Digital Witch partnership", client: "Digital Witch", clientEmail: "accounts@dw.example", dept: "growth", billable: true, rateKobo: 500000, budgetHours: 60, active: true });
  await db.doc("timeProjects/p2").set({ name: "Internal build", client: "", dept: "engineering", billable: false, rateKobo: 0, active: true });
  const entry = (uid: string, day: string, week: string, minutes: number, extra: object = {}) => db.collection("timeEntries").add({ uid, day, week, uidWeek: `${uid}_${week}`, minutes, kind: "project", refId: "p1", label: "Digital Witch partnership", dept: "growth", billable: true, source: "manual", startedAt: "", endedAt: "", note: "", createdAt: "x", ...extra });
  await entry("tola", "2026-10-06", "2026-10-05", 240); await entry("tola", "2026-10-07", "2026-10-05", 180);
  await entry("tola", "2026-10-13", "2026-10-12", 300); await entry("ada", "2026-10-14", "2026-10-12", 60);
  await entry("ada", "2026-10-15", "2026-10-12", 45, { billable: false }); // not billable
  await db.doc("timeSheets/tola_2026-10-05").set({ uid: "tola", week: "2026-10-05", status: "approved" });
  await db.doc("timeSheets/tola_2026-10-12").set({ uid: "tola", week: "2026-10-12", status: "approved" });
  await db.doc("timeSheets/ada_2026-10-12").set({ uid: "ada", week: "2026-10-12", status: "submitted" }); // not approved yet

  await rejects(listInvoices(db, notFin, "2026-10"), /finance team/);
  await rejects(makeDrafts(db, fin, "2026-11", new Date("2026-10-23T12:00:00Z")), /this month or one before/);
  assert.deepEqual(await makeDrafts(db, fin, "2026-10", new Date("2026-10-31T12:00:00Z")), { made: 1, nothing: 0 });
  assert.deepEqual(await makeDrafts(db, fin, "2026-10", new Date("2026-10-31T12:00:00Z")), { made: 0, nothing: 0 }, "once per project and month");
  let { invoices } = await listInvoices(db, fin, "2026-10");
  assert.equal(invoices.length, 1);
  let inv = invoices[0];
  assert.deepEqual(inv.lines.map((l) => [l.week, l.minutes]), [["2026-10-05", 420], ["2026-10-12", 300]], "approved billable only");
  assert.equal(inv.totalKobo, 6_000_000, "12 h × ₦5,000"); assert.equal(inv.vatKobo, 0, "VAT off by default");

  // Ada's week is approved later: refresh picks it up; VAT switched on applies to the refreshed draft
  await db.doc("timeSheets/ada_2026-10-12").update({ status: "approved" });
  await saveInvoiceSettings(db, fin, { vatOn: true, bankName: "Moniepoint", accountName: "NotesApp Technologies Ltd", accountNumber: "1234567890" });
  await refreshDraft(db, fin, inv.id);
  inv = (await listInvoices(db, fin, "2026-10")).invoices[0];
  assert.equal(inv.minutes, 780); assert.equal(inv.subtotalKobo, 6_500_000); assert.equal(inv.vatKobo, 487_500); assert.equal(inv.totalKobo, 6_987_500);

  // Sent: numbered, due in 14 days, the client emailed; its weeks are locked
  const s1 = await sendInvoice(db, fin, inv.id, {}, new Date("2026-11-01T09:00:00Z"), send);
  assert.equal(s1.number, "NA-INV-2026-001"); assert.equal(mails[0].to, "accounts@dw.example"); assert.match(mails[0].subject, /NA-INV-2026-001/);
  const token = new URL(s1.link).searchParams.get("t")!;
  await rejects(sendInvoice(db, fin, inv.id, {}, new Date(), send), /already been sent/);
  assert.equal(await weekInvoiced(db, "tola", "2026-10-12"), "NA-INV-2026-001");
  assert.equal(await weekInvoiced(db, "tola", "2026-10-26"), null);
  const pub = await publicInvoice(db, inv.id, token);
  assert.equal(pub.invoice.dueOn, "2026-11-15"); assert.equal(pub.bank?.accountNumber, "1234567890");
  await rejects(publicInvoice(db, inv.id, "wrong-token-wrong-token"), /link isn't valid/);
  await rejects(clientCheck(db, inv.id, token, "na_nope_123456"), /payment wasn't found/);
  assert.equal(await checkPay(db, "na_unknown_ref"), "unknown");

  // The reminder: once, 3 days after the due date
  assert.equal(await sendInvoiceReminders(db, new Date("2026-11-17T12:00:00Z"), send), 0);
  assert.equal(await sendInvoiceReminders(db, new Date("2026-11-18T12:00:00Z"), send), 1);
  assert.equal(await sendInvoiceReminders(db, new Date("2026-11-25T12:00:00Z"), send), 0);
  assert.ok(mails.at(-1)!.text.includes(`t=${encodeURIComponent(token)}`), "the reminder carries the same link");

  // Paid by bank transfer: money in on the ledger, once
  await markPaid(db, fin, inv.id, "Moniepoint ref 778", new Date("2026-11-19T10:00:00Z"));
  await rejects(markPaid(db, fin, inv.id, "again"), /sent, unpaid/);
  const paid = (await db.doc(`invoices/${inv.id}`).get()).data()!;
  assert.equal(paid.status, "paid"); assert.ok(paid.ledgerEntryId, paid.ledgerError);
  const led = (await db.doc(`financeEntries/${paid.ledgerEntryId}`).get()).data() ?? (await db.collection("financeEntries").where("category", "==", "client_invoice").get()).docs[0]?.data();
  assert.equal(led?.amountKobo, 6_987_500); assert.equal(led?.kind, "income");
  await rejects(voidInvoice(db, fin, inv.id, "mistake"), /paid invoice can't be voided/);

  // A second project-month voided unlocks its weeks
  await entry("tola", "2026-09-29", "2026-09-28", 60);
  await db.doc("timeSheets/tola_2026-09-28").set({ uid: "tola", week: "2026-09-28", status: "approved" });
  await makeDrafts(db, fin, "2026-09", new Date("2026-10-31T12:00:00Z"));
  const sep = (await listInvoices(db, fin, "2026-09")).invoices[0];
  await sendInvoice(db, fin, sep.id, {}, new Date("2026-10-31T12:00:00Z"), send);
  assert.equal(await weekInvoiced(db, "tola", "2026-09-28"), "NA-INV-2026-002");
  await rejects(voidInvoice(db, fin, sep.id, ""), /Say why/);
  await voidInvoice(db, fin, sep.id, "Wrong client");
  assert.equal(await weekInvoiced(db, "tola", "2026-09-28"), null);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
