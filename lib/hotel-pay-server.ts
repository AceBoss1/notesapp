import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { initializeTransaction, newReference, refundTransaction } from "./paystack";
import { createCheckoutAccount, paylonyConfigured, verifyCheckoutPayment } from "./paylony";
import { readVerify } from "./cardtap-topup";
import { physicalCommissionRateFor } from "./tiers";
import { booksCaps } from "./pricing";
import { SITE_URL } from "./host";
import { notifyBell, sendEmail } from "./email";
import { setting } from "./config";
import { lagosDay, type Line, type Method } from "./books";
import { accessFor as inventoryAccessFor, bookStockMove, lowStockAlert } from "./inventory-server";
import { addonOn, billOwed, hasFeature, naira, roleCan, roomsLeft, targetText, type Booking, type Order, type Stay } from "./hotel";
import { HotelError, bookingBells, bumpPulse, hotelById, orderBells, planOf, type Ctx, type TillCtx } from "./hotel-server";
import type { AccountTier } from "./users";

// Every payment of the Hotel kit (docs/HOTEL_KIT.md, "Money rules"). The one place that marks a booking confirmed, an order paid or a room
// bill settled, from a payment that is verified:
//
//   - online (Paystack): lib/payments.ts fulfillPayment, from the webhook or the guest's return, asks Paystack and checks the amount, then
//     calls readHotelPay/writeHotelPay inside its transaction. Idempotent on the payment reference (payments/{reference}).
//   - an account number per order (Paylony, add-on): the same, but fulfillPayment asks Paylony about the reference first (confirmPaylonyHotel).
//   - a card machine (Moniepoint, add-on): a signed webhook, then settleMachine (lib/hotel-pos-server.ts). Idempotent on the machine's
//     transaction reference (hotelPayments/moniepoint_<ref>).
//   - cash or a card at the counter: a till (its PIN) or a staff member records it under their name (settleCounter). Once per target.
// The status API (lib/hotel-server.ts moveOrder) refuses "paid". A payment that lands after the hold ran out, or for something already
// paid or cancelled, is stored and flagged on the booking or order ("late"), its money held, for staff to rebook or refund.
// Every settled sale goes into Business books (bookEntries/hotel_<id>), and stock linked to Inventory goes down (afterSettle).

export type HotelPayInfo = { target: "booking" | "order" | "stay"; id: string; hotelId: string; label: string; code: string; late?: boolean; entryId?: string };
type Provider = "paystack" | "paylony" | "moniepoint" | "counter";
export type Settlement = { provider: Provider; ref: string; amountKobo: number; method: Method; via: string; by: string };
type Read = { kind: HotelPayInfo["target"]; ref: DocumentReference; snap: DocumentSnapshot; orders: DocumentSnapshot[]; dup: DocumentSnapshot | null };
const col = { booking: "hotelBookings", order: "hotelOrders", stay: "hotelStays" } as const;
const iso = (d: Date) => d.toISOString();

// ---- What is owed, and whether it can still be paid ----
function dueOf(r: Read): number {
  const d = r.snap.data();
  if (!d) return 0;
  if (r.kind === "stay") return billOwed(Number(d.roomDueKobo) || 0, r.orders.map((o) => o.data() as Order));
  return Number(d.totalKobo) || 0;
}
export function payable(kind: Read["kind"], d: Record<string, unknown> | undefined, at: Date): boolean {
  if (!d) return false;
  if (kind === "stay") return d.open === true;
  const live = typeof d.holdUntil === "string" && Date.parse(d.holdUntil) > at.getTime();
  if (kind === "booking") return d.status === "held" && live;
  return (d.status === "awaiting_payment" || d.status === "pending") && live;
}

