import { BADGE_PRICE_KOBO, TIERS, setBadgePriceKobo } from "./tiers";
import { GOLD_PRICING } from "./gold";
import { BOOST_PACKAGES } from "./boost-config";
import { AD_PACKAGES } from "./ad-packages";
import { GEMS, GEM_INFO, isReset, type Gem, type GemRates, type ResetEvery } from "./nana-gems";

// Prices and revenue rates that an admin can change from /admin/pricing, in one plain object. The rest of the app still reads TIERS,
// GOLD_PRICING, BOOST_PACKAGES, AD_PACKAGES and BADGE_PRICE_KOBO; applyPricing() writes the chosen values into those in place, so
// nothing else has to change. The saved copy lives in platformSettings/pricing (server-only); see lib/pricing-server.ts.
// Money is kobo; rates are fractions 0–1 (the admin form shows percents).
export class PricingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type TierRates = { session: number; physical: number; digital: number; adShare: number };
export type PricingConfig = {
  basic: TierRates;
  pro: TierRates & { monthlyKobo: number; yearlyKobo: number };
  business: TierRates & { monthlyKobo: number; yearlyKobo: number };
  // Enterprise is agreed per account: these are the "from" prices shown, the floor rates used when no account rate is set, and the ad share.
  enterprise: { fromMonthlyKobo: number; fromYearlyKobo: number; adShare: number; floorSession: number; floorPhysical: number; floorDigital: number };
  // The two course packages on top of Enterprise (docs/COURSES.md): Enterprise Courses, and the Academy API's "from" price before usage.
  coursePackages: { enterpriseCoursesMonthlyKobo: number; academyApiFromMonthlyKobo: number; certificateMinKobo: number };
  // Certificates on free courses claimed late: free for the grace days after completing, then the price rises by weeklyRate of the
  // starting price each full week (not compounding), up to capRate. Shown to the learner before they pay (a "late claim fee").
  certificateLate: { graceDays: number; weeklyRate: number; capRate: number };
  // Nana (the AI helper and, in phase 2, the operator) on our AI account (lib/nana-gems.ts): each plan's monthly allowance, shared out
  // over the reset period (a day, a week or a month); the credit packs anyone can buy, which never expire and are spent after the
  // allowance; a ceiling on what allowances can cost the whole site each month (bought credit isn't stopped by it); what the models
  // cost us (US dollars per million tokens, and the naira to the dollar); and whether the allowance covers every gem the plan allows
  // or Pearl only. Members with their own AI key are not metered.
  nana: {
    budgets: { standard: number; basic: number; pro: number; business: number; enterprise: number };
    topUps: { id: string; name: string; priceKobo: number; creditKobo: number }[];
    siteCeilingKobo: number;
    resetEvery: ResetEvery;
    allowanceGems: "all" | "pearl";
    usdKobo: number;
    rates: Record<Gem, GemRates>;
  };
  badgeKobo: number;
  gold: { personal: { monthlyKobo: number; depositKobo: number }; corporate: { monthlyKobo: number; depositKobo: number } };
  boosts: { id: string; name: string; impressions: number; priceKobo: number }[];
  ads: { id: string; name: string; impressions: number; priceKobo: number }[];
};

const tier = (t: string) => TIERS.find((x) => x.tier === t)!;
const num = (v: number | "custom") => (typeof v === "number" ? v : 0);
const rates = (t: string): TierRates => ({ session: num(tier(t).sessionAndUnlockCommission), physical: num(tier(t).physicalCommission), digital: num(tier(t).digitalCommission), adShare: tier(t).adRevenueShare ?? 0 });

