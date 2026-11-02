// Size and count limits that depend on the member's plan. The numbers below are the defaults; admins change them per plan in
// /admin/limits and the change applies sitewide (lib/limits-server.ts reads the saved values). To add another limit, add a row here
// and read it with limitFor() where it is enforced: it then shows up on the admin page by itself.
import type { AccountTier } from "./users";
import { MOMENT_DAILY_LIMIT, MOMENT_VIDEO_WEEKLY_LIMIT } from "./moments-rules";

export const LIMIT_TIERS: AccountTier[] = ["standard", "basic", "pro", "business", "enterprise"];
export const LIMIT_TIER_LABEL: Record<AccountTier, string> = { standard: "Free Standard", basic: "Basic", pro: "Pro", business: "Business", enterprise: "Enterprise" };

export type LimitKey = "messageAttachmentMB" | "messageAttachmentsPerMessage" | "messageVoiceNoteSeconds" | "momentVideosPerWeek" | "momentsPerDay" | "nanaOperator" | "nanaJobsPerDay" | "agentConnect";
// kind "flag": a plan feature switched on (1) or off (0); the admin page shows a tick box.
export type LimitDef = { key: LimitKey; group: string; label: string; unit: string; min: number; max: number; defaults: Record<AccountTier, number>; kind?: "flag" };

const flat = (n: number): Record<AccountTier, number> => ({ standard: n, basic: n, pro: n, business: n, enterprise: n });

export const LIMITS: LimitDef[] = [
  { key: "messageAttachmentMB", group: "Messages", label: "Largest file in a message", unit: "MB", min: 1, max: 500, defaults: { standard: 5, basic: 10, pro: 25, business: 50, enterprise: 100 } },
  { key: "messageAttachmentsPerMessage", group: "Messages", label: "Files in one message", unit: "files", min: 1, max: 20, defaults: { standard: 1, basic: 3, pro: 5, business: 8, enterprise: 10 } },
  { key: "messageVoiceNoteSeconds", group: "Messages", label: "Longest voice note", unit: "seconds", min: 10, max: 900, defaults: flat(300) },
  { key: "momentVideosPerWeek", group: "Moments", label: "Video moments a week (each part of a long video counts)", unit: "videos", min: 0, max: 500, defaults: MOMENT_VIDEO_WEEKLY_LIMIT },
  { key: "momentsPerDay", group: "Moments", label: "New moments a day", unit: "moments", min: 1, max: 200, defaults: flat(MOMENT_DAILY_LIMIT) },
  // Nana as an operator (owner, 2 Nov 2026: Business and Enterprise only; lower plans see a friendly upsell). Connected agents' requests
  // reach Nana's inbox on every plan that may connect one.
  { key: "nanaOperator", group: "Nana and connected agents", label: "Nana operator: jobs, drafts and Nana's inbox", unit: "on/off", min: 0, max: 1, kind: "flag", defaults: { standard: 0, basic: 0, pro: 0, business: 1, enterprise: 1 } },
  { key: "nanaJobsPerDay", group: "Nana and connected agents", label: "Nana's job runs a day per member (each draft or summary counts)", unit: "runs", min: 0, max: 1000, defaults: { standard: 0, basic: 0, pro: 0, business: 60, enterprise: 200 } },
  { key: "agentConnect", group: "Nana and connected agents", label: "Connect outside AI assistants (Connect NotesApp)", unit: "on/off", min: 0, max: 1, kind: "flag", defaults: { standard: 1, basic: 1, pro: 1, business: 1, enterprise: 1 } },
];
export const planHas = (key: LimitKey, tier: AccountTier, overrides: LimitOverrides = {}) => limitFor(key, tier, overrides) > 0;

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