// ---- Inside a transaction: every read first, then the writes ----
export async function readSettle(t: Transaction, db: Firestore, kind: Read["kind"], id: string, dupId?: string): Promise<Read> {
  const ref = db.doc(`${col[kind]}/${id}`);
  const snap = await t.get(ref);
  const orders = kind === "stay" && snap.exists ? (await t.get(db.collection("hotelOrders").where("stayId", "==", id))).docs : [];
  const dup = dupId ? await t.get(db.doc(`hotelPayments/${dupId}`)) : null;
  return { kind, ref, snap, orders, dup };
}
type Written = { late: boolean; entryId?: string; label: string };
export function writeSettle(t: Transaction, db: Firestore, r: Read, s: Settlement, now: Date, opts: { online: boolean; payerUid?: string } = { online: false }): Written {
  const d = r.snap.data() as Record<string, unknown>;
  if (!d) throw new HotelError(404, "Not found.");
  const at = iso(now);
  const label = r.kind === "booking" ? `${d.roomName}, ${d.checkIn} to ${d.checkOut}` : r.kind === "order" ? `${d.number} (${d.deptName})` : `Room ${d.unit} bill`;
  if (r.dup?.exists) return { late: false, label }; // this exact payment was applied already
  const ownerUid = String(d.ownerUid);
  if (r.dup) t.create(r.dup.ref, { provider: s.provider, ref: s.ref, kind: r.kind, id: r.ref.id, amountKobo: s.amountKobo, at, by: s.by });
  const due = dueOf(r);
  // Late, or not enough, or already paid: kept and flagged, never applied.
  if (!payable(r.kind, d, now) || s.amountKobo < due || due <= 0) {
    if (r.kind === "stay") throw new HotelError(409, "That bill is already settled.");
    t.update(r.ref, { late: { amountKobo: s.amountKobo, provider: s.provider, ref: s.ref, at, state: "open" } });
    return { late: true, label };
  }
  const base = { ownerUid, kind: "sale" as const, source: (opts.online ? "online" : "walkin") as "online" | "walkin", on: lagosDay(now), at, by: s.by, method: s.method, owesKobo: 0, settledKobo: 0, open: false, files: [], counts: false };
  let lines: Line[] = [];
  let entryId = `hotel_${r.ref.id}`;
  if (r.kind === "booking") {
    t.update(r.ref, { status: "confirmed", paidAt: at, paidVia: s.via, paymentRef: s.ref });
    lines = [{ title: `${d.roomName}, ${d.nights} night${d.nights === 1 ? "" : "s"} (${d.checkIn})`, qty: Number(d.nights) || 1, unitKobo: Number(d.unitPriceKobo) || 0, costKobo: 0, noCost: true }];
  } else if (r.kind === "order") {
    t.update(r.ref, { status: "paid", paidAt: at, paidVia: s.via, paymentRef: s.ref });
    lines = ((d.lines as Order["lines"]) ?? []).map((l) => ({ title: l.name, qty: l.qty, unitKobo: l.unitKobo, costKobo: 0, noCost: true }));
  } else {
    // The room bill at checkout: the room (if it wasn't paid ahead) and every order on the bill, settled together.
    entryId = `hotel_stay_${r.ref.id}`;
    if (Number(d.roomDueKobo) > 0) lines.push({ title: `${d.roomName}, room ${d.unit}`, qty: 1, unitKobo: Number(d.roomDueKobo), costKobo: 0, noCost: true });
    for (const o of r.orders) {
      const x = o.data() as Order;
      if (x.payMethod !== "room_bill" || x.billSettledAt || x.status === "cancelled") continue;
      t.update(o.ref, { billSettledAt: at, paidVia: s.via });
      for (const l of x.lines) lines.push({ title: `${l.name} (${x.number})`, qty: l.qty, unitKobo: l.unitKobo, costKobo: 0, noCost: true });
    }
    t.update(r.ref, { roomDueKobo: 0, settledKobo: (Number(d.settledKobo) || 0) + s.amountKobo, settledVia: s.via, settledAt: at });
  }
  const totalKobo = lines.reduce((n, l) => n + l.qty * l.unitKobo, 0);
  const gap = s.amountKobo - totalKobo;
  if (gap) lines.push({ title: gap > 0 ? "Paid over the bill" : "Discount", qty: 1, unitKobo: gap, costKobo: 0, noCost: true });
  t.set(db.doc(`bookEntries/${entryId}`), { ...base, lines, totalKobo: s.amountKobo, paidKobo: s.amountKobo, partyName: String(d.guestName || "Hotel guest"), note: `Hotel: ${label}`, extRef: `hotel:${r.kind}:${r.ref.id}` });
  return { late: false, entryId, label };
}

