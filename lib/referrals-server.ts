import type { Firestore, Transaction } from "firebase-admin/firestore";

import { getAuth } from "firebase-admin/auth";
import { createSubscription, refundTransaction } from "./paystack";
import {
  HOLD_DAYS, MIN_CASH_KOBO, PLAN_SHARE, affiliateKobo, cleanAffiliatePercent, creditWithBonus, isAvailable, jumpAlert, planEarningKobo, withinPlanWindow,
  type Earning, type EarningSource,
} from "./referrals";

// Server-only. Referrals and affiliates (lib/referrals.ts has the rules). Collections, all server-only (firestore.rules):
//   referrals/{uid}                                       who brought this member, when, when they first paid for a plan, and
//                                                         whether they've had the first-month offer (never on the public profile)
//   referralEarnings/{plan_<ref> | prod_<ref>}            one earning per payment (Earning)
//   referralWithdrawals/{id}                              cash (a ledger entry the usual payouts send) or NotesApp Credit with the bonus
export class ReferralError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Referrer = { uid: string; username: string };

// The member a link (or the referral cookie) names, if they can earn: a real, unsuspended account with a verified email, not a
// child profile or in teen mode, and never the buyer themselves.
export async function referrerByUsername(db: Firestore, username: unknown, notUid?: string): Promise<Referrer | null> {
  const u = String(username ?? "").toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(u)) return null;
  const uid = String((await db.doc(`usernames/${u}`).get()).data()?.uid ?? "");
  if (!uid || uid === notUid) return null;
  const d = (await db.doc(`users/${uid}`).get()).data();
  if (!d || d.suspended === true || d.teen === true || d.kid === true) return null;
  const verified = await getAuth().getUser(uid).then((x) => x.emailVerified === true).catch(() => false);
  return verified ? { uid, username: u } : null;
}

// ---- who brought a new member ----

// Recorded once, for an account a week old at most that has never paid for a plan, and never for yourself.
export async function claimReferral(db: Firestore, uid: string, refUsername: unknown, now = new Date()): Promise<{ claimed: boolean; reason?: string }> {
  const ref = await referrerByUsername(db, refUsername, uid);
  if (!ref) return { claimed: false, reason: "no-referrer" };
  const userRef = db.doc(`users/${uid}`), refDoc = db.doc(`referrals/${uid}`);
  return db.runTransaction(async (t) => {
    const [u, r] = [(await t.get(userRef)).data(), await t.get(refDoc)];
    if (!u) return { claimed: false, reason: "no-account" };
    if (r.exists) return { claimed: false, reason: "already" };
    if (u.lastPaidAt || u.teen === true || u.kid === true) return { claimed: false, reason: "not-new" };
    const created = Date.parse(String(u.createdAt ?? ""));
    if (!Number.isFinite(created) || now.getTime() - created > 7 * 86_400_000) return { claimed: false, reason: "too-old" };
    t.set(refDoc, { uid, referredBy: ref.uid, referredByUsername: ref.username, referredAt: now.toISOString() });
    return { claimed: true };
  });
}

// A member's referral code, typed at a plan's checkout instead of following their link: the code is their username. It records
// the referral the same way the link does (a week-old account at most, never paid for a plan), and wins over a link clicked
// earlier as long as nothing has been recorded yet. Returns the referrer, or throws ReferralError with what the buyer sees.
export async function referralByCode(db: Firestore, uid: string, code: unknown, now = new Date()): Promise<Referrer> {
  const ref = await referrerByUsername(db, String(code ?? "").trim().toLowerCase().replace(/^@/, ""), uid);
  if (!ref) throw new ReferralError(404, "That code isn't valid here.");
  const r = await claimReferral(db, uid, ref.username, now);
  if (r.claimed) return ref;
  if (r.reason === "already") {
    const by = (await db.doc(`referrals/${uid}`).get()).data()?.referredBy;
    if (by === ref.uid) return ref;
    throw new ReferralError(409, "You joined through someone else's invitation, so their offer is the one you have.");
  }
  if (r.reason === "too-old") throw new ReferralError(409, "Referral codes are for new accounts, in their first week.");
  throw new ReferralError(409, "Referral codes are for members who haven't had a plan before.");
}

