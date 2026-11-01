import type { Firestore, Transaction } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { EventError, eventOf, mayManage, mayView } from "./events-server";
import { nextOccurrence } from "./events";
import { TICKETS_PER_ORDER_MAX, cleanTicketTypes, makeTicketCode, readTicketCode, ticketsLeft, type TicketDoc, type TicketType } from "./tickets";
import { commissionRateFor } from "./tiers";
import type { AccountTier } from "./users";
import type { PaymentRecord } from "./payments";

// Paid event tickets on the server (the rules are lib/tickets.ts). Buying is a payment of kind "ticket" (app/api/paystack/initialize);
// lib/payments.ts fulfillPayment calls fulfilTicketsInTransaction, which moves the sold count and writes one tickets/{code} per
// admission. The organiser's money is a "ticket" ledger entry with their usual commission, released after the event ends.

const typesRef = (db: Firestore, eventId: string) => db.doc(`eventTickets/${eventId}`);
async function typesOf(db: Firestore, eventId: string): Promise<TicketType[]> {
  return (((await typesRef(db, eventId).get()).data()?.types ?? []) as TicketType[]);
}

// The organiser (whoever can edit the event) sets the ticket types. Sold counts are kept as they are.
export async function setTicketTypes(db: Firestore, uid: string, eventId: string, raw: unknown, now = new Date()): Promise<TicketType[]> {
  const e = await eventOf(db, eventId);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the event's organiser sets its tickets.");
  if (e.cancelled) throw new EventError(409, "This event has been cancelled.");
  const list = Array.isArray(raw) ? raw : [];
  if (list.length) {
    const payout = (await db.doc(`payoutAccounts/${e.hostUid}`).get()).data();
    if (!payout?.recipientCode) throw new EventError(409, "Ticket money is paid to the bank account of the event's host. Add it first, under Rates & payouts.");
  }
  return db.runTransaction(async (t) => {
    const cur = (((await t.get(typesRef(db, eventId))).data()?.types ?? []) as TicketType[]);
    const r = cleanTicketTypes(list, cur);
    if (!r.ok) throw new EventError(400, r.error);
    t.set(typesRef(db, eventId), { eventId, hostUid: e.hostUid, types: r.types, updatedAt: now.toISOString() });
    return r.types;
  });
}

// Checks a purchase before checkout. Sold out (or not enough left) is refused here; the fulfil transaction checks again.
export async function ticketCheckout(db: Firestore, uid: string, raw: { eventId?: unknown; typeId?: unknown; quantity?: unknown }, now = new Date()) {
  const e = await eventOf(db, String(raw.eventId ?? ""));
  if (!(await mayView(db, e, uid))) throw new EventError(403, "This event is for the community's members.");
  if (e.cancelled) throw new EventError(409, "This event has been cancelled.");
  const occ = nextOccurrence(e, now);
  if (!occ || occ.end <= now) throw new EventError(409, "This event has ended.");
  if (e.hostUid === uid) throw new EventError(409, "You're the host, so you don't need a ticket.");
  const quantity = Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > TICKETS_PER_ORDER_MAX) throw new EventError(400, `Choose from 1 to ${TICKETS_PER_ORDER_MAX} tickets.`);
  const type = (await typesOf(db, e.id)).find((x) => x.id === raw.typeId);
  if (!type) throw new EventError(404, "Choose a ticket type.");
  const left = ticketsLeft(type);
  if (!left) throw new EventError(409, `${type.name} is sold out.`);
  if (left < quantity) throw new EventError(409, `Only ${left} ${type.name} ${left === 1 ? "ticket is" : "tickets are"} left.`);
  const host = (await db.doc(`users/${e.hostUid}`).get()).data();
  if (!host || host.suspended) throw new EventError(409, "This event isn't selling tickets right now.");
  const payout = (await db.doc(`payoutAccounts/${e.hostUid}`).get()).data();
  if (!payout?.recipientCode) throw new EventError(409, "The host hasn't set up payouts yet, so tickets can't be sold.");
  const buyer = (await db.doc(`users/${uid}`).get()).data();
  const info: NonNullable<PaymentRecord["ticket"]> = {
    eventId: e.id, eventTitle: e.title, typeId: type.id, typeName: type.name, quantity, unitKobo: type.priceKobo,
    startsAt: occ.start.toISOString(), endsAt: occ.end.toISOString(), holderName: String(buyer?.displayName || buyer?.username || "Guest"),
  };
  return {
    info, amountKobo: type.priceKobo * quantity, hostUid: e.hostUid, hostUsername: String(host.username ?? e.hostUsername ?? ""),
    commissionRate: commissionRateFor((host.accountTier as AccountTier) || "basic", host.customRates),
  };
}

