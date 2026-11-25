// Notes Tasks: paid one-off tasks on NotesApp (owner, 25 Nov 2026: "a review and task platform… to upload the task and advertise the
// link, allowing for anonymous company profiles (paid feature)"). A verified organisation or a verified member posts a task, funds it
// from their NotesApp Credit, and shares its link. Members apply; the poster accepts up to `slots` of them. Accepted workers agree to the
// task's terms (its NDA), see the private brief and files, and submit their work; the poster approves (the reward is paid), asks for
// changes, or rejects. Both sides rate each other. Pure rules here; the server side is lib/tasks-server.ts.
//
// Money (escrow): publishing holds reward × slots from the poster's NotesApp Credit (lib/wallet-server.ts placeHold). Each approval takes
// one reward out of that hold into the ledger for the worker (less TASK_COMMISSION), paid to their bank PAYOUT_HOLD_HOURS later, the
// same way as paid sessions. Closing the task gives back what's left. A submission the poster doesn't review in REVIEW_DAYS is approved
// for them, so workers are never left unpaid by silence.
//
// Anonymous posting: the task shows "Verified organisation · Technology" instead of the poster's name. NotesApp still knows who it is.
// Included on Business and Enterprise; otherwise ANON_FEE_KOBO per task.
import type { AccountTier } from "./users";
import { INDUSTRY_LABEL, isIndustry } from "./profile-work";

export const TASKS_BRAND = "Notes Tasks";
export class TaskError extends Error { constructor(public status: number, message: string) { super(message); } }

export const TASK_CATEGORIES = [
  { key: "language", label: "Language data and translation" },
  { key: "writing", label: "Writing and editing" },
  { key: "research", label: "Research and surveys" },
  { key: "design", label: "Design and media" },
  { key: "data", label: "Data entry and labelling" },
  { key: "testing", label: "Testing and reviews" },
  { key: "tech", label: "Software and tech" },
  { key: "other", label: "Something else" },
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number]["key"];
export const CATEGORY_LABEL = Object.fromEntries(TASK_CATEGORIES.map((c) => [c.key, c.label])) as Record<TaskCategory, string>;
export const isCategory = (v: unknown): v is TaskCategory => TASK_CATEGORIES.some((c) => c.key === v);

export const TASK_COMMISSION = 0.1; // NotesApp's share of each reward
export const ANON_FEE_KOBO = 5_000 * 100;
export const REWARD_MIN_KOBO = 1_000 * 100;
export const REWARD_MAX_KOBO = 2_000_000 * 100;
export const SLOTS_MAX = 50;
export const DAYS_MIN = 1, DAYS_MAX = 60; // time a worker has after being accepted
export const OPEN_DAYS_MAX = 60; // applications close at most this long after publishing
export const REVIEW_DAYS = 5; // a submission not reviewed in this time is approved
export const CHANGES_MAX = 2; // rounds of "ask for changes" per worker
export const FILES_MAX = 10;
export const FILE_MAX_BYTES = 50 * 1024 * 1024;
export const TITLE_MAX = 100, SUMMARY_MAX = 280, DETAILS_MAX = 6_000, BRIEF_MAX = 10_000, TERMS_MAX = 10_000, PITCH_MAX = 1_000;
export const NOTE_MAX = 6_000, FEEDBACK_MAX = 1_000, COMMENT_MAX = 500;

export type TaskStatus = "draft" | "open" | "closed" | "removed";
export type TaskFile = { id: string; name: string; size: number; type: string };
export type Task = {
  id: string;
  posterUid: string; posterUsername: string; posterName: string; posterAvatar: string; posterOrg: boolean;
  anonymous: boolean; anonLabel: string;
  title: string; summary: string; details: string; category: TaskCategory;
  rewardKobo: number; slots: number; days: number; openDays: number; closesAt: string;
  terms: string; // the task's terms or NDA: public, so applicants know them before applying; agreeing is part of applying
  status: TaskStatus; funded: boolean; heldKobo: number; paidKobo: number;
  accepted: number; approved: number; applicants: number;
  ratingSum: number; ratingCount: number; // the poster's ratings from workers on this task
  createdAt: string; publishedAt?: string; closedAt?: string; removedReason?: string;
};
// Only for accepted workers and the poster: tasks/{id}/private/brief
export type TaskPrivate = { brief: string; files: (TaskFile & { key: string })[] };

export type AppStatus = "applied" | "accepted" | "declined" | "withdrawn" | "submitted" | "changes" | "approved" | "rejected" | "expired";
export type TaskApplication = {
  taskId: string; uid: string; username: string; name: string; avatar: string; pitch: string;
  status: AppStatus; appliedAt: string; acceptedAt?: string; termsAcceptedAt?: string; dueAt?: string;
  note?: string; files?: TaskFile[]; submittedAt?: string; changesAsked?: number; feedback?: string;
  decidedAt?: string; autoApproved?: boolean; reference?: string;
  workerRating?: number; workerComment?: string; // the poster's rating of the worker
  posterRating?: number; posterComment?: string; // the worker's rating of the poster
};
// Statuses that hold a slot.
export const ACTIVE: readonly AppStatus[] = ["accepted", "submitted", "changes"];
export const isActive = (s: AppStatus) => ACTIVE.includes(s);

const tidy = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
const line = (v: unknown, max: number) => tidy(v, max).replace(/\s+/g, " ");

export type TaskInput = { title?: unknown; summary?: unknown; details?: unknown; category?: unknown; rewardNaira?: unknown; slots?: unknown; days?: unknown; openDays?: unknown; anonymous?: unknown; brief?: unknown; terms?: unknown };
export type CleanTask = { title: string; summary: string; details: string; category: TaskCategory; rewardKobo: number; slots: number; days: number; openDays: number; anonymous: boolean; brief: string; terms: string };

