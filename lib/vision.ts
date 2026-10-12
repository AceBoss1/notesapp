// The Vision model in the team hub: how funding rounds, the staff option pool and an optional dual-class vote change what each founder owns, what it is
// worth on paper, how much of the vote each holds, and how long cash lasts. Pure functions, shared by the page (live sliders) and the checks.
// Planning only: not a forecast and not an offer of securities. Paper value = stake x the last post-money; it ignores liquidation preferences and tax.

export type PersonKey = "emmanuel" | "chimdinma" | "akujuobi" | "nora";
export const PERSON_LABEL: Record<PersonKey, string> = { emmanuel: "Emmanuel Adams", chimdinma: "Chimdinma Onwuegbu", akujuobi: "Akujuobi Ifeyinwa Maureen", nora: "Nora Bawa" };
export const FOUNDERS: PersonKey[] = ["emmanuel", "chimdinma", "akujuobi"];
export const isFounder = (p: PersonKey | null | undefined) => !!p && FOUNDERS.includes(p);

// Who is signed in, as a team member. An explicit email list (VISION_PEOPLE="chimdinma=a@x.com,akujuobi=b@y.com,nora=c@z.com") wins; otherwise the
// owner is Emmanuel and everyone else is recognised by the name on their account. null = not one of the four (they don't get the model).
export function personFor(input: { name?: string; email?: string; owner?: boolean }, map?: string): PersonKey | null {
  const email = (input.email || "").trim().toLowerCase();
  for (const part of (map || "").split(",")) {
    const [k, e] = part.split("=").map((s) => s.trim().toLowerCase());
    if (k && e && e === email && k in PERSON_LABEL) return k as PersonKey;
  }
  if (input.owner) return "emmanuel";
  const n = (input.name || "").toLowerCase();
  if (/chimdinma|onwuegbu/.test(n)) return "chimdinma";
  if (/akujuobi|ifeyinwa/.test(n)) return "akujuobi";
  if (/\bnora\b|bawa/.test(n)) return "nora";
  if (/\bemmanuel\b/.test(n) && /adams/.test(n)) return "emmanuel";
  return null;
}

export type Round = { name: string; on: boolean; raise: number; post: number; topup: number }; // US$ ; topup = % of the company added to the pool before the round
export type Founders = { trackB: boolean; bridge: number; cPct: number; aPct: number; cCash: number; aCash: number };
export type Company = { pool: number; poolAt: "formation" | "preA" | "none"; rounds: Round[]; dual: "never" | "last" | "all"; V: number; classB: [boolean, boolean, boolean] };
export type Business = { users: number; conv: number; churn: number; burn: number; cash: number; fx: number };

// 0 Emmanuel 1 Chimdinma 2 Akujuobi 3 angels 4 FEBO reserve 5 option pool 6.. one investor per round
export const HOLDERS = ["Emmanuel Adams", "Chimdinma Onwuegbu", "Akujuobi Ifeyinwa Maureen", "Angels (bridge)", "FEBO reserve", "Option pool"];
export const ROUND_NAMES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Exit / IPO"];
const N = 12;

export type Snap = { name: string; v: number[]; vote: number[]; post: number };
export type Result = { snaps: Snap[]; last: Snap; finalValue: number; raises: number[]; warnings: { poolLate: boolean } };

// Founders' starting split. The bridge sells 5% per US$10,000 of a 15% block to angels; what is not sold is the FEBO reserve (no votes while unallocated).
export function startingSplit(f: Founders) {
  const angel = f.trackB ? Math.min(15, (f.bridge / 10000) * 5) : 0;
  const febo = f.trackB ? 15 - angel : 0;
  const e = 100 - f.cPct - f.aPct - (f.trackB ? 15 : 0);
  return { e, c: f.cPct, a: f.aPct, angel, febo };
}

export function runModel(f: Founders, c: Company): Result {
  const s = startingSplit(f);
  const cur = new Array<number>(N).fill(0);
  [s.e, s.c, s.a, s.angel, s.febo].forEach((x, i) => (cur[i] = x / 100));
  const snaps: { name: string; v: number[]; post: number }[] = [{ name: "Start", v: cur.slice(), post: 0 }];
  const pool = c.pool / 100;
  let poolDone = false;
  const carve = () => { for (let k = 0; k < N; k++) cur[k] *= 1 - pool; cur[5] += pool; poolDone = true; snaps.push({ name: "Pool", v: cur.slice(), post: 0 }); };
  if (c.poolAt === "formation" && pool > 0) carve();
  const raises = new Array<number>(N).fill(0);
  let finalValue = 0;
  c.rounds.forEach((r, i) => {
    if (!r.on) return;
    if (i >= 2 && c.poolAt === "preA" && !poolDone && pool > 0) carve();
    const p = r.post > 0 ? r.raise / r.post : 0;
    const t = r.topup / 100;
    const keep = Math.max(0, 1 - p - t);
    for (let k = 0; k < N; k++) cur[k] *= keep;
    cur[5] += t;
    cur[6 + i] = p;
    raises[6 + i] = r.raise;
    snaps.push({ name: r.name, v: cur.slice(), post: r.post });
    finalValue = r.post;
  });
  const out: Snap[] = snaps.map((sn, idx) => {
    const dual = c.dual === "all" || (c.dual === "last" && idx === snaps.length - 1);
    // Unissued pool and unsold FEBO shares carry no votes; investors vote as converted.
    const w = sn.v.map((x, k) => (k === 4 || k === 5 ? 0 : x * (k < 3 && c.classB[k] && dual ? c.V : 1)));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    return { ...sn, vote: w.map((x) => x / tot) };
  });
  return { snaps: out, last: out[out.length - 1], finalValue, raises, warnings: { poolLate: c.poolAt === "preA" } };
}

