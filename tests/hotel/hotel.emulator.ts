// The Hotel kit against the emulators (lib/hotel-server.ts, lib/hotel-pay-server.ts, lib/hotel-pos-server.ts, lib/hotel-nana-server.ts):
// tiers and roles; rooms, holds and availability; paying online (Paystack stubbed) with Business books and the ledger, idempotent; late
// money stored and flagged, then rebooked; holds expiring and rooms released; the status API refusing "paid"; orders and Inventory stock;
// the room bill settled at checkout; tills with PINs and cash-up; an account number per order (Paylony stubbed); signed card-machine and
// WhatsApp webhooks with simulated payloads; Nana's tools, with prices only from tool results; Set it up for me. Run: npm run test:hotel-server → "ALL OK".
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
process.env.PAYSTACK_SECRET_KEY = "sk_test_standin"; // Paystack is stubbed below: no network, no money
process.env.PAYLONY_SECRET_KEY = "sk_test_standin";
process.env.ANTHROPIC_API_KEY = "test-key"; // Nana on "our" account; the model is stubbed
process.env.MONIEPOINT_WEBHOOK_SECRET = "moniepoint-test-secret-0123456789";
process.env.MONIEPOINT_CLIENT_ID = "id"; process.env.MONIEPOINT_CLIENT_SECRET = "secret"; process.env.MONIEPOINT_API_URL = "https://moniepoint.invalid";
process.env.WHATSAPP_APP_SECRET = "wa-secret"; process.env.WHATSAPP_VERIFY_TOKEN = "wa-verify"; process.env.WHATSAPP_ACCESS_TOKEN = "wa-token";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  HotelError, addBranch, availability, boardView, checkIn, checkOut, context, createBooking, createOrder, guestView, kitchenView, moveOrder, openTill, reportView, requestSetup,
  saveDepartments, saveMenuItem, saveRoom, saveTill, setStaff, setupHotel, sweepHolds, tillContext, tillDay, tillOrder,
} from "../../lib/hotel-server";
import { afterSettle, rebookLate, refundLate, settleCounter, startPay } from "../../lib/hotel-pay-server";
import { processMoniepoint, processWhatsapp, sendToMachine, signMoniepoint } from "../../lib/hotel-pos-server";
import { hotelChat, type ModelArgs, type ModelReply, type NanaHotelDeps } from "../../lib/hotel-nana-server";
import { fulfillPayment } from "../../lib/payments";
import { ensurePricing } from "../../lib/pricing-server";
import { addDays, lagosToday } from "../../lib/hotel";

// Paystack and Paylony stand-ins: what verify says for each reference.
const paystack = new Map<string, { status: string; amount: number }>();
const paylony = new Map<string, string>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (u.startsWith("https://api.paystack.co/transaction/verify/")) {
    const ref = decodeURIComponent(u.split("/").pop()!);
    const t = paystack.get(ref);
    return new Response(JSON.stringify(t ? { status: true, data: { ...t, currency: "NGN", reference: ref } } : { status: false, message: "not found" }), { status: t ? 200 : 400 });
  }
  if (u.startsWith("https://api.paystack.co/refund")) return new Response(JSON.stringify({ status: true, data: { status: "pending" } }), { status: 200 });
  if (u.includes("api.paylony.com/api/v1/verify_checkout_payment/")) {
    const ref = decodeURIComponent(u.split("/").pop()!);
    return new Response(paylony.get(ref) ?? JSON.stringify({ status: "00", data: { payment_status: "pending" } }), { status: 200 });
  }
  return realFetch(url as string, init);
}) as typeof fetch;
const init = (async (a: { reference: string }) => ({ authorization_url: `https://checkout.paystack.test/${a.reference}`, reference: a.reference })) as never;
const payDeps = { init, account: (async () => ({ ok: true, httpStatus: 200, body: { status: "00", data: { account_number: "0123456789", bank_name: "Test Bank", account_name: "Osun Suites / NotesApp" } } })) as never, paylony: () => true };

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re?: RegExp) => {
  await assert.rejects(p, (e: unknown) => e instanceof HotelError && e.status === status && (!re || re.test(e.message)));
};
const now = new Date();
const today = lagosToday(now);
const d1 = addDays(today, 7), d3 = addDays(today, 9);
const min = (n: number) => new Date(now.getTime() + n * 60_000);