// A referred friend's first plan: the free month (or a month off a year) only before they've ever paid for one.
export async function referralOfferFor(db: Firestore, uid: string): Promise<{ referrerUid: string; referrerUsername: string } | null> {
  const [u, r, sub] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`referrals/${uid}`).get(), db.doc(`tierSubscriptions/${uid}`).get()]);
  const d = r.data();
  if (!d?.referredBy || u.data()?.lastPaidAt || d.offerUsed === true || sub.exists) return null;
  return { referrerUid: String(d.referredBy), referrerUsername: String(d.referredByUsername ?? "") };
}

// ---- earnings ----

const createIfNew = async (db: Firestore, e: Earning) => {
  try { await db.doc(`referralEarnings/${e.id}`).create(e); return true; }
  catch (err) { if ((err as { code?: number }).code === 6) return false; throw err; } // already recorded (ALREADY_EXISTS)
};

// After a real plan payment (the first one, or a renewal): PLAN_SHARE to whoever brought the payer, for PLAN_MONTHS from the
// payer's first real plan payment. The free month's card check is not a real payment and never reaches here.
export async function recordPlanEarning(db: Firestore, payerUid: string, reference: string, paidKobo: number, title: string, now = new Date()): Promise<Earning | null> {
  const refDoc = db.doc(`referrals/${payerUid}`);
  const u = (await refDoc.get()).data();
  if (!u?.referredBy || paidKobo <= 0) return null;
  if (!withinPlanWindow(u.paidSince, now)) return null;
  if (!u.paidSince) await refDoc.update({ paidSince: now.toISOString() });
  const e: Earning = {
    id: `plan_${reference}`, uid: String(u.referredBy), source: "plan", paymentReference: reference, buyerUid: payerUid, title,
    baseKobo: paidKobo, percent: Math.round(PLAN_SHARE * 100), kobo: planEarningKobo(paidKobo), status: "held",
    releaseAfter: new Date(now.getTime() + HOLD_DAYS.plan * 86_400_000).toISOString(), createdAt: now.toISOString(),
  };
  if (!(await createIfNew(db, e))) return null;
  await alertIfJump(db, e.uid, now).catch(() => false);
  return e;
}

// A product sold through an affiliate link: worked out at checkout and kept on the payment (PaymentRecord.affiliate).
export type PaymentAffiliate = { uid: string; username: string; percent: number; kobo: number };
export function affiliateFor(ref: Referrer | null, opts: { buyerUid: string; sellerUid: string; percent: unknown; paidKobo: number }): PaymentAffiliate | null {
  const percent = Number(opts.percent) || 0;
  if (!ref || percent <= 0 || ref.uid === opts.buyerUid || ref.uid === opts.sellerUid) return null;
  const kobo = affiliateKobo(opts.paidKobo, percent);
  return kobo > 0 ? { uid: ref.uid, username: ref.username, percent, kobo } : null;
}

// Inside fulfillPayment's transaction, with the publisher's ledger entry: the affiliate's share is taken out of the publisher's
// net there, and their earning is written here (writes only, so it can sit after the transaction's reads).
export function writeProductEarning(
  t: Transaction, db: Firestore,
  p: { reference: string; uid: string; publisherUid: string; affiliate?: PaymentAffiliate; amountKobo: number },
  source: Exclude<EarningSource, "plan">, title: string, itemId: string | undefined, now: string,
) {
  if (!p.affiliate) return;
  const e: Earning = {
    id: `prod_${p.reference}`, uid: p.affiliate.uid, source, paymentReference: p.reference, buyerUid: p.uid, sellerUid: p.publisherUid,
    ...(itemId ? { itemId } : {}), title, baseKobo: p.amountKobo, percent: p.affiliate.percent, kobo: p.affiliate.kobo, status: "held",
    releaseAfter: new Date(Date.parse(now) + HOLD_DAYS[source] * 86_400_000).toISOString(), createdAt: now,
  };
  t.set(db.doc(`referralEarnings/${e.id}`), e);
}

