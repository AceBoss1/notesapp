// Notes Planner: the rules, shared by the page, the server and the tests (docs/NOTES_PLANNER.md). Pure: no Firestore, no AI.
// Nana interviews the member one question at a time, then writes their next 12 months: one goal, three numbers, a project a month,
// a few moves for every day and a Sunday review. The plan shows in My Calendar as its own kind ("plan", lib/my-calendar.ts).
import { addDays, isDay, lagosAt, lagosMidnight, type CalEntry } from "./my-calendar";

export class PlannerError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// ── Months and days ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export const monthOf = (day: string) => day.slice(0, 7);
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}
export const lastDayOf = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
export const monthShort = (month: string) => MONTHS[Number(month.slice(5)) - 1].slice(0, 3).toUpperCase();
const daysApart = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday

// A plan starts on the 1st of next month and runs 12 months (a teen may plan one term: 3 months).
export const ADULT_LENGTHS = [12] as const;
export const TEEN_LENGTHS = [3, 12] as const;
export const lengthsFor = (teen: boolean): readonly number[] => (teen ? TEEN_LENGTHS : ADULT_LENGTHS);
export const cleanLength = (v: unknown, teen: boolean) => (lengthsFor(teen).includes(Number(v)) ? Number(v) : 12);
export const planStart = (today: string) => `${addMonths(monthOf(today), 1)}-01`;
export const planMonths = (start: string, length: number) => Array.from({ length }, (_, i) => addMonths(monthOf(start), i));
export const planEnd = (start: string, length: number) => lastDayOf(addMonths(monthOf(start), length - 1));
export function planSpan(start: string, length: number): string {
  const a = monthOf(start), b = addMonths(a, length - 1);
  return a.slice(0, 4) === b.slice(0, 4) ? `${MONTHS[Number(a.slice(5)) - 1]} to ${monthName(b)}` : `${monthName(a)} to ${monthName(b)}`;
}

// ── The plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// #NotesApp's own tools a monthly project may link to (Engineering Guide, principle 8). Nana names one by id; any other link is dropped.
export const PLAN_TOOLS = {
  site: { href: "/profile/site", label: "Your site" },
  booking: { href: "/booking", label: "Booking" },
  store: { href: "/store-selling", label: "Your store" },
  books: { href: "/books", label: "Business books" },
  academy: { href: "/academy", label: "Notes Academy" },
  events: { href: "/events", label: "Events" },
  community: { href: "/community", label: "Community" },
  jobs: { href: "/explore?tab=jobs", label: "Notes Jobs" },
  prep: { href: "/learn", label: "Naija Exam Prep" },
} as const;
export type PlanTool = keyof typeof PLAN_TOOLS;
export const isPlanTool = (v: unknown): v is PlanTool => typeof v === "string" && v in PLAN_TOOLS;
// What a teen's plan may link to: learning only.
const TEEN_TOOLS: PlanTool[] = ["academy", "prep"];

export type PlanNumber = { label: string; start: string; target: string; now: string };
export type PlanMonth = { month: string; project: string; done: string; finished: boolean; tool?: PlanTool };
export type PlanRisk = { habit: string; sign: string; response: string };
export type PlanTask = { text: string; done: boolean };
export type Plan = {
  v: 1;
  teen: boolean;
  by: "nana" | "me";
  start: string; // the 1st of the first month
  createdAt: string;
  refuse: string; // the life I refuse (never on a teen's plan)
  vision: string; // the life I'm building
  becoming: string; // "I am the type of person who…"
  goal: string; // true by the plan's last day
  numbers: PlanNumber[]; // up to three
  stop: string[];
  keep: string[];
  months: PlanMonth[]; // one per month of the plan
  risks: PlanRisk[]; // up to three: the habit, its early warning sign, what she does when she sees it
  moves: string[]; // one to three, every day
  tasks: PlanTask[]; // the first three, each under 30 minutes
  review: string[]; // three Sunday questions
};

export const LIMITS = { line: 240, short: 120, numbers: 3, chips: 5, risks: 3, moves: 3, tasks: 3 } as const;
export const DEFAULT_REVIEW = ["What did I finish for this month's project?", "Where did I slip, and why?", "What is the one thing for next week?"];
export const TEEN_REVIEW = ["What did I get done this week?", "What was hard, and what would help?", "What is the one thing for next week?"];