// The values in force right now, read back from the live objects.
export function currentPricing(): PricingConfig {
  const e = tier("enterprise");
  return {
    basic: rates("basic"),
    pro: { ...rates("pro"), monthlyKobo: tier("pro").monthlyKobo!, yearlyKobo: tier("pro").yearlyKobo! },
    business: { ...rates("business"), monthlyKobo: tier("business").monthlyKobo!, yearlyKobo: tier("business").yearlyKobo! },
    enterprise: { fromMonthlyKobo: ENTERPRISE_FROM.monthly, fromYearlyKobo: ENTERPRISE_FROM.yearly, adShare: e.adRevenueShare ?? 0, floorSession: e.sessionAndUnlockCommissionFloor ?? 0.05, floorPhysical: e.physicalCommissionFloor ?? 0.01, floorDigital: e.digitalCommissionFloor ?? 0.015 },
    coursePackages: { ...COURSE_PACKAGES },
    certificateLate: { ...CERTIFICATE_LATE },
    nana: { budgets: { ...NANA.budgets }, topUps: NANA.topUps.map((t) => ({ ...t })), siteCeilingKobo: NANA.siteCeilingKobo, resetEvery: NANA.resetEvery, allowanceGems: NANA.allowanceGems, usdKobo: NANA.usdKobo, rates: { pearl: { ...NANA.rates.pearl }, emerald: { ...NANA.rates.emerald }, ruby: { ...NANA.rates.ruby } } },
    badgeKobo: BADGE_PRICE_KOBO,
    gold: { personal: { monthlyKobo: GOLD_PRICING.personal.monthlyKobo, depositKobo: GOLD_PRICING.personal.identityDepositKobo }, corporate: { monthlyKobo: GOLD_PRICING.corporate.monthlyKobo, depositKobo: GOLD_PRICING.corporate.identityDepositKobo } },
    boosts: BOOST_PACKAGES.map((p) => ({ id: p.id, name: p.name, impressions: p.impressions, priceKobo: p.priceKobo })),
    ads: AD_PACKAGES.map((p) => ({ id: p.id, name: p.name, impressions: p.impressions, priceKobo: p.priceKobo })),
  };
}
// Enterprise has no fixed price in TIERS (only display text), so its "from" prices are kept here.
const ENTERPRISE_FROM = { monthly: 55_000 * 100, yearly: 550_000 * 100 };
// The Enterprise course packages, kept here for the same reason. The regular Enterprise price above doesn't change with them.
// certificateMinKobo: our part of a certificate on a free course (the teacher's margin comes on top).
const COURSE_PACKAGES = { enterpriseCoursesMonthlyKobo: 100_000 * 100, academyApiFromMonthlyKobo: 250_000 * 100, certificateMinKobo: 999 * 100 };
const CERTIFICATE_LATE = { graceDays: 7, weeklyRate: 0.01, capRate: 0.5 };
// Allowances in kobo of AI cost a month. Free Basic's is ours to give (our commission on Basic sales pays for it); 4 weekly summaries
// on the small model cost about ₦15, so ₦50 leaves room. Free (Standard) members get the same. Top-ups keep 20% for card fees and
// running costs. The model prices are the published per-million-token list prices; check them when a model changes.
const NANA: PricingConfig["nana"] = {
  budgets: { standard: 50 * 100, basic: 50 * 100, pro: 750 * 100, business: 3_000 * 100, enterprise: 10_000 * 100 },
  topUps: [
    { id: "nana-1k", name: "Starter", priceKobo: 1_000 * 100, creditKobo: 800 * 100 },
    { id: "nana-2k5", name: "Plus", priceKobo: 2_500 * 100, creditKobo: 2_100 * 100 },
    { id: "nana-5k", name: "Max", priceKobo: 5_000 * 100, creditKobo: 4_400 * 100 },
  ],
  siteCeilingKobo: 500_000 * 100,
  resetEvery: "week",
  allowanceGems: "all",
  usdKobo: 1_600 * 100,
  rates: { pearl: { inUsd: 1, outUsd: 5 }, emerald: { inUsd: 3, outUsd: 15 }, ruby: { inUsd: 5, outUsd: 25 } },
};
export const DEFAULT_PRICING: PricingConfig = currentPricing();

// What a certificate costs on a given day: the starting price (our minimum + the teacher's margin), plus the late claim fee once the
// grace days after completing are over. Whole kobo, rounded up to the next naira.
export function certificatePrice(startKobo: number, completedAt: string, now: Date, late = CERTIFICATE_LATE): { kobo: number; lateKobo: number; weeksLate: number; capped: boolean } {
  const days = Math.floor((now.getTime() - Date.parse(completedAt)) / 86_400_000);
  const weeksLate = days > late.graceDays ? Math.floor((days - late.graceDays) / 7) : 0;
  const rate = Math.min(late.capRate, weeksLate * late.weeklyRate);
  const lateKobo = Math.ceil((startKobo * rate) / 100) * 100;
  return { kobo: startKobo + lateKobo, lateKobo, weeksLate, capped: weeksLate * late.weeklyRate >= late.capRate && late.capRate > 0 };
}

const group = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const nairaText = (kobo: number) => `₦${group(kobo / 100)}`;
const monthsFree = (monthly: number, yearly: number) => { const f = 12 - yearly / monthly; return Number.isInteger(f) && f >= 1 ? ` (${f} month${f === 1 ? "" : "s"} free)` : ""; };

