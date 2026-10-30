import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  DiscountError, NOTESAPP_OWNER, NOTESAPP_TARGETS, cleanCodeInput, codeId, discountFor, normalizeCode,
  type CodeUse, type DiscountCode, type DiscountTarget,
} from "./discounts";

// Server-only. Discount codes (lib/discounts.ts has the rules): looking one up for a buyer at checkout, recording each use when the
// payment lands (inside fulfillPayment's transaction), and an owner's list. Collections, both server-only (firestore.rules):
//   discountCodes/{owner}_{CODE}       the code, its limits and its running totals
//   discountRedemptions/{reference}    one per paid order that used a code

// What a payment record carries when a code was used (lib/payments.ts PaymentRecord.discount).
export type PaymentDiscount = { codeId: string; code: string; owner: string; discountKobo: number; fullKobo: number };

async function buyerFacts(db: Firestore, c: DiscountCode, uid: string): Promise<{ buyerUses: number; buyerHasPaidOwner: boolean }> {
  const uses = await db.collection("discountRedemptions").where("codeId", "==", c.id).where("uid", "==", uid).count().get();
  let paid = false;
  if (c.firstOrderOnly) {
    const q = c.owner === NOTESAPP_OWNER
      ? db.collection("payments").where("uid", "==", uid).where("status", "==", "paid").where("kind", "in", [...NOTESAPP_TARGETS])
      : db.collection("payments").where("uid", "==", uid).where("status", "==", "paid").where("publisherUid", "==", c.owner);
    paid = !(await q.limit(1).get()).empty;
  }
  return { buyerUses: uses.data().count, buyerHasPaidOwner: paid };
}

// A code applied to one purchase: what it takes off, or a DiscountError the buyer sees. `owner` is the seller's uid for their
// products, NOTESAPP_OWNER for ours; a code made by anyone else simply isn't found.
export async function applyCode(
  db: Firestore, owner: string, rawCode: unknown, buyerUid: string,
  use: Omit<CodeUse, "now" | "buyerUses" | "buyerHasPaidOwner">, now = new Date(),
): Promise<{ code: DiscountCode; discountKobo: number }> {
  const code = normalizeCode(rawCode);
  if (!code) throw new DiscountError(400, "Type a code.");
  const snap = await db.doc(`discountCodes/${codeId(owner, code)}`).get();
  if (!snap.exists) throw new DiscountError(404, "That code isn't valid here.");
  const c = { ...(snap.data() as DiscountCode), id: snap.id };
  if (c.owner !== NOTESAPP_OWNER && c.owner === buyerUid) throw new DiscountError(409, "You can't use your own code.");
  const r = discountFor(c, { ...use, now, ...(await buyerFacts(db, c, buyerUid)) });
  if (!r.ok) throw new DiscountError(409, r.reason);
  return { code: c, discountKobo: r.discountKobo };
}

export const paymentDiscount = (a: { code: DiscountCode; discountKobo: number }, fullKobo: number): PaymentDiscount =>
  ({ codeId: a.code.id, code: a.code.code, owner: a.code.owner, discountKobo: a.discountKobo, fullKobo });

// Inside fulfillPayment's transaction. Firestore wants every read before any write, so this comes in two halves: read the code at
// the start, write the use at the end. The limits were checked when the checkout started; a use that lands after the code filled up
// (two buyers at once) is still honoured, since the buyer has paid the lower price, and marked so the owner can see it.
export async function readCodeForRedemption(t: Transaction, db: Firestore, d: PaymentDiscount | undefined) {
  if (!d) return null;
  const ref = db.doc(`discountCodes/${d.codeId}`);
  const snap = await t.get(ref);
  return { ref, code: snap.exists ? (snap.data() as DiscountCode) : null };
}
export function writeRedemption(
  t: Transaction, db: Firestore, read: Awaited<ReturnType<typeof readCodeForRedemption>>,
  p: { reference: string; uid: string; kind: string; amountKobo: number; publisherUid: string; discount?: PaymentDiscount }, now: string,
) {
  if (!read || !p.discount) return;
  const overUsed = !!read.code && read.code.maxUses != null && read.code.uses >= read.code.maxUses;
  t.set(db.doc(`discountRedemptions/${p.reference}`), {
    reference: p.reference, codeId: p.discount.codeId, code: p.discount.code, owner: p.discount.owner, uid: p.uid, kind: p.kind,
    sellerUid: p.publisherUid, discountKobo: p.discount.discountKobo, paidKobo: p.amountKobo, fullKobo: p.discount.fullKobo, at: now,
    ...(overUsed ? { overUsed: true } : {}),
  });
  if (read.code) {
    t.update(read.ref, {
      uses: FieldValue.increment(1), discountGivenKobo: FieldValue.increment(p.discount.discountKobo),
      revenueKobo: FieldValue.increment(p.amountKobo), lastUsedAt: now,
    });
  }
}

// ---- an owner's codes ----

export async function listCodes(db: Firestore, owner: string): Promise<DiscountCode[]> {
  const snap = await db.collection("discountCodes").where("owner", "==", owner).get();
  return snap.docs.map((d) => ({ ...(d.data() as DiscountCode), id: d.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Create a code, or change one the owner already has (the code itself, its uses and totals never change; make a new code instead).
export async function saveCode(db: Firestore, owner: string, actorUid: string, raw: Record<string, unknown>, now = new Date()): Promise<DiscountCode> {
  const input = cleanCodeInput(raw, owner === NOTESAPP_OWNER);
  const id = codeId(owner, input.code);
  const ref = db.doc(`discountCodes/${id}`);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const at = now.toISOString();
    if (snap.exists) {
      if (raw.create === true) throw new DiscountError(409, "You already have that code. Pick another, or edit the one you have.");
      const prev = snap.data() as DiscountCode;
      const next: DiscountCode = { ...prev, ...input, id, owner, code: input.code, updatedAt: at };
      if (input.kind === "percent") delete (next as Partial<DiscountCode>).amountKobo; else delete (next as Partial<DiscountCode>).percent;
      t.set(ref, next);
      return next;
    }
    const fresh: DiscountCode = { ...input, id, owner, uses: 0, discountGivenKobo: 0, revenueKobo: 0, createdAt: at, createdBy: actorUid, updatedAt: at };
    t.set(ref, fresh);
    return fresh;
  });
}

export async function setCodeActive(db: Firestore, owner: string, code: string, active: boolean): Promise<void> {
  const ref = db.doc(`discountCodes/${codeId(owner, code)}`);
  if (!(await ref.get()).exists) throw new DiscountError(404, "That code wasn't found.");
  await ref.update({ active, updatedAt: new Date().toISOString() });
}

// The last uses of an owner's codes, newest first (the owner sees amounts and dates, never who the buyer was).
export async function recentUses(db: Firestore, owner: string, limit = 50) {
  const snap = await db.collection("discountRedemptions").where("owner", "==", owner).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const r = d.data();
    return { code: String(r.code), kind: String(r.kind) as DiscountTarget, discountKobo: Number(r.discountKobo), paidKobo: Number(r.paidKobo), at: String(r.at), overUsed: r.overUsed === true };
  });
}
