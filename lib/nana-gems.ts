import type { AccountTier } from "./users";

// Nana's models, as members see them: three gems, the dearer the gem the more capable (and costly) the model behind it.
//   Ruby    → Claude Opus   (our most capable; Enterprise)
//   Emerald → Claude Sonnet (deeper answers; Business and Enterprise)
//   Pearl   → Claude Haiku  (fast and light; everyone)
// Effort (how long Nana thinks before answering) follows the same ladder: Quick for everyone, Balanced from Business, Thorough on
// Enterprise. The model ids live in settings (NANA_MODEL, NANA_MODEL_EMERALD, NANA_MODEL_RUBY; lib/nana-server.ts).
//
// Every member gets an allowance in naira of AI cost (Admin → Pricing → Nana AI), sized by plan and refreshed on a timer (a day, a
// week or a month). It is spent first; then the Nana credit they bought, which never expires. A dearer gem uses either faster.
// This file is pure (no database), so the page and the server share it.

export const GEMS = ["pearl", "emerald", "ruby"] as const;
export type Gem = (typeof GEMS)[number];
export const isGem = (g: unknown): g is Gem => typeof g === "string" && (GEMS as readonly string[]).includes(g);
export const GEM_INFO: Record<Gem, { name: string; family: string; blurb: string; color: string; from: AccountTier }> = {
  pearl: { name: "Pearl", family: "Haiku", blurb: "Fast and light, for everyday questions", color: "#D9CFC1", from: "standard" },
  emerald: { name: "Emerald", family: "Sonnet", blurb: "Deeper answers and better writing", color: "#0F8A5F", from: "business" },
  ruby: { name: "Ruby", family: "Opus", blurb: "Our most capable, for the hardest work", color: "#B0123B", from: "enterprise" },
};

export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];
export const isEffort = (e: unknown): e is Effort => typeof e === "string" && (EFFORTS as readonly string[]).includes(e);
export const EFFORT_INFO: Record<Effort, { name: string; blurb: string; from: AccountTier; chatTokens: number }> = {
  low: { name: "Quick", blurb: "Answers straight away", from: "standard", chatTokens: 2000 },
  medium: { name: "Balanced", blurb: "Thinks a little first", from: "business", chatTokens: 4000 },
  high: { name: "Thorough", blurb: "Thinks it through", from: "enterprise", chatTokens: 8000 },
};

const RANK: Record<AccountTier, number> = { standard: 0, basic: 1, pro: 2, business: 3, enterprise: 4 };
const reaches = (tier: AccountTier, from: AccountTier) => RANK[tier] >= RANK[from];
export const gemsFor = (tier: AccountTier): Gem[] => GEMS.filter((g) => reaches(tier, GEM_INFO[g].from));
export const effortsFor = (tier: AccountTier): Effort[] => EFFORTS.filter((e) => reaches(tier, EFFORT_INFO[e].from));
// What someone asked for, brought down to the best their plan allows (never refused: Nana still answers).
export const pickGem = (tier: AccountTier, wanted: unknown): Gem => {
  const ok = gemsFor(tier);
  return isGem(wanted) && ok.includes(wanted) ? wanted : isGem(wanted) ? ok[ok.length - 1] : "pearl";
};
export const pickEffort = (tier: AccountTier, wanted: unknown): Effort => {
  const ok = effortsFor(tier);
  return isEffort(wanted) && ok.includes(wanted) ? wanted : isEffort(wanted) ? ok[ok.length - 1] : "low";
};
export const gemRank = (g: Gem) => GEMS.indexOf(g);
// The plan a gem or effort needs, for the "Business" / "Enterprise" labels on locked choices.
export const planName = (t: AccountTier) => ({ standard: "Free", basic: "Free Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" })[t];

