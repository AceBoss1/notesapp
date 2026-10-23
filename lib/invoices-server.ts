import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { sendEmail } from "./email";
import { setting } from "./config";
import { SITE_URL } from "./host";
import { lagosDate } from "./team";
import { createEntry, type Caller } from "./finance-server";
import { createCheckoutAccount, payWithCardtap, paylonyConfigured, verifyCheckoutPayment, verifyTransaction as paylonyVerify } from "./paylony";
import { initializeTransaction, newReference, verifyTransaction as paystackVerify } from "./paystack";
import { pick, readVerify } from "./cardtap-topup";
import { COMPANY_INFO } from "./site";
import {
  InvoiceError, VAT_RATE, canDraftFor, dueFrom, invoiceNumber, isMonth, linesFrom, monthLabel, publicView, reminderDue, totals,
  type Invoice, type PayMethod,
} from "./invoices";
import type { TimeEntry } from "./time";

// Server side of client invoices (lib/invoices.ts has the rules). Collections, server-only in firestore.rules:
//   invoices/{id}          the invoices; `weeks` (the Mondays it bills) and `projectId` lock those hours once sent
//   invoiceCounters/{year} the next number
//   invoicePays/{reference} each payment attempt (Paylony transfer account, CardTap, Paystack), checked with the provider
//   invoiceSettings/main    VAT on or off, and the bank account shown for a plain transfer
// Finance and super admins only (hasDept "finance"); the client sees one invoice through its link (`token`: a long random
// capability, kept only in this server-only collection so the reminder can carry the same link).
const INV = "invoices", COUNTERS = "invoiceCounters", PAYS = "invoicePays", SETTINGS = "invoiceSettings/main";
const need = (cond: boolean, msg: string, status = 400) => { if (!cond) throw new InvoiceError(msg, status); };
const toInvoice = (id: string, d: FirebaseFirestore.DocumentData) => ({ ...(d as Omit<Invoice, "id">), id }) as Invoice;
// Payments that arrive by themselves (a webhook, the client's page) are recorded in the ledger as the system, not as a person.
const SYSTEM: Caller = { uid: "system:invoices", email: "invoices@notesapp", owner: true, finance: true, product: false };

export type InvoiceSettings = { vatOn: boolean; bankName: string; accountName: string; accountNumber: string };
export async function invoiceSettings(db: Firestore): Promise<InvoiceSettings> {
  const d = (await db.doc(SETTINGS).get()).data() ?? {};
  return { vatOn: d.vatOn === true, bankName: d.bankName ?? "", accountName: d.accountName ?? "", accountNumber: d.accountNumber ?? "" };
}
export async function saveInvoiceSettings(db: Firestore, c: Caller, b: Record<string, unknown>, now = new Date()) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const accountNumber = String(b.accountNumber ?? "").replace(/\s/g, "");
  need(!accountNumber || /^\d{10}$/.test(accountNumber), "A Nigerian bank account number has 10 digits.");
  const s = { vatOn: b.vatOn === true, bankName: String(b.bankName ?? "").trim().slice(0, 80), accountName: String(b.accountName ?? "").trim().slice(0, 100), accountNumber };
  await db.doc(SETTINGS).set({ ...s, updatedAt: now.toISOString(), by: c.uid });
  return s;
}

// The approved billable minutes by day for a project in a month, and which weeks they're in.
async function billable(db: Firestore, projectId: string, month: string): Promise<Record<string, number>> {
  const s = await db.collection("timeEntries").where("refId", "==", projectId).get();
  const entries = s.docs.map((d) => d.data() as TimeEntry & { uidWeek: string }).filter((e) => e.kind === "project" && e.billable && e.day.slice(0, 7) === month);
  const sheetIds = Array.from(new Set(entries.map((e) => e.uidWeek)));
  const sheets = sheetIds.length ? await db.getAll(...sheetIds.map((id) => db.doc(`timeSheets/${id}`))) : [];
  const approved = new Set(sheets.filter((x) => x.data()?.status === "approved").map((x) => x.id));
  const byDay: Record<string, number> = {};
  for (const e of entries) if (approved.has(e.uidWeek)) byDay[e.day] = (byDay[e.day] ?? 0) + e.minutes;
  return byDay;
}

