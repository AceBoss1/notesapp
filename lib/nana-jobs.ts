import { isAiProvider, type AiProvider } from "./ai-providers";

// Nana Jobs (docs/NANA_JOBS.md): the shapes and rules shared by the browser and the server. The funnel is in lib/nana-jobs-funnel.ts,
// the job sources in lib/nana-jobs-sources.ts, and everything that reads or writes Firestore in lib/nana-jobs-server.ts.
export const NANA_JOBS = "Nana Jobs";

export class NanaJobsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Who may use it: members 18 and up with a personal account. Teens (and kids' profiles) keep the normal job board; organisation
// accounts hire, they don't job-hunt here. Free on every plan, because the member's own AI pays for the scoring.
export type WhoFlags = { teen?: unknown; kid?: unknown; accountKind?: unknown } | null | undefined;
export function whyNotAllowed(u: WhoFlags): string | null {
  if (!u) return "Sign in to use Nana Jobs.";
  if (u.teen === true || u.kid === true) return "Nana Jobs is for members aged 18 and over. The job board on Explore is still yours.";
  if (u.accountKind === "organisation") return "Nana Jobs is for personal accounts. Organisations post jobs on Notes Jobs instead.";
  return null;
}

export const SENIORITY = ["junior", "mid", "senior", "lead"] as const;
export type Seniority = (typeof SENIORITY)[number];
export const SENIORITY_LABEL: Record<Seniority, string> = { junior: "Junior or entry level", mid: "Mid level", senior: "Senior", lead: "Lead or manager" };

export const ATS = ["greenhouse", "lever", "ashby"] as const;
export type Ats = (typeof ATS)[number];
export const ATS_LABEL: Record<Ats, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" };
export type Board = { name: string; ats: Ats | null; slug: string; ok: boolean };

// The scoring profile: what Nana judges every opening against. Private: firms never see it.
export type NjProfile = {
  roles: string[]; // roles you want
  shipped: string[]; // things you've actually shipped: the only experience Nana may claim for you
  skills: string[];
  remote: boolean; // happy to work remotely
  cities: string[]; // on-site: cities you can work in
  country: string; // where you live (location rules: "remote, but only from the US")
  seniority: Seniority;
  payFloor: string; // the lowest pay you'll take, in your own words
  dealBreakers: string[];
};
// Where to look, which AI, and when to send it.
export type NjSettings = {
  provider: AiProvider | ""; // the AI the member chose ("" = a free one if connected, else the rough ranking)
  feeds: boolean; // the open feeds in lib/nana-jobs-sources.ts FEEDS
  boards: boolean; // the company boards below
  companies: Board[];
  bell: boolean; // on by default
  email: boolean; // off by default
  hour: number; // Lagos time, 0-23
  aiPerDay: number; // how many openings the member's AI reads each run
};
export const AI_PER_DAY = { min: 5, max: 60, default: 25 } as const;
export const MAX_COMPANIES = 40;
export const SHORTLIST = { min: 5, max: 15, threshold: 50 } as const;

export const DEFAULT_PROFILE: NjProfile = { roles: [], shipped: [], skills: [], remote: true, cities: [], country: "Nigeria", seniority: "mid", payFloor: "", dealBreakers: [] };
export const DEFAULT_SETTINGS: NjSettings = { provider: "", feeds: true, boards: true, companies: [], bell: true, email: false, hour: 8, aiPerDay: AI_PER_DAY.default };

const line = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
function list(v: unknown, maxItems: number, maxLen: number): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n/) : [];
  const out: string[] = [];
  for (const x of raw) {
    const s = line(String(x ?? "").replace(/^[\s•\-*·]+/, ""), maxLen);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function cleanProfile(b: Record<string, unknown>, cur: NjProfile = DEFAULT_PROFILE): NjProfile {
  const has = (k: string) => b[k] !== undefined;
  return {
    roles: has("roles") ? list(b.roles, 8, 60) : cur.roles,
    shipped: has("shipped") ? list(b.shipped, 12, 220) : cur.shipped,
    skills: has("skills") ? list(b.skills, 30, 40) : cur.skills,
    remote: typeof b.remote === "boolean" ? b.remote : cur.remote,
    cities: has("cities") ? list(b.cities, 6, 50) : cur.cities,
    country: has("country") ? line(b.country, 50) : cur.country,
    seniority: (SENIORITY as readonly string[]).includes(String(b.seniority)) ? (b.seniority as Seniority) : cur.seniority,
    payFloor: has("payFloor") ? line(b.payFloor, 80) : cur.payFloor,
    dealBreakers: has("dealBreakers") ? list(b.dealBreakers, 15, 60).map((s) => s.replace(/^["“]|["”]$/g, "")) : cur.dealBreakers,
  };
}

export function cleanSettings(b: Record<string, unknown>, cur: NjSettings = DEFAULT_SETTINGS): NjSettings {
  const n = Number(b.aiPerDay);
  const h = Number(b.hour);
  return {
    provider: b.provider === "" ? "" : isAiProvider(b.provider) ? b.provider : cur.provider,
    feeds: typeof b.feeds === "boolean" ? b.feeds : cur.feeds,
    boards: typeof b.boards === "boolean" ? b.boards : cur.boards,
    companies: cur.companies, // changed only through addCompany / removeCompany, which check the board first
    bell: typeof b.bell === "boolean" ? b.bell : cur.bell,
    email: typeof b.email === "boolean" ? b.email : cur.email,
    hour: Number.isInteger(h) && h >= 0 && h <= 23 ? h : cur.hour,
    aiPerDay: Number.isFinite(n) && b.aiPerDay !== undefined ? Math.min(AI_PER_DAY.max, Math.max(AI_PER_DAY.min, Math.round(n))) : cur.aiPerDay,
  };
}

// The four set-up steps (screen 1), done or not.
export type Steps = { ai: boolean; profile: boolean; sources: boolean; when: boolean };
export const profileReady = (p: NjProfile) => p.roles.length > 0 && (p.remote || p.cities.length > 0);

// The next run at the member's hour in Lagos time (UTC+1, no summer time), strictly after `now`.
export function nextRunAt(hour: number, now = new Date()): string {
  const t = new Date(now);
  t.setUTCHours(hour - 1, 0, 0, 0); // Lagos is UTC+1
  while (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString();
}
export const hourText = (h: number) => `${String(h).padStart(2, "0")}:00 Lagos`;

export type JobStatus = "interested" | "applied" | "not_for_me";
export const JOB_STATUS_LABEL: Record<JobStatus, string> = { interested: "Interested", applied: "Applied", not_for_me: "Not for me" };
export const isJobStatus = (s: unknown): s is JobStatus => typeof s === "string" && s in JOB_STATUS_LABEL;

// One opening, the same shape from every source.
export type PoolJob = {
  hash: string; source: string; sourceLabel: string; company: string; title: string; location: string; url: string;
  postedAt: string | null; description: string; salaryText: string; tags: string[]; remoteHint: boolean | null;
  notesJobId?: string; // a Notes Jobs job: "Apply on #NotesApp"
};
// One line of the shortlist.
export type ShortJob = {
  hash: string; title: string; company: string; location: string; url: string; source: string; sourceLabel: string; postedAt: string | null;
  notesJobId?: string; score: number; rough: boolean; reason: string; risk: string; link: "live" | "unknown" | "not_checked";
  parts?: { domain: number; stack: number; seniority: number; location: number; signal: number };
  status?: JobStatus;
};
export type Funnel = { collected: number; unique: number; fit: number; keywordTop: number; readByAi: number; alive: number };
// profileFrom: what the run judged against. "yours" = the member's own roles; "cv" = no roles yet, so the roles from their CV review;
// "empty" = neither, so no title gate at all (v0.174.1: an empty profile used to keep nothing).
export type ProfileFrom = "yours" | "cv" | "empty";
export type NjRun = { at: string; provider: AiProvider | ""; model: string; funnel: Funnel; error: string; note: string; jobs: ShortJob[]; rejected: Record<string, number>; profileFrom?: ProfileFrom; via?: "lite" };
// via "lite": no AI of the member's was connected, so Nana Lite (our small model, lib/nana-lite.ts) read the top openings at our cost.
export const LITE_JOBS_PER_RUN = 10; // openings Nana Lite reads in one run (our cost): the best of the keyword ranking

// Every opening a run collected, with what happened to it (the "See all collected jobs" view). Only the member's own run; read-only.
export type SeenJob = { hash: string; title: string; company: string; location: string; url: string; sourceLabel: string; notesJobId?: string; outcome: "listed" | "cut" | "ranked"; why: string };
export const SEEN_MAX = 1000;

// The hard filters' reasons, grouped into the few a member understands ("312 not in your roles · 98 location · 44 too old").
export function cutGroup(reason: string): string {
  if (reason === "title isn't a role you want") return "not in your roles";
  if (/^older than/.test(reason)) return "too old";
  if (/another country|other countries|chose on-site|citizenship/.test(reason)) return "location";
  if (reason === "above the level you want") return "above your level";
  if (/^deal-breaker/.test(reason)) return "deal-breakers";
  if (reason === "student or trainee post") return "student or trainee";
  if (reason === "incomplete") return "incomplete listing";
  return reason;
}
export function cutSummary(rejected: Record<string, number> | undefined, top = 4): { label: string; count: number }[] {
  const by = new Map<string, number>();
  for (const [r, n] of Object.entries(rejected ?? {})) { const g = cutGroup(r); by.set(g, (by.get(g) ?? 0) + Number(n || 0)); }
  return [...by.entries()].filter(([, n]) => n > 0).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, top);
}
export const cutText = (rejected: Record<string, number> | undefined, top = 4) => cutSummary(rejected, top).map((c) => `${c.count.toLocaleString("en-GB")} ${c.label}`).join(", ");

// Nothing to judge against: no roles, skills or shipped work.
export const profileEmpty = (p: Pick<NjProfile, "roles" | "skills" | "shipped">) => !p.roles.length && !p.skills.length && !p.shipped.length;

// The profile a run judges against. The member's own roles win; with none, the roles (and skills and shipped work, where the member left
// those empty) from their CV review; with neither, no roles, which means no title gate.
export function effectiveProfile(p: NjProfile, cv: Pick<CvReview, "profile"> | null | undefined): { profile: NjProfile; from: ProfileFrom } {
  if (p.roles.length) return { profile: p, from: "yours" };
  const c = cv?.profile;
  if (c?.roles?.length) return { profile: { ...p, roles: c.roles, skills: p.skills.length ? p.skills : c.skills ?? [], shipped: p.shipped.length ? p.shipped : c.shipped ?? [] }, from: "cv" };
  return { profile: p, from: "empty" };
}

// What the browser shows when an API call fails. The server's own words when it sent them; a platform timeout (an HTML or plain-text
// 504 with no JSON) becomes "your AI took too long", never a bare "Something went wrong".
export function apiErrorText(status: number, body: string): string {
  let msg = "";
  try { const j = JSON.parse(body); msg = typeof j?.error === "string" ? j.error : typeof j?.message === "string" ? j.message : ""; } catch { /* not JSON */ }
  if (msg.trim()) return msg.trim();
  if (status === 504 || status === 408 || /FUNCTION_INVOCATION_TIMEOUT|timed? ?out/i.test(body)) return "Your AI took too long to answer, so we stopped waiting. Nothing was lost: please try again in a moment.";
  if (status === 429) return "That's a lot of tries in a short time. Please wait a little and try again.";
  if (status === 401) return "Sign in again to continue.";
  if (status === 413) return "That's too much to send in one go. Please send a shorter version.";
  return `That didn't work on our side (error ${status || "no answer"}). Please try again in a moment.`;
}

// The CV review the member's AI writes (screen 2b): honest, short, and a profile to start from.
export type CvReview = {
  strengths: string[]; gaps: string[]; fixes: string[]; roles: string[];
  profile: Pick<NjProfile, "roles" | "shipped" | "skills" | "cities" | "country" | "remote" | "seniority">;
  provider: AiProvider; at: string;
};
export const CV_MAX_CHARS = 30_000;
export const CV_MIN_CHARS = 200;
