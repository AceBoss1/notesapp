import type { Firestore, Transaction } from "firebase-admin/firestore";
import {
  BONUS_DAYS, EMPTY_WALLET, bonusAllowedFor, applySpend, bonusBalance, liveLots, nairaOf, refundSplit, settleSplit, splitSpend,
  type BonusLot, type Wallet, type WalletHold, type WalletTx,
} from "./wallet";
import type { PaymentRecord } from "./payments";

// Server-only. wallets/{uid} holds the balance; walletTx/{id} is the member's statement. Browsers may read their own, never write.

export class WalletError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const walletDoc = (db: Firestore, uid: string) => db.doc(`wallets/${uid}`);
export function walletOf(data: FirebaseFirestore.DocumentData | undefined): Wallet {
  if (!data) return { ...EMPTY_WALLET, bonusLots: [] };
  return {
    creditKobo: Number.isInteger(data.creditKobo) ? data.creditKobo : 0,
    bonusLots: Array.isArray(data.bonusLots) ? (data.bonusLots as BonusLot[]).filter((l) => l && Number.isInteger(l.kobo) && typeof l.expiresAt === "string") : [],
  };
}

// The bonus lots that ran out since the wallet was last written, as one statement line (written alongside the change).
function expiredLine(t: Transaction, db: Firestore, uid: string, w: Wallet, now: Date) {
  const gone = w.bonusLots.filter((l) => l.kobo > 0 && Date.parse(l.expiresAt) <= now.getTime()).reduce((n, l) => n + l.kobo, 0);
  if (gone > 0) t.set(db.doc(`walletTx/exp_${uid}_${now.getTime()}`), { uid, type: "bonus_expired", creditKobo: 0, bonusKobo: -gone, label: "Bonus Credits ended", at: now.toISOString() } satisfies WalletTx);
}

export function paymentLabel(p: Pick<PaymentRecord, "kind" | "publisherUsername" | "store" | "digital" | "booking" | "gift" | "boost"> & { course?: PaymentRecord["course"]; giving?: PaymentRecord["giving"]; liveTicket?: PaymentRecord["liveTicket"]; ppm?: PaymentRecord["ppm"] }): string {
  switch (p.kind) {
    case "boost": return p.boost?.itemId ? "Boost for a store item" : "Boost for a post";
    case "ad": return "Advert campaign";
    case "badge": return "Maroon ✔ verification badge (one month)";
    case "gift": return `Gift to @${p.gift?.username ?? p.publisherUsername}`;
    case "store": return `${p.store?.itemTitle ?? "Shop item"} · @${p.publisherUsername}`;
    case "digital": return `${p.digital?.itemTitle ?? "Download"} · @${p.publisherUsername}`;
    case "life_naira": return "Notesville Naira for Notes Life";
    case "nana_credit": return "Nana AI credit";
    case "certificate": return "Notes Academy certificate";
    case "course": return `${p.course?.courseTitle ?? "Course"} · Notes Academy`;
    case "giving": return `Gift to ${p.giving?.communityName ?? "a community"}${p.giving ? ` · ${p.giving.fund}` : ""}`;
    case "live_ticket": return `Ticket: ${p.liveTicket?.eventTitle ?? "paid live"} · @${p.publisherUsername}`;
    case "ppm": return `Per-minute ${p.ppm?.kind === "video" ? "video" : "voice"} session with @${p.publisherUsername}${p.ppm ? ` · ${p.ppm.billedMinutes} min` : ""}`;
    case "booking": return `Session with @${p.booking?.username ?? p.publisherUsername}${p.booking ? ` · ${p.booking.date} ${p.booking.slot}` : ""}`;
    default: return "Payment";
  }
}
const HELD_KINDS = ["store", "booking", "digital", "course", "live_ticket", "ppm"];

