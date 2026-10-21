// Free trials of the paid plans (owner, 21 Oct 2026). Pure: the rules, checked on the server by lib/trials-server.ts.
//
// - A trial lasts 15 days (TRIAL_DAYS), with no card.
// - Each plan can be tried once per account: Pro once and Business once. Organisations: Business once per registration number too.
// - A paid plan must come between two trials: after a trial ends, the account is on Free Basic, and it can only try another plan it hasn't
//   tried after it has paid for a plan. Without paying, it stays on Free Basic.
// - Only a plan above the one the account already pays for can be tried. Upgrading and downgrading by paying work as before.
//
// Stored on users/{uid} (server-written): trialTier + trialUntil while a trial runs, `trials` (every trial ever started: tier, startedAt,
// until) and `lastPaidAt` (the last time a plan was paid for, set by lib/payments.ts and renewals in lib/tier-billing.ts). Older accounts may
// only have `trialUsedAt` from the 30-day organisation trial: that counts as a Business trial.
export const TRIAL_DAYS = 15;
export const TRIAL_TIERS = ["pro", "business"] as const;
export type TrialTier = (typeof TRIAL_TIERS)[number];
export const isTrialTier = (v: unknown): v is TrialTier => v === "pro" || v === "business";

export type TrialRecord = { tier: string; startedAt: string; until: string };
export type TrialProfile = {
  accountTier?: string; trialTier?: string; trialUntil?: string; trialUsedAt?: string; trials?: TrialRecord[]; lastPaidAt?: string;
};

const RANK: Record<string, number> = { standard: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
const NAME: Record<string, string> = { pro: "Pro", business: "Business", enterprise: "Enterprise", basic: "Free Basic" };
export const planName = (t: string) => NAME[t] ?? t;

// Every trial the account has had, oldest first, including the old organisation trial.
export function trialHistory(p: TrialProfile): TrialRecord[] {
  const list = Array.isArray(p.trials) ? p.trials.filter((t) => t && typeof t.tier === "string" && typeof t.startedAt === "string") : [];
  if (p.trialUsedAt && !list.some((t) => t.startedAt === p.trialUsedAt)) {
    list.push({ tier: p.trialTier && isTrialTier(p.trialTier) ? p.trialTier : "business", startedAt: p.trialUsedAt, until: p.trialUntil ?? p.trialUsedAt });
  }
  return list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export const onTrial = (p: TrialProfile, now: Date) => !!p.trialUntil && new Date(p.trialUntil).getTime() > now.getTime();

export type TrialCheck = { ok: true } | { ok: false; reason: "not-a-plan" | "on-trial" | "tried" | "pay-first" | "has-plan"; message: string };
// May this account start a free trial of `tier` now? `paidTier` is the plan it currently pays for (an active subscription), if any.
export function trialCheck(p: TrialProfile, tier: unknown, now: Date, paidTier: string | null): TrialCheck {
  if (!isTrialTier(tier)) return { ok: false, reason: "not-a-plan", message: "Free trials are for Pro and Business." };
  if (onTrial(p, now)) {
    return { ok: false, reason: "on-trial", message: `You're on a free ${planName(p.trialTier ?? "")} trial until ${new Date(p.trialUntil!).toDateString()}.` };
  }
  const history = trialHistory(p);
  if (history.some((t) => t.tier === tier)) {
    return { ok: false, reason: "tried", message: `You've already had your free ${planName(tier)} trial. Get ${planName(tier)} to have it again.` };
  }
  const last = history[history.length - 1];
  if (last && !(p.lastPaidAt && p.lastPaidAt > last.startedAt)) {
    return { ok: false, reason: "pay-first", message: "A paid plan has to come between free trials. Pay for a plan first; after that you can try one you haven't tried yet." };
  }
  const have = Math.max(RANK[paidTier ?? ""] ?? 0, RANK[p.accountTier ?? ""] ?? 0);
  if (have >= RANK[tier]) return { ok: false, reason: "has-plan", message: `Your plan already includes everything in ${planName(tier)}.` };
  return { ok: true };
}

// What the account goes back to when a trial ends: the plan it pays for, else Free Basic.
export const afterTrialTier = (paidTier: string | null): string => (paidTier && RANK[paidTier] ? paidTier : "basic");
// Add-ons (logistics, inventory) also have a one-time free trial; it is never longer than a plan's.
export const addonTrialDays = (configured: number) => Math.max(0, Math.min(TRIAL_DAYS, Math.round(configured)));
