import { getAdminDb } from "./firebase-admin";
import { createPlan, disableSubscription, verifyTransaction, pricePaidKobo } from "./paystack";
import { TIERS, BADGE_PRICE_KOBO } from "./tiers";
import { GOLD_PRICING, GoldTrack } from "./gold";
import { sendEmail } from "./email";
import type { AccountTier } from "./users";

// Server-only. Pro / Business plan billing: one Paystack plan per
// (tier, interval), a `tierSubscriptions/{uid}` record per paying
// account, renewals via webhook, and an expiry sweep that drops lapsed
// accounts back to Free Basic (only if their tier is still the one
// they paid for — admin-set tiers are never touched).
export type BillingTier = "pro" | "business";
export type Interval = "monthly" | "annually";

export type TierSubscription = {
  uid: string;
  email: string;
  tier: BillingTier;
  interval: Interval;
  planCode: string;
  status: "active" | "cancelled" | "expired";
  subscribedAt: string;
  currentPeriodEnd: string;
};

const GRACE_DAYS = 3; // renewal-failure slack before a downgrade
const periodDays = (i: Interval) => (i === "annually" ? 366 : 31);
export const periodEndFrom = (base: number, i: Interval) => new Date(base + periodDays(i) * 86_400_000).toISOString();

export function tierPrice(tier: string, interval: string): number | null {
  const t = TIERS.find((x) => x.tier === tier);
  if (!t) return null;
  return (interval === "annually" ? t.yearlyKobo : interval === "monthly" ? t.monthlyKobo : undefined) ?? null;
}

// Paystack plan for a tier/interval, created lazily and re-created if
// the configured price ever changes (existing subscribers stay on the
// plan they bought).
export async function getTierPlanCode(tier: BillingTier, interval: Interval): Promise<{ planCode: string; amountKobo: number }> {
  const amountKobo = tierPrice(tier, interval);
  if (!amountKobo) throw new Error("This plan isn't available.");
  const db = getAdminDb();
  const ref = db.doc(`platformPlans/${tier}_${interval}`);
  const cur = (await ref.get()).data();
  if (cur?.planCode && cur.amountKobo === amountKobo) return { planCode: cur.planCode, amountKobo };
  const label = TIERS.find((t) => t.tier === tier)?.label || tier;
  const { plan_code } = await createPlan({ name: `#NotesApp ${label} ${interval}`, amountKobo, interval });
  await ref.set({ tier, interval, planCode: plan_code, amountKobo, createdAt: new Date().toISOString() });
  return { planCode: plan_code, amountKobo };
}

export type BadgeSubscription = {
  uid: string;
  email: string;
  planCode: string;
  status: "active" | "cancelled" | "expired";
  subscribedAt: string;
  currentPeriodEnd: string;
};

// The ₦999/month verified-badge add-on has its own plan.
export async function getBadgePlanCode(): Promise<{ planCode: string; amountKobo: number }> {
  const db = getAdminDb();
  const ref = db.doc("platformPlans/badge_monthly");
  const cur = (await ref.get()).data();
  if (cur?.planCode && cur.amountKobo === BADGE_PRICE_KOBO) return { planCode: cur.planCode, amountKobo: BADGE_PRICE_KOBO };
  const { plan_code } = await createPlan({ name: "#NotesApp Verified badge monthly", amountKobo: BADGE_PRICE_KOBO, interval: "monthly" });
  await ref.set({ tier: "badge", interval: "monthly", planCode: plan_code, amountKobo: BADGE_PRICE_KOBO, createdAt: new Date().toISOString() });
  return { planCode: plan_code, amountKobo: BADGE_PRICE_KOBO };
}

// Gold badge monthly plan, one per track (same price on every tier).
export async function getGoldPlanCode(track: GoldTrack): Promise<{ planCode: string; amountKobo: number }> {
  const amountKobo = GOLD_PRICING[track].monthlyKobo;
  const ref = getAdminDb().doc(`platformPlans/gold_${track}_monthly`);
  const cur = (await ref.get()).data();
  if (cur?.planCode && cur.amountKobo === amountKobo) return { planCode: cur.planCode, amountKobo };
  const { plan_code } = await createPlan({ name: `#NotesApp Gold badge ${track} monthly`, amountKobo, interval: "monthly" });
  await ref.set({ tier: "gold", track, interval: "monthly", planCode: plan_code, amountKobo, createdAt: new Date().toISOString() });
  return { planCode: plan_code, amountKobo };
}

export type GoldSubscription = BadgeSubscription & { kind: "endorsement" | "identity"; track: GoldTrack };