// Writes a config into the live objects. Safe to call repeatedly with the same values.
export function applyPricing(c: PricingConfig): void {
  const setRates = (t: string, r: TierRates) => { const x = tier(t); x.sessionAndUnlockCommission = r.session; x.physicalCommission = r.physical; x.digitalCommission = r.digital; x.adRevenueShare = r.adShare; };
  setRates("basic", c.basic);
  for (const t of ["pro", "business"] as const) {
    const x = tier(t); const v = c[t];
    setRates(t, v);
    x.monthlyKobo = v.monthlyKobo; x.yearlyKobo = v.yearlyKobo;
    x.price = `${nairaText(v.monthlyKobo)}/month`;
    x.priceNote = `or ${nairaText(v.yearlyKobo)}/year${monthsFree(v.monthlyKobo, v.yearlyKobo)} · cancel anytime`;
  }
  const e = tier("enterprise");
  ENTERPRISE_FROM.monthly = c.enterprise.fromMonthlyKobo; ENTERPRISE_FROM.yearly = c.enterprise.fromYearlyKobo;
  e.adRevenueShare = c.enterprise.adShare;
  e.sessionAndUnlockCommissionFloor = c.enterprise.floorSession; e.physicalCommissionFloor = c.enterprise.floorPhysical; e.digitalCommissionFloor = c.enterprise.floorDigital;
  e.price = `Starting from ${nairaText(c.enterprise.fromMonthlyKobo)}+/month`;
  e.priceNote = `or ${nairaText(c.enterprise.fromYearlyKobo)}+/year${monthsFree(c.enterprise.fromMonthlyKobo, c.enterprise.fromYearlyKobo)} · cancel anytime · rates and seats agreed with us`;
  Object.assign(COURSE_PACKAGES, c.coursePackages);
  Object.assign(CERTIFICATE_LATE, c.certificateLate);
  Object.assign(NANA.budgets, c.nana.budgets); NANA.siteCeilingKobo = c.nana.siteCeilingKobo;
  NANA.resetEvery = c.nana.resetEvery; NANA.allowanceGems = c.nana.allowanceGems; NANA.usdKobo = c.nana.usdKobo;
  for (const g of GEMS) Object.assign(NANA.rates[g], c.nana.rates[g]);
  for (const t of c.nana.topUps) { const p = NANA.topUps.find((x) => x.id === t.id); if (p) { p.priceKobo = t.priceKobo; p.creditKobo = t.creditKobo; } }
  setBadgePriceKobo(c.badgeKobo);
  for (const k of ["personal", "corporate"] as const) { GOLD_PRICING[k].monthlyKobo = c.gold[k].monthlyKobo; GOLD_PRICING[k].identityDepositKobo = c.gold[k].depositKobo; }
  for (const b of c.boosts) { const p = BOOST_PACKAGES.find((x) => x.id === b.id); if (p) { p.impressions = b.impressions; p.priceKobo = b.priceKobo; p.maxPerDay = Math.ceil(b.impressions / p.minDays); } }
  for (const a of c.ads) { const p = AD_PACKAGES.find((x) => x.id === a.id); if (p) { p.impressions = a.impressions; p.priceKobo = a.priceKobo; } }
}

