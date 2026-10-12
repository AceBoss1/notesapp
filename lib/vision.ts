// The Vision model in the team hub: how funding rounds, the staff option pool and an optional dual-class vote change what each founder owns, what it is
// worth on paper, how much of the vote each holds, and how long cash lasts. Pure functions, shared by the page (live sliders) and the checks.
// Planning only: not a forecast and not an offer of securities. Paper value = stake x the last post-money; it ignores liquidation preferences and tax.

export type PersonKey = "emmanuel" | "chimdinma" | "akujuobi" | "nora";
export const PERSON_LABEL: Record<PersonKey, string> = { emmanuel: "Emmanuel Adams", chimdinma: "Chimdinma Onwuegbu", akujuobi: "Ifeyinwa Akujuobi", nora: "Nora Bawa" };
// The short name shown on chips and slider labels. Ifeyinwa is the name she uses on #NotesApp (@ify); the legal documents keep her registered name.
export const PERSON_SHORT: Record<PersonKey, string> = { emmanuel: "Emmanuel", chimdinma: "Chimdinma", akujuobi: "Ifeyinwa", nora: "Nora" };
// Sign-in by username: @ify is Ifeyinwa Akujuobi (the "akujuobi" key is the internal id of the second co-founder).
export const USERNAME_TO_PERSON: Record<string, PersonKey> = { ify: "akujuobi", chimdinma: "chimdinma" };
export const FOUNDERS: PersonKey[] = ["emmanuel", "chimdinma", "akujuobi"];
export const isFounder = (p: PersonKey | null | undefined) => !!p && FOUNDERS.includes(p);

// Who is signed in, as a team member. An explicit email list (VISION_PEOPLE="chimdinma=a@x.com,akujuobi=b@y.com,nora=c@z.com") wins; otherwise the
// owner is Emmanuel, then the username (@ify is Ifeyinwa Akujuobi), then the name on the account. null = not one of the four (they don't get the model).
export function personFor(input: { name?: string; email?: string; owner?: boolean; username?: string }, map?: string): PersonKey | null {
  const email = (input.email || "").trim().toLowerCase();
  for (const part of (map || "").split(",")) {
    const [k, e] = part.split("=").map((s) => s.trim().toLowerCase());
    if (k && e && e === email && k in PERSON_LABEL) return k as PersonKey;
  }
  if (input.owner) return "emmanuel";
  const u = (input.username || "").trim().toLowerCase().replace(/^@/, "");
  if (u && USERNAME_TO_PERSON[u]) return USERNAME_TO_PERSON[u];
  const n = (input.name || "").toLowerCase();
  if (/chimdinma|onwuegbu/.test(n)) return "chimdinma";
  if (/akujuobi|ifeyinwa/.test(n)) return "akujuobi";
  if (/\bnora\b|bawa/.test(n)) return "nora";
  if (/\bemmanuel\b/.test(n) && /adams/.test(n)) return "emmanuel";
  return null;
}

export type Round = { name: string; on: boolean; raise: number; post: number; target: number; users: number }; // US$ ; target = pool size wanted after the round, % (0 = no top-up) ; users = verified registered users needed before the round opens (0 = no gate)
export type Founders = { trackB: boolean; bridge: number; cPct: number; aPct: number; cCash: number; aCash: number };
export type Company = { pool: number; poolAt: "formation" | "preA" | "none"; rounds: Round[]; dual: "never" | "last" | "all"; V: number; classB: [boolean, boolean, boolean] };
export type Business = { users: number; conv: number; churn: number; burn: number; burnVar: number; burnExp: number; expansion: number; growth: number; cash: number; fx: number }; // burn = monthly cost at 100,000 users; burnVar = % of it that grows with users; burnExp = how fast that part grows (0 fixed, 1 in step with users); expansion = one-time spend to open new countries or continents, N; growth = new registered users each month, % of today's users

