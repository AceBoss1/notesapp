import { DEPT_LABEL, isDept, type Dept } from "./admin-access";
import { addDays, lagosDate, weekStart } from "./team";

// Time in the team hub (/admin/team/time): a timer, a weekly timesheet, attendance, leave, billable projects and pay by the hour.
// The rules the owner set (22 Oct 2026):
//   - The working week is 20 hours: 4 a day, Monday to Friday. First in after 9:00 am Lagos time is marked late, but hours are what count.
//   - Everyone is paid by the hour for now: approved hours × their hourly rate go into the month's payroll run.
//   - A running timer asks "still working?" every 30 minutes. No answer within 10 minutes stops it at the last answer, so the last 30
//     minutes aren't counted. A meeting timer waits for the meeting's planned length before it first asks.
//   - A timer still running at Lagos midnight stops there and asks the person to check it.
//   - Friday 4 pm: a reminder if this week's timesheet isn't submitted.
//   - Timesheets and leave are approved by a team lead of one of the person's departments or a super admin, never by the person
//     themselves (the owner, who has no one above them, can approve their own).
//   - Staff see their own time, team leads their departments, super admins everyone. Hours only: no screenshots, no keystrokes.
// Pure functions, shared by the page and the server (lib/time-server.ts), which is what decides.

export const DAY_HOURS = 4;
export const WORK_DAYS = 5;
export const WEEK_MINUTES = DAY_HOURS * WORK_DAYS * 60;
export const LATE_AFTER = "09:00";
export const CHECK_EVERY_MIN = 30;
export const ANSWER_WITHIN_MIN = 10;
export const FRIDAY_NUDGE = "16:00";
export const MEETING_LENGTHS = [30, 60, 90, 120];

export class TimeError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export type TimeKind = "item" | "project" | "meeting" | "other";
export const KIND_LABEL: Record<TimeKind, string> = { item: "Work item", project: "Project", meeting: "Meeting", other: "Other work" };
export const isKind = (k: unknown): k is TimeKind => k === "item" || k === "project" || k === "meeting" || k === "other";

// What the time is for. `refId` is the work item, project or meeting; "other" work has only a label.
export type Target = { kind: TimeKind; refId: string; label: string; dept: string; billable: boolean };

export type Timer = Target & {
  uid: string;
  note: string;
  startedAt: string; // ISO
  checkAt: string; // when it next asks "still working?"
  safeUntil: string; // where it stops if that goes unanswered
  plannedMinutes?: number; // meetings only
  promptedFor?: string; // the checkAt the bell was last sent for
};

export type TimeEntry = Target & {
  id: string;
  uid: string;
  day: string; // Lagos date
  minutes: number; // negative only for a timesheet correction (source "adjust")
  startedAt: string; // "" for time added by hand
  endedAt: string;
  note: string;
  source: "timer" | "manual" | "adjust";
  flag?: "midnight" | "no-answer";
  createdAt: string;
};

export type SheetStatus = "draft" | "submitted" | "approved";
export type Timesheet = { uid: string; week: string; status: SheetStatus; submittedAt?: string; decidedBy?: string; decidedAt?: string; returnNote?: string };

export type LeaveKind = "annual" | "sick" | "holiday" | "other";
export const LEAVE_LABEL: Record<LeaveKind, string> = { annual: "Annual leave", sick: "Sick leave", holiday: "Public holiday", other: "Other leave" };
export const isLeaveKind = (k: unknown): k is LeaveKind => k === "annual" || k === "sick" || k === "holiday" || k === "other";
export type Leave = { id: string; uid: string; kind: LeaveKind; from: string; to: string; counts: boolean; note: string; status: "pending" | "approved" | "declined"; decidedBy?: string; createdAt: string };
export const EVERYONE = "*"; // a public holiday set for the whole team

export type Project = { id: string; name: string; client: string; dept: string; billable: boolean; rateKobo: number; budgetHours: number; active: boolean; createdAt: string };

// ── Times and days ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const MIN = 60_000;
export const plusMin = (iso: string, m: number) => new Date(Date.parse(iso) + m * MIN).toISOString();
// The next Lagos midnight after a time (Lagos is UTC+1 all year).
export const lagosMidnightAfter = (iso: string) => new Date(Date.parse(`${addDays(lagosDate(new Date(iso)), 1)}T00:00:00+01:00`)).toISOString();
export const lagosClock = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(11, 16);
export const isWeekday = (day: string) => { const d = new Date(`${day}T12:00:00Z`).getUTCDay(); return d >= 1 && d <= 5; };
export const weekDays = (week: string) => Array.from({ length: 7 }, (_, i) => addDays(week, i));
export const isDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));
export const isWeek = (w: unknown): w is string => isDay(w) && weekStart(w) === w;

