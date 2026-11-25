// What a free trial kept you (docs/GTM_DOORS_AND_TRIALS.md; owner approved 25 Nov 2026). Pure: from the member's own ledger entries in the
// trial, what they kept on the plan they tried, next to what they would have kept on the plan they go back to; whether it paid for itself;
// the point where it would; the one nudge later; and Admin's figures. The server side is lib/trial-earnings-server.ts.
//
// The owner's choice: no commission calculator on the pricing page (people upgrade when they are ready). The maths is shown only to someone
// who has tried a plan, only about their own money.

export type Rates = { session: number; physical: number; digital: number }; // commission, 0–1 (lib/my-rates.ts)
export type Group = keyof Rates;
export type LedgerIn = { kind: string; grossKobo: number; commissionKobo: number; status: string; createdAt: string; currency?: string };

// Which of the plan's rates each kind of earning is charged at. Kinds not here (ad share, shipping, giving, affiliate, debts, withdrawals)
// don't change with the plan, so they are left out of the comparison.
const GROUP: Record<string, Group> = {
  booking: "session", subscription: "session", gift: "session", live_ticket: "session", ticket: "session", ppm: "session",
  order: "physical", hotel: "physical",
  digital: "digital", course: "digital", certificate: "digital",
};
const LABEL: Record<string, string> = {
  booking: "Sessions", subscription: "Subscriptions", gift: "Gifts", live_ticket: "Lives and tickets", ticket: "Lives and tickets", ppm: "Lives and tickets",
  order: "Shop items", hotel: "Shop items", digital: "Downloads and courses", course: "Downloads and courses", certificate: "Downloads and courses",
};
export const LINE_ORDER = ["Sessions", "Subscriptions", "Gifts", "Lives and tickets", "Shop items", "Downloads and courses"];
export const groupOf = (kind: string): Group | null => GROUP[kind] ?? null;

export type Line = { label: string; count: number; grossKobo: number; keptBackKobo: number; keptPlanKobo: number };
export type Comparison = { lines: Line[]; count: number; grossKobo: number; keptPlanKobo: number; keptBackKobo: number; extraKobo: number };

// `plan` is the trial plan's rates (what each payment was actually charged, give or take a fan tier's uplift), `back` the plan they return
// to. Each payment's commission at the other plan is its real commission scaled by the two plans' rates, so a VIP uplift or a discount on
// the payment carries across; a payment charged nothing (a free ticket) stays at nothing.
export function compareTrial(entries: LedgerIn[], plan: Rates, back: Rates, from: string, to: string): Comparison {
  const by = new Map<string, Line>();
  for (const e of entries) {
    if (e.status === "refunded" || (e.currency && e.currency !== "NGN")) continue;
    if (!(e.createdAt >= from && e.createdAt < to)) continue;
    const g = groupOf(e.kind);
    if (!g) continue;
    const gross = Math.max(0, Math.round(e.grossKobo || 0));
    const comm = Math.min(gross, Math.max(0, Math.round(e.commissionKobo || 0)));
    const other = plan[g] > 0 ? Math.round((comm * back[g]) / plan[g]) : Math.round(gross * back[g]);
    const label = LABEL[e.kind];
    const l = by.get(label) ?? { label, count: 0, grossKobo: 0, keptBackKobo: 0, keptPlanKobo: 0 };
    l.count++; l.grossKobo += gross; l.keptPlanKobo += gross - comm; l.keptBackKobo += gross - Math.min(gross, other);
    by.set(label, l);
  }
  const lines = LINE_ORDER.map((k) => by.get(k)).filter((l): l is Line => !!l);
  const sum = (f: (l: Line) => number) => lines.reduce((a, l) => a + f(l), 0);
  const keptPlanKobo = sum((l) => l.keptPlanKobo), keptBackKobo = sum((l) => l.keptBackKobo);
  return { lines, count: sum((l) => l.count), grossKobo: sum((l) => l.grossKobo), keptPlanKobo, keptBackKobo, extraKobo: keptPlanKobo - keptBackKobo };
}