// 0 Emmanuel 1 Chimdinma 2 Akujuobi 3 angels 4 FEBO reserve 5 option pool 6.. one investor per round
export const HOLDERS = ["Emmanuel Adams", "Chimdinma Onwuegbu", "Ifeyinwa Akujuobi", "Angels (bridge)", "FEBO reserve", "Option pool"];
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

// The founders' sliders cannot all be pushed up at once: Emmanuel keeps at least EMMANUEL_MIN% of the founders' stock (after the angel block, if any), each
// co-founder holds between COFOUNDER_MIN% and COFOUNDER_MAX%. When one slider goes up and there is no room, the other co-founder comes down first; if that
// still is not enough (the other is already at the minimum), the slider you are moving stops where the limit is.
export const EMMANUEL_MIN = 50;
export const COFOUNDER_MIN = 2;
export const COFOUNDER_MAX = 25;
export function balanceFounders(f: Founders, moved: "c" | "a" | "bridge" = "c"): Founders {
  const block = f.trackB ? 15 : 0;
  const room = 100 - block - EMMANUEL_MIN; // what the two co-founders can hold between them
  let c = Math.min(COFOUNDER_MAX, Math.max(COFOUNDER_MIN, f.cPct));
  let a = Math.min(COFOUNDER_MAX, Math.max(COFOUNDER_MIN, f.aPct));
  if (c + a > room) {
    if (moved === "a") { c = Math.max(COFOUNDER_MIN, room - a); a = Math.min(a, room - c); }
    else { a = Math.max(COFOUNDER_MIN, room - c); c = Math.min(c, room - a); }
  }
  return { ...f, cPct: c, aPct: a };
}