// "1h 05m", "45m", "-0h 30m" for corrections.
export function hm(minutes: number): string {
  const neg = minutes < 0, m = Math.abs(Math.round(minutes));
  return `${neg ? "-" : ""}${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
// "2:30" in the grid.
export const clock = (minutes: number) => { const m = Math.abs(Math.round(minutes)); return `${minutes < 0 ? "-" : ""}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };

// "2:30", "2h30", "2.5", "150m" or "90" (minutes) → minutes. null when it can't be read.
export function parseDuration(v: unknown): number | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || s === "-" || s === "–") return 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d{1,2})\s*h\s*(?:([0-5]?\d)\s*m?)?$/))) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  if ((m = s.match(/^(\d{1,4})\s*m(in)?$/))) return Number(m[1]);
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})$/))) return Math.round(Number(s) * 60);
  if ((m = s.match(/^\d{1,2}$/))) return Number(s) * 60; // a bare small number is hours
  return null;
}

// ── The timer ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function startTimer(uid: string, target: Target, note: string, nowIso: string, plannedMinutes?: number): Timer {
  if (target.kind === "meeting") {
    const p = Number(plannedMinutes);
    if (!Number.isInteger(p) || p < 15 || p > 480) throw new TimeError("Say how long the meeting is planned for, between 15 minutes and 8 hours.");
    // It doesn't ask until the meeting's planned end; unanswered, the meeting's time still counts.
    const end = plusMin(nowIso, p);
    return { ...target, uid, note, startedAt: nowIso, checkAt: end, safeUntil: end, plannedMinutes: p };
  }
  return { ...target, uid, note, startedAt: nowIso, checkAt: plusMin(nowIso, CHECK_EVERY_MIN), safeUntil: nowIso };
}

// "Yes, still working": counted up to now, asked again in 30 minutes. Too late (already stopped) is the caller's to check with settle().
export const confirmTimer = (t: Timer, nowIso: string): Timer => ({ ...t, checkAt: plusMin(nowIso, CHECK_EVERY_MIN), safeUntil: nowIso, promptedFor: undefined });

export type Settled = { endedAt: string; flag?: "midnight" | "no-answer" } | null;
// Whether a running timer has stopped by itself by `nowIso`, and where: at Lagos midnight, or (no answer) at the last answer.
export function settle(t: Timer, nowIso: string): Settled {
  const now = Date.parse(nowIso);
  const midnight = lagosMidnightAfter(t.startedAt);
  const missed = now > Date.parse(plusMin(t.checkAt, ANSWER_WITHIN_MIN));
  if (missed && Date.parse(t.safeUntil) < Date.parse(midnight)) return { endedAt: t.safeUntil, flag: "no-answer" };
  if (now >= Date.parse(midnight)) return { endedAt: midnight, flag: "midnight" };
  return null;
}
export const asking = (t: Timer, nowIso: string) => Date.parse(nowIso) >= Date.parse(t.checkAt);
export const answerBy = (t: Timer) => plusMin(t.checkAt, ANSWER_WITHIN_MIN);

// The entry a stopped timer leaves (null when under a minute).
export function entryFromTimer(t: Timer, endedAt: string, flag: TimeEntry["flag"], nowIso: string): Omit<TimeEntry, "id"> | null {
  const minutes = Math.floor((Date.parse(endedAt) - Date.parse(t.startedAt)) / MIN);
  if (minutes < 1) return null;
  const { kind, refId, label, dept, billable, uid, note, startedAt } = t;
  return { kind, refId, label, dept, billable, uid, note, startedAt, endedAt, day: lagosDate(new Date(startedAt)), minutes, source: "timer", ...(flag ? { flag } : {}), createdAt: nowIso };
}

// ── Cleaning input ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
export const cleanNote = (v: unknown) => clip(v, 200);

// What the page sends to say what the time is for; the server fills in the label and department from the item, project or meeting.
export function cleanTargetInput(b: Record<string, unknown>): { kind: TimeKind; refId: string; label: string; billable: boolean } {
  if (!isKind(b.kind)) throw new TimeError("Choose what you're working on.");
  const refId = clip(b.refId, 80), label = clip(b.label, 100);
  if (b.kind === "other" && !label) throw new TimeError("Say what you're working on.");
  if (b.kind !== "other" && !refId) throw new TimeError("Choose the work item, project or meeting.");
  return { kind: b.kind, refId, label, billable: b.billable === true };
}