const text = (v: unknown, max: number) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const list = (v: unknown, max: number, len: number) => (Array.isArray(v) ? v : []).map((x) => text(x, len)).filter(Boolean).slice(0, max);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Anything Nana wrote or the member typed, made into a plan or refused with a reason she can act on.
export function cleanPlan(raw: unknown, o: { start: string; length: number; teen: boolean; by: "nana" | "me"; now: Date }): Plan {
  if (!isDay(o.start) || !o.start.endsWith("-01")) throw new PlannerError("A plan starts on the 1st of a month.");
  const r = obj(raw);
  const goal = text(r.goal, LIMITS.line);
  if (!goal) throw new PlannerError("Write the one goal your plan is for.");
  const numbers = (Array.isArray(r.numbers) ? r.numbers : []).map(obj)
    .map((n) => ({ label: text(n.label, LIMITS.short), start: text(n.start, 24), target: text(n.target, 24), now: text(n.now, 24) || text(n.start, 24) }))
    .filter((n) => n.label && n.target).slice(0, LIMITS.numbers);
  const byMonth = new Map<string, Record<string, unknown>>();
  (Array.isArray(r.months) ? r.months : []).map(obj).forEach((m, i) => {
    const key = isMonth(m.month) ? m.month : addMonths(monthOf(o.start), i);
    if (!byMonth.has(key)) byMonth.set(key, m);
  });
  const tools = o.teen ? TEEN_TOOLS : (Object.keys(PLAN_TOOLS) as PlanTool[]);
  const months = planMonths(o.start, o.length).map((month): PlanMonth => {
    const m = byMonth.get(month) ?? {};
    const tool = isPlanTool(m.tool) && tools.includes(m.tool) ? m.tool : undefined;
    return { month, project: text(m.project, LIMITS.short), done: text(m.done, LIMITS.line), finished: m.finished === true, ...(tool ? { tool } : {}) };
  });
  const moves = list(r.moves, LIMITS.moves, LIMITS.short);
  if (!moves.length) throw new PlannerError("Add at least one move for every day.");
  if (o.by === "nana") {
    if (numbers.length < LIMITS.numbers) throw new PlannerError("The plan needs three numbers to track.");
    if (months.some((m) => !m.project)) throw new PlannerError("The plan needs a project for every month.");
  }
  const review = list(r.review, 3, LIMITS.short);
  return {
    v: 1, teen: o.teen, by: o.by, start: o.start, createdAt: o.now.toISOString(),
    refuse: o.teen ? "" : text(r.refuse, LIMITS.line), vision: text(r.vision, LIMITS.line), becoming: text(r.becoming, LIMITS.line), goal,
    numbers, stop: list(r.stop, LIMITS.chips, LIMITS.short), keep: list(r.keep, LIMITS.chips, LIMITS.short), months,
    risks: (Array.isArray(r.risks) ? r.risks : []).map(obj).map((k) => ({ habit: text(k.habit, LIMITS.short), sign: text(k.sign, LIMITS.short), response: text(k.response, LIMITS.line) })).filter((k) => k.habit).slice(0, LIMITS.risks),
    moves,
    tasks: (Array.isArray(r.tasks) ? r.tasks : []).map((t) => (typeof t === "string" ? { text: t } : obj(t))).map((t) => ({ text: text(t.text, LIMITS.short), done: t.done === true })).filter((t) => t.text).slice(0, LIMITS.tasks),
    review: review.length === 3 ? review : o.teen ? TEEN_REVIEW : DEFAULT_REVIEW,
  };
}

// Nana's plan arrives as JSON, sometimes with a sentence or a code fence around it.
export function parsePlanJson(reply: string): unknown {
  const a = reply.indexOf("{"), b = reply.lastIndexOf("}");
  if (a < 0 || b <= a) throw new PlannerError("Nana's plan didn't come out right. Please try again.", 502);
  try { return JSON.parse(reply.slice(a, b + 1)); } catch { throw new PlannerError("Nana's plan didn't come out right. Please try again.", 502); }
}

