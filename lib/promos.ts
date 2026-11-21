// Promo campaigns: a public code that unlocks a limited pool of free plans, venture slots and tournament places. Pure and client-safe:
// the rules shared by the API (lib/promos-server.ts), the offer page and the tests.
//
// The first campaign is Davido's 34th birthday (owner, 21 Nov 2026; the #NotesApp journal post "Happy 34th birthday, Davido"), code
// DAVIDO-at-34. The owner's answers: anyone picks a plan while that plan's slots last; one claim per account (and per organisation
// registration number); live from the day it ships until the slots run out; venture slots open now until all four are picked; the Arcade
// tournament takes sign-ups today only (Lagos time).
//
// A free plan from a promo rides on the free-trial fields (trialTier + trialUntil on users/{uid}), so the daily job in lib/tier-billing.ts
// reminds the member before the end and moves the account back to the plan it pays for, or Free Basic, like a trial. `trialSource` marks it
// as a promo, so it is NOT added to the member's trial history and doesn't use up their own free trials (lib/trials.ts).

export type PromoTier = "pro" | "business" | "enterprise";
export const PROMO_TIERS: PromoTier[] = ["enterprise", "business", "pro"];
export const isPromoTier = (v: unknown): v is PromoTier => v === "pro" || v === "business" || v === "enterprise";

export type PlanPool = { tier: PromoTier; slots: number; days: number; label: string; valueText: string };
export type Campaign = {
  id: string; // Firestore-safe id: promos/{id}, promoClaims/{id}_{uid}
  code: string; // as printed; matching ignores case, spaces and dashes
  name: string;
  startsAt: string; // ISO; the code works from here…
  endsAt: string | null; // …to here (null: until the slots run out)
  plans: PlanPool[];
  ventures: { slots: number; maxKoboPerVenture: number; totalKobo: number } | null;
  tournament: { lagosDate: string; name: string; sponsorshipKobo: number; playFrom: string; playUntil: string } | null; // sign-ups on this Lagos date only; play in the window
  postPath: string; // where the campaign is announced
};

export const DAVIDO_AT_34: Campaign = {
  id: "davido-at-34",
  code: "DAVIDO-at-34",
  name: "Davido at 34",
  startsAt: "2026-11-21T00:00:00+01:00",
  endsAt: null,
  plans: [
    { tier: "enterprise", slots: 34, days: 30, label: "Enterprise for 1 month", valueText: "worth ₦55,000+ a month" },
    { tier: "business", slots: 34, days: 30, label: "Business for 1 month", valueText: "worth ₦25,000 a month" },
    { tier: "pro", slots: 1000, days: 365, label: "Pro for 1 year", valueText: "worth ₦50,000 a year" },
  ],
  ventures: { slots: 4, maxKoboPerVenture: 5_000_000 * 100, totalKobo: 20_000_000 * 100 },
  // Owner, 21 Nov 2026: "tournament must run today, maybe 10pm; we will announce as people play".
  tournament: { lagosDate: "2026-11-21", name: "Davido at 34 Arcade Tournament", sponsorshipKobo: 10_000_000 * 100, playFrom: "2026-11-21T22:00:00+01:00", playUntil: "2026-11-22T00:00:00+01:00" },
  postPath: "/journals/happy-34th-birthday-davido",
};

export const CAMPAIGNS: Campaign[] = [DAVIDO_AT_34];

// "davido at 34", "DAVIDO-AT-34" and "Davido_at_34" all match.
export const normCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const campaignByCode = (code: unknown): Campaign | null => {
  const n = normCode(code);
  return (n && CAMPAIGNS.find((c) => normCode(c.code) === n)) || null;
};
export const campaignById = (id: unknown): Campaign | null => CAMPAIGNS.find((c) => c.id === id) ?? null;

export const campaignLive = (c: Campaign, now: Date) => now.getTime() >= Date.parse(c.startsAt) && (!c.endsAt || now.getTime() <= Date.parse(c.endsAt));
export const poolOf = (c: Campaign, tier: PromoTier) => c.plans.find((p) => p.tier === tier) ?? null;

// The calendar date in Lagos (UTC+1, no daylight saving).
export const lagosDate = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
export const tournamentOpen = (c: Campaign, now: Date) => !!c.tournament && campaignLive(c, now) && lagosDate(now) === c.tournament.lagosDate;