// ── Checking what an admin typed ────────────────────────────────────────────────────────────────────────────────────────────────────────
const MAX_KOBO = 10_000_000 * 100; // ₦10 million: a typo guard
const kobo = (v: unknown, what: string, min = 0): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > MAX_KOBO) throw new PricingError(`${what}: enter an amount in naira${min ? ` of at least ${nairaText(min)}` : ""}, up to ${nairaText(MAX_KOBO)}.`);
  return n;
};
const frac = (v: unknown, what: string, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new PricingError(`${what}: enter a percentage between 0 and ${Math.round(max * 100)}.`);
  return Math.round(n * 10000) / 10000;
};
const bad = (msg: string): never => { throw new PricingError(msg); };
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export function cleanPricing(input: unknown): PricingConfig {
  const i = rec(input), d = DEFAULT_PRICING;
  const r = (v: unknown, name: string, max = 0.6): TierRates => { const o = rec(v); return { session: frac(o.session, `${name} session and unlock rate`, max), physical: frac(o.physical, `${name} physical-goods rate`, max), digital: frac(o.digital, `${name} digital-goods rate`, max), adShare: frac(o.adShare, `${name} ad share`, 1) }; };
  const paid = (v: unknown, name: string) => {
    const o = rec(v), monthlyKobo = kobo(o.monthlyKobo, `${name} monthly price`, 100 * 100), yearlyKobo = kobo(o.yearlyKobo, `${name} yearly price`, 100 * 100);
    if (yearlyKobo < monthlyKobo) throw new PricingError(`${name}: the yearly price is lower than one month. Check the numbers.`);
    if (yearlyKobo > monthlyKobo * 12) throw new PricingError(`${name}: the yearly price is more than twelve months. Check the numbers.`);
    return { ...r(v, name), monthlyKobo, yearlyKobo };
  };
  const e = rec(i.enterprise);
  const fromMonthlyKobo = kobo(e.fromMonthlyKobo, "Enterprise monthly 'from' price", 100 * 100), fromYearlyKobo = kobo(e.fromYearlyKobo, "Enterprise yearly 'from' price", 100 * 100);
  if (fromYearlyKobo < fromMonthlyKobo || fromYearlyKobo > fromMonthlyKobo * 12) throw new PricingError("Enterprise: the yearly 'from' price should be between one and twelve months.");
  // A config saved before the course packages existed has none: keep the defaults for them instead of refusing the whole config.
  const cp = i.coursePackages === undefined ? d.coursePackages : rec(i.coursePackages);
  const coursePackages = {
    enterpriseCoursesMonthlyKobo: kobo(cp.enterpriseCoursesMonthlyKobo, "Enterprise Courses monthly price", 100 * 100),
    academyApiFromMonthlyKobo: kobo(cp.academyApiFromMonthlyKobo, "Enterprise Academy API monthly 'from' price", 100 * 100),
    // added after the packages: a config without it keeps the default
    certificateMinKobo: cp.certificateMinKobo === undefined ? d.coursePackages.certificateMinKobo : kobo(cp.certificateMinKobo, "Certificate minimum", 100 * 100),
  };
  // Added later: a config saved before these existed keeps their defaults.
  const cl = i.certificateLate === undefined ? d.certificateLate : rec(i.certificateLate);
  const graceDays = Math.round(Number(cl.graceDays));
  if (!Number.isFinite(graceDays) || graceDays < 0 || graceDays > 365) throw new PricingError("Certificate late fee: grace days should be between 0 and 365.");
  const certificateLate = { graceDays, weeklyRate: frac(cl.weeklyRate, "Certificate late fee per week", 0.25), capRate: frac(cl.capRate, "Certificate late fee cap", 5) };
  const n = i.nana === undefined ? d.nana : rec(i.nana), nb = rec(n.budgets);
  const nana = {
    // Free (Standard) was added later: a config without it gets the default
    budgets: { standard: nb.standard === undefined ? d.nana.budgets.standard : kobo(nb.standard, "Nana budget, Free"), basic: kobo(nb.basic, "Nana budget, Free Basic"), pro: kobo(nb.pro, "Nana budget, Pro"), business: kobo(nb.business, "Nana budget, Business"), enterprise: kobo(nb.enterprise, "Nana budget, Enterprise") },
    topUps: d.nana.topUps.map((b) => {
      const o = rec((Array.isArray(n.topUps) ? n.topUps : []).find((x) => rec(x).id === b.id));
      const priceKobo = kobo(o.priceKobo, `Nana top-up ${b.name} price`, 100 * 100), creditKobo = kobo(o.creditKobo, `Nana top-up ${b.name} credit`, 100);
      if (creditKobo > priceKobo) throw new PricingError(`Nana top-up ${b.name}: the credit is more than the price.`);
      return { id: b.id, name: b.name, priceKobo, creditKobo };
    }),
    siteCeilingKobo: kobo(n.siteCeilingKobo, "Nana site-wide monthly ceiling", 1_000 * 100),
    // The timer, the gems and the model prices came after: a config without them keeps the defaults.
    resetEvery: n.resetEvery === undefined ? d.nana.resetEvery : isReset(n.resetEvery) ? n.resetEvery : bad("Nana allowance: reset every day, week or month."),
    allowanceGems: n.allowanceGems === undefined ? d.nana.allowanceGems : n.allowanceGems === "all" || n.allowanceGems === "pearl" ? n.allowanceGems : bad("Nana allowance: covers every gem, or Pearl only."),
    usdKobo: n.usdKobo === undefined ? d.nana.usdKobo : kobo(n.usdKobo, "Naira to the dollar", 100 * 100),
    rates: Object.fromEntries(GEMS.map((g) => {
      const o = n.rates === undefined ? d.nana.rates[g] : rec(rec(n.rates)[g]);
      const usd = (v: unknown, what: string) => { const x = Number(v); if (!Number.isFinite(x) || x < 0 || x > 1000) throw new PricingError(`${GEM_INFO[g].name} ${what}: enter US dollars per million tokens, 0 to 1,000.`); return Math.round(x * 1000) / 1000; };
      return [g, { inUsd: usd(o.inUsd, "input price"), outUsd: usd(o.outUsd, "output price") }];
    })) as Record<Gem, GemRates>,
  };
  const g = rec(i.gold);
  const gold = (v: unknown, n: string) => { const o = rec(v); return { monthlyKobo: kobo(o.monthlyKobo, `${n} gold monthly`, 100 * 100), depositKobo: kobo(o.depositKobo, `${n} gold check deposit`) }; };
  const list = (v: unknown, base: PricingConfig["boosts"], name: string) => base.map((b) => {
    const o = rec((Array.isArray(v) ? v : []).find((x) => rec(x).id === b.id));
    const impressions = Math.round(Number(o.impressions));
    if (!Number.isFinite(impressions) || impressions < 100 || impressions > 10_000_000) throw new PricingError(`${name} ${b.name}: impressions should be between 100 and 10,000,000.`);
    return { id: b.id, name: b.name, impressions, priceKobo: kobo(o.priceKobo, `${name} ${b.name} price`, 100 * 100) };
  });
  return {
    basic: r(i.basic, "Free Basic"), pro: paid(i.pro, "Pro"), business: paid(i.business, "Business"),
    enterprise: { fromMonthlyKobo, fromYearlyKobo, adShare: frac(e.adShare, "Enterprise ad share", 1), floorSession: frac(e.floorSession, "Enterprise session floor", 0.5), floorPhysical: frac(e.floorPhysical, "Enterprise physical floor", 0.5), floorDigital: frac(e.floorDigital, "Enterprise digital floor", 0.5) },
    coursePackages, certificateLate, nana,
    badgeKobo: kobo(i.badgeKobo, "Verified badge price", 100 * 100),
    gold: { personal: gold(g.personal, "Personal"), corporate: gold(g.corporate, "Organisation") },
    boosts: list(i.boosts, d.boosts, "Boost"), ads: list(i.ads, d.ads, "Ad package"),
  };
}