export function cleanManual(b: Record<string, unknown>, today: string): { day: string; minutes: number } {
  if (!isDay(b.day)) throw new TimeError("Choose the day.");
  if (String(b.day) > today) throw new TimeError("You can't add time for a day that hasn't come yet.");
  const minutes = parseDuration(b.duration);
  if (minutes === null || minutes < 1) throw new TimeError("Enter the time as 1:30, 1h30 or 90m.");
  if (minutes > 16 * 60) throw new TimeError("That's more than 16 hours in one go. Split it, or check it.");
  return { day: String(b.day), minutes };
}

export function cleanLeave(b: Record<string, unknown>): { kind: LeaveKind; from: string; to: string; counts: boolean; note: string } {
  if (!isLeaveKind(b.kind)) throw new TimeError("Choose the kind of leave.");
  if (!isDay(b.from) || !isDay(b.to)) throw new TimeError("Choose the first and last day.");
  const from = String(b.from), to = String(b.to);
  if (to < from) throw new TimeError("The last day is before the first.");
  if (leaveDays({ from, to }).length > 60) throw new TimeError("That's more than 60 working days. Ask for it in parts.");
  if (!leaveDays({ from, to }).length) throw new TimeError("Those days are a weekend. Leave covers Monday to Friday.");
  return { kind: b.kind, from, to, counts: b.counts !== false, note: clip(b.note, 200) };
}
// The weekdays a leave covers.
export function leaveDays(l: Pick<Leave, "from" | "to">): string[] {
  const out: string[] = [];
  for (let d = l.from; d <= l.to && out.length < 400; d = addDays(d, 1)) if (isWeekday(d)) out.push(d);
  return out;
}

export function cleanProject(b: Record<string, unknown>): Omit<Project, "id" | "createdAt" | "active"> {
  const name = clip(b.name, 80);
  if (!name) throw new TimeError("Give the project a name.");
  const dept = isDept(b.dept) ? b.dept : "";
  const billable = b.billable === true;
  const rate = Number(String(b.rate ?? "0").replace(/[₦,\s]/g, "") || 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000) throw new TimeError("Enter the hourly rate in naira, for example 5000.");
  if (billable && rate <= 0) throw new TimeError("A billable project needs an hourly rate.");
  const budget = Number(b.budgetHours ?? 0);
  if (!Number.isFinite(budget) || budget < 0 || budget > 100_000) throw new TimeError("Enter the budget in hours, or 0 for none.");
  return { name, client: clip(b.client, 80), dept, billable, rateKobo: billable ? Math.round(rate * 100) : 0, budgetHours: Math.round(budget) };
}

// ── Who sees and approves ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Viewer = { uid: string; superAdmin: boolean; owner: boolean; leads: string[] };
export const leadsAny = (v: Viewer, depts: readonly string[] = []) => v.leads.some((d) => depts.includes(d));
export const canSee = (v: Viewer, person: { uid: string; depts?: readonly string[] }) => v.superAdmin || v.uid === person.uid || leadsAny(v, person.depts);
export function canApprove(v: Viewer, person: { uid: string; depts?: readonly string[] }): boolean {
  if (v.uid === person.uid) return v.owner;
  return v.superAdmin || leadsAny(v, person.depts);
}
export const isApprover = (v: Viewer) => v.superAdmin || v.leads.length > 0;
export const cleanLeads = (v: unknown): Dept[] => Array.from(new Set((Array.isArray(v) ? v : []).filter(isDept)));
export const leadsLabel = (d: readonly string[]) => d.map((x) => DEPT_LABEL[x as Dept] ?? x).join(", ");

// A week can change while it's a draft. Submitted or approved, it is locked until it's returned.
export const locked = (s: SheetStatus | undefined) => s === "submitted" || s === "approved";

// ── The week, added up ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Row = { key: string; kind: TimeKind; refId: string; label: string; dept: string; billable: boolean; days: Record<string, number>; total: number };
export const rowKey = (t: Pick<Target, "kind" | "refId" | "label" | "billable">) => `${t.kind}|${t.refId || t.label.toLowerCase()}|${t.billable ? 1 : 0}`;