// Reads for fulfillPayment's transaction (every read before any write): the ticket types, and fresh codes that aren't taken.
export async function readForTickets(t: Transaction, db: Firestore, p: PaymentRecord) {
  const tk = p.ticket!;
  const types = (((await t.get(typesRef(db, tk.eventId))).data()?.types ?? []) as TicketType[]);
  const codes: string[] = [];
  while (codes.length < tk.quantity) {
    const code = makeTicketCode((n) => randomBytes(n));
    if (codes.includes(code) || (await t.get(db.doc(`tickets/${code}`))).exists) continue;
    codes.push(code);
  }
  return { types, codes };
}
// The writes: false when there aren't enough left (the payment is then flagged for a refund, as a sold-out shop order is).
export function writeTickets(t: Transaction, db: Firestore, p: PaymentRecord, read: Awaited<ReturnType<typeof readForTickets>>, now: string): boolean {
  const tk = p.ticket!;
  const idx = read.types.findIndex((x) => x.id === tk.typeId);
  if (idx < 0 || ticketsLeft(read.types[idx]) < tk.quantity) return false;
  const types = read.types.map((x, i) => (i === idx ? { ...x, sold: x.sold + tk.quantity } : x));
  t.update(typesRef(db, tk.eventId), { types });
  for (const code of read.codes) {
    t.set(db.doc(`tickets/${code}`), {
      code, eventId: tk.eventId, eventTitle: tk.eventTitle, typeId: tk.typeId, typeName: tk.typeName, priceKobo: tk.unitKobo,
      holderUid: p.uid, holderName: tk.holderName, reference: p.reference, startsAt: tk.startsAt, endsAt: tk.endsAt, status: "valid", createdAt: now,
    } satisfies TicketDoc);
  }
  return true;
}

// A buyer's tickets (all, or one event's), soonest first.
export async function myTickets(db: Firestore, uid: string, eventId?: string): Promise<TicketDoc[]> {
  const snap = await db.collection("tickets").where("holderUid", "==", uid).limit(500).get();
  return snap.docs.map((d) => d.data() as TicketDoc).filter((x) => !eventId || x.eventId === eventId).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.code.localeCompare(b.code));
}

export type CheckIn =
  | { state: "valid"; name: string; type: string; at: string }
  | { state: "already"; name: string; type: string; at: string }
  | { state: "refunded"; name: string; type: string }
  | { state: "wrong_event"; event: string }
  | { state: "not_found" };

// The organiser checks a ticket in: valid (and now checked in), already checked in (and when), refunded, for another event, or not a ticket.
export async function checkIn(db: Firestore, uid: string, eventId: string, input: string, now = new Date()): Promise<CheckIn> {
  const e = await eventOf(db, eventId);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the event's organiser checks tickets in.");
  const code = readTicketCode(input);
  if (!code) return { state: "not_found" };
  const ref = db.doc(`tickets/${code}`);
  return db.runTransaction(async (t): Promise<CheckIn> => {
    const tk = (await t.get(ref)).data() as TicketDoc | undefined;
    if (!tk) return { state: "not_found" };
    if (tk.eventId !== eventId) return { state: "wrong_event", event: tk.eventTitle };
    if (tk.status === "refunded") return { state: "refunded", name: tk.holderName, type: tk.typeName };
    if (tk.checkedInAt) return { state: "already", name: tk.holderName, type: tk.typeName, at: tk.checkedInAt };
    const at = now.toISOString();
    t.update(ref, { checkedInAt: at, checkedInBy: uid });
    return { state: "valid", name: tk.holderName, type: tk.typeName, at };
  });
}

// For the check-in page: how many are sold and in, by type.
export async function checkInStats(db: Firestore, uid: string, eventId: string) {
  const e = await eventOf(db, eventId);
  if (!(await mayManage(db, e, uid))) throw new EventError(403, "Only the event's organiser checks tickets in.");
  const snap = await db.collection("tickets").where("eventId", "==", eventId).limit(20000).get();
  const valid = snap.docs.map((d) => d.data() as TicketDoc).filter((x) => x.status === "valid");
  const byType = new Map<string, { type: string; sold: number; in: number }>();
  for (const x of valid) {
    const r = byType.get(x.typeName) ?? { type: x.typeName, sold: 0, in: 0 };
    r.sold++; if (x.checkedInAt) r.in++;
    byType.set(x.typeName, r);
  }
  return { title: e.title, sold: valid.length, in: valid.filter((x) => x.checkedInAt).length, byType: [...byType.values()] };
}

// A refunded ticket purchase: its tickets stop being valid and go back on sale.
export async function voidTicketsFor(db: Firestore, reference: string) {
  const snap = await db.collection("tickets").where("reference", "==", reference).get();
  const live = snap.docs.filter((d) => d.data().status === "valid");
  if (!live.length) return;
  const eventId = String(live[0].data().eventId), typeId = String(live[0].data().typeId);
  await db.runTransaction(async (t) => {
    const ref = typesRef(db, eventId);
    const types = (((await t.get(ref)).data()?.types ?? []) as TicketType[]);
    const fresh = await Promise.all(live.map((d) => t.get(d.ref)));
    const still = fresh.filter((d) => d.data()?.status === "valid");
    if (types.length) t.update(ref, { types: types.map((x) => (x.id === typeId ? { ...x, sold: Math.max(0, x.sold - still.length) } : x)) });
    for (const d of still) t.update(d.ref, { status: "refunded" });
  });
}
