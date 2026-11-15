// Campus programme (owner, 15 Nov 2026: "a campus coordinator [country specific, we start with Nigeria]; then Kenya, Botswana and Ghana menu in admin dashboard, also the
// coordinator can provide team access to her ambassadors, assign task and monitor them"). Pure rules; the server is lib/campus-server.ts.
//
// Who's who:
//   lead         super admins, the Chief of Staff and Marketing (the Campus Ambassador role reports to user acquisition): appoint and remove
//                coordinators in any country and see every country's team.
//   coordinator  runs one country's campus team: adds and removes her ambassadors, assigns tasks, reviews what they hand in, sees how
//                each is doing. A coordinator only ever sees and manages her own ambassadors.
//   ambassador   sees her own tasks, reports progress (a note and a link as proof), her own sign-ups and her referral link.
//
// Campus access is its own record (campusTeam/{uid}), not the staff `admin` claim: an ambassador gets the Campus pages in the admin area
// and nothing else (no staff badge, no internal pages or tools, no plan upgrade).

// Each country's day runs in its own time (due dates, "this month"): hours ahead of UTC, none of these keep summer time.
export const CAMPUS_COUNTRIES = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", utcHours: 1 },
  { code: "KE", name: "Kenya", flag: "🇰🇪", utcHours: 3 },
  { code: "BW", name: "Botswana", flag: "🇧🇼", utcHours: 2 },
  { code: "GH", name: "Ghana", flag: "🇬🇭", utcHours: 0 },
] as const;
export type CampusCountry = (typeof CAMPUS_COUNTRIES)[number]["code"];
export const isCampusCountry = (c: unknown): c is CampusCountry => CAMPUS_COUNTRIES.some((x) => x.code === c);
export const countryName = (c: string) => CAMPUS_COUNTRIES.find((x) => x.code === c)?.name ?? c;

export type CampusRole = "coordinator" | "ambassador";
export type CampusMember = {
  uid: string; role: CampusRole; country: CampusCountry;
  campus: string; // the university or college, e.g. "University of Lagos"
  state?: string; // e.g. "Lagos"
  coordinatorUid?: string; // an ambassador's coordinator
  username: string; name: string;
  addedBy: string; addedAt: string;
  lastCheckIn?: string; // last time they opened Campus or reported on a task (not their general online status)
};

export const TASK_KINDS = [
  { id: "signups", label: "Bring sign-ups", hint: "Members who join with your link or code" },
  { id: "event", label: "Hold an event", hint: "A talk, stand or workshop on campus" },
  { id: "content", label: "Post content", hint: "A post, video or story about #NotesApp" },
  { id: "other", label: "Other", hint: "Anything else" },
] as const;
export type TaskKind = (typeof TASK_KINDS)[number]["id"];
export const isTaskKind = (k: unknown): k is TaskKind => TASK_KINDS.some((x) => x.id === k);
export const taskKindLabel = (k: string) => TASK_KINDS.find((x) => x.id === k)?.label ?? k;

export type ProgressStatus = "todo" | "doing" | "done";
export const PROGRESS_LABEL: Record<ProgressStatus, string> = { todo: "To do", doing: "In progress", done: "Done" };
export type Review = "approved" | "redo";
export type Progress = { status: ProgressStatus; note?: string; proofUrl?: string; updatedAt?: string; review?: Review; reviewNote?: string; reviewedAt?: string };

export type CampusTask = {
  id: string; country: CampusCountry; coordinatorUid: string;
  title: string; details: string; kind: TaskKind;
  target?: number; // for sign-ups: how many each ambassador should bring
  due: string; // YYYY-MM-DD
  assignees: string[];
  progress: Record<string, Progress>;
  createdBy: string; createdAt: string; updatedAt: string;
};

export const LIMITS = { title: 120, details: 2000, note: 1000, url: 500, campus: 120, state: 40, assignees: 200, team: 300 };

export class CampusError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// A new or edited task from the form. `today` is YYYY-MM-DD: a due date can't be in the past.
export function cleanTask(input: Record<string, unknown>, today: string): { title: string; details: string; kind: TaskKind; target?: number; due: string } {
  const title = clip(input.title, LIMITS.title);
  if (title.length < 3) throw new CampusError("Give the task a short title.");
  const details = String(input.details ?? "").trim().slice(0, LIMITS.details);
  const kind = isTaskKind(input.kind) ? input.kind : "other";
  const due = String(input.due ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(`${due}T00:00:00Z`))) throw new CampusError("Choose a due date.");
  if (due < today) throw new CampusError("The due date has passed. Choose today or later.");
  let target: number | undefined;
  if (kind === "signups") {
    target = Math.floor(Number(input.target));
    if (!Number.isFinite(target) || target < 1 || target > 10_000) throw new CampusError("Say how many sign-ups each ambassador should bring.");
  }
  return { title, details, kind, ...(target ? { target } : {}), due };
}