// "₦1.2m", "40", "90%", "450k" → a number, or null when it isn't one.
export function amount(v: string): number | null {
  const m = v.replace(/[₦$£€,\s]/g, "").match(/^(-?\d+(?:\.\d+)?)(k|m|bn|b)?%?$/i);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Number(m[1]) * mult;
}
// How far a number has moved from its start to its target, 0 to 100. null when any of the three isn't a number.
export function progress(n: PlanNumber): number | null {
  const s = amount(n.start || "0"), t = amount(n.target), c = amount(n.now || n.start || "0");
  if (s === null || t === null || c === null || t === s) return null;
  return Math.max(0, Math.min(100, Math.round(((c - s) / (t - s)) * 100)));
}

// ── The interview ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const PARTS = ["Where you are now", "If nothing changes", "What you want", "Did I get you right?"] as const;
export const TEEN_PARTS = ["Where you are now", "What gets in the way", "What you want", "Did I get you right?"] as const;
export const partTitle = (part: number, teen: boolean) => (teen ? TEEN_PARTS : PARTS)[Math.max(1, Math.min(4, part)) - 1];
export const TARGET_QUESTIONS = 25;
export const TEEN_TARGET = 14;
export const targetFor = (teen: boolean) => (teen ? TEEN_TARGET : TARGET_QUESTIONS);
export const MAX_QUESTIONS = 36; // after this Nana must sum up, whatever is left
export const ANSWER_MAX = 1500;
export const SKIP_TEXT = "(I'd rather skip this one.)";
export const OPENING = "Let's start with where you are now. What is something in your life you've learned to put up with? Not the big, obvious thing. The small, constant one you've stopped noticing.";
export const TEEN_OPENING = "Let's start with where you are now. What is going well for you at school or outside it, and what is one thing you wish was going better?";

export type Msg = { role: "nana" | "me"; text: string; at: string };
export type Interview = {
  teen: boolean;
  length: number; // months the plan will cover
  start: string; // the plan's first day
  gentle: boolean;
  part: number; // 1 to 4
  asked: number; // questions Nana has asked
  messages: Msg[];
  summary: string[] | null; // five lines in her own words, once Nana has summed up
  startedAt: string;
};

export function newInterview(o: { teen: boolean; length: number; today: string; now: Date }): Interview {
  const at = o.now.toISOString();
  return {
    teen: o.teen, length: cleanLength(o.length, o.teen), start: planStart(o.today), gentle: o.teen, part: 1, asked: 1, summary: null, startedAt: at,
    messages: [{ role: "nana", text: o.teen ? TEEN_OPENING : OPENING, at }],
  };
}

export function cleanAnswer(v: unknown): string {
  const t = (typeof v === "string" ? v : "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim();
  if (!t) throw new PlannerError("Type your answer, or skip this one.");
  if (t.length > ANSWER_MAX) throw new PlannerError(`Keep your answer under ${ANSWER_MAX} characters.`);
  return t;
}

// Nana's reply opens with [[PART n]] (which part her next question belongs to) or [[SUMMARY]] followed by five lines.
export type Reply = { text: string; part: number | null; summary: string[] | null };
export function parseReply(raw: string): Reply {
  const part = raw.match(/\[\[PART\s*([1-4])\]\]/i);
  const isSummary = /\[\[SUMMARY\]\]/i.test(raw);
  const clean = raw.replace(/\[\[[A-Z]+[^\]]*\]\]/gi, "").trim().slice(0, 3000);
  if (!isSummary) return { text: clean, part: part ? Number(part[1]) : null, summary: null };
  const lines = clean.split("\n").map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean).map((l) => l.slice(0, 300));
  return lines.length >= 3 ? { text: clean, part: 4, summary: lines.slice(0, 5) } : { text: clean, part: part ? Number(part[1]) : null, summary: null };
}

