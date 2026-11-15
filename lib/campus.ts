// Campus programme (owner, 15 Nov 2026: "a campus coordinator [country specific, we start with Nigeria] menu in admin dashboard, also the
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

export const CAMPUS_COUNTRIES = [{ code: "NG", name: "Nigeria", flag: "🇳🇬" }] as const;
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
    ...(coord ? [{ href: "/admin/campus/ambassadors", label: "Ambassadors", group: "Campus" as const }] : []),
    ...(v.lead ? [{ href: "/admin/campus/coordinators", label: "Coordinators", group: "Campus" as const }] : []),
  ];
}

// Today in Lagos (WAT, UTC+1): due dates are campus days.
export const lagosDay = (now = new Date()) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
