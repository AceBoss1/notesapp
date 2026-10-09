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
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// A date in Lagos (WAT, UTC+1, no daylight saving), as YYYY-MM-DD.
export function lagosDate(now = new Date()): string {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}
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
  g.recentlyDone = items.filter((i) => i.status === "done" && i.doneAt.slice(0, 10) >= since).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
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