// ---- Paying online: Paystack, or an account number (Paylony, add-on) ----
type Deps = { init: typeof initializeTransaction; account: typeof createCheckoutAccount; paylony: () => boolean };
const liveDeps: Deps = { init: initializeTransaction, account: createCheckoutAccount, paylony: paylonyConfigured };
const pick = (body: unknown, keys: string[]): string => {
  const layers = [body, (body as { data?: unknown })?.data].filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  for (const l of layers) for (const k of keys) if (l[k] !== undefined && l[k] !== null && l[k] !== "") return String(l[k]);
  return "";
};
export const guestUrl = (code: string) => `${SITE_URL}/hotel/${code}`;
export async function startPay(db: Firestore, raw: { target?: unknown; id?: unknown; code?: unknown; method?: unknown; email?: unknown }, uid: string | undefined, now = new Date(), deps: Deps = liveDeps) {
  const kind = raw.target === "booking" || raw.target === "order" || raw.target === "stay" ? raw.target : null;
  if (!kind) throw new HotelError(400, "Pay for what?");
  const snap = await db.doc(`${col[kind]}/${String(raw.id ?? "x").replace(/\//g, "")}`).get();
  const d = snap.data() as (Booking & Order & Stay) | undefined;
  // The guest's own code proves it's theirs: nobody pays (or reads) another guest's booking by guessing its id.
  if (!d || d.code !== String(raw.code ?? "").toUpperCase()) throw new HotelError(404, "That booking or order wasn't found.");
  const found = await hotelById(db, d.hotelId);
  if (!found) throw new HotelError(404, "Hotel not found.");
  let due = Number(d.totalKobo) || 0;
  if (kind === "stay") {
    if (!d.open) throw new HotelError(409, "That bill is already settled.");
    due = billOwed(d.roomDueKobo, (await db.collection("hotelOrders").where("stayId", "==", snap.id).get()).docs.map((o) => o.data() as Order));
    if (due <= 0) throw new HotelError(409, "There's nothing to pay on this bill.");
  } else if (!payable(kind, d as unknown as Record<string, unknown>, now)) throw new HotelError(409, ["confirmed", "paid", "checked_in"].includes(String(d.status)) ? "That's paid already. Thank you." : "The hold on this has run out. Book or order again.");
  if (kind === "booking" && d.payMethod === "desk") throw new HotelError(409, "This booking is paid at the front desk.");
  const method = raw.method === "transfer" ? "transfer" : "online";
  const email = String(raw.email ?? d.email ?? "").trim().toLowerCase() || (kind === "stay" ? "" : d.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HotelError(400, "Enter your email address for the receipt.");
  const owner = (await db.doc(`users/${found.hotel.ownerUid}`).get()).data() ?? {};
  const reference = newReference();
  const label = kind === "booking" ? `${d.roomName}, ${d.checkIn} to ${d.checkOut}` : kind === "order" ? `${d.number} (${d.deptName})` : `Room ${d.unit} bill`;
  const info: HotelPayInfo = { target: kind, id: snap.id, hotelId: found.hotel.id, label, code: d.code };
  const record = {
    reference, kind: "hotel", uid: uid ?? "", email, amountKobo: due, status: "pending", publisherUid: found.hotel.ownerUid, publisherUsername: String(owner.username ?? ""),
    commissionRate: physicalCommissionRateFor(planOf(owner) as AccountTier, owner.customRates), hotel: info, createdAt: iso(now),
  };
  if (method === "transfer") {
    if (!deps.paylony() || !addonOn(found.hotel.addons, "account", now)) throw new HotelError(409, "Paying by transfer to an account number isn't set up at this hotel. Pay by card, bank or USSD.");
    const r = await deps.account({ name: String(d.guestName || found.hotel.name), email, amount: (due / 100).toFixed(2), reference, phone: String(d.phone ?? ""), title: found.hotel.name, description: label });
    const account = { accountNumber: pick(r.body, ["account_number", "accountNumber"]), bankName: pick(r.body, ["bank_name", "bankName", "bank"]), accountName: pick(r.body, ["account_name", "accountName"]), expiresAt: pick(r.body, ["expiry", "expires_at", "expiresAt", "expiry_date"]) };
    if (!r.ok || !/^\d{10}$/.test(account.accountNumber)) throw new HotelError(502, "We couldn't open an account number just now. Try again, or pay by card.");
    await db.doc(`payments/${reference}`).set({ ...record, payWith: "paylony", paylony: { account } });
    await snap.ref.update({ paymentRefs: [...((d as unknown as { paymentRefs?: string[] }).paymentRefs ?? []), reference].slice(-10) });
    return { reference, amountKobo: due, account };
  }
  if (!setting("PAYSTACK_SECRET_KEY")) throw new HotelError(503, "Online payment isn't available right now. Please try again later.");
  const tx = await deps.init({ email, amountKobo: due, reference, callbackUrl: `${guestUrl(d.code)}?ref=${encodeURIComponent(reference)}`, metadata: { kind: "hotel", hotel: found.hotel.name, what: label }, channels: ["card", "bank_transfer", "ussd", "bank"] });
  await db.doc(`payments/${reference}`).set(record);
  return { reference, amountKobo: due, url: tx.authorization_url };
}

// Paylony said nothing clear yet: the payment stays pending, nothing is applied.
export class HotelNotPaid extends Error { constructor(public state: "waiting" | "failed") { super(state === "failed" ? "The transfer didn't go through." : "Waiting for the transfer to land."); } }
export async function confirmPaylonyHotel(payRef: DocumentReference, p: { reference: string; amountKobo: number }, verify = verifyCheckoutPayment) {
  const r = await verify(p.reference);
  const v = readVerify(r.body, p.amountKobo);
  await payRef.update({ "paylony.lastVerify": { at: new Date().toISOString(), state: v.state } }).catch(() => {});
  if (v.state !== "paid") throw new HotelNotPaid(v.state);
}

// Inside fulfillPayment (lib/payments.ts): read, then write. The money is ours to pay out (Paystack and Paylony collect into #NotesApp's
// accounts), so it goes into the payout ledger like a store sale; held until the guest has stayed, or a few days for orders. Late money is
// held as "disputed" until staff rebook or refund it.
type PayRec = { reference: string; amountKobo: number; commissionRate: number; uid: string; publisherUid: string; publisherUsername: string; payWith?: string; hotel?: HotelPayInfo };
export async function readHotelPay(t: Transaction, db: Firestore, p: PayRec) {
  return readSettle(t, db, p.hotel!.target, p.hotel!.id);
}
export function writeHotelPay(t: Transaction, db: Firestore, p: PayRec, r: Read, nowIso: string): HotelPayInfo {
  const now = new Date(nowIso);
  const via = p.payWith === "paylony" ? "transfer" : "card";
  const w = writeSettle(t, db, r, { provider: p.payWith === "paylony" ? "paylony" : "paystack", ref: p.reference, amountKobo: p.amountKobo, method: via === "transfer" ? "transfer" : "card", via, by: "online" }, now, { online: true, payerUid: p.uid });
  const d = r.snap.data() ?? {};
  const after = r.kind === "booking" && !w.late ? Date.parse(`${d.checkOut}T12:00:00+01:00`) + 86_400_000 : now.getTime() + booksCaps().debtHoldDays * 86_400_000;
  const commissionKobo = Math.round(p.amountKobo * p.commissionRate);
  t.set(db.doc(`ledger/${p.reference}`), {
    reference: p.reference, kind: "hotel", publisherUid: p.publisherUid, publisherUsername: p.publisherUsername, payerUid: p.uid, grossKobo: p.amountKobo, commissionKobo,
    netKobo: p.amountKobo - commissionKobo, status: w.late ? "disputed" : "held", releaseAfter: new Date(Math.max(after, now.getTime())).toISOString(), createdAt: nowIso,
    ...(w.late ? { failureReason: "Hotel: the payment landed late. Held until the hotel rebooks it or refunds it." } : {}),
  });
  return { ...p.hotel!, late: w.late, ...(w.entryId ? { entryId: w.entryId } : {}) };
}

// ---- At the counter: cash, a card on the machine (keyed in), or a transfer the cashier saw land ----
export async function settleCounter(db: Firestore, who: { ctx?: Ctx; till?: TillCtx }, raw: { target?: unknown; id?: unknown; method?: unknown }, now = new Date()) {
  const kind = raw.target === "booking" || raw.target === "order" || raw.target === "stay" ? raw.target : null;
  if (!kind) throw new HotelError(400, "Settle what?");
  const method: Method = raw.method === "pos" ? "pos" : raw.method === "transfer" ? "transfer" : "cash";
  const id = String(raw.id ?? "x").replace(/\//g, "");
  const hotelId = who.ctx?.hotel.id ?? who.till?.hotel.id;
  if (who.ctx && !roleCan(who.ctx.role, kind === "order" ? "orders" : "stays")) throw new HotelError(403, "Your role at this hotel can't take payments.");
  if (who.ctx?.role === "department") throw new HotelError(403, "Payments at the counter are taken on a till or at the front desk.");
  const by = who.till ? `${who.till.till.name} · ${who.till.cashier}` : who.ctx!.actor;
  const res = await db.runTransaction(async (t) => {
    const r = await readSettle(t, db, kind, id, `counter_${kind}_${id}`);
    const d = r.snap.data();
    if (!d || d.hotelId !== hotelId) throw new HotelError(404, "Not found.");
    if (who.till && (kind !== "order" || d.tillId !== who.till.till.id)) throw new HotelError(403, "That isn't this till's sale.");
    if (r.dup?.exists) throw new HotelError(409, "That's settled already.");
    if (kind !== "stay" && !payable(kind, d, now)) throw new HotelError(409, "This can't be paid now: its hold has run out, or it's paid already.");
    const amountKobo = dueOf(r);
    if (amountKobo <= 0) throw new HotelError(409, "There's nothing to pay.");
    const w = writeSettle(t, db, r, { provider: "counter", ref: `${kind}_${id}`, amountKobo, method, via: method, by }, now);
    return { ...w, amountKobo, hotelId: String(d.hotelId) };
  });
  await afterSettle(db, kind, id, now);
  return res;
}

// ---- After a settlement (never inside the transaction): bells, stock, the guest's email, the board ----
export async function afterSettle(db: Firestore, kind: HotelPayInfo["target"], id: string, now = new Date()) {
  const snap = await db.doc(`${col[kind]}/${id}`).get();
  const d = snap.data();
  if (!d) return;
  const found = await hotelById(db, String(d.hotelId));
  if (!found) return;
  await bumpPulse(db, found.hotel.id, now);
  const h = found.hotel;
  if (d.late?.state === "open") {
    await notifyBell({ uid: h.ownerUid, type: "hotel", linkHref: `/profile/hotel?h=${h.id}&tab=bookings`, message: `Money landed late for ${kind === "booking" ? `a booking (${d.roomName})` : `order ${d.number}`}: ${naira(Number(d.late.amountKobo))}. Rebook it or refund it.` }).catch(() => {});
    return;
  }
  if (kind === "booking" && d.status === "confirmed") {
    await bookingBells(db, h, { ...(d as Booking), id }).catch(() => {});
    if (d.email) await sendEmail({ to: String(d.email), subject: `Your booking at ${h.name} is confirmed`, text: `Hello ${String(d.guestName).split(" ")[0]},\n\nYour booking is confirmed: ${d.roomName}, ${d.nights} night${d.nights === 1 ? "" : "s"}, check-in ${d.checkIn} from ${h.policy.checkIn}, check-out ${d.checkOut} by ${h.policy.checkOut}. Paid: ${naira(Number(d.totalKobo))}.\n\nCancellation: ${h.policy.cancellation}\n\nYour booking: ${guestUrl(String(d.code))}\n\n${h.name}, with #NotesApp`, action: { label: "See your booking", url: guestUrl(String(d.code)) } }).catch(() => false);
  }
  if (kind === "order" && d.status === "paid") {
    await orderBells(db, h, { ...(d as Order), id }).catch(() => {});
    await moveStock(db, found.tier, h.ownerUid, [{ ...(d as Order), id }], now);
  }
  if (kind === "stay") {
    const orders = (await db.collection("hotelOrders").where("stayId", "==", id).get()).docs.map((o) => ({ ...(o.data() as Order), id: o.id }));
    await moveStock(db, found.tier, h.ownerUid, orders.filter((o) => o.billSettledAt), now);
  }
}
// Stock goes down for menu items linked to Inventory (Standard and up), once per order: the order is claimed first.
export async function moveStock(db: Firestore, tier: Parameters<typeof hasFeature>[0], ownerUid: string, orders: (Order & { id: string })[], now: Date) {
  if (!hasFeature(tier, "inventory")) return 0;
  const owner = (await db.doc(`users/${ownerUid}`).get()).data();
  if (!owner || !inventoryAccessFor(owner as Parameters<typeof inventoryAccessFor>[0], now).ok) return 0;
  let n = 0;
  for (const o of orders) {
    const lines = o.lines.filter((l) => l.stockItemId);
    if (!lines.length || o.stockMovedAt) continue;
    const ref = db.doc(`hotelOrders/${o.id}`);
    const claimed = await db.runTransaction(async (t) => { const x = await t.get(ref); if (x.get("stockMovedAt")) return false; t.update(ref, { stockMovedAt: iso(now) }); return true; });
    if (!claimed) continue;
    const bookRef = o.payMethod === "room_bill" ? `hotel_stay_${o.stayId}` : `hotel_${o.id}`;
    for (const l of lines) {
      await bookStockMove(db, { ownerUid, itemId: l.stockItemId!, delta: -l.qty, reason: "sale", note: `Hotel ${o.number}`, by: "hotel", bookRef, at: iso(now) }).then(() => n++).catch((e) => console.error("[hotel] stock move failed", o.id, e instanceof Error ? e.message : e));
      await lowStockAlert(db, { ownerUid, itemId: l.stockItemId!, quantity: l.qty }).catch(() => {});
    }
  }
  return n;
}
// The paid step of lib/payments.ts calls this once the transaction is written.
export async function afterHotelPay(db: Firestore, p: { hotel?: HotelPayInfo }) {
  if (p.hotel) await afterSettle(db, p.hotel.target, p.hotel.id);
}

// ---- Late money: rebook (if the room or order can still be honoured) or refund ----
export async function rebookLate(c: Ctx, raw: { kind?: unknown; id?: unknown }) {
  const kind = raw.kind === "booking" ? "booking" : raw.kind === "order" ? "order" : null;
  if (!kind || !roleCan(c.role, kind === "booking" ? "bookings" : "orders") || c.role === "department") throw new HotelError(403, "Your role at this hotel can't do that.");
  const id = String(raw.id ?? "x").replace(/\//g, "");
  const ref = c.db.doc(`${col[kind]}/${id}`);
  await c.db.runTransaction(async (t) => {
    const s = await t.get(ref);
    const d = s.data() as (Booking & Order) | undefined;
    if (!d || d.hotelId !== c.hotel.id || d.late?.state !== "open") throw new HotelError(404, "Nothing late to rebook here.");
    const others = kind === "booking" ? (await t.get(c.db.collection("hotelBookings").where("roomId", "==", d.roomId).where("checkOut", ">", d.checkIn))).docs.filter((x) => x.id !== id).map((x) => x.data() as Booking) : [];
    const room = kind === "booking" ? (await t.get(c.db.doc(`hotelRooms/${d.roomId}`))).data() : null;
    const ledger = d.late.provider === "paystack" || d.late.provider === "paylony" ? await t.get(c.db.doc(`ledger/${d.late.ref}`)) : null;
    if (kind === "booking" && roomsLeft((room?.units ?? []).length, others, d.checkIn, d.checkOut, c.now) < 1) throw new HotelError(409, "That room is taken for those dates now. Refund the guest, or call them about other dates.");
    const at = iso(c.now);
    const amount = d.late.amountKobo;
    t.update(ref, { status: kind === "booking" ? "confirmed" : "paid", paidAt: at, paidVia: d.late.provider === "paylony" ? "transfer" : d.late.provider === "moniepoint" ? "moniepoint" : "card", paymentRef: d.late.ref, "late.state": "rebooked", "late.by": c.actor });
    const lines: Line[] = kind === "booking" ? [{ title: `${d.roomName}, ${d.nights} night${d.nights === 1 ? "" : "s"} (${d.checkIn})`, qty: d.nights, unitKobo: d.unitPriceKobo, costKobo: 0, noCost: true }] : d.lines.map((l) => ({ title: l.name, qty: l.qty, unitKobo: l.unitKobo, costKobo: 0, noCost: true }));
    const online = d.late.provider !== "moniepoint";
    t.set(c.db.doc(`bookEntries/hotel_${id}`), { ownerUid: c.hotel.ownerUid, kind: "sale", source: online ? "online" : "walkin", on: lagosDay(c.now), at, by: c.actor, lines, totalKobo: amount, paidKobo: amount, method: online ? (d.late.provider === "paylony" ? "transfer" : "card") : "pos", owesKobo: 0, settledKobo: 0, open: false, files: [], counts: false, partyName: d.guestName || "Hotel guest", note: "Hotel: late payment, rebooked", extRef: `hotel:${kind}:${id}` });
    if (ledger?.exists && ledger.get("status") === "disputed") t.update(ledger.ref, { status: "held", failureReason: "" });
  });
  await afterSettle(c.db, kind, id, c.now);
}
export async function refundLate(c: Ctx, raw: { kind?: unknown; id?: unknown }, refund = refundTransaction) {
  if (c.role !== "owner") throw new HotelError(403, "Only the owner refunds money.");
  const kind = raw.kind === "booking" ? "booking" : raw.kind === "order" ? "order" : null;
  if (!kind) throw new HotelError(400, "Refund what?");
  const ref = c.db.doc(`${col[kind]}/${String(raw.id ?? "x").replace(/\//g, "")}`);
  const d = (await ref.get()).data() as (Booking & Order) | undefined;
  if (!d || d.hotelId !== c.hotel.id || d.late?.state !== "open") throw new HotelError(404, "Nothing late to refund here.");
  if (d.late.provider === "paystack") {
    await refund(d.late.ref);
    await Promise.all([ref.update({ "late.state": "refunded", "late.by": c.actor }), c.db.doc(`ledger/${d.late.ref}`).update({ status: "refunded" }).catch(() => {}), c.db.doc(`payments/${d.late.ref}`).update({ status: "refunded" }).catch(() => {})]);
    return { state: "refunded" as const };
  }
  // A transfer (Paylony) or a card machine: our team sends it back by hand, so it reaches them as a request.
  await ref.update({ "late.state": "refund_requested", "late.by": c.actor });
  await c.db.collection("leads").add({ name: c.hotel.name, email: "", category: "payments", message: `Hotel kit: refund a late payment of ${naira(d.late.amountKobo)} (${d.late.provider}, reference ${d.late.ref}) for ${kind === "booking" ? `booking ${d.roomName} ${d.checkIn}` : `order ${d.number}`} at ${c.hotel.name}. Guest: ${d.guestName}, ${d.phone}.`, status: "new", createdAt: iso(c.now), uid: c.actor });
  return { state: "refund_requested" as const };
}

export const providers = () => ({ paystack: !!setting("PAYSTACK_SECRET_KEY"), paylony: paylonyConfigured() });
export const describeTarget = (o: Order) => `${o.number}, ${targetText(o.target)}`;