export async function listInvoices(db: Firestore, c: Caller, month: string) {
  need(c.finance, "Invoices are for the finance team.", 403);
  need(isMonth(month), "Choose a month.");
  const [s, settings, open] = await Promise.all([
    db.collection(INV).where("month", "==", month).get(),
    invoiceSettings(db),
    db.collection(INV).where("status", "==", "sent").get(),
  ]);
  const projects = (await db.collection("timeProjects").get()).docs.map((d) => ({ id: d.id, ...(d.data() as { name: string; client: string; clientEmail?: string; billable: boolean; active?: boolean; rateKobo: number }) }));
  const invoices = s.docs.map((d) => toInvoice(d.id, d.data())).sort((a, b) => (b.number || "~").localeCompare(a.number || "~"));
  const unpaid = open.docs.map((d) => toInvoice(d.id, d.data())).filter((i) => i.month !== month);
  return { month, invoices, unpaid, settings, billableProjects: projects.filter((p) => p.billable && p.active !== false).map((p) => ({ id: p.id, name: p.name, client: p.client, clientEmail: p.clientEmail ?? "", rateKobo: p.rateKobo })) };
}

// Drafts for the month: one per billable project with approved billable hours and no invoice yet (a voided one doesn't count).
export async function makeDrafts(db: Firestore, c: Caller, month: unknown, now = new Date()) {
  need(c.finance, "Invoices are for the finance team.", 403);
  need(isMonth(month) && canDraftFor(String(month), lagosDate(now)), "Choose this month or one before it.");
  const m = String(month);
  const [projects, existing, settings] = await Promise.all([db.collection("timeProjects").get(), db.collection(INV).where("month", "==", m).get(), invoiceSettings(db)]);
  const taken = new Set(existing.docs.filter((d) => d.data().status !== "void").map((d) => d.data().projectId as string));
  let made = 0, nothing = 0;
  for (const p of projects.docs) {
    const d = p.data();
    if (!d.billable || d.active === false || taken.has(p.id) || !d.rateKobo) continue;
    const lines = linesFrom(await billable(db, p.id, m), m, d.rateKobo);
    if (!lines.length) { nothing++; continue; }
    const vatTenths = settings.vatOn ? VAT_RATE * 10 : 0;
    await db.collection(INV).add({
      number: "", projectId: p.id, project: d.name, client: d.client ?? "", clientEmail: d.clientEmail ?? "", month: m, rateKobo: d.rateKobo, lines, weeks: lines.map((l) => l.week),
      ...totals(lines, vatTenths), vatTenths, status: "draft", issuedOn: "", dueOn: "", createdAt: now.toISOString(), createdBy: c.uid,
    });
    made++;
  }
  return { made, nothing };
}

// Refreshes a draft from the approved hours as they are now (hours approved since it was drafted).
export async function refreshDraft(db: Firestore, c: Caller, id: unknown, now = new Date()) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const ref = db.doc(`${INV}/${String(id)}`);
  const i = (await ref.get()).data() as Invoice | undefined;
  need(!!i, "That invoice wasn't found.", 404);
  need(i!.status === "draft", "Only a draft can be refreshed.", 409);
  const lines = linesFrom(await billable(db, i!.projectId, i!.month), i!.month, i!.rateKobo);
  const vatTenths = (await invoiceSettings(db)).vatOn ? VAT_RATE * 10 : 0;
  await ref.update({ lines, weeks: lines.map((l) => l.week), ...totals(lines, vatTenths), vatTenths, updatedAt: now.toISOString() });
  return { lines: lines.length };
}

const linkFor = (id: string, token: string) => `${SITE_URL}/invoice/${id}?t=${encodeURIComponent(token)}`;