// A refunded payment takes back the earning it made, unless it was already taken out (then finance settles it by hand).
export async function reverseEarningsFor(db: Firestore, reference: string, now = new Date()): Promise<number> {
  const snap = await db.collection("referralEarnings").where("paymentReference", "==", reference).where("status", "==", "held").get();
  for (const d of snap.docs) await d.ref.update({ status: "reversed", reversedAt: now.toISOString() });
  return snap.size;
}

// ---- taking earnings out ----

export async function withdraw(
  db: Firestore, uid: string, method: "cash" | "credit", now = new Date(),
  deps: { walletLive: boolean; creditWallet: (t: Transaction, uid: string, creditKobo: number, bonusKobo: number, id: string, now: Date) => Promise<void> },
): Promise<{ kobo: number; bonusKobo: number; withdrawalId: string }> {
  const q = db.collection("referralEarnings").where("uid", "==", uid).where("status", "==", "held");
  const payout = method === "cash" ? (await db.doc(`payoutAccounts/${uid}`).get()).data() : null;
  if (method === "cash" && !payout?.recipientCode) throw new ReferralError(409, "Add a bank account for cash first (on your Referrals page).");
  if (method === "credit" && !deps.walletLive) throw new ReferralError(409, "NotesApp Credit isn't open yet. Take it as cash instead.");
  return db.runTransaction(async (t) => {
    const all = (await t.get(q)).docs;
    const ready = all.filter((d) => isAvailable(d.data() as Earning, now));
    const kobo = ready.reduce((s, d) => s + Number(d.data().kobo), 0);
    if (!kobo) throw new ReferralError(409, "Nothing is ready to take out yet.");
    if (method === "cash" && kobo < MIN_CASH_KOBO) throw new ReferralError(409, `Cash is paid from ₦${(MIN_CASH_KOBO / 100).toLocaleString("en-NG")}. Wait a little, or take it as NotesApp Credit with 10% more.`);
    const id = `rw_${uid}_${now.getTime()}`;
    const { bonusKobo } = method === "credit" ? creditWithBonus(kobo) : { bonusKobo: 0 };
    if (method === "credit") await deps.creditWallet(t, uid, kobo, bonusKobo, id, now);
    const u = method === "cash" ? (await t.get(db.doc(`users/${uid}`))).data() : null;
    const at = now.toISOString();
    if (method === "cash") {
      // A ledger entry like a sale's: the usual payout run (lib/payouts.ts) sends it to the member's bank account.
      t.set(db.doc(`ledger/${id}`), {
        reference: id, kind: "affiliate", publisherUid: uid, publisherUsername: String(u?.username ?? ""), payerUid: uid,
        grossKobo: kobo, commissionKobo: 0, netKobo: kobo, status: "held", releaseAfter: at, createdAt: at,
      });
    }
    for (const d of ready) t.update(d.ref, { status: "withdrawn", withdrawalId: id, withdrawnAt: at });
    t.set(db.doc(`referralWithdrawals/${id}`), { id, uid, method, kobo, bonusKobo, earnings: ready.map((d) => d.id), at });
    return { kobo, bonusKobo, withdrawalId: id };
  });
}

// ---- what a member sees ----

