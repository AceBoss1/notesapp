import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  DiscountError, NOTESAPP_OWNER, NOTESAPP_TARGETS, affiliateCodeSplits, cleanCodeInput, codeId, couponOpen, discountFor, normalizeCode,
  publicCoupon, type CodeUse, type DiscountCode, type DiscountTarget, type PublicCoupon,
} from "./discounts";
import { referrerByUsername, type Referrer } from "./referrals-server";

// Server-only. Discount codes (lib/discounts.ts has the rules): looking one up for a buyer at checkout, recording each use when the
// payment lands (inside fulfillPayment's transaction), and an owner's list. Collections, both server-only (firestore.rules):
//   discountCodes/{owner}_{CODE}       the code, its limits and its running totals
//   discountRedemptions/{reference}    one per paid order that used a code
//   savedCoupons/{uid}_{codeId}        a buyer's coupon wallet (step 3): codes they saved from a card, a shop or a link

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
// products, NOTESAPP_OWNER for ours; a code made by anyone else simply isn't found. An affiliate's code (TOLU-AMAKA10: a member's
// username and a publisher code the publisher lets affiliates share) gives the same discount and names the affiliate, whose share
// of the sale then follows the product's affiliate offer, the same as their link.
export async function applyCode(
  db: Firestore, owner: string, rawCode: unknown, buyerUid: string,
  use: Omit<CodeUse, "now" | "buyerUses" | "buyerHasPaidOwner">, now = new Date(),
): Promise<{ code: DiscountCode; discountKobo: number; affiliate?: Referrer }> {
  const code = normalizeCode(rawCode);
  if (!code) throw new DiscountError(400, "Type a code.");
  let snap = await db.doc(`discountCodes/${codeId(owner, code)}`).get();
  let affiliate: Referrer | undefined;
  if (!snap.exists && owner !== NOTESAPP_OWNER) {
    for (const split of affiliateCodeSplits(code)) {
      const s = await db.doc(`discountCodes/${codeId(owner, split.code)}`).get();
      if (!s.exists || (s.data() as DiscountCode).allowAffiliates !== true) continue;
      const ref = await referrerByUsername(db, split.username);
      if (!ref || ref.uid === owner) continue;
      snap = s; affiliate = ref;
      break;
    }
  }
  if (!snap.exists) {
    // A real code, but another store's (or #NotesApp's, at a store's checkout): say so, so the buyer knows what to do.
    const elsewhere = await db.collection("discountCodes").where("code", "==", code).limit(1).get();
    if (!elsewhere.empty) {
      throw new DiscountError(404, owner === NOTESAPP_OWNER
        ? "That coupon is from a store on #NotesApp, not for this. Input a #NotesApp coupon here."
        : elsewhere.docs[0].data().owner === NOTESAPP_OWNER
          ? "That's a #NotesApp coupon, for #NotesApp's own products. Input a coupon from this store."
          : "That coupon is from another store. Input a coupon from this store.");
    }
    throw new DiscountError(404, "That code isn't valid here.");
  }
  const c = { ...(snap.data() as DiscountCode), id: snap.id };
  if (c.owner !== NOTESAPP_OWNER && c.owner === buyerUid) throw new DiscountError(409, "You can't use your own code.");
  const r = discountFor(c, { ...use, now, ...(await buyerFacts(db, c, buyerUid)) });
  if (!r.ok) throw new DiscountError(409, r.reason);
  return { code: c, discountKobo: r.discountKobo, ...(affiliate ? { affiliate } : {}) };
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

// ---- coupons (step 3) ----

const ownerOf = async (db: Firestore, username: unknown): Promise<{ uid: string; username: string } | null> => {
  const u = String(username ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_-]{2,30}$/.test(u)) return null;
  const uid = String((await db.doc(`usernames/${u}`).get()).data()?.uid ?? "");
  return uid ? { uid, username: u } : null;
};

// The coupons a publisher shows in their shop: open codes they chose to show (optionally only those for one item).
export async function shopCoupons(db: Firestore, sellerUsername: unknown, itemId?: string, now = new Date()): Promise<PublicCoupon[]> {
  const o = await ownerOf(db, sellerUsername);
  if (!o) return [];
  return (await listCodes(db, o.uid))
    .filter((c) => c.showInShop === true && couponOpen(c, now) && (!itemId || !c.itemIds?.length || c.itemIds.includes(itemId)))
    .map((c) => publicCoupon(c, o.username));
}