// Sending: it gets its number, is dated today and due in 14 days, and the client is emailed the link. Its hours are locked from now.
export async function sendInvoice(db: Firestore, c: Caller, id: unknown, b: Record<string, unknown> = {}, now = new Date(), send = sendEmail) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const ref = db.doc(`${INV}/${String(id)}`);
  const token = randomBytes(18).toString("base64url");
  const today = lagosDate(now);
  const sent = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That invoice wasn't found.", 404);
    const i = toInvoice(s.id, s.data()!);
    need(i.status === "draft", "It has already been sent.", 409);
    need(i.totalKobo > 0, "There's nothing to bill on it.");
    const email = String(b.clientEmail ?? i.clientEmail ?? "").trim().toLowerCase();
    need(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), "Add the client's email address first.");
    const year = Number(today.slice(0, 4));
    const cRef = db.doc(`${COUNTERS}/${year}`);
    const seq = ((await t.get(cRef)).data()?.next as number | undefined) ?? 1;
    t.set(cRef, { next: seq + 1 }, { merge: true });
    const patch = { number: invoiceNumber(year, seq), clientEmail: email, status: "sent" as const, issuedOn: today, dueOn: dueFrom(today), sentAt: now.toISOString(), token };
    t.update(ref, patch);
    return { ...i, ...patch };
  });
  const ok = await send({
    to: sent.clientEmail, subject: `Invoice ${sent.number} from ${COMPANY_INFO.legalName}: ₦${(sent.totalKobo / 100).toLocaleString("en-NG")}`,
    text: `Hello ${sent.client || ""},\n\nHere is invoice ${sent.number} for ${sent.project}, ${monthLabel(sent.month)}: ${(sent.minutes / 60).toFixed(2)} hours at ₦${(sent.rateKobo / 100).toLocaleString("en-NG")} an hour, ₦${(sent.totalKobo / 100).toLocaleString("en-NG")} in all, due by ${sent.dueOn}.\n\nView and pay it online (bank transfer, CardTap or card): ${linkFor(sent.id, token)}\n\nThank you,\n${COMPANY_INFO.legalName} · RC ${COMPANY_INFO.rcNumber}`,
    action: { label: "View and pay", url: linkFor(sent.id, token) },
  }).catch(() => false);
  await ref.update({ emailSent: ok });
  return { number: sent.number, emailSent: ok, link: linkFor(sent.id, token) };
}

export async function voidInvoice(db: Firestore, c: Caller, id: unknown, reason: unknown, now = new Date()) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const why = String(reason ?? "").trim().slice(0, 200);
  need(!!why, "Say why it's being voided.");
  const ref = db.doc(`${INV}/${String(id)}`);
  const i = (await ref.get()).data() as Invoice | undefined;
  need(!!i, "That invoice wasn't found.", 404);
  need(i!.status !== "paid", "A paid invoice can't be voided. Record a refund in the money ledger instead.", 409);
  await ref.update({ status: "void", voidReason: why, voidedAt: now.toISOString(), voidedBy: c.uid });
}

// Paid: once, in a transaction; then money in on the ledger (Client invoice), dated today.
async function settlePaid(db: Firestore, id: string, via: PayMethod, payRef: string, now: Date, who: Caller = SYSTEM) {
  const ref = db.doc(`${INV}/${id}`);
  const won = await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.data()!.status !== "sent") return null;
    t.update(ref, { status: "paid", paidAt: now.toISOString(), paidVia: via, payRef });
    return toInvoice(s.id, s.data()!);
  });
  if (!won) return false;
  try {
    const e = await createEntry(db, who, { kind: "income", category: "client_invoice", amountKobo: won.totalKobo, occurredOn: lagosDate(now), party: won.client || won.project, description: `Invoice ${won.number}: ${won.project}, ${monthLabel(won.month)}` }, now);
    await ref.update({ ledgerEntryId: e.id });
  } catch (err) {
    console.error("[invoices] ledger entry failed", id, err); // the invoice stays paid; finance adds the entry by hand
    await ref.update({ ledgerError: String((err as Error).message ?? err).slice(0, 300) });
  }
  return true;
}

export async function markPaid(db: Firestore, c: Caller, id: unknown, note: unknown, now = new Date()) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const ok = await settlePaid(db, String(id), "bank", `bank:${String(note ?? "").trim().slice(0, 80)}`, now, c);
  need(ok, "Only a sent, unpaid invoice can be marked paid.", 409);
}

// ── The client's side (no sign-in: the link's token is the proof) ────────────────────────────────────────────────────────────