// Pays a checkout from the wallet: takes the money and writes the payment record in one step, so either both happen or neither.
// The caller then runs fulfillPayment(reference), which skips Paystack for wallet payments.
export async function payFromWallet(db: Firestore, record: PaymentRecord, now = new Date()): Promise<{ creditKobo: number; bonusKobo: number }> {
  const ref = walletDoc(db, record.uid);
  const payRef = db.doc(`payments/${record.reference}`);
  return db.runTransaction(async (t) => {
    const [ws, ps] = await Promise.all([t.get(ref), t.get(payRef)]);
    if (ps.exists) throw new WalletError(409, "This payment has already started.");
    const w = walletOf(ws.data());
    const bonusOk = bonusAllowedFor(record.kind);
    const split = splitSpend(w, record.amountKobo, bonusOk, now);
    if (!split) {
      const bonus = bonusBalance(w, now);
      const usable = w.creditKobo + (bonusOk ? bonus : 0);
      throw new WalletError(402, `Not enough in your wallet: this costs ${nairaOf(record.amountKobo)} and you have ${nairaOf(usable)} you can use here${!bonusOk && bonus ? ` (Bonus Credits can't be used for this)` : ""}. Top up, or pay by card.`);
    }
    expiredLine(t, db, record.uid, w, now);
    const next = applySpend(w, split, now);
    t.set(ref, { ...next, updatedAt: now.toISOString() });
    t.set(payRef, { ...record, payWith: "wallet", walletDebit: { creditKobo: split.creditKobo, bonusKobo: split.bonusKobo } });
    t.set(db.doc(`walletTx/${record.reference}_spend`), {
      uid: record.uid, type: "spend", creditKobo: -split.creditKobo, bonusKobo: -split.bonusKobo, label: paymentLabel(record),
      reference: record.reference, kind: record.kind, ...(HELD_KINDS.includes(record.kind) ? { held: true } : {}), at: now.toISOString(),
    } satisfies WalletTx);
    return { creditKobo: split.creditKobo, bonusKobo: split.bonusKobo };
  });
}

// Inside fulfillPayment's transaction for a paid top-up: adds the credit and its bonus. Reads first (t.get), then writes.
export async function creditTopup(t: Transaction, db: Firestore, p: PaymentRecord, now: Date): Promise<void> {
  const ref = walletDoc(db, p.uid);
  const w = walletOf((await t.get(ref)).data());
  const bonusKobo = p.topup?.bonusKobo ?? 0;
  const lots = liveLots(w, now);
  if (bonusKobo > 0) lots.push({ id: p.reference, kobo: bonusKobo, expiresAt: new Date(now.getTime() + BONUS_DAYS * 86_400_000).toISOString(), source: "topup" });
  expiredLine(t, db, p.uid, w, now);
  t.set(ref, { creditKobo: w.creditKobo + p.amountKobo, bonusLots: lots, updatedAt: now.toISOString() });
  t.set(db.doc(`walletTx/${p.reference}_topup`), {
    uid: p.uid, type: "topup", creditKobo: p.amountKobo, bonusKobo, label: p.payWith === "cardtap" ? "Top-up via CardTap" : "Top-up via Paystack", reference: p.reference, kind: "wallet_topup", at: now.toISOString(),
  } satisfies WalletTx);
}

// Referral and affiliate earnings taken as NotesApp Credit (lib/referrals-server.ts withdraw): the earnings as credit, and the 10%
// on top as Bonus Credits. Inside the caller's transaction, which has made no writes yet.
export async function creditEarnings(t: Transaction, db: Firestore, uid: string, creditKobo: number, bonusKobo: number, id: string, now: Date): Promise<void> {
  const ref = walletDoc(db, uid);
  const w = walletOf((await t.get(ref)).data());
  const lots = liveLots(w, now);
  if (bonusKobo > 0) lots.push({ id, kobo: bonusKobo, expiresAt: new Date(now.getTime() + BONUS_DAYS * 86_400_000).toISOString(), source: "adjust" });
  expiredLine(t, db, uid, w, now);
  t.set(ref, { creditKobo: w.creditKobo + creditKobo, bonusLots: lots, updatedAt: now.toISOString() });
  t.set(db.doc(`walletTx/${id}`), { uid, type: "topup", creditKobo, bonusKobo, label: "Referral earnings", reference: id, kind: "referral", at: now.toISOString() } satisfies WalletTx);
}

// A refund of a wallet payment (all of it when amountKobo is left out) goes back to the wallet, the bonus share as a new bonus lot.
export async function refundToWallet(db: Firestore, reference: string, amountKobo?: number, label?: string, now = new Date()): Promise<number> {
  const payRef = db.doc(`payments/${reference}`);
  return db.runTransaction(async (t) => {
    const p = (await t.get(payRef)).data() as (PaymentRecord & { walletRefundedKobo?: number }) | undefined;
    if (!p || p.payWith !== "wallet" || !p.walletDebit) throw new WalletError(404, "That isn't a wallet payment.");
    const ref = walletDoc(db, p.uid);
    const w = walletOf((await t.get(ref)).data());
    const back = refundSplit(p.walletDebit, p.walletRefundedKobo ?? 0, amountKobo);
    const total = back.creditKobo + back.bonusKobo;
    if (!total) return 0;
    const lots = liveLots(w, now);
    if (back.bonusKobo > 0) lots.push({ id: `${reference}_r${now.getTime()}`, kobo: back.bonusKobo, expiresAt: new Date(now.getTime() + BONUS_DAYS * 86_400_000).toISOString(), source: "refund" });
    expiredLine(t, db, p.uid, w, now);
    t.set(ref, { creditKobo: w.creditKobo + back.creditKobo, bonusLots: lots, updatedAt: now.toISOString() });
    t.update(payRef, { walletRefundedKobo: (p.walletRefundedKobo ?? 0) + total });
    t.set(db.doc(`walletTx/${reference}_refund_${now.getTime()}`), {
      uid: p.uid, type: "refund", creditKobo: back.creditKobo, bonusKobo: back.bonusKobo, label: label ?? `Refund: ${paymentLabel(p)}`, reference, kind: p.kind, at: now.toISOString(),
    } satisfies WalletTx);
    return total;
  });
}

// A card payment given back as NotesApp Credit instead of to the card (a paid live the host cancelled or never started: owner, 3 Nov
// 2026, "everyone is refunded to their NotesApp Credit automatically"). The whole amount, once (creditRefundedKobo); returns what went back.
export async function refundCardToCredit(db: Firestore, reference: string, label?: string, now = new Date()): Promise<number> {
  const payRef = db.doc(`payments/${reference}`);
  return db.runTransaction(async (t) => {
    const p = (await t.get(payRef)).data() as (PaymentRecord & { creditRefundedKobo?: number }) | undefined;
    if (!p || p.payWith === "wallet") throw new WalletError(404, "That isn't a card payment.");
    if (p.creditRefundedKobo) return 0;
    const ref = walletDoc(db, p.uid);
    const w = walletOf((await t.get(ref)).data());
    expiredLine(t, db, p.uid, w, now);
    t.set(ref, { creditKobo: w.creditKobo + p.amountKobo, bonusLots: liveLots(w, now), updatedAt: now.toISOString() });
    t.update(payRef, { creditRefundedKobo: p.amountKobo });
    t.set(db.doc(`walletTx/${reference}_credit_${now.getTime()}`), {
      uid: p.uid, type: "refund", creditKobo: p.amountKobo, bonusKobo: 0, label: label ?? `Refund: ${paymentLabel(p)}`, reference, kind: p.kind, at: now.toISOString(),
    } satisfies WalletTx);
    return p.amountKobo;
  });
}

// ── Holds (lib/wallet.ts WalletHold; pay-per-minute sessions, lib/ppm-server.ts) ──
// Both run inside the caller's transaction, after all its reads: pass the wallet and the hold as read there. Credit only, never Bonus
// Credits. The statement shows a "hold" line when credit is set aside and a "release" line for what comes back.
export const holdDoc = (db: Firestore, id: string) => db.doc(`walletHolds/${id}`);
// Sets credit aside (or adds to a hold that's still open). Throws WalletError 402 when the credit doesn't cover it.
export function placeHold(t: Transaction, db: Firestore, a: { uid: string; wallet: FirebaseFirestore.DocumentData | undefined; holdId: string; hold: WalletHold | undefined; kobo: number; kind: string; label: string; reference?: string; now: Date }): WalletHold {
  if (!Number.isInteger(a.kobo) || a.kobo <= 0) throw new WalletError(400, "Nothing to hold.");
  if (a.hold && (a.hold.status !== "held" || a.hold.uid !== a.uid)) throw new WalletError(409, "That hold is already settled.");
  const w = walletOf(a.wallet);
  if (w.creditKobo < a.kobo) {
    const bonus = bonusBalance(w, a.now);
    throw new WalletError(402, `Not enough NotesApp Credit: this holds ${nairaOf(a.kobo)} and you have ${nairaOf(w.creditKobo)}${bonus ? ` (Bonus Credits can't be used for this)` : ""}. Top up your wallet first.`);
  }
  expiredLine(t, db, a.uid, w, a.now);
  t.set(walletDoc(db, a.uid), { creditKobo: w.creditKobo - a.kobo, bonusLots: liveLots(w, a.now), updatedAt: a.now.toISOString() });
  const next: WalletHold = a.hold
    ? { ...a.hold, kobo: a.hold.kobo + a.kobo }
    : { uid: a.uid, kobo: a.kobo, status: "held", kind: a.kind, label: a.label, createdAt: a.now.toISOString() };
  t.set(holdDoc(db, a.holdId), next);
  t.set(db.doc(`walletTx/${a.holdId}_hold_${a.now.getTime()}`), {
    uid: a.uid, type: "hold", creditKobo: -a.kobo, bonusKobo: 0, label: a.hold ? `More held: ${a.label}` : `Held: ${a.label}`, reference: a.reference ?? a.holdId, kind: a.kind, held: true, at: a.now.toISOString(),
  } satisfies WalletTx);
  return next;
}
// Settles an open hold: chargeKobo (capped at the hold) is kept, the rest goes back to credit. Returns what was charged and released, or
// null when the hold was already settled (safe to run twice).
export function settleHold(t: Transaction, db: Firestore, a: { wallet: FirebaseFirestore.DocumentData | undefined; holdId: string; hold: WalletHold | undefined; chargeKobo: number; label: string; reference?: string; now: Date }): { chargedKobo: number; releasedKobo: number } | null {
  if (!a.hold || a.hold.status !== "held") return null;
  const split = settleSplit(a.hold.kobo, a.chargeKobo);
  const w = walletOf(a.wallet);
  if (split.releasedKobo > 0) {
    expiredLine(t, db, a.hold.uid, w, a.now);
    t.set(walletDoc(db, a.hold.uid), { creditKobo: w.creditKobo + split.releasedKobo, bonusLots: liveLots(w, a.now), updatedAt: a.now.toISOString() });
  }
  t.set(holdDoc(db, a.holdId), { ...a.hold, status: "settled", chargedKobo: split.chargedKobo, releasedKobo: split.releasedKobo, settledAt: a.now.toISOString() });
  t.set(db.doc(`walletTx/${a.holdId}_release`), {
    uid: a.hold.uid, type: "release", creditKobo: split.releasedKobo, bonusKobo: 0, label: a.label, reference: a.reference ?? a.holdId, kind: a.hold.kind, at: a.now.toISOString(),
  } satisfies WalletTx);
  return split;
}

// Adds Bonus Credits to a wallet inside the caller's transaction (Notes Life invites). Pass the wallet as read in that transaction.
// kind: what it's for in the wallet's history ("life_referral" for Notes Life invites, "referral_milestone" for referral milestones).
export function grantBonus(t: Transaction, db: Firestore, uid: string, walletData: FirebaseFirestore.DocumentData | undefined, kobo: number, label: string, id: string, now = new Date(), kind = "life_referral") {
  const w = walletOf(walletData);
  expiredLine(t, db, uid, w, now);
  const lots = liveLots(w, now);
  lots.push({ id, kobo, expiresAt: new Date(now.getTime() + BONUS_DAYS * 86_400_000).toISOString(), source: "adjust" });
  t.set(walletDoc(db, uid), { creditKobo: w.creditKobo, bonusLots: lots, updatedAt: now.toISOString() });
  t.set(db.doc(`walletTx/${id}`), { uid, type: "bonus", creditKobo: 0, bonusKobo: kobo, label, kind, at: now.toISOString() } satisfies WalletTx);
}

// Taking a top-up back out (an admin refunding it to the card): only the unspent part of it, and its bonus goes with it.
export async function reverseTopup(db: Firestore, reference: string, amountKobo: number | undefined, now = new Date()): Promise<{ kobo: number; lot?: BonusLot }> {
  const payRef = db.doc(`payments/${reference}`);
  return db.runTransaction(async (t) => {
    const p = (await t.get(payRef)).data() as (PaymentRecord & { topupReversedKobo?: number }) | undefined;
    if (!p || p.kind !== "wallet_topup") throw new WalletError(404, "That isn't a top-up.");
    const ref = walletDoc(db, p.uid);
    const w = walletOf((await t.get(ref)).data());
    const amt = Math.min(amountKobo ?? p.amountKobo, p.amountKobo - (p.topupReversedKobo ?? 0));
    if (amt <= 0) return { kobo: 0 };
    if (w.creditKobo < amt) throw new WalletError(409, `Only ${nairaOf(w.creditKobo)} of this member's credit is unspent, so at most that can be refunded.`);
    // Its bonus goes with it: up to the bonus this top-up gave, taken from what bonus is left (that top-up's own lot first).
    const owed = Math.round(((p.topup?.bonusKobo ?? 0) * amt) / p.amountKobo);
    const ordered = [...liveLots(w, now)].sort((x, y) => (x.id === reference ? -1 : y.id === reference ? 1 : x.expiresAt.localeCompare(y.expiresAt)));
    let take = owed;
    const kept = ordered.map((l) => { const cut = Math.min(l.kobo, take); take -= cut; return { ...l, kobo: l.kobo - cut }; }).filter((l) => l.kobo > 0);
    const taken = owed - take;
    const lot: BonusLot | undefined = taken > 0 ? { id: `${reference}_back`, kobo: taken, expiresAt: new Date(now.getTime() + BONUS_DAYS * 86_400_000).toISOString(), source: "adjust" } : undefined;
    expiredLine(t, db, p.uid, w, now);
    t.set(ref, { creditKobo: w.creditKobo - amt, bonusLots: kept, updatedAt: now.toISOString() });
    t.update(payRef, { topupReversedKobo: (p.topupReversedKobo ?? 0) + amt });
    t.set(db.doc(`walletTx/${reference}_reverse_${now.getTime()}`), {
      uid: p.uid, type: "topup_refund", creditKobo: -amt, bonusKobo: -(lot?.kobo ?? 0), label: "Top-up refunded to your card", reference, kind: "wallet_topup", at: now.toISOString(),
    } satisfies WalletTx);
    return { kobo: amt, ...(lot ? { lot } : {}) };
  });
}

// Undoes reverseTopup when the card refund itself failed: the credit and bonus go back exactly as they were.
export async function restoreTopup(db: Firestore, reference: string, back: { kobo: number; lot?: BonusLot }, now = new Date()): Promise<void> {
  const payRef = db.doc(`payments/${reference}`);
  await db.runTransaction(async (t) => {
    const p = (await t.get(payRef)).data() as (PaymentRecord & { topupReversedKobo?: number }) | undefined;
    if (!p) return;
    const ref = walletDoc(db, p.uid);
    const w = walletOf((await t.get(ref)).data());
    t.set(ref, { creditKobo: w.creditKobo + back.kobo, bonusLots: [...liveLots(w, now), ...(back.lot ? [back.lot] : [])], updatedAt: now.toISOString() });
    t.update(payRef, { topupReversedKobo: Math.max(0, (p.topupReversedKobo ?? 0) - back.kobo) });
    t.set(db.doc(`walletTx/${reference}_restore_${now.getTime()}`), {
      uid: p.uid, type: "refund", creditKobo: back.kobo, bonusKobo: back.lot?.kobo ?? 0, label: "Card refund didn't go through: credit put back", reference, kind: "wallet_topup", at: now.toISOString(),
    } satisfies WalletTx);
  });
}

// For the wallet page: the balance (with expired bonus left out) and the latest statement lines.
export async function walletSummary(db: Firestore, uid: string, limit = 50, now = new Date()) {
  const [ws, txs, holds] = await Promise.all([
    walletDoc(db, uid).get(),
    limit > 0 ? db.collection("walletTx").where("uid", "==", uid).orderBy("at", "desc").limit(limit).get() : Promise.resolve(null),
    db.collection("walletHolds").where("uid", "==", uid).where("status", "==", "held").limit(50).get(),
  ]);
  const w = walletOf(ws.data());
  const lots = liveLots(w, now).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const activity = (txs?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as WalletTx) }));
  // "Held" is shown only while the seller's money is still waiting (the ledger entry of that payment), not forever.
  const heldRefs = activity.filter((a) => a.held && a.reference && a.type !== "hold").map((a) => a.reference!);
  const ledger = heldRefs.length ? await db.getAll(...heldRefs.map((r) => db.doc(`ledger/${r}`))) : [];
  const stillHeld = new Set(ledger.filter((l) => ["held", "disputed"].includes(String(l.data()?.status))).map((l) => l.id));
  return {
    creditKobo: w.creditKobo, bonusKobo: lots.reduce((n, l) => n + l.kobo, 0), bonusLots: lots,
    // Credit set aside for pay-per-minute sessions that haven't ended (not spendable until they do; unused minutes come back).
    heldKobo: holds.docs.reduce((n, d) => n + (Number(d.data().kobo) || 0), 0),
    activity: activity.map((a) => ({ ...a, held: a.type === "hold" ? holds.docs.some((d) => a.reference === d.id) : !!a.reference && stillHeld.has(a.reference) })),
  };
}
