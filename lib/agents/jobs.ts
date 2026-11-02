import type { AgentSettings } from "./config";
import type { Voice } from "./voice";

// Nana's jobs (the operator, Business and Enterprise): what each one does, and the member's settings for them (nanaOps/{uid}, server-only).
// Nothing runs until the member switches Nana's jobs on in Nana's inbox; then the five below start as the approved mockup shows (all on,
// booking confirmations going without asking). Pure.
export type JobId = "bookingReplies" | "weeklySummary" | "customerQuestions" | "journalDrafts" | "shippingNudges";
export const JOBS: { id: JobId; label: string; detail: (s: AgentSettings, autoConfirm: boolean) => string }[] = [
  { id: "bookingReplies", label: "Booking replies", detail: (_s, auto) => (auto ? "Drafts, asks you · confirmations go" : "Drafts, asks you") },
  { id: "weeklySummary", label: "Weekly summary", detail: (s) => `${["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"][s.weeklySummaryWeekday]}, ${String(s.weeklySummaryHour).padStart(2, "0")}:00` },
  { id: "customerQuestions", label: "Customer questions", detail: () => "Drafts, asks you" },
  { id: "journalDrafts", label: "Journal drafts", detail: () => "From your notes · never publishes" },
  { id: "shippingNudges", label: "Shipping nudges", detail: (s) => `After ${s.shipNudgeDays} day${s.shipNudgeDays === 1 ? "" : "s"} unshipped` },
];
export const isJobId = (v: unknown): v is JobId => JOBS.some((j) => j.id === v);

export type NanaOps = {
  enabled: boolean; // the member switched Nana's jobs on
  paused: boolean; // Pause all jobs (Nana's inbox, or Console → Connected agents → Nana)
  jobs: Record<JobId, boolean>;
  autoConfirm: boolean; // booking confirmations go without asking (the mockup's default rule)
  voice?: Voice;
  lastWeekly?: string; // ISO week of the last summary sent
  jobsDay?: { day: string; count: number }; // job runs today, for the plan's daily limit
  updatedAt?: string;
};
export const DEFAULT_OPS: NanaOps = { enabled: false, paused: false, jobs: { bookingReplies: true, weeklySummary: true, customerQuestions: true, journalDrafts: true, shippingNudges: true }, autoConfirm: true };
export const opsOf = (raw: Partial<NanaOps> | undefined): NanaOps => ({ ...DEFAULT_OPS, ...(raw ?? {}), jobs: { ...DEFAULT_OPS.jobs, ...(raw?.jobs ?? {}) } });
// Is this job running for this member right now?
export const jobOn = (ops: NanaOps, job: JobId) => ops.enabled && !ops.paused && ops.jobs[job] === true;

// The member's changes from the inbox: only known switches, as true/false.
export function cleanOpsPatch(input: unknown): Partial<NanaOps> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Partial<NanaOps> = {};
  if (typeof i.enabled === "boolean") out.enabled = i.enabled;
  if (typeof i.paused === "boolean") out.paused = i.paused;
  if (typeof i.autoConfirm === "boolean") out.autoConfirm = i.autoConfirm;
  if (i.jobs && typeof i.jobs === "object") {
    const jobs: Partial<Record<JobId, boolean>> = {};
    for (const [k, v] of Object.entries(i.jobs as Record<string, unknown>)) if (isJobId(k) && typeof v === "boolean") jobs[k] = v;
    if (Object.keys(jobs).length) out.jobs = jobs as Record<JobId, boolean>;
  }
  return out;
}