// Recurring charge on a platform plan. Returns true if it was one of ours.
export async function fulfillTierRenewal(data: {
  reference: string;
  customer?: { email?: string };
  plan?: { plan_code?: string } | null;
}): Promise<boolean> {
  const planCode = data.plan?.plan_code;
  const email = data.customer?.email;
  if (!planCode || !email) return false;
  const db = getAdminDb();
  const planSnap = await db.collection("platformPlans").where("planCode", "==", planCode).limit(1).get();
  if (planSnap.empty) return false;
  const planTier = planSnap.docs[0].data().tier;
  const isGold = planTier === "gold";
  const isBadge = planTier === "badge" || isGold;

  const seen = db.doc(`tierCharges/${data.reference}`);
  if ((await seen.get()).exists) return true;
  const tx = await verifyTransaction(data.reference);
  if (tx.status !== "success") return true;

  const subs = await db.collection(isGold ? "goldSubscriptions" : isBadge ? "badgeSubscriptions" : "tierSubscriptions").where("planCode", "==", planCode).where("email", "==", email).limit(1).get();
  if (subs.empty) return true;
  const doc = subs.docs[0];
  if (isBadge) {
    const b = doc.data() as BadgeSubscription;
    const end = periodEndFrom(Math.max(Date.now(), new Date(b.currentPeriodEnd).getTime()), "monthly");
    const bb = db.batch();
    bb.update(doc.ref, { status: "active", currentPeriodEnd: end });
    bb.set(db.doc(`users/${b.uid}`), isGold ? { goldUntil: end } : { badgeUntil: end }, { merge: true });
    bb.set(seen, { reference: data.reference, uid: b.uid, kind: isGold ? "gold" : "badge", amountKobo: pricePaidKobo(tx), at: new Date().toISOString() });
    await bb.commit();
    return true;
  }
  const sub = doc.data() as TierSubscription;
  const base = Math.max(Date.now(), new Date(sub.currentPeriodEnd).getTime());
  const batch = db.batch();
  batch.update(doc.ref, { status: "active", currentPeriodEnd: periodEndFrom(base, sub.interval) });
  batch.update(db.doc(`users/${sub.uid}`), { accountTier: sub.tier });
  batch.set(seen, { reference: data.reference, uid: sub.uid, kind: "tier", amountKobo: pricePaidKobo(tx), at: new Date().toISOString() });
  await batch.commit();
  return true;
}

export async function markTierCancelled(planCode: string, email: string): Promise<void> {
  const db = getAdminDb();
  for (const col of ["tierSubscriptions", "badgeSubscriptions", "goldSubscriptions"]) {
    const subs = await db.collection(col).where("planCode", "==", planCode).where("email", "==", email).get();
    await Promise.all(subs.docs.map((d) => (d.data().status === "active" ? d.ref.update({ status: "cancelled" }) : null)));
  }
}

// Business/Enterprise include the badge, so a running ₦999 add-on would
// be double-billing — stop it (best effort; the badge stays either way).
export async function cancelBadgeIfCovered(uid: string): Promise<void> {
  try {
    const ref = getAdminDb().doc(`badgeSubscriptions/${uid}`);
    const b = (await ref.get()).data() as BadgeSubscription | undefined;
    if (!b || b.status !== "active") return;
    const found = await findPaystackSubscription(b.email, b.planCode);
    if (found) await disableSubscription(found.code, found.token);
    await ref.update({ status: "cancelled", cancelledAt: new Date().toISOString(), note: "covered by plan" });
  } catch (err) {
    console.error("cancelBadgeIfCovered failed:", err);
  }
}

// Downgrades accounts whose paid period (plus grace) has ended.
export async function expireTiers(): Promise<number> {
  const db = getAdminDb();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString();
  const snap = await db.collection("tierSubscriptions").where("currentPeriodEnd", "<", cutoff).get();
  let n = 0;
  for (const d of snap.docs) {
    const sub = d.data() as TierSubscription;
    if (sub.status === "expired") continue;
    const userRef = db.doc(`users/${sub.uid}`);
    const user = (await userRef.get()).data();
    if (user?.accountTier === sub.tier) await userRef.update({ accountTier: "basic" as AccountTier });
    await d.ref.update({ status: "expired", expiredAt: new Date().toISOString() });
    if (sub.email) {
      await sendEmail({
        to: sub.email,
        subject: `Your #NotesApp ${sub.tier === "pro" ? "Pro" : "Business"} plan has ended`,
        text: `Your paid plan ended, so your account is back on Free Basic. Your journal, bookings and earnings are untouched. You can upgrade again any time from ${process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng"}/pricing.`,
      }).catch(() => {});
    }
    n++;
  }
  // Lapsed badge add-ons just get marked (badgeUntil already stops the ✔).
  const badges = await db.collection("badgeSubscriptions").where("currentPeriodEnd", "<", cutoff).get();
  await Promise.all(badges.docs.map((d) => (d.data().status !== "expired" ? d.ref.update({ status: "expired" }) : null)));
  const golds = await db.collection("goldSubscriptions").where("currentPeriodEnd", "<", cutoff).get();
  await Promise.all(golds.docs.map((d) => (d.data().status !== "expired" ? d.ref.update({ status: "expired" }) : null)));
  return n;
}

// Paystack's subscription list — used to find the subscription code + email
// token needed to cancel (scans a few pages; fine at this scale).
export async function findPaystackSubscription(email: string, planCode: string): Promise<{ code: string; token: string } | null> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://api.paystack.co/subscription?perPage=100&page=${page}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const json = await res.json();
    const list: any[] = json?.data || [];
    const hit = list.find((s) => s?.plan?.plan_code === planCode && s?.customer?.email?.toLowerCase() === email.toLowerCase() && s.status === "active");
    if (hit) return { code: hit.subscription_code, token: hit.email_token };
    if (list.length < 100) break;
  }
  return null;
}