export const DAY = 86_400_000;
export const trialDays = (startedAt: string, until: string) => Math.max(1, Math.round((new Date(until).getTime() - new Date(startedAt).getTime()) / DAY));
// The plan's price for the days of the trial.
export const costFor = (monthlyKobo: number, days: number) => Math.round((monthlyKobo * days) / 30);
// Sessions, subscriptions and gifts a month at which the plan pays for itself (the session rate is where most of it is).
export function breakEvenKobo(monthlyKobo: number, plan: Rates, back: Rates): number | null {
  const d = back.session - plan.session;
  return d > 0 ? Math.ceil(monthlyKobo / d / 100) * 100 : null;
}

export type Verdict = "paid" | "not_yet";
export type Outcome = { verdict: Verdict; costKobo: number; paceKobo: number; times: number; breakEvenKobo: number | null };
export function outcome(c: Pick<Comparison, "extraKobo">, monthlyKobo: number, days: number, plan: Rates, back: Rates): Outcome {
  const costKobo = costFor(monthlyKobo, days);
  return {
    verdict: c.extraKobo > 0 && c.extraKobo >= costKobo ? "paid" : "not_yet",
    costKobo, paceKobo: Math.round((c.extraKobo * 30) / days), times: costKobo > 0 ? Math.floor((c.extraKobo / costKobo) * 10) / 10 : 0,
    breakEvenKobo: breakEvenKobo(monthlyKobo, plan, back),
  };
}

// ── The one nudge ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A member told "not yet" who is still on the plan they went back to hears once, when their last 30 days would have kept them more on
// the plan than it costs, and never more than once every 60 days.
export const NUDGE_EVERY_MS = 60 * DAY;
export function nudgeDue(last30: Pick<Comparison, "extraKobo">, monthlyKobo: number, lastNudgeAt: string | undefined, now: number): boolean {
  if (last30.extraKobo <= 0 || last30.extraKobo < monthlyKobo) return false;
  return !lastNudgeAt || now - new Date(lastNudgeAt).getTime() >= NUDGE_EVERY_MS;
}

// ── What is stored at the end of a trial (trialResults/{uid}_{day}, server only) ─────────────────────────────────────────────────────
export type TrialResult = {
  uid: string; tier: string; back: string; startedAt: string; until: string; endedAt: string;
  monthlyKobo: number; plan: Rates; backRates: Rates; comparison: Comparison; outcome: Outcome;
  nudgedAt?: string[]; // the "Pro would have kept you more" messages sent since
};

// ── Admin → Growth → Trials ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type TrialStats = {
  ended: number; toldPaid: number; toldNotYet: number; paidAfter: number; paidAfterToldPaid: number; paidAfterToldNotYet: number;
  givenUpKobo: number; planMonthlyKobo: number; nudged: number; paidAfterNudge: number;
};
// results: the trials that ended in the window; paidAt: when each account last paid for a plan (users/{uid}.lastPaidAt).
export function trialStats(results: Pick<TrialResult, "uid" | "until" | "monthlyKobo" | "comparison" | "outcome" | "nudgedAt">[], paidAt: Record<string, string | undefined>): TrialStats {
  const s: TrialStats = { ended: 0, toldPaid: 0, toldNotYet: 0, paidAfter: 0, paidAfterToldPaid: 0, paidAfterToldNotYet: 0, givenUpKobo: 0, planMonthlyKobo: 0, nudged: 0, paidAfterNudge: 0 };
  for (const r of results) {
    s.ended++;
    const told = r.outcome.verdict;
    if (told === "paid") s.toldPaid++; else s.toldNotYet++;
    s.givenUpKobo += Math.max(0, r.comparison.extraKobo);
    const p = paidAt[r.uid];
    const paid = !!p && p >= r.until;
    if (paid) { s.paidAfter++; s.planMonthlyKobo += r.monthlyKobo; if (told === "paid") s.paidAfterToldPaid++; else s.paidAfterToldNotYet++; }
    if (r.nudgedAt?.length) { s.nudged++; if (paid && r.nudgedAt.some((n) => p! >= n)) s.paidAfterNudge++; }
  }
  return s;
}