// The grid: one row per piece of work (and billable or not), a cell per day.
export function weekRows(entries: Pick<TimeEntry, "kind" | "refId" | "label" | "dept" | "billable" | "day" | "minutes">[]): Row[] {
  const rows = new Map<string, Row>();
  for (const e of entries) {
    const k = rowKey(e);
    let r = rows.get(k);
    if (!r) rows.set(k, (r = { key: k, kind: e.kind, refId: e.refId, label: e.label, dept: e.dept, billable: e.billable, days: {}, total: 0 }));
    r.days[e.day] = (r.days[e.day] ?? 0) + e.minutes;
    r.total += e.minutes;
  }
  return Array.from(rows.values()).filter((r) => r.total !== 0 || Object.values(r.days).some((m) => m !== 0)).sort((a, b) => b.total - a.total);
}

export type DayAttendance = { day: string; minutes: number; firstIn: string; late: boolean; leave?: LeaveKind; counts: boolean };
export type WeekSummary = {
  week: string; tracked: number; billable: number; assigned: number; target: number; daysPresent: number; daysDue: number; late: number; leaveDays: number;
  firstInAvg: string; days: DayAttendance[];
};

// Hours, billable and assigned shares and attendance for one person's week. Weekdays up to `today` are due; a day with time tracked
// is present, and so is a day of approved leave that counts towards attendance.
export function weekSummary(week: string, entries: Pick<TimeEntry, "day" | "minutes" | "billable" | "kind" | "startedAt" | "source">[], leave: Pick<Leave, "from" | "to" | "kind" | "counts" | "status">[], today: string): WeekSummary {
  const days = weekDays(week).map((day): DayAttendance => {
    const mine = entries.filter((e) => e.day === day);
    const minutes = mine.reduce((s, e) => s + e.minutes, 0);
    const starts = mine.filter((e) => e.source === "timer" && e.startedAt).map((e) => e.startedAt).sort();
    const firstIn = starts[0] ? lagosClock(starts[0]) : "";
    const l = leave.find((x) => x.status === "approved" && x.from <= day && day <= x.to && isWeekday(day));
    return { day, minutes, firstIn, late: !!firstIn && firstIn > LATE_AFTER, ...(l ? { leave: l.kind } : {}), counts: !!l?.counts };
  });
  const due = days.filter((d) => isWeekday(d.day) && d.day <= today);
  const present = due.filter((d) => d.minutes > 0 || d.counts);
  const firsts = days.filter((d) => d.firstIn).map((d) => Number(d.firstIn.slice(0, 2)) * 60 + Number(d.firstIn.slice(3)));
  const avg = firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : -1;
  const sum = (f: (e: (typeof entries)[number]) => boolean) => entries.filter(f).reduce((s, e) => s + e.minutes, 0);
  return {
    week, days, target: WEEK_MINUTES,
    tracked: sum(() => true), billable: sum((e) => e.billable), assigned: sum((e) => e.kind !== "other"),
    daysPresent: present.length, daysDue: due.length, late: days.filter((d) => d.late).length, leaveDays: days.filter((d) => d.leave && isWeekday(d.day)).length,
    firstInAvg: avg < 0 ? "" : `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`,
  };
}
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Pay for hours: minutes × the hourly rate, to the kobo.
export const payFor = (minutes: number, hourlyKobo: number) => Math.round((Math.max(0, minutes) * hourlyKobo) / 60);

// The approved minutes in a month, from entries whose week's timesheet was approved. Weeks that cross months split by day.
export function approvedMinutesInMonth(entries: Pick<TimeEntry, "day" | "minutes">[], approvedWeeks: Set<string>, month: string): number {
  return Math.max(0, entries.filter((e) => e.day.slice(0, 7) === month && approvedWeeks.has(weekStart(e.day))).reduce((s, e) => s + e.minutes, 0));
}

// The team report as CSV: one line per person for the week.
export function teamCsv(rows: { name: string; depts: string; s: WeekSummary; status: SheetStatus; payKobo: number }[]): string {
  const q = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const head = ["Name", "Departments", "Week", "Tracked hours", "Billable hours", "Assigned hours", "Days present", "Days due", "Late", "Leave days", "Timesheet", "Pay (NGN)"];
  const h = (m: number) => (m / 60).toFixed(2);
  return [head, ...rows.map((r) => [r.name, r.depts, r.s.week, h(r.s.tracked), h(r.s.billable), h(r.s.assigned), r.s.daysPresent, r.s.daysDue, r.s.late, r.s.leaveDays, r.status, (r.payKobo / 100).toFixed(2)])]
    .map((l) => l.map(q).join(",")).join("\n");
}

// Friday at 4 pm Lagos time (or later that day): the week's reminder is due.
export function fridayNudgeDue(now: Date): boolean {
  const day = lagosDate(now);
  return new Date(`${day}T12:00:00Z`).getUTCDay() === 5 && lagosClock(now.toISOString()) >= FRIDAY_NUDGE;
}
