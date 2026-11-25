import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { myRates } from "./my-rates";
import { TIERS } from "./tiers";
import { nairaText } from "./pricing";
import { afterTrialTier, onTrial, planName } from "./trials";
import { isPromoSource } from "./promos";
import type { AccountTier } from "./users";
import {
  compareTrial, nudgeDue, outcome, trialDays, trialStats, DAY,
  type Comparison, type LedgerIn, type Outcome, type Rates, type TrialResult, type TrialStats,
} from "./trial-earnings";

// What a free trial kept you (lib/trial-earnings.ts has the maths). Server only. Callers run ensurePricing() first, so the rates and prices
// are the live ones from Admin → Pricing. trialResults/{uid}_{day} is server-only (firestore.rules); members read their own through
// /api/account/trial.

const ratesOf = (tier: string): Rates => { const r = myRates(tier as AccountTier); return { session: r.session, physical: r.physical, digital: r.digital }; };
export const monthlyOf = (tier: string) => TIERS.find((t) => t.tier === tier)?.monthlyKobo ?? 0;

async function ledgerOf(db: Firestore, uid: string): Promise<LedgerIn[]> {
  const snap = await db.collection("ledger").where("publisherUid", "==", uid).select("kind", "grossKobo", "commissionKobo", "status", "createdAt", "currency").get();
  return snap.docs.map((d) => d.data() as LedgerIn);
}
async function paidTierOf(db: Firestore, uid: string): Promise<string | null> {
  const s = (await db.doc(`tierSubscriptions/${uid}`).get()).data();
  return s && s.status === "active" ? String(s.tier) : null;
}

export type TrialView =
  | { state: "running"; tier: string; back: string; day: number; days: number; startedAt: string; until: string; comparison: Comparison; monthlyKobo: number; plan: Rates; backRates: Rates }
  | { state: "ended"; result: TrialResult }
  | { state: "none" };

// The member's trial now: running (with the total so far), or the last one that ended, or none.
export async function trialView(db: Firestore, uid: string, now = new Date()): Promise<TrialView> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) return { state: "none" };
  if (onTrial(u, now) && u.trialTier && !isPromoSource(u.trialSource)) { // a free plan from a promo code isn't a trial
    const startedAt = String((u.trials as { tier: string; startedAt: string }[] | undefined)?.filter((t) => t.tier === u.trialTier).pop()?.startedAt ?? u.trialUsedAt ?? now.toISOString());
    const tier = String(u.trialTier), back = afterTrialTier(await paidTierOf(db, uid));
    const plan = ratesOf(tier), backRates = ratesOf(back);
    const comparison = compareTrial(await ledgerOf(db, uid), plan, backRates, startedAt, now.toISOString());
    const days = trialDays(startedAt, String(u.trialUntil));
    const day = Math.min(days, Math.max(1, Math.ceil((now.getTime() - new Date(startedAt).getTime()) / DAY)));
    return { state: "running", tier, back, day, days, startedAt, until: String(u.trialUntil), comparison, monthlyKobo: monthlyOf(tier), plan, backRates };
  }
  const last = await db.collection("trialResults").where("uid", "==", uid).get();
  const r = last.docs.map((d) => d.data() as TrialResult).sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  return r ? { state: "ended", result: r } : { state: "none" };
}

// At the end of a trial (lib/tier-billing.ts expireOrgTrials, before the account moves back): work out and keep the result.
export async function recordTrialEnd(db: Firestore, uid: string, u: Record<string, unknown>, paidTier: string | null, now = new Date()): Promise<TrialResult | null> {
  const tier = String(u.trialTier ?? "");
  if (tier !== "pro" && tier !== "business") return null;
  const until = String(u.trialUntil);
  const startedAt = String((u.trials as { tier: string; startedAt: string }[] | undefined)?.filter((t) => t.tier === tier).pop()?.startedAt ?? u.trialUsedAt ?? "");
  if (!startedAt) return null;
  const back = afterTrialTier(paidTier);
  const plan = ratesOf(tier), backRates = ratesOf(back), monthlyKobo = monthlyOf(tier), days = trialDays(startedAt, until);
  const comparison = compareTrial(await ledgerOf(db, uid), plan, backRates, startedAt, until);
  const result: TrialResult = { uid, tier, back, startedAt, until, endedAt: now.toISOString(), monthlyKobo, plan, backRates, comparison, outcome: outcome(comparison, monthlyKobo, days, plan, backRates) };
  await db.doc(`trialResults/${uid}_${startedAt.slice(0, 10)}`).set(JSON.parse(JSON.stringify(result)));
  return result;
}