// ── What a call cost ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The model's prices in US dollars per million tokens, and the naira rate, come from Admin → Pricing. Cached prompt reads are billed at
// a tenth of the input price (a twentieth on Ruby's model); cache writes at 1.25 times for the 5-minute cache and twice for the 1-hour one
// (Nana's instructions). We charge members exactly that, rounded up to the kobo.
export type GemRates = { inUsd: number; outUsd: number };
export type Usage = {
  input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
};
export const CACHE_READ: Record<Gem, number> = { pearl: 0.1, emerald: 0.1, ruby: 0.05 };
export function costKobo(u: Usage, r: GemRates, usdKobo: number, cacheRead = 0.1): number {
  const n = (v: number | null | undefined) => Math.max(0, Number(v) || 0);
  // The split by cache lifetime when the API gives it; otherwise every write counts as a 5-minute one.
  const hour = n(u.cache_creation?.ephemeral_1h_input_tokens);
  const writes = u.cache_creation ? n(u.cache_creation.ephemeral_5m_input_tokens) * 1.25 + hour * 2 : n(u.cache_creation_input_tokens) * 1.25;
  const inUnits = n(u.input_tokens) + writes + n(u.cache_read_input_tokens) * cacheRead;
  const usd = (inUnits * r.inUsd + n(u.output_tokens) * r.outUsd) / 1_000_000;
  return Math.ceil(usd * usdKobo);
}

// ── The allowance's timer ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Periods run on Lagos time (UTC+1, no daylight saving). A week starts on Monday. The monthly budget is shared out so a year of weeks
// or days adds up to a year of months.
export type ResetEvery = "day" | "week" | "month";
export const RESETS: ResetEvery[] = ["day", "week", "month"];
export const isReset = (v: unknown): v is ResetEvery => typeof v === "string" && (RESETS as string[]).includes(v);
const LAGOS = 3_600_000;
const lagos = (d: Date) => new Date(d.getTime() + LAGOS); // read with getUTC*
const fromLagos = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day) - LAGOS);

function periodStart(now: Date, every: ResetEvery): Date {
  const l = lagos(now);
  const y = l.getUTCFullYear(), m = l.getUTCMonth(), d = l.getUTCDate();
  if (every === "month") return fromLagos(y, m, 1);
  if (every === "day") return fromLagos(y, m, d);
  return fromLagos(y, m, d - ((l.getUTCDay() + 6) % 7)); // back to Monday
}
export function periodKey(now: Date, every: ResetEvery): string {
  const s = lagos(periodStart(now, every)).toISOString();
  return every === "month" ? s.slice(0, 7) : `${every === "week" ? "w" : "d"}${s.slice(0, 10)}`;
}
export function nextReset(now: Date, every: ResetEvery): Date {
  const l = lagos(periodStart(now, every));
  const y = l.getUTCFullYear(), m = l.getUTCMonth(), d = l.getUTCDate();
  return every === "month" ? fromLagos(y, m + 1, 1) : fromLagos(y, m, d + (every === "week" ? 7 : 1));
}
export function periodAllowance(monthlyKobo: number, every: ResetEvery): number {
  if (every === "month") return monthlyKobo;
  return Math.round((monthlyKobo * 12) / (every === "week" ? 52.1775 : 365.25));
}

// ── Spending ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A member's Nana account: the allowance used this period and the credit they bought. The allowance goes first; a call that costs more
// than is left takes the rest from credit, and never takes credit below zero (we carry the last few kobo).
export type NanaAccount = { period: string; usedKobo: number; creditKobo: number };
export type Standing = { allowanceKobo: number; usedKobo: number; leftKobo: number; creditKobo: number };
export function standing(a: Partial<NanaAccount> | undefined, period: string, allowanceKobo: number): Standing {
  const usedKobo = a?.period === period ? Math.max(0, Number(a.usedKobo) || 0) : 0;
  const creditKobo = Math.max(0, Number(a?.creditKobo) || 0);
  return { allowanceKobo, usedKobo, leftKobo: Math.max(0, allowanceKobo - usedKobo), creditKobo };
}
// Whether a call may start: allowance left (when it covers this gem), or any credit.
export const canStart = (s: Standing, allowanceCovers: boolean) => (allowanceCovers && s.leftKobo > 0) || s.creditKobo > 0;
export function spend(s: Standing, cost: number, allowanceCovers: boolean): { fromAllowance: number; fromCredit: number; usedKobo: number; creditKobo: number } {
  const fromAllowance = allowanceCovers ? Math.min(cost, s.leftKobo) : 0;
  const fromCredit = Math.min(cost - fromAllowance, s.creditKobo);
  return { fromAllowance, fromCredit, usedKobo: s.usedKobo + fromAllowance, creditKobo: s.creditKobo - fromCredit };
}