async function byToken(db: Firestore, id: unknown, token: unknown): Promise<Invoice> {
  const s = await db.doc(`${INV}/${String(id ?? "x").replace(/\//g, "")}`).get();
  const d = s.data();
  need(!!d && typeof d.token === "string" && d.token.length > 20 && d.token === String(token ?? "") && d.status !== "draft", "That invoice link isn't valid.", 404);
  return toInvoice(s.id, d!);
}

export const payOptions = () => ({ paylony: paylonyConfigured(), cardtap: paylonyConfigured() && !!setting("PAYLONY_CARDTAP_TERMINAL_ID"), paystack: !!setting("PAYSTACK_SECRET_KEY") });

export async function publicInvoice(db: Firestore, id: unknown, token: unknown) {
  const i = await byToken(db, id, token);
  const s = await invoiceSettings(db);
  return { invoice: publicView(i), options: payOptions(), bank: s.accountNumber ? { bankName: s.bankName, accountName: s.accountName, accountNumber: s.accountNumber } : null, company: COMPANY_INFO };
}

export async function startPay(db: Firestore, id: unknown, token: unknown, method: unknown, now = new Date()) {
  const i = await byToken(db, id, token);
  need(i.status === "sent", i.status === "paid" ? "This invoice is already paid. Thank you." : "This invoice can't be paid.", 409);
  const o = payOptions();
  const reference = newReference();
  const base = { invoiceId: i.id, amountKobo: i.totalKobo, createdAt: now.toISOString(), state: "waiting" };
  const naira = (i.totalKobo / 100).toFixed(2);
  if (method === "paylony") {
    need(o.paylony, "Paylony isn't available right now. Pay by card or bank transfer.", 409);
    const r = await createCheckoutAccount({ name: i.client || i.project, email: i.clientEmail, amount: naira, reference, phone: "", title: `Invoice ${i.number}`, description: `${i.project}, ${monthLabel(i.month)}` });
    const acct = { accountNumber: pick(r.body, ["account_number", "accountNumber"]), bankName: pick(r.body, ["bank_name", "bankName", "bank"]), accountName: pick(r.body, ["account_name", "accountName"]), expiresAt: pick(r.body, ["expiry", "expires_at", "expiresAt", "expiry_date"]) };
    need(r.ok && !!acct.accountNumber, "Paylony couldn't open a transfer account just now. Try again, or pay by card.", 502);
    await db.doc(`${PAYS}/${reference}`).set({ ...base, method: "paylony", account: acct });
    return { method, reference, account: acct };
  }
  if (method === "cardtap") {
    need(o.cardtap, "CardTap isn't available right now. Pay by bank transfer or card.", 409);
    const r = await payWithCardtap({ amount: i.totalKobo / 100, name: i.client || i.project, email: i.clientEmail, phone: "", terminal_id: setting("PAYLONY_CARDTAP_TERMINAL_ID")!, reference, title: `Invoice ${i.number}`, description: i.project, redirectUrl: `${SITE_URL}/invoice/${i.id}` });
    const code = pick(r.body, ["initiationRef", "initiation_ref", "paymentRef", "code"]);
    need(r.ok && (typeof code === "string" || typeof code === "number"), "CardTap couldn't start the payment. Try again, or pay another way.", 502);
    await db.doc(`${PAYS}/${reference}`).set({ ...base, method: "cardtap", code: String(code) });
    return { method, reference, code: String(code), instruction: String(pick(r.body, ["instruction", "message"]) ?? "") };
  }
  if (method === "paystack") {
    need(o.paystack, "Card payment isn't available right now.", 409);
    const r = await initializeTransaction({ email: i.clientEmail, amountKobo: i.totalKobo, reference, callbackUrl: `${SITE_URL}/invoice/${i.id}?t=${encodeURIComponent(String(token))}&ref=${reference}`, metadata: { kind: "client_invoice", invoiceId: i.id, number: i.number } });
    await db.doc(`${PAYS}/${reference}`).set({ ...base, method: "paystack" });
    return { method, reference, url: r.authorization_url };
  }
  throw new InvoiceError("Choose how to pay.");
}