export async function summary(db: Firestore, uid: string, now = new Date()) {
  const [earnSnap, friends, withdrawals] = await Promise.all([
    db.collection("referralEarnings").where("uid", "==", uid).orderBy("createdAt", "desc").limit(200).get(),
    db.collection("referrals").where("referredBy", "==", uid).count().get(),
    db.collection("referralWithdrawals").where("uid", "==", uid).orderBy("at", "desc").limit(20).get(),
  ]);
  const earnings = earnSnap.docs.map((d) => d.data() as Earning);
  const sum = (f: (e: Earning) => boolean) => earnings.filter(f).reduce((s, e) => s + e.kobo, 0);
  return {
    friendsJoined: friends.data().count,
    payingFriends: new Set(earnings.filter((e) => e.source === "plan").map((e) => e.buyerUid)).size,
    availableKobo: sum((e) => isAvailable(e, now)),
    pendingKobo: sum((e) => e.status === "held" && !isAvailable(e, now)),
    paidOutKobo: sum((e) => e.status === "withdrawn"),
    // Buyers are never named: only what was earned, from what, and when.
    earnings: earnings.slice(0, 50).map((e) => ({ id: e.id, source: e.source, title: e.title, kobo: e.kobo, percent: e.percent, status: isAvailable(e, now) ? "available" : e.status, releaseAfter: e.releaseAfter, createdAt: e.createdAt })),
    withdrawals: withdrawals.docs.map((d) => { const w = d.data(); return { id: w.id, method: w.method, kobo: w.kobo, bonusKobo: w.bonusKobo, at: w.at }; }),
  };
}

// The admin's view: who earned most this week, and who jumped well past their usual week (no monthly cap; this is the guard).
export async function weeklyLeaders(db: Firestore, now = new Date()) {
  const since = new Date(now.getTime() - 5 * 7 * 86_400_000).toISOString();
  const snap = await db.collection("referralEarnings").where("createdAt", ">=", since).get();
  const weekOf = (iso: string) => Math.floor((now.getTime() - Date.parse(iso)) / (7 * 86_400_000)); // 0 = this week
  const by = new Map<string, number[]>();
  for (const d of snap.docs) {
    const e = d.data() as Earning;
    if (e.status === "reversed") continue;
    const w = weekOf(e.createdAt);
    if (w < 0 || w > 4) continue;
    const arr = by.get(e.uid) ?? [0, 0, 0, 0, 0];
    arr[w] += e.kobo;
    by.set(e.uid, arr);
  }
  const rows = Array.from(by, ([uid, w]) => ({ uid, thisWeekKobo: w[0], earlierWeeksKobo: w.slice(1), alert: jumpAlert(w[0], w.slice(1)) }));
  rows.sort((a, b) => Number(b.alert) - Number(a.alert) || b.thisWeekKobo - a.thisWeekKobo);
  const top = rows.slice(0, 50);
  const users = await Promise.all(top.map((r) => db.doc(`users/${r.uid}`).get()));
  return top.map((r, i) => ({ ...r, username: String(users[i].data()?.username ?? ""), displayName: String(users[i].data()?.displayName ?? "") }));
}

// Hold an alerted referrer's earnings for review: they stay "held" with a later date until finance looks.
export async function holdForReview(db: Firestore, uid: string, days: number, now = new Date()): Promise<number> {
  const snap = await db.collection("referralEarnings").where("uid", "==", uid).where("status", "==", "held").get();
  const until = new Date(now.getTime() + days * 86_400_000).toISOString();
  for (const d of snap.docs) await d.ref.update({ releaseAfter: until, reviewHold: true });
  return snap.size;
}


// ---- a referred friend's first plan ----