// Checks a draft; throws a TaskError that says what to fix.
export function cleanTask(i: TaskInput): CleanTask {
  const title = line(i.title, TITLE_MAX), summary = line(i.summary, SUMMARY_MAX), details = tidy(i.details, DETAILS_MAX);
  if (title.length < 6) throw new TaskError(400, "Give the task a title of at least 6 characters.");
  if (summary.length < 20) throw new TaskError(400, "Add a one-line summary of at least 20 characters: it shows on the task board.");
  if (details.length < 40) throw new TaskError(400, "Describe the task in at least 40 characters: what's needed, and how it will be checked.");
  if (!isCategory(i.category)) throw new TaskError(400, "Choose a category.");
  const naira = Number(i.rewardNaira);
  const rewardKobo = Math.round(naira * 100);
  if (!Number.isFinite(naira) || rewardKobo < REWARD_MIN_KOBO || rewardKobo > REWARD_MAX_KOBO) throw new TaskError(400, `The reward per person is from ₦${(REWARD_MIN_KOBO / 100).toLocaleString()} to ₦${(REWARD_MAX_KOBO / 100).toLocaleString()}.`);
  const slots = Number(i.slots), days = Number(i.days), openDays = Number(i.openDays ?? 14);
  if (!Number.isInteger(slots) || slots < 1 || slots > SLOTS_MAX) throw new TaskError(400, `How many people: 1 to ${SLOTS_MAX}.`);
  if (!Number.isInteger(days) || days < DAYS_MIN || days > DAYS_MAX) throw new TaskError(400, `Days to finish after being accepted: ${DAYS_MIN} to ${DAYS_MAX}.`);
  if (!Number.isInteger(openDays) || openDays < 1 || openDays > OPEN_DAYS_MAX) throw new TaskError(400, `Applications stay open 1 to ${OPEN_DAYS_MAX} days.`);
  return { title, summary, details, category: i.category, rewardKobo, slots, days, openDays, anonymous: i.anonymous === true, brief: tidy(i.brief, BRIEF_MAX), terms: tidy(i.terms, TERMS_MAX) };
}

export const budgetKobo = (t: Pick<Task, "rewardKobo" | "slots">) => t.rewardKobo * t.slots;
export const workerNetKobo = (rewardKobo: number) => rewardKobo - Math.round(rewardKobo * TASK_COMMISSION);
export const anonIncluded = (tier: AccountTier | undefined) => tier === "business" || tier === "enterprise";
export const anonFeeFor = (anonymous: boolean, tier: AccountTier | undefined) => (anonymous && !anonIncluded(tier) ? ANON_FEE_KOBO : 0);
// What publishing takes from the poster's credit: the rewards (held) and any anonymous-posting fee (spent).
export const publishCostKobo = (t: Pick<Task, "rewardKobo" | "slots">, anonymous: boolean, tier: AccountTier | undefined) => budgetKobo(t) + anonFeeFor(anonymous, tier);

type PosterLike = { accountKind?: string; industry?: string; org?: { rcStatus?: string } | null };
// "Verified organisation · Technology or software", or "Verified member" with no industry given.
export function anonLabel(p: PosterLike): string {
  const who = p.accountKind === "organisation" ? "Verified organisation" : "Verified member";
  return isIndustry(p.industry) && p.industry !== "other" ? `${who} · ${INDUSTRY_LABEL[p.industry]}` : who;
}
// Who may post: a CAC-verified organisation, or a member with the ✔ (lib/users.ts hasVerifiedBadge), with a confirmed email.
export function canPost(p: { suspended?: boolean } | null | undefined, verifiedBadge: boolean, orgVerified: boolean, emailVerified: boolean): { ok: true } | { ok: false; reason: string } {
  if (!p || p.suspended) return { ok: false, reason: "Your account can't post tasks right now." };
  if (!emailVerified) return { ok: false, reason: "Confirm your email first." };
  if (!verifiedBadge && !orgVerified) return { ok: false, reason: "Tasks are posted by verified organisations and verified members (with the ✔), so workers know a real poster pays." };
  return { ok: true };
}

export const slotsLeft = (t: Pick<Task, "slots" | "accepted" | "approved">) => Math.max(0, t.slots - t.accepted - t.approved);
export const isOpenFor = (t: Pick<Task, "status" | "closesAt" | "funded">, now = new Date()) => t.status === "open" && t.funded && Date.parse(t.closesAt) > now.getTime();
export const posterRating = (t: Pick<Task, "ratingSum" | "ratingCount">) => (t.ratingCount ? Math.round((t.ratingSum / t.ratingCount) * 10) / 10 : null);
export const cleanPitch = (v: unknown) => tidy(v, PITCH_MAX);
export const cleanNote = (v: unknown) => tidy(v, NOTE_MAX);
export const cleanFeedback = (v: unknown) => tidy(v, FEEDBACK_MAX);
export const cleanComment = (v: unknown) => line(v, COMMENT_MAX);
export const cleanStars = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 5) throw new TaskError(400, "Rate from 1 to 5 stars."); return n; };

// What the public sees of a task: the poster's name only when it isn't anonymous.
export function publicTask(t: Task) {
  const { posterUid: _u, ...rest } = t; void _u;
  return t.anonymous ? { ...rest, posterUsername: "", posterName: t.anonLabel, posterAvatar: "", posterOrg: rest.posterOrg } : rest;
}

export const APP_LABEL: Record<AppStatus, string> = {
  applied: "Applied", accepted: "Accepted: working", declined: "Not selected", withdrawn: "Withdrawn", submitted: "Submitted: waiting for review",
  changes: "Changes asked", approved: "Approved and paid", rejected: "Not approved", expired: "Time ran out",
};