// Asks the provider whether a payment went through, and settles the invoice on a clear yes only. From the client's page (with the
// token), from the Paylony webhook (with its trx), and from Paystack's return.
export async function checkPay(db: Firestore, reference: string, trx?: string, now = new Date()): Promise<"paid" | "waiting" | "failed" | "unknown"> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(reference)) return "unknown";
  const ref = db.doc(`${PAYS}/${reference}`);
  const p = (await ref.get()).data();
  if (!p) return "unknown";
  if (p.state === "paid") return "paid";
  let state: "paid" | "waiting" | "failed" = "waiting";
  if (p.method === "paystack") {
    const tx = await paystackVerify(reference).catch(() => null);
    if (tx?.status === "success" && tx.currency === "NGN" && (tx.requested_amount ?? tx.amount) >= p.amountKobo) state = "paid";
    else if (tx && ["failed", "abandoned", "reversed"].includes(tx.status)) state = "failed";
  } else {
    const r = p.method === "paylony" && trx ? await paylonyVerify(trx).catch(() => null) : await verifyCheckoutPayment(reference).catch(() => null);
    if (r?.ok) state = readVerify(r.body, p.amountKobo).state;
    await ref.update({ lastCheck: { at: now.toISOString(), state } }).catch(() => {});
  }
  if (state === "paid") {
    await ref.update({ state: "paid", paidAt: now.toISOString() });
    await settlePaid(db, p.invoiceId, p.method as PayMethod, reference, now);
  } else if (state === "failed") await ref.update({ state: "failed" });
  return state;
}

export async function clientCheck(db: Firestore, id: unknown, token: unknown, reference: unknown) {
  const i = await byToken(db, id, token);
  const p = (await db.doc(`${PAYS}/${String(reference ?? "x")}`).get()).data();
  need(!!p && p.invoiceId === i.id, "That payment wasn't found.", 404);
  return { state: await checkPay(db, String(reference)) };
}

// ── Locking hours, and the reminder ─────────────────────────────────────────────────────────────────────────────────────────

// Whether a person's week bills on a sent or paid invoice (so it can't be returned or reopened until that invoice is voided).
export async function weekInvoiced(db: Firestore, uid: string, week: string): Promise<string | null> {
  const s = await db.collection(INV).where("weeks", "array-contains", week).get();
  const live = s.docs.filter((d) => ["sent", "paid"].includes(d.data().status));
  if (!live.length) return null;
  const mine = await db.collection("timeEntries").where("uidWeek", "==", `${uid}_${week}`).get();
  const projects = new Set(mine.docs.map((d) => d.data()).filter((e) => e.kind === "project" && e.billable).map((e) => e.refId as string));
  const hit = live.find((d) => projects.has(d.data().projectId));
  return hit ? String(hit.data().number) : null;
}

// From the 15-minute cron: one reminder to the client, 3 days after the due date.
export async function sendInvoiceReminders(db: Firestore, now = new Date(), send = sendEmail): Promise<number> {
  const today = lagosDate(now);
  const s = await db.collection(INV).where("status", "==", "sent").get();
  let n = 0;
  for (const d of s.docs) {
    const i = toInvoice(d.id, d.data());
    if (!reminderDue(i, today)) continue;
    await d.ref.update({ remindedAt: now.toISOString() });
    const token = String(d.data().token ?? "");
    await send({ to: i.clientEmail, subject: `Reminder: invoice ${i.number} was due on ${i.dueOn}`, text: `Hello ${i.client || ""},\n\nA reminder that invoice ${i.number} (₦${(i.totalKobo / 100).toLocaleString("en-NG")}, ${i.project}, ${monthLabel(i.month)}) was due on ${i.dueOn}. You can pay it here: ${linkFor(i.id, token)}\n\nIf you've already paid, thank you, and please ignore this.\n\n${COMPANY_INFO.legalName}`, action: { label: "View and pay", url: linkFor(i.id, token) } }).catch(() => false);
    n++;
  }
  return n;
}

// Finance's copy of the client link, to send another way (WhatsApp, a letter).
export async function clientLink(db: Firestore, c: Caller, id: unknown) {
  need(c.finance, "Invoices are for the finance team.", 403);
  const i = (await db.doc(`${INV}/${String(id)}`).get()).data();
  need(!!i && i.status !== "draft" && !!i.token, "Send it first.", 409);
  return { link: linkFor(String(id), String(i!.token)) };
}