export function withAnswer(iv: Interview, answer: string, now: Date): Interview {
  return { ...iv, summary: null, messages: [...iv.messages, { role: "me", text: answer, at: now.toISOString() }] };
}
export function withReply(iv: Interview, r: Reply, now: Date): Interview {
  const part = r.summary ? 4 : Math.max(iv.part, Math.min(3, r.part ?? iv.part)); // parts only move forward; 4 is the summary
  return { ...iv, part, asked: r.summary ? iv.asked : iv.asked + 1, summary: r.summary, messages: [...iv.messages, { role: "nana", text: r.summary ? r.summary.map((l, i) => `${i + 1}. ${l}`).join("\n") : r.text, at: now.toISOString() }] };
}
export const mustSumUp = (iv: Interview) => iv.asked >= MAX_QUESTIONS;
export const progressPct = (iv: Interview) => (iv.summary ? 96 : Math.min(92, Math.round((iv.asked / targetFor(iv.teen)) * 92)));

// ── A day: the month's project and the moves to tick ───────────────────────────────────────────────────────────────────────
export const inPlan = (plan: Plan, day: string) => day >= plan.start && day <= planEnd(plan.start, plan.months.length);
export type DayView = { inPlan: boolean; startsIn: number; month: PlanMonth | null; daysLeft: number; moves: { text: string; done: boolean }[] };
export function dayView(plan: Plan, day: string, ticks: boolean[] = []): DayView {
  const on = inPlan(plan, day);
  const month = on ? plan.months.find((m) => m.month === monthOf(day)) ?? null : null;
  return {
    inPlan: on, startsIn: Math.max(0, daysApart(day, plan.start)), month: month?.project ? month : null,
    daysLeft: on ? daysApart(day, lastDayOf(monthOf(day))) : 0,
    moves: on ? plan.moves.map((text, i) => ({ text, done: ticks[i] === true })) : [],
  };
}
export function cleanTicks(v: unknown, plan: Plan): boolean[] {
  return plan.moves.map((_, i) => Array.isArray(v) && v[i] === true);
}
// Days in a row with at least one move ticked, ending today (or yesterday, so the morning doesn't break it).
export function streak(tickedDays: Iterable<string>, today: string): number {
  const days = new Set(tickedDays);
  let d = days.has(today) ? today : addDays(today, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ── The Sunday review ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A review belongs to the Sunday that ends its week. It can be done from that Sunday until the Saturday after.
export const reviewWeek = (today: string) => addDays(today, -weekday(today));
export const weekDays = (week: string) => Array.from({ length: 7 }, (_, i) => addDays(week, i - 6)); // Monday to that Sunday
export const reviewOpen = (plan: Plan, today: string) => inPlan(plan, reviewWeek(today)) || (reviewWeek(today) >= plan.start && daysApart(planEnd(plan.start, plan.months.length), today) <= 6);
export type Review = { week: string; answers: string[]; numbers: string[]; signs: boolean[]; note?: string; ai?: boolean; at: string };
export function cleanReview(raw: unknown, plan: Plan, week: string, now: Date): Review {
  const r = obj(raw);
  const answers = plan.review.map((_, i) => text(Array.isArray(r.answers) ? r.answers[i] : "", 600));
  if (!answers.some(Boolean)) throw new PlannerError("Answer at least one of the three questions.");
  return {
    week, answers, at: now.toISOString(),
    numbers: plan.numbers.map((n, i) => text(Array.isArray(r.numbers) ? r.numbers[i] : "", 24) || n.now),
    signs: plan.risks.map((_, i) => Array.isArray(r.signs) && r.signs[i] === true),
  };
}
export const withReviewNumbers = (plan: Plan, review: Review): Plan => ({ ...plan, numbers: plan.numbers.map((n, i) => ({ ...n, now: review.numbers[i] || n.now })) });
// The warning signs she ticked, each with what her plan says to do.
export const warnings = (plan: Plan, review: Pick<Review, "signs">) => plan.risks.filter((_, i) => review.signs[i]).map((k) => ({ sign: k.sign || k.habit, response: k.response }));
// Our own note when Nana isn't available or is switched off.
export function fallbackNote(plan: Plan, review: Review, daysTicked: number): string {
  const w = warnings(plan, review);
  return [
    `You ticked your moves on ${daysTicked} day${daysTicked === 1 ? "" : "s"} of 7.`,
    w.length ? `You saw a warning sign you named. Your plan says: ${w[0].response || "go back to your daily moves"}.` : "No warning signs this week.",
    review.answers[2] ? `Next week's one thing: ${review.answers[2]}` : "",
  ].filter(Boolean).join(" ");
}

// ── In My Calendar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// What the plan puts on the calendar: each month's project on its last day, and the Sunday review. The daily moves are tick boxes on
// the day, not entries, so the month isn't a dot on every day. In the private feed everything is titled "Planner" unless she chose titles.
export const PLANNER_HREF = "/calendar/planner";
export const FEED_TITLE = "Planner";
export function planEntries(plan: Plan, from: string, to: string, o: { titles?: boolean; reviewHour?: number } = {}): CalEntry[] {
  const out: CalEntry[] = [];
  const end = planEnd(plan.start, plan.months.length);
  for (const m of plan.months) {
    const day = lastDayOf(m.month);
    if (!m.project || day < from || day > to) continue;
    const title = `${m.finished ? "Finished" : "Finish"}: ${m.project}`;
    out.push({ id: `plan:month:${m.month}`, kind: "plan", title, feedTitle: o.titles ? title : FEED_TITLE, start: lagosMidnight(day), end: lagosMidnight(addDays(day, 1)), allDay: true, sub: m.done ? `Done when: ${m.done}` : "This month's project", href: PLANNER_HREF });
  }
  const hour = o.reviewHour && o.reviewHour >= 1 && o.reviewHour <= 23 ? o.reviewHour : 17;
  const first = from > plan.start ? from : plan.start;
  for (let d = addDays(first, (7 - weekday(first)) % 7); d <= to && d <= end; d = addDays(d, 7)) {
    const start = lagosAt(d, `${pad(hour)}:00`);
    out.push({ id: `plan:review:${d}`, kind: "plan", title: "Sunday review", feedTitle: o.titles ? "Sunday review" : FEED_TITLE, start, end: new Date(Date.parse(start) + 30 * 60_000).toISOString(), sub: "Three questions, five minutes", href: `${PLANNER_HREF}/review` });
  }
  return out;
}

// ── Her choices ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const MOVES_BELL_HOURS = [0, 5, 6, 7, 8, 9, 10] as const; // 0 = off; Lagos hours
export const REVIEW_BELL_HOURS = [0, 15, 16, 17, 18, 19, 20] as const;
export type PlannerPrefs = { movesBell: number; reviewBell: number; nanaNote: boolean; feedTitles: boolean; lock: boolean };
export const DEFAULT_PLANNER_PREFS: PlannerPrefs = { movesBell: 7, reviewBell: 17, nanaNote: true, feedTitles: false, lock: false };
export function cleanPlannerPrefs(raw: unknown, base: PlannerPrefs = DEFAULT_PLANNER_PREFS): PlannerPrefs {
  const r = obj(raw);
  const pick = (v: unknown, allowed: readonly number[], d: number) => (v !== undefined && allowed.includes(Number(v)) ? Number(v) : d);
  const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    movesBell: pick(r.movesBell, MOVES_BELL_HOURS, base.movesBell), reviewBell: pick(r.reviewBell, REVIEW_BELL_HOURS, base.reviewBell),
    nanaNote: flag(r.nanaNote, base.nanaNote), feedTitles: flag(r.feedTitles, base.feedTitles), lock: flag(r.lock, base.lock),
  };
}
export const hourLabel = (h: number) => (h === 0 ? "Off" : `${((h + 11) % 12) + 1}:00 ${h >= 12 ? "PM" : "AM"}`);

// The bells say nothing about the plan itself.
export const MOVES_BELL_TEXT = "Your moves for today are ready in Notes Planner.";
export const REVIEW_BELL_TEXT = "It's time for your Sunday review in Notes Planner.";
// Once a day from the hour she chose, on days inside her plan.
export const movesBellDue = (plan: Plan, bellHour: number, sentDay: string | undefined, today: string, lagosHourNow: number) =>
  bellHour > 0 && lagosHourNow >= bellHour && sentDay !== today && inPlan(plan, today);
// Once a Sunday from the hour she chose, when that week's review isn't done.
export const reviewBellDue = (plan: Plan, bellHour: number, sentWeek: string | undefined, today: string, lagosHourNow: number, reviewed: boolean) =>
  bellHour > 0 && weekday(today) === 0 && lagosHourNow >= bellHour && sentWeek !== today && !reviewed && inPlan(plan, today);
