// Size and count limits that depend on the member's plan. The numbers below are the defaults; admins change them per plan in
// /admin/limits and the change applies sitewide (lib/limits-server.ts reads the saved values). To add another limit, add a row here
// and read it with limitFor() where it is enforced: it then shows up on the admin page by itself.
import type { AccountTier } from "./users";
import { MOMENT_DAILY_LIMIT, MOMENT_VIDEO_WEEKLY_LIMIT } from "./moments-rules";
import { getTierConfig, type TierConfig } from "./tiers";

export const LIMIT_TIERS: AccountTier[] = ["standard", "basic", "pro", "business", "enterprise"];
export const LIMIT_TIER_LABEL: Record<AccountTier, string> = { standard: "Free Standard", basic: "Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };

export type LimitKey = "messageAttachmentMB" | "messageAttachmentsPerMessage" | "messageVoiceNoteSeconds" | "momentVideosPerWeek" | "momentsPerDay"
  | CourseFlag | "coursesPerMember" | "coursesPerOrganisation" | "courseStorageGB" | "courseVideoHours" | "nanaOperator" | "nanaJobsPerDay" | "agentConnect"
  | "liveRecording" | "replayPublish";
// kind "switch": a plan flag, 1 = on and 0 = off (a tick box in Admin → Limits). noLimitAt0: 0 means "no limit" rather than "none".
export type LimitDef = { key: LimitKey; group: string; label: string; unit: string; min: number; max: number; defaults: Record<AccountTier, number>; kind?: "switch"; noLimitAt0?: boolean };

const flat = (n: number): Record<AccountTier, number> => ({ standard: n, basic: n, pro: n, business: n, enterprise: n });
// A plan flag's defaults come from lib/tiers.ts, so the ladder there stays the one place they're decided.
export type CourseFlag = "freeCourses" | "paidCourses" | "courseVideoUploads";
const fromTiers = (k: keyof TierConfig & CourseFlag): Record<AccountTier, number> =>
  Object.fromEntries(LIMIT_TIERS.map((t) => [t, getTierConfig(t)[k] ? 1 : 0])) as Record<AccountTier, number>;
// Notes Academy's courses per account before these were settings (an organisation could have three times as many).
export const DEFAULT_COURSES_PER_MEMBER = 30;

export const LIMITS: LimitDef[] = [
  { key: "messageAttachmentMB", group: "Messages", label: "Largest file in a message", unit: "MB", min: 1, max: 500, defaults: { standard: 5, basic: 10, pro: 25, business: 50, enterprise: 100 } },
  { key: "messageAttachmentsPerMessage", group: "Messages", label: "Files in one message", unit: "files", min: 1, max: 20, defaults: { standard: 1, basic: 3, pro: 5, business: 8, enterprise: 10 } },
  { key: "messageVoiceNoteSeconds", group: "Messages", label: "Longest voice note", unit: "seconds", min: 10, max: 900, defaults: flat(300) },
  { key: "momentVideosPerWeek", group: "Moments", label: "Video moments a week (each part of a long video counts)", unit: "videos", min: 0, max: 500, defaults: MOMENT_VIDEO_WEEKLY_LIMIT },
  { key: "momentsPerDay", group: "Moments", label: "New moments a day", unit: "moments", min: 1, max: 200, defaults: flat(MOMENT_DAILY_LIMIT) },
  // Notes Academy (docs/COURSES.md). Turning a switch off stops new courses, prices, publishing and uploads on that plan; what's already
  // published stays up, except that a paid course goes off sale while its owner's plan can't sell courses.
  { key: "freeCourses", group: "Courses", label: "Free courses (create and publish)", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: fromTiers("freeCourses") },
  { key: "paidCourses", group: "Courses", label: "Paid courses (text lessons, PDFs and YouTube)", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: fromTiers("paidCourses") },
  { key: "courseVideoUploads", group: "Courses", label: "Uploaded video lessons on paid courses", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: fromTiers("courseVideoUploads") },
  { key: "coursesPerMember", group: "Courses", label: "Courses per member", unit: "courses", min: 1, max: 1_000, defaults: flat(DEFAULT_COURSES_PER_MEMBER) },
  { key: "coursesPerOrganisation", group: "Courses", label: "Courses per organisation", unit: "courses", min: 1, max: 3_000, defaults: flat(DEFAULT_COURSES_PER_MEMBER * 3) },
  { key: "courseStorageGB", group: "Courses", label: "Uploaded PDFs across all courses (0 = no limit)", unit: "GB", min: 0, max: 10_000, noLimitAt0: true, defaults: flat(0) },
  { key: "courseVideoHours", group: "Courses", label: "Uploaded video across all courses (0 = no limit)", unit: "hours", min: 0, max: 10_000, noLimitAt0: true, defaults: flat(0) },
  // Nana as an operator (owner, 2 Nov 2026: Business and Enterprise only; lower plans see a friendly upsell). Connected agents' requests
  // reach Nana's inbox on every plan that may connect one.
  { key: "nanaOperator", group: "Nana and connected agents", label: "Nana operator: jobs, drafts and Nana's inbox", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: { standard: 0, basic: 0, pro: 0, business: 1, enterprise: 1 } },
  { key: "nanaJobsPerDay", group: "Nana and connected agents", label: "Nana's job runs a day per member (each draft or summary counts)", unit: "runs", min: 0, max: 1000, defaults: { standard: 0, basic: 0, pro: 0, business: 60, enterprise: 200 } },
  { key: "agentConnect", group: "Nana and connected agents", label: "Connect outside AI assistants (Connect NotesApp)", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: { standard: 1, basic: 1, pro: 1, business: 1, enterprise: 1 } },
  // Live recording and replays (lib/live-recording.ts), by the host's plan. On for everyone who can host by default (hosts are a
  // community's admins and moderators, on any plan); Admin's "record every relay room" switch records whatever these say.
  { key: "liveRecording", group: "Audio rooms and live", label: "Host can switch recording on before going live", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: flat(1) },
  { key: "replayPublish", group: "Audio rooms and live", label: "Host can publish a recording as a replay", unit: "on/off", min: 0, max: 1, kind: "switch", defaults: flat(1) },
];

// Saved by an admin: only the numbers they changed from the defaults need to be here.
export type LimitOverrides = Partial<Record<LimitKey, Partial<Record<AccountTier, number>>>>;
export type LimitTable = Record<LimitKey, Record<AccountTier, number>>;

export const limitDef = (key: LimitKey) => LIMITS.find((l) => l.key === key)!;

export function limitFor(key: LimitKey, tier: AccountTier, overrides: LimitOverrides = {}): number {
  const v = overrides[key]?.[tier];
  return typeof v === "number" && Number.isFinite(v) ? v : limitDef(key).defaults[tier];
}

export function limitTable(overrides: LimitOverrides = {}): LimitTable {
  return Object.fromEntries(LIMITS.map((l) => [l.key, Object.fromEntries(LIMIT_TIERS.map((t) => [t, limitFor(l.key, t, overrides)]))])) as LimitTable;
}

// Cleans what an admin sent: whole numbers within each limit's range; anything else is dropped (so the default applies).
export function cleanOverrides(input: unknown): LimitOverrides {
  const out: LimitOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const l of LIMITS) {
    const row = (input as Record<string, unknown>)[l.key];
    if (!row || typeof row !== "object") continue;
    for (const t of LIMIT_TIERS) {
      const v = Number((row as Record<string, unknown>)[t]);
      if (Number.isInteger(v) && v >= l.min && v <= l.max && v !== l.defaults[t]) (out[l.key] ??= {})[t] = v;
    }
  }
  return out;
}

// A plan flag (kind "switch") as saved: on unless it's 0.
export const planHas = (key: LimitKey, tier: AccountTier, overrides: LimitOverrides = {}): boolean => limitFor(key, tier, overrides) > 0;

// The plans that have a flag, for copy: "Pro, Business and Enterprise". Only plans that can publish are named; "" when none has it.
export function plansWith(key: CourseFlag, overrides: LimitOverrides = {}): string {
  const names = LIMIT_TIERS.filter((t) => getTierConfig(t).canPublish && planHas(key, t, overrides)).map((t) => LIMIT_TIER_LABEL[t]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A limit read as "how many may be used": Infinity when 0 means no limit.
export const capOf = (key: LimitKey, tier: AccountTier, overrides: LimitOverrides = {}): number => {
  const v = limitFor(key, tier, overrides);
  return limitDef(key).noLimitAt0 && v === 0 ? Infinity : v;
};