(async () => {
  await ensurePricing();
  // Osun Suites on Business (Standard), a Pro owner (Starter), Grand on Enterprise, a stranger, and Ada (books staff) and Bayo (org admin).
  await db.doc("users/osun").set({ uid: "osun", username: "osunsuites", displayName: "Ọ̀ṣun Suites", role: "publisher", accountTier: "business" });
  await db.doc("users/prox").set({ uid: "prox", username: "prox", displayName: "Pro Inn", role: "publisher", accountTier: "pro" });
  await db.doc("users/grand").set({ uid: "grand", username: "grandhotel", displayName: "Grand", role: "publisher", accountTier: "enterprise" });
  await db.doc("users/reader").set({ uid: "reader", username: "reader", role: "reader", accountTier: "standard" });
  await db.doc("bookStaff/osun_ada").set({ ownerUid: "osun", uid: "ada", username: "ada", name: "Ada", role: "cashier" });
  await db.doc("bookStaff/osun_kemi").set({ ownerUid: "osun", uid: "kemi", username: "kemi", name: "Kemi", role: "cashier" });
  await db.doc("orgMembers/osun_bayo").set({ orgUid: "osun", memberUid: "bayo", memberUsername: "bayo", memberName: "Bayo", role: "admin" });
  await db.doc("storeItems/chapman").set({ ownerUid: "osun", title: "Chapman bottle", sellable: true, kind: "physical", stock: 10, priceKobo: 300_000 });

  // ---- Tiers and set-up ----
  await fails(setupHotel(db, "reader", {}), 402);
  const h = await setupHotel(db, "osun", { name: "Ọ̀ṣun Suites", city: "Osogbo", department: "Restaurant" });
  assert.equal(h.id, "osun"); assert.equal(h.departments.length, 1);
  const pro = await setupHotel(db, "prox", { name: "Pro Inn" });
  await fails(saveDepartments(await context(db, "prox", pro.id), [{ name: "Restaurant" }, { name: "Bar" }]), 402, /Starter has one department/);
  await fails(context(db, "reader", "osun"), 403);
  let c = await context(db, "osun", "osun");
  const depts = await saveDepartments(c, [{ name: "Restaurant", kind: "restaurant" }, { name: "Grill", kind: "grill" }, { name: "Lounge", kind: "lounge" }]);
  assert.deepEqual(depts.map((d) => d.id), ["restaurant", "grill", "lounge"]);
  c = await context(db, "osun", "osun");
  await fails(addBranch(c, { branch: "Ikeja" }), 402, /Grand/);
  const g = await setupHotel(db, "grand", { name: "Grand" });
  const gb = await addBranch(await context(db, "grand", g.id), { branch: "Abuja" });
  assert.equal(gb.id, "grand_2");

  // ---- Staff roles by department ----
  await fails(setStaff(c, "stranger", { role: "manager" }), 404, /team first/);
  await setStaff(c, "ada", { role: "department", depts: ["grill"] });
  await setStaff(c, "kemi", { role: "front_desk" });
  c = await context(db, "osun", "osun");
  const ada = await context(db, "ada", "osun");
  assert.equal(ada.role, "department");
  assert.equal((await context(db, "bayo", "osun")).role, "manager", "an organisation admin is a manager");
  await fails(saveRoom(ada, { name: "x", priceKobo: 1, units: 1 }), 403);

  // ---- Rooms, availability and holds ----
  const deluxe = await saveRoom(c, { name: "Deluxe double", priceKobo: 4_500_000, units: "204", blurb: "King bed" });
  const suite = await saveRoom(c, { name: "Executive suite", priceKobo: 8_500_000, units: "301,302" });
  let av = await availability(db, "osun", d1, d3, now);
  assert.equal(av.find((r) => r.id === deluxe.id)!.left, 1); assert.equal(av.find((r) => r.id === deluxe.id)!.totalKobo, 9_000_000);
  const guest = { name: "Tolu Ade", email: "tolu@example.com", phone: "08031234567", guests: 2 };
  const b1 = await createBooking(db, "osun", { ...guest, roomId: deluxe.id, checkIn: d1, checkOut: d3 }, now);
  assert.equal(b1.status, "held"); assert.equal(b1.totalKobo, 9_000_000);
  await fails(createBooking(db, "osun", { ...guest, roomId: deluxe.id, checkIn: d1, checkOut: d3 }, now), 409, /just taken/);
  await fails(createBooking(db, "osun", { ...guest, roomId: deluxe.id, checkIn: d1, checkOut: d3, pay: "desk" }, now), 400, /online/);

  // Holds expire and the room is released: free at once for the next guest, and the sweep marks it expired.
  av = await availability(db, "osun", d1, d3, min(31));
  assert.equal(av.find((r) => r.id === deluxe.id)!.left, 1, "an expired hold frees the room");
  assert.ok((await sweepHolds(db, min(31))) >= 1);
  assert.equal((await db.doc(`hotelBookings/${b1.id}`).get()).get("status"), "expired");

  // ---- Paying online: only a verified payment confirms; Business books; the ledger; idempotent ----
  const b2 = await createBooking(db, "osun", { ...guest, roomId: deluxe.id, checkIn: d1, checkOut: d3 }, now);
  await fails(startPay(db, { target: "booking", id: b2.id, code: "WRONGCODE", method: "online" }, undefined, now, payDeps), 404);
  const p2 = await startPay(db, { target: "booking", id: b2.id, code: b2.code, method: "online" }, undefined, now, payDeps);
  assert.equal(p2.amountKobo, 9_000_000);
  await assert.rejects(fulfillPayment(p2.reference), "Paystack hasn't said it's paid");
  assert.equal((await db.doc(`hotelBookings/${b2.id}`).get()).get("status"), "held");
  paystack.set(p2.reference, { status: "success", amount: 9_000_000 });
  await fulfillPayment(p2.reference);
  await fulfillPayment(p2.reference); // the webhook and the return page both land: once only
  const bk2 = (await db.doc(`hotelBookings/${b2.id}`).get()).data()!;
  assert.equal(bk2.status, "confirmed"); assert.equal(bk2.paidVia, "card");
  const e2 = (await db.doc(`bookEntries/hotel_${b2.id}`).get()).data()!;
  assert.equal(e2.totalKobo, 9_000_000); assert.equal(e2.source, "online"); assert.equal(e2.ownerUid, "osun");
  const l2 = (await db.doc(`ledger/${p2.reference}`).get()).data()!;
  assert.equal(l2.status, "held"); assert.equal(l2.kind, "hotel"); assert.ok(l2.commissionKobo > 0 && l2.netKobo === 9_000_000 - l2.commissionKobo);
  assert.equal((await guestView(db, b2.code)).status, "confirmed");
  assert.ok((await db.collection("notifications").where("recipientUid", "==", "kemi").get()).size >= 1, "front desk hears of the booking");

  // ---- Late money: stored and flagged, held in the ledger, then rebooked ----
  const b3 = await createBooking(db, "osun", { ...guest, roomId: suite.id, checkIn: d1, checkOut: d3 }, now);
  const p3 = await startPay(db, { target: "booking", id: b3.id, code: b3.code, method: "online" }, undefined, now, payDeps);
  await db.doc(`hotelBookings/${b3.id}`).update({ holdUntil: min(-1).toISOString() }); // the guest paid after the hold ran out
  paystack.set(p3.reference, { status: "success", amount: 17_000_000 });
  await fulfillPayment(p3.reference);
  const bk3 = (await db.doc(`hotelBookings/${b3.id}`).get()).data()!;
  assert.equal(bk3.status, "held"); assert.equal(bk3.late.state, "open"); assert.equal(bk3.late.amountKobo, 17_000_000);
  assert.equal((await db.doc(`ledger/${p3.reference}`).get()).get("status"), "disputed", "late money is held, not paid out");
  assert.equal((await db.doc(`bookEntries/hotel_${b3.id}`).get()).exists, false, "not a sale until it's rebooked");
  assert.equal((await db.doc(`payments/${p3.reference}`).get()).get("status"), "paid", "the money is recorded");
  await fails(rebookLate(ada, { kind: "booking", id: b3.id }), 403);
  await rebookLate(c, { kind: "booking", id: b3.id });
  assert.equal((await db.doc(`hotelBookings/${b3.id}`).get()).get("status"), "confirmed");
  assert.equal((await db.doc(`ledger/${p3.reference}`).get()).get("status"), "held");
  assert.equal((await db.doc(`bookEntries/hotel_${b3.id}`).get()).get("totalKobo"), 17_000_000);

  // ---- Orders: priced from the menu, paid only by a verified payment; stock goes down in Inventory ----
  const suya = await saveMenuItem(c, { name: "Suya platter", deptId: "grill", priceKobo: 650_000, note: "Beef, onions, yaji" });
  const asun = await saveMenuItem(c, { name: "Asun", deptId: "grill", priceKobo: 700_000 });
  const chap = await saveMenuItem(c, { name: "Chapman", deptId: "lounge", priceKobo: 300_000, stockItemId: "chapman" });
  await fails(saveMenuItem(c, { name: "X", deptId: "grill", priceKobo: 1, stockItemId: "nope" }), 404);
  const o1 = await createOrder(db, "osun", { deptId: "grill", lines: [{ itemId: suya.id, qty: 1, unitKobo: 1 }, { itemId: asun.id, qty: 2 }], target: { kind: "table", value: "4" }, name: "Tolu", phone: "08031234567" }, "site", now);
  assert.equal(o1.totalKobo, 2_050_000, "the menu's prices, not the page's"); assert.equal(o1.status, "awaiting_payment"); assert.equal(o1.number, "#G-101");
  await fails(moveOrder(c, o1.id, "paid"), 403, /provider confirms/);
  await fails(moveOrder(c, o1.id, "preparing"), 409);
  const p4 = await startPay(db, { target: "order", id: o1.id, code: o1.code, method: "online", email: "tolu@example.com" }, undefined, now, payDeps);
  paystack.set(p4.reference, { status: "success", amount: 2_050_000 });
  await fulfillPayment(p4.reference);
  assert.equal((await db.doc(`hotelOrders/${o1.id}`).get()).get("status"), "paid");
  assert.equal((await db.doc(`bookEntries/hotel_${o1.id}`).get()).get("lines").length, 2);
  const board = await boardView(ada);
  assert.ok(board.orders.some((o) => o.id === o1.id)); assert.equal(board.occupancy, null, "a department role doesn't see rooms");
  assert.equal((await kitchenView(ada, "grill")).orders.length, 1);
  await fails(kitchenView(ada, "lounge"), 403);
  await moveOrder(ada, o1.id, "preparing"); await moveOrder(ada, o1.id, "ready");
  const o2 = await createOrder(db, "osun", { deptId: "lounge", lines: [{ itemId: chap.id, qty: 3 }], target: { kind: "pickup", value: "" }, name: "Tolu", phone: "08031234567" }, "site", now);
  const p5 = await startPay(db, { target: "order", id: o2.id, code: o2.code, method: "online", email: "tolu@example.com" }, undefined, now, payDeps);
  paystack.set(p5.reference, { status: "success", amount: 900_000 });
  await fulfillPayment(p5.reference);
  assert.equal((await db.doc("storeItems/chapman").get()).get("stock"), 7, "stock went down in Inventory");
  await afterSettle(db, "order", o2.id!); // again: stock moves only once
  assert.equal((await db.doc("storeItems/chapman").get()).get("stock"), 7);
  await fails(moveOrder(ada, o2.id, "preparing"), 403, /another department/);

  // ---- The room bill: check-in, orders on the bill, settled at checkout ----
  await fails(checkIn(c, b1.id, "204"), 409);
  const stay = await checkIn(await context(db, "kemi", "osun"), b2.id, "204");
  await fails(createOrder(db, "osun", { deptId: "grill", lines: [{ itemId: asun.id, qty: 1 }], target: { kind: "room", value: "204" }, pay: "room_bill", stayCode: "AAAAAAAA" }, "site", now), 403);
  const o3 = await createOrder(db, "osun", { deptId: "grill", lines: [{ itemId: asun.id, qty: 2 }, { itemId: suya.id, qty: 1 }], target: { kind: "room", value: "204" }, pay: "room_bill", stayCode: stay.code }, "site", now);
  assert.equal(o3.status, "on_bill");
  const kemi = await context(db, "kemi", "osun");
  await fails(checkOut(kemi, stay.id), 409, /still has ₦20,500/);
  await fails(settleCounter(db, { ctx: ada }, { target: "stay", id: stay.id, method: "cash" }), 403);
  const settled = await settleCounter(db, { ctx: kemi }, { target: "stay", id: stay.id, method: "pos" });
  assert.equal(settled.amountKobo, 2_050_000);
  await fails(settleCounter(db, { ctx: kemi }, { target: "stay", id: stay.id, method: "pos" }), 409);
  assert.ok((await db.doc(`hotelOrders/${o3.id}`).get()).get("billSettledAt"));
  const se = (await db.doc(`bookEntries/hotel_stay_${stay.id}`).get()).data()!;
  assert.equal(se.totalKobo, 2_050_000); assert.equal(se.source, "walkin"); assert.equal(se.method, "pos");
  await checkOut(kemi, stay.id);
  assert.equal((await db.doc(`hotelBookings/${b2.id}`).get()).get("status"), "checked_out");

  // ---- Tills: own PIN, one department; cash sales into books; cash-up ----
  const till = await saveTill(c, { name: "Lounge 1", deptId: "lounge", pin: "4321", machineSerial: "MP-001" });
  await fails(openTill(db, till.id, "0000", "Ada"), 403);
  const opened = await openTill(db, till.id, "4321", "Ada");
  const tc = await tillContext(db, opened.token);
  const sale = await tillOrder(tc, { lines: [{ itemId: chap.id, qty: 2 }] }, "till_cash");
  await settleCounter(db, { till: tc }, { target: "order", id: sale.id, method: "cash" });
  assert.equal((await db.doc(`hotelOrders/${sale.id}`).get()).get("status"), "paid");
  assert.equal((await db.doc(`bookEntries/hotel_${sale.id}`).get()).get("method"), "cash");
  await fails(tillOrder(tc, { lines: [{ itemId: asun.id, qty: 1 }] }, "till_cash"), 400, /isn't on this menu/);

  // ---- Card-machine link (Moniepoint, add-on): signed webhooks, simulated ----
  await fails(sendToMachine(tc, { lines: [{ itemId: chap.id, qty: 1 }] }), 402);
  await db.doc("hotels/osun").update({ "addons.cardMachine": min(60 * 24 * 30).toISOString(), "addons.account": min(60 * 24 * 30).toISOString(), "addons.whatsapp": min(60 * 24 * 30).toISOString(), "addons.housekeeping": min(60 * 24 * 30).toISOString() });
  const tc2 = await tillContext(db, opened.token);
  let pushed: { amountKobo: number; merchantRef: string } | null = null;
  const mOrder = await sendToMachine(tc2, { lines: [{ itemId: chap.id, qty: 1 }] }, async (a) => { pushed = a; return { ok: true }; });
  assert.equal(pushed!.amountKobo, 300_000); assert.equal(pushed!.merchantRef, mOrder.id);
  const sign = (body: object, id = "evt1") => { const raw = JSON.stringify(body); const ts = String(Date.now()); return { raw, h: { id, timestamp: ts, signature: signMoniepoint(id, ts, raw, process.env.MONIEPOINT_WEBHOOK_SECRET!) } }; };
  const ev = (ref: string, amountNaira: number, status = "APPROVED", merchantRef = mOrder.id!) => ({ eventType: "V1_POS_PURCHASE_TRANSACTION", data: { terminalSerial: "MP-001", amount: amountNaira, transactionReference: ref, merchantReference: merchantRef, transactionStatus: status } });
  const forged = sign(ev("TX1", 3000));
  assert.equal((await processMoniepoint(db, { ...forged.h, signature: "bad" }, forged.raw)).status, 401, "a bad signature is refused");
  assert.equal((await processMoniepoint(db, forged.h, forged.raw.replace("3000", "30"))).status, 401, "a changed body is refused");
  assert.equal((await db.doc(`hotelOrders/${mOrder.id}`).get()).get("status"), "awaiting_payment");
  const good = sign(ev("TX1", 3000));
  assert.equal((await processMoniepoint(db, good.h, good.raw)).result, "settled");
  assert.equal((await processMoniepoint(db, good.h, good.raw)).result, "duplicate", "a repeat delivery changes nothing");
  assert.equal((await db.doc(`hotelOrders/${mOrder.id}`).get()).get("paidVia"), "moniepoint");
  // A machine approval after the sale ran out: kept and flagged.
  const late = await sendToMachine(tc2, { lines: [{ itemId: chap.id, qty: 1 }] }, async () => ({ ok: true }));
  await db.doc(`hotelOrders/${late.id}`).update({ holdUntil: min(-1).toISOString() });
  assert.equal((await processMoniepoint(db, sign(ev("TX2", 3000, "APPROVED", late.id!)).h, sign(ev("TX2", 3000, "APPROVED", late.id!)).raw)).result, "late");
  assert.equal((await db.doc(`hotelOrders/${late.id}`).get()).get("late.state"), "open");
  // A sale the machine wasn't asked about still counts toward "card machine says".
  const walk = sign(ev("TX3", 5000, "APPROVED", ""));
  await processMoniepoint(db, walk.h, walk.raw);
  const day = await tillDay(tc2);
  assert.equal(day.machineKobo, 300_000 + 300_000 + 500_000);
  assert.equal(day.sales.filter((s) => s.method === "cash").reduce((n, s) => n + s.totalKobo, 0), 600_000);

  // ---- An account number per order (Paylony, add-on): paid only when Paylony says so ----
  const o4 = await createOrder(db, "osun", { deptId: "grill", lines: [{ itemId: suya.id, qty: 1 }], target: { kind: "table", value: "2" }, name: "Bisi", phone: "08030000000", pay: "transfer" }, "site", now);
  const p6 = await startPay(db, { target: "order", id: o4.id, code: o4.code, method: "transfer", email: "bisi@example.com" }, undefined, now, payDeps);
  assert.equal((p6 as { account: { accountNumber: string } }).account.accountNumber, "0123456789");
  await assert.rejects(fulfillPayment(p6.reference), /Waiting/);
  paylony.set(p6.reference, JSON.stringify({ status: "00", data: { payment_status: "paid", amount_paid: "4000.00" } }));
  await assert.rejects(fulfillPayment(p6.reference), /Waiting/, "less than the order: not paid");
  paylony.set(p6.reference, JSON.stringify({ status: "00", data: { payment_status: "paid", amount_paid: "6500.00" } }));
  await fulfillPayment(p6.reference);
  assert.equal((await db.doc(`hotelOrders/${o4.id}`).get()).get("paidVia"), "transfer");

  // ---- Refunding late money (owner only) ----
  const o5 = await createOrder(db, "osun", { deptId: "grill", lines: [{ itemId: suya.id, qty: 1 }], target: { kind: "table", value: "3" }, name: "Bisi", phone: "08030000000" }, "site", now);
  const p7 = await startPay(db, { target: "order", id: o5.id, code: o5.code, method: "online", email: "bisi@example.com" }, undefined, now, payDeps);
  await db.doc(`hotelOrders/${o5.id}`).update({ status: "expired" });
  paystack.set(p7.reference, { status: "success", amount: 650_000 });
  await fulfillPayment(p7.reference);
  await fails(refundLate(kemi, { kind: "order", id: o5.id }), 403);
  assert.equal((await refundLate(c, { kind: "order", id: o5.id })).state, "refunded");
  assert.equal((await db.doc(`ledger/${p7.reference}`).get()).get("status"), "refunded");

  // ---- Nana (Grand): tools read the live menu; a price the model makes up is never sent ----
  await saveDepartments(await context(db, "grand", "grand"), [{ name: "Grill", kind: "grill" }]);
  const gc = await context(db, "grand", "grand");
  const gAsun = await saveMenuItem(gc, { name: "Asun", deptId: "grill", priceKobo: 700_000 });
  await saveMenuItem(gc, { name: "Chapman", deptId: "grill", priceKobo: 300_000 });
  const script = (steps: ((a: ModelArgs) => ModelReply)[]): NanaHotelDeps => { let i = 0; return { create: async (a) => steps[Math.min(i++, steps.length - 1)](a), now: () => now, pay: (async (_d: unknown, raw: Parameters<typeof startPay>[1]) => startPay(db, raw, undefined, now, payDeps)) as never }; };
  const tool = (name: string, input: Record<string, unknown>): ModelReply => ({ content: [{ type: "tool_use", id: `t_${name}_${Math.random()}`, name, input }], stop_reason: "tool_use" });
  const say = (text: string): ModelReply => ({ content: [{ type: "text", text }], stop_reason: "end_turn" });
  const lying = await hotelChat(db, "grand", { message: "Abeg how much be asun?" }, "site", script([() => tool("list_menu", { department: "grill" }), () => say("Asun na ₦5,000 only!")]));
  assert.doesNotMatch(lying.reply, /5,000/, "an invented price is not sent"); assert.match(lying.reply, /₦7,000/, "the menu's price is");
  const honest = await hotelChat(db, "grand", { chatId: lying.chatId, message: "2 asun to room 12, I go pay online" }, "site", script([
    () => tool("quote_order", { department: "grill", items: [{ item_id: gAsun.id, qty: 2 }] }),
    () => tool("place_order", { department: "grill", items: [{ item_id: gAsun.id, qty: 2 }], deliver_to: "room", room_or_table: "12", name: "Musa", phone: "08039999999", pay: "online", guest_confirmed: true }),
    () => say("Done ✓ Order #G-101 is with the grill. Total ₦14,000."),
  ]));
  assert.match(honest.reply, /₦14,000/); assert.ok(honest.orderId);
  const no = (await db.doc(`hotelOrders/${honest.orderId}`).get()).data()!;
  assert.equal(no.totalKobo, 1_400_000); assert.equal(no.source, "nana"); assert.equal(no.status, "awaiting_payment", "Nana never marks anything paid");
  const chat = (await db.doc(`hotelChats/${lying.chatId}`).get()).data()!;
  assert.ok(chat.steps.length >= 3 && chat.messages.length === 4 && chat.orderId === honest.orderId, "Conversations keeps every step");
  await fails(hotelChat(db, "osun", { message: "hi" }, "site", script([() => say("hi")])), 402, /isn't on/);

  // ---- WhatsApp ordering (add-on): signed payloads, each message once ----
  await db.doc("hotels/osun").update({ whatsappNumberId: "15550001111" });
  const sent: string[] = [];
  const wa = (id: string, text: string) => JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "15550001111" }, contacts: [{ profile: { name: "Musa" } }], messages: [{ id, from: "2348031112222", type: "text", text: { body: text } }] } }] }] });
  const sig = (raw: string) => `sha256=${createHmac("sha256", "wa-secret").update(raw).digest("hex")}`;
  const waDeps = { nana: script([() => tool("list_menu", { department: "lounge" }), () => say("Chapman na ₦3,000.")]), send: async (_n: string, _to: string, text: string) => { sent.push(text); return true; } };
  assert.equal((await processWhatsapp(db, wa("wamid.1", "chapman price?"), "sha256=00", waDeps)).status, 401);
  assert.equal((await processWhatsapp(db, wa("wamid.1", "chapman price?"), sig(wa("wamid.1", "chapman price?")), waDeps)).handled, 1);
  assert.equal((await processWhatsapp(db, wa("wamid.1", "chapman price?"), sig(wa("wamid.1", "chapman price?")), waDeps)).handled, 0, "a repeat delivery isn't answered twice");
  assert.equal(sent.length, 1); assert.match(sent[0], /₦3,000/);

  // ---- Reports (Grand only) and Set it up for me ----
  await fails(reportView(c, "2026-11"), 402);
  const rep = await reportView(gc, today.slice(0, 7));
  assert.equal(rep.month, today.slice(0, 7));
  const r = await requestSetup(db, { uid: "osun", email: null }, { name: "Mrs Ade", email: "ade@example.com", hotel: "Ọ̀ṣun Suites", city: "Osogbo", rooms: 24, departments: "Restaurant, Grill" });
  const lead = (await db.doc(`leads/${r.id}`).get()).data()!;
  assert.equal(lead.category, "hotel-setup"); assert.match(lead.message, /Rooms: 24/);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