// One coupon for its card (/coupon/<username>/<CODE>): any open code of that publisher's, shown or not, since its owner shared it.
export async function couponCard(db: Firestore, sellerUsername: unknown, code: unknown, now = new Date()): Promise<PublicCoupon | null> {
  const o = await ownerOf(db, sellerUsername);
  if (!o) return null;
  const snap = await db.doc(`discountCodes/${codeId(o.uid, normalizeCode(code))}`).get();
  const c = snap.exists ? ({ ...(snap.data() as DiscountCode), id: snap.id }) : null;
  return c && couponOpen(c, now) ? publicCoupon(c, o.username) : null;
}

// The codes affiliates may share, per publisher, for the affiliate marketplace (each affiliate's own code is <USERNAME>-<CODE>).
export async function affiliateCodes(db: Firestore, ownerUids: string[], now = new Date()): Promise<Record<string, PublicCoupon[]>> {
  const out: Record<string, PublicCoupon[]> = {};
  for (const uid of Array.from(new Set(ownerUids)).slice(0, 100)) {
    const username = String((await db.doc(`users/${uid}`).get()).data()?.username ?? "");
    const codes = (await listCodes(db, uid)).filter((c) => c.allowAffiliates === true && couponOpen(c, now));
    if (codes.length) out[uid] = codes.map((c) => publicCoupon(c, username));
  }
  return out;
}

// ---- a buyer's coupon wallet ----

export type SavedCoupon = PublicCoupon & { id: string; owner: string; savedAt: string; open: boolean };
export async function saveCoupon(db: Firestore, uid: string, sellerUsername: unknown, code: unknown, now = new Date()): Promise<SavedCoupon> {
  const o = await ownerOf(db, sellerUsername);
  const c = o ? await couponCard(db, o.username, code, now) : null;
  if (!o || !c) throw new DiscountError(404, "That coupon isn't available any more.");
  if (o.uid === uid) throw new DiscountError(409, "That's your own coupon.");
  const id = `${uid}_${codeId(o.uid, c.code)}`;
  const saved = { uid, owner: o.uid, ownerUsername: o.username, code: c.code, codeId: codeId(o.uid, c.code), savedAt: now.toISOString() };
  await db.doc(`savedCoupons/${id}`).set(saved);
  return { ...c, id, owner: o.uid, savedAt: saved.savedAt, open: true };
}
export async function removeCoupon(db: Firestore, uid: string, id: string): Promise<void> {
  const ref = db.doc(`savedCoupons/${id}`);
  const d = (await ref.get()).data();
  if (!d || d.uid !== uid) throw new DiscountError(404, "That coupon isn't in your list.");
  await ref.delete();
}
export async function myCoupons(db: Firestore, uid: string, now = new Date()): Promise<SavedCoupon[]> {
  const snap = await db.collection("savedCoupons").where("uid", "==", uid).limit(100).get();
  const out: SavedCoupon[] = [];
  for (const d of snap.docs) {
    const s = d.data();
    const codeSnap = await db.doc(`discountCodes/${s.codeId}`).get();
    if (!codeSnap.exists) continue;
    const c = { ...(codeSnap.data() as DiscountCode), id: codeSnap.id };
    out.push({ ...publicCoupon(c, String(s.ownerUsername)), id: d.id, owner: String(s.owner), savedAt: String(s.savedAt), open: couponOpen(c, now) });
  }
  return out.sort((a, b) => Number(b.open) - Number(a.open) || b.savedAt.localeCompare(a.savedAt));
}

// At any checkout: the coupon that takes the most off this purchase, from the buyer's saved coupons for this seller and the ones
// the seller shows to everyone (#NotesApp's for our own products). Nana picks it and the checkout applies it; the buyer can remove
// it or type another. Each candidate goes through applyCode, so every limit and the buyer's own uses count.
export type BestCoupon = { code: string; discountKobo: number; label: string; source: "saved" | "shop" };
export async function bestCoupon(
  db: Firestore, uid: string, owner: string, use: Omit<CodeUse, "now" | "buyerUses" | "buyerHasPaidOwner">, now = new Date(),
): Promise<BestCoupon | null> {
  const [saved, all] = await Promise.all([
    db.collection("savedCoupons").where("uid", "==", uid).where("owner", "==", owner).limit(30).get(),
    listCodes(db, owner),
  ]);
  const candidates = new Map<string, "saved" | "shop">();
  for (const d of saved.docs) candidates.set(String(d.data().code), "saved");
  for (const c of all) if (c.showInShop === true && couponOpen(c, now) && !candidates.has(c.code)) candidates.set(c.code, "shop");
  let best: BestCoupon | null = null;
  for (const [code, source] of candidates) {
    try {
      const r = await applyCode(db, owner, code, uid, use, now);
      if (!best || r.discountKobo > best.discountKobo) best = { code: r.code.code, discountKobo: r.discountKobo, label: publicCoupon(r.code, "").label, source };
    } catch { /* this one doesn't work here */ }
  }
  return best;
}