// The lines added to the "your trial has ended" email.
export function resultEmailText(r: Pick<TrialResult, "tier" | "back" | "comparison" | "outcome" | "monthlyKobo">): string {
  const plan = planName(r.tier), back = planName(r.back), o: Outcome = r.outcome, c = r.comparison;
  if (c.count === 0) return `You had no paid sessions, subscriptions, gifts or sales in the trial, so there's nothing to compare yet.`;
  const head = `In your trial you earned ${nairaText(c.grossKobo)}. On ${plan} you kept ${nairaText(c.keptPlanKobo)}; on ${back} you'd have kept ${nairaText(c.keptBackKobo)}.`;
  if (o.verdict === "paid") return `${head} ${plan} kept you ${nairaText(c.extraKobo)} more, and costs ${nairaText(r.monthlyKobo)} a month.`;
  return `${head} ${back} suits you for now${o.breakEvenKobo ? `: ${plan} pays for itself once you earn about ${nairaText(o.breakEvenKobo)} a month in sessions, subscriptions and gifts, and we'll tell you when you get there` : ""}.`;
}

// The one nudge (lib/trial-earnings.ts nudgeDue): members told "not yet", still on the plan they went back to. Returns who to message;
// the caller sends and then calls markNudged.
export async function nudgesDue(db: Firestore, now = Date.now()): Promise<{ id: string; uid: string; tier: string; extraKobo: number; monthlyKobo: number }[]> {
  const snap = await db.collection("trialResults").where("outcome.verdict", "==", "not_yet").get();
  const out: { id: string; uid: string; tier: string; extraKobo: number; monthlyKobo: number }[] = [];
  const seen = new Set<string>();
  for (const d of snap.docs.sort((a, b) => String(b.data().endedAt).localeCompare(String(a.data().endedAt)))) {
    const r = d.data() as TrialResult;
    if (seen.has(r.uid)) continue; // only the latest trial of each member
    seen.add(r.uid);
    const u = (await db.doc(`users/${r.uid}`).get()).data();
    if (!u || u.suspended === true || u.accountTier !== r.back || onTrial(u, new Date(now))) continue;
    const plan = ratesOf(r.tier), back = ratesOf(r.back), monthlyKobo = monthlyOf(r.tier);
    const from = new Date(now - 30 * DAY).toISOString(), to = new Date(now).toISOString();
    // These payments were charged at the plan they're on now (`back`), so the comparison runs the other way: what the plan they tried
    // would have kept them, against what they actually kept.
    const actual = compareTrial(await ledgerOf(db, r.uid), back, plan, from, to);
    const c = { extraKobo: -actual.extraKobo };
    if (nudgeDue(c, monthlyKobo, r.nudgedAt?.[r.nudgedAt.length - 1], now)) out.push({ id: d.id, uid: r.uid, tier: r.tier, extraKobo: c.extraKobo, monthlyKobo });
  }
  return out;
}
export const markNudged = (db: Firestore, id: string, at: string) => db.doc(`trialResults/${id}`).update({ nudgedAt: FieldValue.arrayUnion(at) });

// Admin → Growth → Trials: the trials that ended in the last `days` days.
export async function trialStatsFor(db: Firestore, days = 30, now = Date.now()): Promise<TrialStats & { days: number }> {
  const since = new Date(now - days * DAY).toISOString();
  const snap = await db.collection("trialResults").where("endedAt", ">=", since).get();
  const results = snap.docs.map((d) => d.data() as TrialResult);
  const paidAt: Record<string, string | undefined> = {};
  await Promise.all([...new Set(results.map((r) => r.uid))].map(async (uid) => { paidAt[uid] = (await db.doc(`users/${uid}`).get()).data()?.lastPaidAt; }));
  return { ...trialStats(results, paidAt), days };
}