// A proof link must be an ordinary web address.
export function cleanUrl(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  if (s.length > LIMITS.url || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(s)) throw new CampusError("The proof link must start with https://");
  return s;
}

export const isOverdue = (t: Pick<CampusTask, "due">, p: Progress | undefined, today: string) => (p?.status ?? "todo") !== "done" && t.due < today;

// How an ambassador is doing with her tasks.
export function taskCounts(tasks: CampusTask[], uid: string, today: string) {
  let done = 0, open = 0, overdue = 0, redo = 0;
  for (const t of tasks) {
    if (!t.assignees.includes(uid)) continue;
    const p = t.progress[uid];
    if (p?.status === "done" && p.review !== "redo") done++;
    else { open++; if (isOverdue(t, p, today)) overdue++; }
    if (p?.review === "redo") redo++;
  }
  return { done, open, overdue, redo };
}

// The Campus pages in the admin menu, by who's looking.
export type CampusView = { lead: boolean; role: CampusRole | null };
export function campusPages(v: CampusView): { href: string; label: string; group: "Campus" }[] {
  if (!v.lead && !v.role) return [];
  const coord = v.lead || v.role === "coordinator";
  return [
    { href: "/admin/campus", label: v.role === "ambassador" && !v.lead ? "My campus" : "Overview", group: "Campus" as const },
    { href: "/admin/campus/tasks", label: "Tasks", group: "Campus" as const },
    { href: "/admin/campus/leaderboard", label: "Leaderboard", group: "Campus" as const },
    ...(coord ? [{ href: "/admin/campus/ambassadors", label: "Ambassadors", group: "Campus" as const }] : []),
    ...(v.lead ? [{ href: "/admin/campus/coordinators", label: "Coordinators", group: "Campus" as const }] : []),
  ];
}

// Today in a campus country (due dates and "this month" are its own days); Nigeria when it isn't known.
export const campusDay = (country: string | undefined, now: Date = new Date()) => {
  const h = CAMPUS_COUNTRIES.find((c) => c.code === country)?.utcHours ?? 1;
  return new Date(now.getTime() + h * 3_600_000).toISOString().slice(0, 10);
};
export const lagosDay = (now = new Date()) => campusDay("NG", now);

// ---- the gamified leaderboard (owner, 15 Nov 2026: "make the gamified leaderboard available for ambassadors") ----
// Points: every member who joins with your link or code, every task your coordinator approves, and a bonus when it was done by its due date.
export const POINTS = { signup: 10, approved: 20, onTime: 10 } as const;
// Levels come from all-time points and never go down.
export const LEVELS = [
  { min: 0, name: "Rookie", emoji: "🌱" },
  { min: 100, name: "Rising", emoji: "⭐" },
  { min: 300, name: "Star", emoji: "🌟" },
  { min: 750, name: "Champion", emoji: "🏆" },
  { min: 1500, name: "Legend", emoji: "👑" },
] as const;
export type Level = (typeof LEVELS)[number];
export function levelFor(points: number): { level: Level; next: Level | null; toNext: number } {
  let i = 0;
  for (let j = 0; j < LEVELS.length; j++) if (points >= LEVELS[j].min) i = j;
  const next = LEVELS[i + 1] ?? null;
  return { level: LEVELS[i], next, toNext: next ? next.min - points : 0 };
}
export type Tally = { signups: number; approved: number; onTime: number };
export const pointsOf = (t: Tally) => t.signups * POINTS.signup + t.approved * POINTS.approved + t.onTime * POINTS.onTime;

// Approved tasks for one ambassador, this month (by when the coordinator approved it, in the country's days) and in all; "on time" when
// she last reported it on or before its due day.
export function approvedTally(tasks: CampusTask[], uid: string, monthStart: string, country: string): { month: Omit<Tally, "signups">; all: Omit<Tally, "signups"> } {
  const month = { approved: 0, onTime: 0 }, all = { approved: 0, onTime: 0 };
  for (const t of tasks) {
    const p = t.progress[uid];
    if (!t.assignees.includes(uid) || p?.review !== "approved") continue;
    const onTime = !!p.updatedAt && campusDay(country, new Date(p.updatedAt)) <= t.due;
    all.approved++; if (onTime) all.onTime++;
    if (p.reviewedAt && campusDay(country, new Date(p.reviewedAt)) >= monthStart) { month.approved++; if (onTime) month.onTime++; }
  }
  return { month, all };
}

// On the leaderboard ambassadors see each other by first name and initial ("Chioma E."), with their campus.
export const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};
export const MEDALS = ["🥇", "🥈", "🥉"];