// After the first payment (fulfillPayment): Paystack's subscription for the plan, on the card just used, starting when the free
// month (or the discounted year, or the period a #NotesApp code paid for) ends; then a referred friend's monthly card check is
// given back (never a real payment made with a code). If Paystack refuses, the friend keeps the period
// they have, and the record says so for finance (they can subscribe again from the pricing page when it ends).
export async function startReferralSubscription(
  db: Firestore,
  p: { reference: string; uid: string; tier?: { interval: "monthly" | "annually"; planCode: string; referralFirst?: boolean } },
  tx: { authorization?: { authorization_code?: string; reusable?: boolean }; customer?: { customer_code?: string } } | null,
  deps: { create?: typeof createSubscription; refund?: typeof refundTransaction } = {},
): Promise<"started" | "failed"> {
  const create = deps.create ?? createSubscription, refund = deps.refund ?? refundTransaction;
  const subRef = db.doc(`tierSubscriptions/${p.uid}`);
  const sub = (await subRef.get()).data();
  let result: "started" | "failed" = "failed";
  try {
    const auth = tx?.authorization?.authorization_code, customer = tx?.customer?.customer_code;
    if (!p.tier || !sub || !auth || !customer || tx?.authorization?.reusable === false) throw new Error("no reusable card on this payment");
    const s = await create({ customer, plan: p.tier.planCode, authorization: auth, startDate: String(sub.currentPeriodEnd) });
    await subRef.update({ subscriptionCode: s.subscription_code, subscriptionStartsAt: sub.currentPeriodEnd });
    result = "started";
  } catch (e) {
    await subRef.update({ subscriptionError: e instanceof Error ? e.message : String(e) }).catch(() => {});
  }
  if (p.tier?.referralFirst && p.tier.interval === "monthly") {
    try { await refund(p.reference); await db.doc(`payments/${p.reference}`).update({ cardCheckRefunded: true }); }
    catch (e) { await db.doc(`payments/${p.reference}`).update({ cardCheckRefundError: e instanceof Error ? e.message : String(e) }).catch(() => {}); }
  }
  return result;
}

// ---- products open to affiliates ----
// affiliateOffers/{item_<id> | course_<id>}: a publisher's share for affiliates on one product, kept by the server (the product itself
// is unchanged), with what the marketplace shows. percent 0 takes it off the marketplace.
export type AffiliateOffer = {
  id: string; type: "item" | "course"; itemId: string; ownerUid: string; ownerUsername: string; percent: number;
  title: string; image: string; priceKobo: number; path: string; kind: "store" | "digital" | "course"; updatedAt: string;
};
export const offerIdFor = (type: "item" | "course", id: string) => `${type}_${id}`;

export async function offerPercent(db: Firestore, offerId: string, sellerUid: string): Promise<number> {
  const o = (await db.doc(`affiliateOffers/${offerId}`).get()).data() as AffiliateOffer | undefined;
  return o && o.ownerUid === sellerUid ? Number(o.percent) || 0 : 0;
}

// A publisher (or a team member who runs the store) sets the share on their own product; the product's details are read fresh.
export async function setOffer(db: Firestore, actorUid: string, type: "item" | "course", itemId: string, percentRaw: unknown, canAct: (ownerUid: string) => Promise<boolean>, now = new Date()): Promise<AffiliateOffer | null> {
  let percent: number;
  try { percent = cleanAffiliatePercent(percentRaw); } catch (e) { throw new ReferralError(400, (e as Error).message); }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(itemId)) throw new ReferralError(400, "Choose a product.");
  const src = (await db.doc(`${type === "item" ? "storeItems" : "courses"}/${itemId}`).get()).data();
  if (!src) throw new ReferralError(404, "That product wasn't found.");
  const ownerUid = String(src.ownerUid ?? "");
  if (!(await canAct(ownerUid))) throw new ReferralError(403, "You can only set this on your own products.");
  const ref = db.doc(`affiliateOffers/${offerIdFor(type, itemId)}`);
  if (percent === 0) { await ref.delete(); return null; }
  if (type === "item" && (src.sellable !== true || !Number.isInteger(src.priceKobo))) throw new ReferralError(409, "Only items on sale here can have an affiliate share.");
  if (type === "course" && !(Number(src.priceKobo) > 0)) throw new ReferralError(409, "Only paid courses can have an affiliate share.");
  const owner = (await db.doc(`users/${ownerUid}`).get()).data();
  const offer: AffiliateOffer = {
    id: ref.id, type, itemId, ownerUid, ownerUsername: String(owner?.username ?? ""), percent,
    title: String(src.title ?? ""), image: String(src.image ?? src.cover ?? ""), priceKobo: Number(src.priceKobo) || 0,
    path: type === "item" ? `/shop/${itemId}` : `/academy/${String(src.slug ?? itemId)}`,
    kind: type === "course" ? "course" : src.kind === "digital" ? "digital" : "store", updatedAt: now.toISOString(),
  };
  await ref.set(offer);
  return offer;
}