// Per round: the share sold (raise / post-money) and the pool top-up needed to leave the pool at its target after the round (taken from existing holders, as
// investors usually require). Depends only on the pool and the rounds, never on the founders' split.
export function roundMath(c: Company): { p: number; t: number; poolAfter: number }[] {
  let pool = c.poolAt === "formation" ? c.pool / 100 : 0;
  let carved = c.poolAt !== "preA";
  return c.rounds.map((r, i) => {
    if (!r.on) return { p: 0, t: 0, poolAfter: pool };
    if (i >= 2 && !carved && c.pool > 0) { pool = c.pool / 100; carved = true; }
    const p = r.post > 0 ? r.raise / r.post : 0;
    const T = r.target / 100;
    const t = T > 0 && pool < 1 ? Math.min(Math.max(0, (T - pool * (1 - p)) / (1 - pool)), 1 - p) : 0;
    pool = pool * (1 - p - t) + t;
    return { p, t, poolAfter: pool };
  });
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
  const rm = roundMath(c);
  c.rounds.forEach((r, i) => {
    if (!r.on) return;
    if (i >= 2 && c.poolAt === "preA" && !poolDone && pool > 0) carve();
    const { p, t } = rm[i];
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
  const rm = roundMath(c);
  c.rounds.forEach((r, i) => {
    if (!r.on) return;
    cur *= Math.max(0, 1 - rm[i].p - rm[i].t);
    out.push({ name: r.name, pct: cur, post: r.post });
  });
  return out;
}

// Planning case from the CAC model: N 79.586 of net recurring revenue per registered user for each 1% of paying conversion, after gateway fees and the
// commission given up (100,000 users at 1% = N7,958,600 a month). Churn is applied after the first month, as in the 12-month figure (about N62.9M).
export const NET_PER_USER_PER_PCT = 79.586;
export const BURN_BASE_USERS = 100_000;
// Monthly burn grows with users, but slower than users: unit costs fall at scale (hosting, support tooling, payments) and revenue per user pays for it.
// The part that does not grow (tools, core team) stays; the part that does grows as (users / 100,000) raised to burnExp, never below the 100,000-user
// figure. Default: 70% of the N1,142,600 grows, with exponent 0.75: about N4.8M at 1M users, N85M at 50M and N240M (about US$180,000) at 200M.
// One-time expansion spend (new countries, a new continent) is separate: it is entered once and does not repeat every month.
export const burnAt = (b: Pick<Business, "burn" | "burnVar" | "burnExp" | "users">) => b.burn * (1 - b.burnVar / 100) + b.burn * (b.burnVar / 100) * Math.pow(Math.max(1, b.users / BURN_BASE_USERS), b.burnExp);
export function runway(b: Business) {
  const burn = burnAt(b);
  const mrr = b.users * b.conv * NET_PER_USER_PER_PCT;
  const ch = b.churn / 100;
  // New registered users keep arriving: each month b.growth % of today's users join, and a share of them (the paying conversion) become payers who then leave
  // at the churn rate like everyone else. Growth equal to churn holds net revenue steady. Burn follows the user count as it grows.
  const newMrr = b.users * (b.growth / 100) * b.conv * NET_PER_USER_PER_PCT;
  let cashNow = b.cash - b.expansion;
  let cashOutMonth: number | null = cashNow < 0 ? 0 : null;
  let cum12 = 0, cashAfter12 = 0, rev12 = 0, burn12 = burn, users12 = b.users;
  let rev = mrr;
  for (let m = 1; m <= 36; m++) {
    if (m > 1) rev = rev * (1 - ch) + newMrr;
    const users = b.users * (1 + (b.growth / 100) * (m - 1));
    const burnM = burnAt({ ...b, users });
    cashNow += rev - burnM;
    if (cashNow < 0 && cashOutMonth === null) cashOutMonth = m;
    if (m <= 12) cum12 += rev;
    if (m === 12) { cashAfter12 = cashNow; rev12 = rev; burn12 = burnM; users12 = users; }
  }
  return {
    mrr, burn, cashOutMonth, revMonth12: rev12, burnMonth12: burn12, users12, surplus: mrr - burn,
    breakEvenConv: b.users > 0 ? burn / (b.users * NET_PER_USER_PER_PCT) : 0,
    cum12, cashAfter12,
    monthsOnCash: burn > 0 ? b.cash / burn : Infinity,
    monthsWithRevenue: burn > mrr ? b.cash / (burn - mrr) : Infinity,
    steadyGrowth: b.churn, // monthly growth in users that holds net recurring revenue flat
  };
}

// The user gates: a round opens only when the platform has this many verified registered users. Board policy for planning, not a promise to investors or staff.
export const GATES = { seed: 1_000_000, seriesA: 10_000_000, seriesB: 50_000_000, seriesC: 200_000_000 };
export const GATE_NOTE = ["", "Seed gate", "Series A gate", "Series B gate (cross-country)", "Series C gate (cross-continent)"];
export const AFRICA_MOBILE_USERS = 650_000_000; // the founders' figure; source it (GSMA, UN) before using it outside the company

// Rounds whose user gate has not been reached cannot close: they drop out of the cap table until the users slider reaches the gate.
export function applyGates(c: Company, users: number, enforce: boolean): { company: Company; locked: boolean[] } {
  const locked = c.rounds.map((r) => enforce && r.on && r.users > users);
  return { company: { ...c, rounds: c.rounds.map((r, i) => (locked[i] ? { ...r, on: false } : r)) }, locked };
}
// What a round's valuation implies at the users it needs: dollars per user, and a multiple of the annualised net revenue those users give at this conversion.
export function roundStats(r: Round, conv: number, fx: number) {
  if (r.users <= 0 || r.post <= 0) return null;
  const annualUsd = (r.users * conv * NET_PER_USER_PER_PCT * 12) / (fx || 1333);
  return { perUser: r.post / r.users, multiple: annualUsd > 0 ? r.post / annualUsd : Infinity, shareOfAfrica: r.users / AFRICA_MOBILE_USERS };
}
// Users on a log scale for the slider: 1,000 up to USERS_MAX (250 million, past the 200 million Series C gate).
export const USERS_MAX = 250_000_000;
const USERS_SPAN = Math.log10(USERS_MAX) - 3;
export const usersFromPos = (pos: number) => (pos >= 100 ? USERS_MAX : Math.round(Math.pow(10, 3 + (pos / 100) * USERS_SPAN) / 1000) * 1000);
export const posFromUsers = (u: number) => Math.min(100, Math.max(0, ((Math.log10(Math.max(1000, u)) - 3) / USERS_SPAN) * 100));
export const fmtUsers = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(0)}K` : String(n));

export type Scenario = { key: "worst" | "base" | "vision"; label: string; note: string; company: Pick<Company, "pool" | "poolAt" | "rounds" | "dual" | "V">; business: Business };
const R = (name: string, on: boolean, raise: number, post: number, users = 0, target = 0): Round => ({ name, on, raise, post, target, users });
const noRound = (name: string, users = 0) => R(name, false, 0, 0, users);
export const SCENARIOS: Scenario[] = [
  {
    key: "worst", label: "Worst case", note: "Growth stalls at 25,000 users: bridge and a small Pre-Seed, then a modest sale. No gate beyond Pre-Seed opens.",
    company: { pool: 15, poolAt: "formation", dual: "never", V: 10, rounds: [R("Pre-Seed", true, 100_000, 1_000_000), R("Seed", true, 1_000_000, 6_000_000, GATES.seed), R("Series A", true, 8_000_000, 40_000_000, GATES.seriesA), noRound("Series B", GATES.seriesB), noRound("Series C", GATES.seriesC), R("Exit (small sale)", true, 0, 3_000_000)] },
    business: { users: 25_000, conv: 0.25, churn: 12, burn: 1_142_600, burnVar: 70, burnExp: 0.75, expansion: 0, growth: 0, cash: 665_000, fx: 1333 },
  },
  {
    key: "base", label: "Baseline", note: "10 million users: the Seed and Series A gates open; Series B and C stay locked. Then a sale.",
    company: { pool: 15, poolAt: "formation", dual: "never", V: 10, rounds: [R("Pre-Seed", true, 250_000, 3_571_429), R("Seed", true, 1_000_000, 14_285_714, GATES.seed), R("Series A", true, 8_000_000, 40_000_000, GATES.seriesA), noRound("Series B", GATES.seriesB), noRound("Series C", GATES.seriesC), R("Exit (sale)", true, 0, 60_000_000)] },
    business: { users: 10_000_000, conv: 1, churn: 8, burn: 1_142_600, burnVar: 70, burnExp: 0.75, expansion: 0, growth: 2, cash: 665_000, fx: 1333 },
  },
  {
    key: "vision", label: "Vision", note: "All four gates reached (200 million users) and every round to a US$7.5B listing. Aspirational: paper value only.",
    company: { pool: 15, poolAt: "preA", dual: "last", V: 10, rounds: [R("Pre-Seed", true, 250_000, 3_571_429), R("Seed", true, 1_000_000, 14_285_714, GATES.seed), R("Series A", true, 150_000_000, 1_000_000_000, GATES.seriesA), R("Series B", true, 250_000_000, 2_500_000_000, GATES.seriesB), R("Series C", true, 500_000_000, 5_000_000_000, GATES.seriesC), R("IPO", true, 750_000_000, 7_500_000_000)] },
    business: { users: 200_000_000, conv: 2, churn: 6, burn: 1_142_600, burnVar: 70, burnExp: 0.75, expansion: 0, growth: 5, cash: 14_663_000, fx: 1333 },
  },
];

export const fmtUsd = (n: number) => { const a = Math.abs(n); return a >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`; };
export const fmtNgn = (n: number) => { const a = Math.abs(n); return a >= 1e12 ? `₦${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `₦${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `₦${(n / 1e6).toFixed(2)}M` : `₦${Math.round(n).toLocaleString("en-NG")}`; };
export const fmtPct = (x: number) => `${(x * 100).toFixed(2)}%`;