// Counters kept on promos/{id}: claims per tier and venture picks.
export type PromoCounts = { plans: Partial<Record<PromoTier, number>>; venturePicks: number; tournamentEntries: number };
export const emptyCounts = (): PromoCounts => ({ plans: {}, venturePicks: 0, tournamentEntries: 0 });
export const slotsLeft = (c: Campaign, counts: PromoCounts, tier: PromoTier) => {
  const pool = poolOf(c, tier);
  return pool ? Math.max(0, pool.slots - (counts.plans[tier] ?? 0)) : 0;
};
export const venturesLeft = (c: Campaign, counts: PromoCounts) => (c.ventures ? Math.max(0, c.ventures.slots - counts.venturePicks) : 0);

// What the public sees: no names, just what's left.
export type PromoStatus = {
  id: string; code: string; name: string; live: boolean; postPath: string;
  plans: { tier: PromoTier; label: string; valueText: string; slots: number; left: number; days: number }[];
  ventures: { slots: number; left: number; maxKoboPerVenture: number } | null;
  tournament: { name: string; open: boolean; lagosDate: string; entries: number; playFrom: string; playUntil: string } | null;
};
export function publicStatus(c: Campaign, counts: PromoCounts, now: Date): PromoStatus {
  return {
    id: c.id, code: c.code, name: c.name, live: campaignLive(c, now), postPath: c.postPath,
    plans: c.plans.map((p) => ({ tier: p.tier, label: p.label, valueText: p.valueText, slots: p.slots, left: slotsLeft(c, counts, p.tier), days: p.days })),
    ventures: c.ventures ? { slots: c.ventures.slots, left: venturesLeft(c, counts), maxKoboPerVenture: c.ventures.maxKoboPerVenture } : null,
    tournament: c.tournament ? { name: c.tournament.name, open: tournamentOpen(c, now), lagosDate: c.tournament.lagosDate, entries: counts.tournamentEntries, playFrom: c.tournament.playFrom, playUntil: c.tournament.playUntil } : null,
  };
}

const RANK: Record<string, number> = { standard: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
const NAME: Record<string, string> = { pro: "Pro", business: "Business", enterprise: "Enterprise", basic: "Free Basic" };

export type ClaimProfile = { role?: string; accountTier?: string; trialTier?: string; trialUntil?: string; trialSource?: string; suspended?: boolean; teen?: boolean };
export type ClaimCheck = { ok: true } | { ok: false; status: number; message: string };
// May this account claim `tier` from the campaign now? `paidTier`: the plan it pays for (an active tierSubscriptions record), if any.
// `claimed`: this account (or its organisation) already has a claim from this campaign. Slots are checked separately, in the transaction.
export function claimCheck(c: Campaign, p: ClaimProfile | undefined, tier: unknown, now: Date, paidTier: string | null, claimed: boolean): ClaimCheck {
  if (!campaignLive(c, now)) return { ok: false, status: 409, message: `The ${c.code} offer isn't open.` };
  if (!isPromoTier(tier) || !poolOf(c, tier)) return { ok: false, status: 400, message: "Choose Enterprise, Business or Pro." };
  if (!p) return { ok: false, status: 404, message: "Finish setting up your profile first." };
  if (p.suspended === true) return { ok: false, status: 403, message: "Your account can't do that right now." };
  if (p.role === "reader" || !p.accountTier || p.accountTier === "standard") return { ok: false, status: 403, message: "Plans are for publishers: switch to Free Basic first (Settings → Plan), then claim." };
  if (claimed) return { ok: false, status: 409, message: `You've already claimed a plan with ${c.code}. It's one per account.` };
  const full = { ok: false as const, status: 409, message: `Your account already has ${NAME[tier]} or more. Pick a higher plan, or leave the slot for someone else.` };
  // A plan it pays for (or was given for good) at this level or higher: the slot would be wasted.
  const trialRunning = !!p.trialUntil && Date.parse(p.trialUntil) > now.getTime();
  if (Math.max(RANK[paidTier ?? ""] ?? 0, trialRunning ? 0 : RANK[p.accountTier] ?? 0) >= RANK[tier]) return full;
  // A trial (or an earlier promo) running: only a higher plan, or the same plan for longer, is worth claiming.
  if (trialRunning) {
    const t = RANK[p.trialTier ?? ""] ?? 0;
    if (t > RANK[tier] || (t === RANK[tier] && Date.parse(p.trialUntil!) >= Date.parse(promoUntil(c, tier, now)))) return full;
  }
  return { ok: true };
}

// The end of a promo plan claimed now.
export const promoUntil = (c: Campaign, tier: PromoTier, now: Date) => new Date(now.getTime() + (poolOf(c, tier)?.days ?? 0) * 86_400_000).toISOString();
export const promoSource = (c: Campaign) => `promo:${c.id}`;
export const isPromoSource = (s: unknown) => typeof s === "string" && s.startsWith("promo:");