export async function listOffers(db: Firestore, opts: { ownerUid?: string; limit?: number } = {}): Promise<AffiliateOffer[]> {
  let q = db.collection("affiliateOffers") as FirebaseFirestore.Query;
  if (opts.ownerUid) q = q.where("ownerUid", "==", opts.ownerUid);
  const snap = await q.limit(opts.limit ?? 300).get();
  return snap.docs.map((d) => d.data() as AffiliateOffer).sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title));
}

// After an earning: if this member's week is well past their usual week (lib/referrals.ts jumpAlert), tell the team once that week
// (an email to the support address, and a row on /admin/referrals) so finance can look before it's paid. There's no monthly cap.
export async function alertIfJump(db: Firestore, uid: string, now = new Date(), send: (subject: string, text: string) => Promise<unknown> = defaultAlert): Promise<boolean> {
  const since = new Date(now.getTime() - 5 * 7 * 86_400_000).toISOString();
  const snap = await db.collection("referralEarnings").where("uid", "==", uid).where("createdAt", ">=", since).get();
  const weeks = [0, 0, 0, 0, 0];
  for (const d of snap.docs) {
    const e = d.data() as Earning;
    if (e.status === "reversed") continue;
    const w = Math.floor((now.getTime() - Date.parse(e.createdAt)) / (7 * 86_400_000));
    if (w >= 0 && w < 5) weeks[w] += e.kobo;
  }
  if (!jumpAlert(weeks[0], weeks.slice(1))) return false;
  const week = Math.floor(now.getTime() / (7 * 86_400_000));
  try { await db.doc(`referralAlerts/${uid}_${week}`).create({ uid, thisWeekKobo: weeks[0], earlierWeeksKobo: weeks.slice(1), at: now.toISOString() }); }
  catch { return false; } // already told this week
  const u = (await db.doc(`users/${uid}`).get()).data();
  await send(`Referral earnings jumped: @${u?.username ?? uid}`, `@${u?.username ?? uid} has earned ₦${(weeks[0] / 100).toLocaleString("en-NG")} this week from referrals and affiliate links, against about ₦${(weeks.slice(1).reduce((a, b) => a + b, 0) / 4 / 100).toLocaleString("en-NG")} in a usual week.\n\nLook before it's paid: /admin/referrals (you can hold their earnings for review).`).catch(() => {});
  return true;
}
async function defaultAlert(subject: string, text: string) {
  const { sendEmail } = await import("./email");
  const { setting } = await import("./config");
  const to = setting("SUPPORT_EMAIL") || setting("NEXT_PUBLIC_CONTACT_EMAIL") || "hello@notesapp.name.ng";
  return sendEmail({ to, subject, text });
}

// A publisher's products that can carry an affiliate share: shop items on sale here, and paid courses.
export type OwnProduct = { type: "item" | "course"; itemId: string; title: string; priceKobo: number; kind: AffiliateOffer["kind"] };
export async function ownProducts(db: Firestore, uid: string): Promise<OwnProduct[]> {
  const [items, courses] = await Promise.all([
    db.collection("storeItems").where("ownerUid", "==", uid).limit(300).get(),
    db.collection("courses").where("ownerUid", "==", uid).limit(100).get(),
  ]);
  const out: OwnProduct[] = [];
  for (const d of items.docs) {
    const x = d.data();
    if (x.sellable === true && Number.isInteger(x.priceKobo)) out.push({ type: "item", itemId: d.id, title: String(x.title ?? ""), priceKobo: Number(x.priceKobo), kind: x.kind === "digital" ? "digital" : "store" });
  }
  for (const d of courses.docs) {
    const x = d.data();
    if (Number(x.priceKobo) > 0) out.push({ type: "course", itemId: d.id, title: String(x.title ?? ""), priceKobo: Number(x.priceKobo), kind: "course" });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
