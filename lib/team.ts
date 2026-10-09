// The team hub: shared work items and milestones for #NotesApp staff. Pure functions (validation, grouping, progress), so the maths is
// testable without a database; lib/team-server.ts keeps the documents.
import type { Traction } from "./traction";

export const STATUSES = ["todo", "doing", "blocked", "decision", "done"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { todo: "To do", doing: "Doing", blocked: "Blocked", decision: "Needs a decision", done: "Done" };
export const HORIZONS = ["today", "week", "later"] as const;
export type Horizon = (typeof HORIZONS)[number];
export const HORIZON_LABEL: Record<Horizon, string> = { today: "Today", week: "This week", later: "Later" };

export type TeamItem = {
  id: string;
  title: string;
  detail: string;
  ownerUid: string; // "" = unassigned
  status: Status;
  horizon: Horizon;
  due: string; // YYYY-MM-DD (Lagos date) or ""
  blockedReason: string; // why it is stuck, and on whom
  decisionQuestion: string; // what has to be decided
  decidedNote: string; // the answer, once decided
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
  doneAt: string;
  meetingId?: string; // the meeting it came out of, if any
  commentCount?: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// A date in Lagos (WAT, UTC+1, no daylight saving), as YYYY-MM-DD.
export function lagosDate(now = new Date()): string {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}
// The Lagos date of an ISO time.
export const lagosDay = (iso: string) => lagosDate(new Date(iso));
export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export class TeamError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// What a caller may set on an item; unknown fields are ignored and every text is trimmed and capped. `partial` (updates) keeps only the
// fields that were sent.
export function cleanItem(body: Record<string, unknown>, partial: boolean): Partial<TeamItem> {
  const out: Partial<TeamItem> = {};
  const has = (k: string) => !partial || k in body;
  if (has("title")) {
    const t = clip(body.title, 140);
    if (!t) throw new TeamError("Give it a title.");
    out.title = t;
  }
  if (has("detail")) out.detail = clip(body.detail, 2000);
  if (has("ownerUid")) out.ownerUid = clip(body.ownerUid, 128);
  if (has("status")) {
    const s = body.status ?? "todo";
    if (!STATUSES.includes(s as Status)) throw new TeamError("Unknown status.");
    out.status = s as Status;
  }
  if (has("horizon")) {
    const h = body.horizon ?? "week";
    if (!HORIZONS.includes(h as Horizon)) throw new TeamError("Unknown horizon.");
    out.horizon = h as Horizon;
  }
  if (has("due")) {
    const d = clip(body.due, 10);
    if (d && !DATE.test(d)) throw new TeamError("The due date must look like 2026-10-31.");
    out.due = d;
  }
  if (has("blockedReason")) out.blockedReason = clip(body.blockedReason, 500);
  if (has("decisionQuestion")) out.decisionQuestion = clip(body.decisionQuestion, 500);
  if (has("decidedNote")) out.decidedNote = clip(body.decidedNote, 500);
  if (!partial && body.meetingId) out.meetingId = clip(body.meetingId, 64);
  return out;
}

// Whatever the status change implies: done stamps the time (and a decision keeps its answer), anything else clears it.
export function statusEffects(next: Status, prev: Status | null, now: string): Partial<TeamItem> {
  if (next === prev) return {};
  return { doneAt: next === "done" ? now : "" };
}

export const isOpen = (i: TeamItem) => i.status !== "done";
export const isOverdue = (i: TeamItem, today: string) => isOpen(i) && !!i.due && i.due < today;

export type Grouped = {
  decisions: TeamItem[]; // waiting for someone to decide
  blocked: TeamItem[];
  overdue: TeamItem[]; // past due and not done (any status)
  today: TeamItem[]; // today's list: horizon today, due today or overdue, still doing or to do
  week: TeamItem[]; // the rest of this week: horizon week, or due within 7 days
  later: TeamItem[];
  recentlyDone: TeamItem[]; // finished in the last 7 days
};

const byDue = (a: TeamItem, b: TeamItem) => (a.due || "9999") .localeCompare(b.due || "9999") || a.createdAt.localeCompare(b.createdAt);

export function groupItems(items: TeamItem[], today: string): Grouped {
  const open = items.filter(isOpen);
  const g: Grouped = { decisions: [], blocked: [], overdue: [], today: [], week: [], later: [], recentlyDone: [] };
  const weekEnd = addDays(today, 7);
  for (const i of open) {
    if (isOverdue(i, today)) g.overdue.push(i);
    if (i.status === "decision") { g.decisions.push(i); continue; }
    if (i.status === "blocked") { g.blocked.push(i); continue; }
    if (i.horizon === "today" || i.due === today || isOverdue(i, today)) g.today.push(i);
    else if (i.horizon === "week" || (i.due && i.due <= weekEnd)) g.week.push(i);
    else g.later.push(i);
  }
  const since = addDays(today, -7);
  g.recentlyDone = items.filter((i) => i.status === "done" && i.doneAt && lagosDay(i.doneAt) >= since).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  for (const k of ["decisions", "blocked", "overdue", "today", "week", "later"] as const) g[k].sort(byDue);
  return g;
}

// Milestones: a target on one of the traction numbers, over a stretch of days or weeks.
export const METRICS = {
  registered: { label: "Registered members", unit: "count" },
  paidPlans: { label: "Paid plans (Pro, Business, Enterprise)", unit: "count" },
  goldBadges: { label: "Gold badges", unit: "count" },
  publishers: { label: "Publishers", unit: "count" },
  sellers: { label: "Sellers with items", unit: "count" },
  organisations: { label: "Organisations", unit: "count" },
  sessionsBooked: { label: "Sessions booked", unit: "count" },
  storeOrders: { label: "Store orders", unit: "count" },
  payingCustomers: { label: "Paying customers", unit: "count" },
  processedKobo: { label: "Money processed (₦)", unit: "kobo" },
} as const;
export type MetricKey = keyof typeof METRICS;
export const isMetric = (k: unknown): k is MetricKey => typeof k === "string" && k in METRICS;

export function metricValue(t: Traction, k: MetricKey): number {
  switch (k) {
    case "registered": return t.people.registered;
    case "paidPlans": return t.people.paidPlans;
    case "goldBadges": return t.people.goldBadges;
    case "publishers": return t.people.publishers;
    case "sellers": return t.people.sellers;
    case "organisations": return t.people.organisations;
    case "sessionsBooked": return t.activity.sessionsBooked;
    case "storeOrders": return t.activity.storeOrders;
    case "payingCustomers": return t.money.payingCustomers;
    case "processedKobo": return t.money.processedKobo;
  }
}

export type Milestone = {
  id: string;
  title: string;
  metric: MetricKey;
  mode: "gain" | "total"; // gain: how much it has grown since the start; total: the number itself
  target: number; // in the metric's own unit (kobo for money)
  baseline: number; // the metric when the milestone began (gain mode)
  startsOn: string;
  endsOn: string;
  ownerUid: string;
  note: string;
  createdByUid: string;
  createdAt: string;
};

export function cleanMilestone(body: Record<string, unknown>): Omit<Milestone, "id" | "baseline" | "createdByUid" | "createdAt"> {
  const title = clip(body.title, 140);
  if (!title) throw new TeamError("Give the milestone a title.");
  if (!isMetric(body.metric)) throw new TeamError("Pick a number to track.");
  const mode = body.mode === "total" ? "total" : "gain";
  const target = Math.round(Number(body.target));
  if (!Number.isFinite(target) || target <= 0 || target > 1e13) throw new TeamError("The target must be a positive number.");
  const startsOn = clip(body.startsOn, 10), endsOn = clip(body.endsOn, 10);
  if (!DATE.test(startsOn) || !DATE.test(endsOn)) throw new TeamError("Give a start and an end date.");
  if (endsOn < startsOn) throw new TeamError("The end date is before the start date.");
  return { title, metric: body.metric, mode, target, startsOn, endsOn, ownerUid: clip(body.ownerUid, 128), note: clip(body.note, 500) };
}

export type Progress = { current: number; value: number; pct: number; state: "hit" | "on-track" | "behind" | "missed" | "upcoming" };

export function milestoneProgress(m: Milestone, now: number, today: string): Progress {
  const value = m.mode === "gain" ? Math.max(0, now - m.baseline) : now;
  const pct = Math.min(100, Math.round((value / m.target) * 100));
  if (value >= m.target) return { current: now, value, pct: 100, state: "hit" };
  if (today > m.endsOn) return { current: now, value, pct, state: "missed" };
  if (today < m.startsOn) return { current: now, value, pct, state: "upcoming" };
  const total = Math.max(1, (Date.parse(m.endsOn) - Date.parse(m.startsOn)) / 86_400_000 + 1);
  const gone = (Date.parse(today) - Date.parse(m.startsOn)) / 86_400_000 + 1;
  const timePct = Math.min(100, (gone / total) * 100);
  // The first stretch of a milestone is never "behind": nothing is expected after a day.
  return { current: now, value, pct, state: timePct <= 20 || pct >= timePct * 0.9 ? "on-track" : "behind" };
}

// ---- Meetings: a scheduled get-together with its own room in the group chat, an agenda, the decisions taken and the actions agreed
// (actions become work items with the meeting's id on them).
export const MEETING_STATUSES = ["scheduled", "live", "done"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];
export type MeetingDecision = { text: string; at: string; byUid: string };
export type Meeting = {
  id: string;
  title: string;
  startsAt: string; // ISO time
  agenda: string;
  conversationId: string; // the meeting's room in the group chat
  status: MeetingStatus;
  notes: string; // a short summary, written at the end
  decisions: MeetingDecision[];
  createdByUid: string;
  createdAt: string;
  endedAt: string;
};

// "2026-10-12" + "15:30" in Lagos time (UTC+1) → the matching ISO instant.
export function lagosToIso(date: string, time: string): string {
  if (!DATE.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new TeamError("Give the meeting a date and a time.");
  const t = Date.parse(`${date}T${time}:00+01:00`);
  if (!Number.isFinite(t)) throw new TeamError("That date or time isn't valid.");
  return new Date(t).toISOString();
}
export const lagosParts = (iso: string) => ({ date: lagosDate(new Date(iso)), time: new Date(Date.parse(iso) + 3_600_000).toISOString().slice(11, 16) });

export function cleanMeeting(body: Record<string, unknown>) {
  const title = clip(body.title, 100);
  if (!title) throw new TeamError("Give the meeting a title.");
  return { title, startsAt: lagosToIso(clip(body.date, 10), clip(body.time, 5)), agenda: clip(body.agenda, 2000) };
}

// A plain-text recap to paste anywhere: when, what was decided, what was agreed and who owns it.
export function meetingSummary(m: Meeting, actions: TeamItem[], nameOf: (uid: string) => string): string {
  const when = lagosParts(m.startsAt);
  const lines = [`${m.title} (${when.date}, ${when.time})`];
  if (m.agenda) lines.push("", "Agenda:", m.agenda);
  if (m.decisions.length) lines.push("", "Decisions:", ...m.decisions.map((d) => `- ${d.text}`));
  if (actions.length) lines.push("", "Actions:", ...actions.map((a) => `- ${a.title}${a.ownerUid ? ` (${nameOf(a.ownerUid)})` : ""}${a.due ? `, due ${a.due}` : ""}${a.status === "done" ? " [done]" : ""}`));
  if (m.notes) lines.push("", "Notes:", m.notes);
  return lines.join("\n");
}

// ---- Comments on items
export type TeamComment = { id: string; byUid: string; text: string; createdAt: string };
export const COMMENT_MAX = 1000;
export function cleanComment(text: unknown): string {
  const t = String(text ?? "").trim().slice(0, COMMENT_MAX);
  if (!t) throw new TeamError("Write a comment first.");
  return t;
}

// ---- The morning summary: one message per person, built from the same lists as the hub.
export type DigestSignal = { label: string; count: number };
export type DigestInput = {
  name: string;
  uid: string;
  today: string;
  items: TeamItem[];
  signals: DigestSignal[];
  milestones: { title: string; pct: number; state: string }[];
  meetingsToday: { title: string; time: string }[];
  nameOf: (uid: string) => string;
  link: string;
};
export type Digest = { subject: string; text: string; bell: string; empty: boolean };

export function buildMorningSummary(i: DigestInput): Digest {
  const g = groupItems(i.items, i.today);
  const mine = (x: TeamItem) => x.ownerUid === i.uid;
  const todayMine = g.today.filter(mine);
  const overdueMine = g.overdue.filter((x) => mine(x) && x.status !== "blocked" && x.status !== "decision");
  const doneYesterday = i.items.filter((x) => x.status === "done" && x.doneAt && lagosDay(x.doneAt) === addDays(i.today, -1)).length;
  const lines: string[] = [`Good morning, ${i.name.split(" ")[0] || "team"}.`];
  const dated = (x: TeamItem) => (x.due ? ` (due ${x.due === i.today ? "today" : x.due})` : "");
  if (todayMine.length) lines.push("", `Your day (${todayMine.length})`, ...todayMine.map((x) => `- ${x.title}${dated(x)}${isOverdue(x, i.today) ? " [overdue]" : ""}`));
  else lines.push("", "Nothing is set for you today.");
  if (i.meetingsToday.length) lines.push("", "Meetings today", ...i.meetingsToday.map((m) => `- ${m.time} ${m.title}`));
  if (g.decisions.length) lines.push("", `Waiting for a decision (${g.decisions.length})`, ...g.decisions.slice(0, 8).map((x) => `- ${x.decisionQuestion || x.title}${x.ownerUid ? ` (${i.nameOf(x.ownerUid)})` : ""}`));
  if (g.blocked.length) lines.push("", `Blocked (${g.blocked.length})`, ...g.blocked.slice(0, 8).map((x) => `- ${x.title}: ${x.blockedReason}${x.ownerUid ? ` (${i.nameOf(x.ownerUid)})` : ""}`));
  if (i.signals.length) lines.push("", "Waiting in the review queues", ...i.signals.map((s) => `- ${s.count} ${s.label.toLowerCase()}`));
  if (i.milestones.length) lines.push("", "Milestones", ...i.milestones.map((m) => `- ${m.title}: ${m.pct}% (${m.state})`));
  if (doneYesterday) lines.push("", `The team finished ${doneYesterday} item${doneYesterday === 1 ? "" : "s"} yesterday.`);
  lines.push("", `Open the team hub: ${i.link}`);

  const parts = [
    todayMine.length ? `${todayMine.length} for you today` : "",
    overdueMine.length ? `${overdueMine.length} overdue` : "",
    g.decisions.length ? `${g.decisions.length} decision${g.decisions.length === 1 ? "" : "s"} waiting` : "",
    g.blocked.length ? `${g.blocked.length} blocked` : "",
    i.meetingsToday.length ? `${i.meetingsToday.length} meeting${i.meetingsToday.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  const empty = !todayMine.length && !g.decisions.length && !g.blocked.length && !i.signals.length && !i.meetingsToday.length && !i.milestones.length;
  const day = new Date(`${i.today}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
  return { subject: `Team hub, ${day}${parts.length ? `: ${parts.join(", ")}` : ""}`, text: lines.join("\n"), bell: parts.length ? `Today: ${parts.join(", ")}.` : "Your team hub summary for today is ready.", empty };
}

// ---- The weekly review: weeks run Monday to Sunday (Lagos dates).
export function weekStart(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}
export const weekEnd = (start: string) => addDays(start, 6);

export type WeekNumbers = { weekStart: string; signups: number; payments: number; processedKobo: number };
// Counts by week from the dates people joined and paid.
export function bucketWeeks(signupDates: string[], payments: { date: string; kobo: number }[], currentWeekStart: string, weeks: number): WeekNumbers[] {
  const starts = Array.from({ length: weeks }, (_, k) => addDays(currentWeekStart, -7 * (weeks - 1 - k)));
  const idx = (d: string) => starts.indexOf(weekStart(d));
  const out: WeekNumbers[] = starts.map((s) => ({ weekStart: s, signups: 0, payments: 0, processedKobo: 0 }));
  for (const d of signupDates) { const k = idx(d); if (k >= 0) out[k].signups++; }
  for (const p of payments) { const k = idx(p.date); if (k >= 0) { out[k].payments++; out[k].processedKobo += p.kobo; } }
  return out;
}

export type WeekWork = { done: TeamItem[]; created: number; carriedOver: TeamItem[]; blocked: TeamItem[]; decisions: TeamItem[]; overdue: number };
export function weekWork(items: TeamItem[], start: string, today: string): WeekWork {
  const end = weekEnd(start);
  const inWeek = (iso: string) => { const d = lagosDay(iso); return d >= start && d <= end; };
  const open = items.filter(isOpen);
  return {
    done: items.filter((x) => x.status === "done" && x.doneAt && inWeek(x.doneAt)).sort((a, b) => a.doneAt.localeCompare(b.doneAt)),
    created: items.filter((x) => x.createdAt && inWeek(x.createdAt)).length,
    carriedOver: open.filter((x) => x.status !== "blocked" && x.status !== "decision" && (x.horizon !== "later" || (x.due && x.due <= end))).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")),
    blocked: open.filter((x) => x.status === "blocked"),
    decisions: open.filter((x) => x.status === "decision"),
    overdue: open.filter((x) => isOverdue(x, today)).length,
  };
}

export type Review = { wins: string; lessons: string; nextFocus: string };
export function cleanReview(body: Record<string, unknown>): Review {
  return { wins: clip(body.wins, 2000), lessons: clip(body.lessons, 2000), nextFocus: clip(body.nextFocus, 2000) };
}
// One line per thing to do next week: "- Ship forms", "1. Ship forms" and plain lines all work.
export function focusLines(text: string): string[] {
  return text.split("\n").map((l) => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim()).filter(Boolean).slice(0, 20);
}

// The weekly review as plain text (pasted into an email or used as a meeting's agenda).
export function reviewSummary(i: {
  weekStart: string;
  numbers: WeekNumbers[]; // the last weeks, oldest first, ending with this one
  work: WeekWork;
  milestones: { title: string; pct: number; state: string }[];
  meetings: { title: string; decisions: number }[];
  review: Review | null;
  nameOf: (uid: string) => string;
  naira: (kobo: number) => string;
}): string {
  const cur = i.numbers[i.numbers.length - 1], prev = i.numbers[i.numbers.length - 2];
  const delta = (a: number, b: number | undefined) => (b === undefined ? "" : a === b ? " (same as last week)" : ` (${a > b ? "+" : ""}${a - b} on last week)`);
  const lines = [`Weekly review: ${i.weekStart} to ${weekEnd(i.weekStart)}`, "", "Numbers",
    `- New members: ${cur?.signups ?? 0}${delta(cur?.signups ?? 0, prev?.signups)}`,
    `- Payments: ${cur?.payments ?? 0}${delta(cur?.payments ?? 0, prev?.payments)}`,
    `- Money processed: ${i.naira(cur?.processedKobo ?? 0)}`];
  lines.push("", `Work: ${i.work.done.length} done, ${i.work.created} added, ${i.work.carriedOver.length} carried over, ${i.work.overdue} overdue`);
  if (i.work.done.length) lines.push("Done:", ...i.work.done.map((x) => `- ${x.title}${x.ownerUid ? ` (${i.nameOf(x.ownerUid)})` : ""}`));
  if (i.work.decisions.length) lines.push("Waiting for a decision:", ...i.work.decisions.map((x) => `- ${x.decisionQuestion || x.title}`));
  if (i.work.blocked.length) lines.push("Blocked:", ...i.work.blocked.map((x) => `- ${x.title}: ${x.blockedReason}`));
  if (i.milestones.length) lines.push("", "Milestones", ...i.milestones.map((m) => `- ${m.title}: ${m.pct}% (${m.state})`));
  if (i.meetings.length) lines.push("", "Meetings", ...i.meetings.map((m) => `- ${m.title}${m.decisions ? `, ${m.decisions} decision${m.decisions === 1 ? "" : "s"}` : ""}`));
  if (i.review?.wins) lines.push("", "Wins:", i.review.wins);
  if (i.review?.lessons) lines.push("", "Lessons:", i.review.lessons);
  if (i.review?.nextFocus) lines.push("", "Next week's focus:", i.review.nextFocus);
  return lines.join("\n");
}