// An employee option granted from the pool at formation (Nora Bawa: 1.50% of fully diluted) is diluted only by the rounds, never by the founders' split.
// Returns her share of the company after each stage, in the same stage order as the founders' table.
export function optionPath(pctAtGrant: number, c: Company): { name: string; pct: number; post: number }[] {
  const out = [{ name: "Grant", pct: pctAtGrant / 100, post: 0 }];
  let cur = pctAtGrant / 100;
  c.rounds.forEach((r) => {
    if (!r.on) return;
    const p = r.post > 0 ? r.raise / r.post : 0;
    cur *= Math.max(0, 1 - p - r.topup / 100);
    out.push({ name: r.name, pct: cur, post: r.post });
  });
  return out;
}

// Planning case from the CAC model: N 79.586 of net recurring revenue per registered user for each 1% of paying conversion, after gateway fees and the
// commission given up (100,000 users at 1% = N7,958,600 a month). Churn is applied after the first month, as in the 12-month figure (about N62.9M).
export const NET_PER_USER_PER_PCT = 79.586;
export function runway(b: Business) {
  const mrr = b.users * b.conv * NET_PER_USER_PER_PCT;
  const ch = b.churn / 100;
  const cum = ch > 0 ? (mrr * (1 - Math.pow(1 - ch, 12))) / ch : mrr * 12;
  return {
    mrr, surplus: mrr - b.burn,
    breakEvenConv: b.users > 0 ? b.burn / (b.users * NET_PER_USER_PER_PCT) : 0,
    cum12: cum, cashAfter12: b.cash + cum - 12 * b.burn,
    monthsOnCash: b.burn > 0 ? b.cash / b.burn : Infinity,
    monthsWithRevenue: b.burn > mrr ? b.cash / (b.burn - mrr) : Infinity,
  };
}

export type Scenario = { key: "worst" | "base" | "vision"; label: string; note: string; company: Pick<Company, "pool" | "poolAt" | "rounds" | "dual" | "V">; business: Business };
const R = (name: string, on: boolean, raise: number, post: number, topup = 0): Round => ({ name, on, raise, post, topup });
const noRound = (name: string) => R(name, false, 0, 0);
export const SCENARIOS: Scenario[] = [
  {
    key: "worst", label: "Worst case", note: "Bridge and a small Pre-Seed only, then a modest sale.",
    company: { pool: 15, poolAt: "formation", dual: "never", V: 10, rounds: [R("Pre-Seed", true, 100_000, 1_000_000), R("Seed", false, 1_000_000, 6_000_000), R("Series A", false, 8_000_000, 40_000_000), noRound("Series B"), noRound("Series C"), R("Exit (small sale)", true, 0, 3_000_000)] },
    business: { users: 25_000, conv: 0.25, churn: 12, burn: 1_142_600, cash: 665_000, fx: 1333 },
  },
  {
    key: "base", label: "Baseline", note: "Pre-Seed and Seed as planned, a Series A, then a sale.",
    company: { pool: 15, poolAt: "formation", dual: "never", V: 10, rounds: [R("Pre-Seed", true, 250_000, 3_571_429), R("Seed", true, 1_000_000, 14_285_714), R("Series A", true, 8_000_000, 40_000_000), noRound("Series B"), noRound("Series C"), R("Exit (sale)", true, 0, 150_000_000)] },
    business: { users: 100_000, conv: 1, churn: 8, burn: 1_142_600, cash: 665_000, fx: 1333 },
  },
  {
    key: "vision", label: "Vision", note: "Every round to a US$7.5B listing. Aspirational: paper value only.",
    company: { pool: 15, poolAt: "preA", dual: "last", V: 10, rounds: [R("Pre-Seed", true, 250_000, 3_571_429), R("Seed", true, 1_000_000, 14_285_714), R("Series A", true, 150_000_000, 1_000_000_000), R("Series B", true, 250_000_000, 2_500_000_000), R("Series C", true, 500_000_000, 5_000_000_000), R("IPO", true, 750_000_000, 7_500_000_000)] },
    business: { users: 250_000, conv: 2, churn: 6, burn: 1_142_600, cash: 14_663_000, fx: 1333 },
  },
];

export const fmtUsd = (n: number) => { const a = Math.abs(n); return a >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`; };
export const fmtPct = (x: number) => `${(x * 100).toFixed(2)}%`;