// A short plain-words list of what changed, for the log and the notice to the owner.
export function describeChanges(a: PricingConfig, b: PricingConfig): string[] {
  const out: string[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if ((typeof x === "number" && typeof y === "number") || (typeof x === "string" && typeof y === "string")) { if (x !== y) out.push(`${path}: ${x} → ${y}`); return; }
    if (Array.isArray(x) && Array.isArray(y)) { x.forEach((v, n) => walk(v, y[n], `${path}.${rec(v).id ?? n}`)); return; }
    if (x && y && typeof x === "object") Object.keys(x as object).forEach((k) => walk((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  };
  walk(a, b, "");
  return out;
}

// For wording on pages: read these when rendering (not at import), so an admin's change shows up.
export const pct = (x: number) => `${+(x * 100).toFixed(1)}%`;
export const planRate = (tierName: "basic" | "pro" | "business", kind: "session" | "physical" | "digital" | "adShare") => {
  const t = TIERS.find((x) => x.tier === tierName)!;
  const v = kind === "session" ? t.sessionAndUnlockCommission : kind === "physical" ? t.physicalCommission : kind === "digital" ? t.digitalCommission : t.adRevenueShare;
  return pct(typeof v === "number" ? v : 0);
};
export const planPrice = (tierName: "pro" | "business") => nairaText(TIERS.find((x) => x.tier === tierName)!.monthlyKobo!);
export const enterpriseFrom = () => nairaText(currentPricing().enterprise.fromMonthlyKobo);
export const enterpriseCoursesPrice = () => nairaText(COURSE_PACKAGES.enterpriseCoursesMonthlyKobo);
export const academyApiFrom = () => nairaText(COURSE_PACKAGES.academyApiFromMonthlyKobo);
export const certificateMin = () => nairaText(COURSE_PACKAGES.certificateMinKobo);
// Monthly earnings from sessions, subscriptions and gifts above which a paid plan costs less than the extra commission it saves.
export const breakEven = (tierName: "pro" | "business") => {
  const b = TIERS.find((x) => x.tier === "basic")!.sessionAndUnlockCommission as number, t = TIERS.find((x) => x.tier === tierName)!;
  const saved = b - (t.sessionAndUnlockCommission as number);
  return saved > 0 ? `₦${group(Math.round(t.monthlyKobo! / 100 / saved / 1000) * 1000)}` : "more than you would earn";
};
