// The numbers behind Nana's jobs and connected agents (owner's decisions, 2 Nov 2026), in one place. Admins change them in
// Admin → Limits ("Nana and connected agents"); the saved values live in serverConfig/agents (lib/agents/config-server.ts). Which plans
// get the Nana operator is a plan flag beside the other plan limits (lib/limits.ts: nanaOperator, agentConnect, nanaJobsPerDay).
// Pure and client-safe: the Connect screen and Console read the same defaults.

export type AgentSettingKey =
  | "accessDays" | "actionsPerDay" | "discountCapNaira" | "undoReplyMinutes" | "undoAutoHours" | "draftHours" | "logDays"
  | "linkCodeMinutes" | "shipNudgeDays" | "weeklySummaryWeekday" | "weeklySummaryHour" | "eventsPerRun";
export type AgentSettingDef = { key: AgentSettingKey; label: string; unit: string; min: number; max: number; def: number };

export const AGENT_SETTINGS: AgentSettingDef[] = [
  { key: "accessDays", label: "Connect: access lasts (the default; members may choose another)", unit: "days", min: 1, max: 365, def: 90 },
  { key: "actionsPerDay", label: "Connect: actions a day per agent (default; resets at midnight Lagos)", unit: "actions", min: 1, max: 10_000, def: 100 },
  { key: "discountCapNaira", label: "Connect: biggest discount an agent may offer (default)", unit: "naira", min: 0, max: 1_000_000, def: 2_000 },
  { key: "undoReplyMinutes", label: "Undo a sent reply for", unit: "minutes", min: 1, max: 60, def: 2 },
  { key: "undoAutoHours", label: "Undo Nana's automatic actions for", unit: "hours", min: 1, max: 168, def: 24 },
  { key: "draftHours", label: "Drafts and requests waiting for the member expire after", unit: "hours", min: 1, max: 336, def: 48 },
  { key: "logDays", label: "Keep the activity log for", unit: "days", min: 30, max: 730, def: 365 },
  { key: "linkCodeMinutes", label: "Pairing codes and connect links last", unit: "minutes", min: 2, max: 60, def: 10 },
  { key: "shipNudgeDays", label: "Shipping nudge after an order is unshipped for", unit: "days", min: 1, max: 30, def: 3 },
  { key: "weeklySummaryWeekday", label: "Weekly summary day (0 Sunday, 1 Monday … 6 Saturday)", unit: "day", min: 0, max: 6, def: 1 },
  { key: "weeklySummaryHour", label: "Weekly summary hour (Lagos time)", unit: "hour", min: 0, max: 23, def: 7 },
  { key: "eventsPerRun", label: "Events Nana handles per scheduled run (all members)", unit: "events", min: 1, max: 500, def: 60 },
];

export type AgentSettings = Record<AgentSettingKey, number>;
export type AgentOverrides = Partial<AgentSettings>;
export const AGENT_DEFAULTS = Object.fromEntries(AGENT_SETTINGS.map((s) => [s.key, s.def])) as AgentSettings;

// Fixed by the owner, not settings: agents never move money (refunds, payouts, withdrawals, Boost, purchases), so they spend ₦0;
// publishing and price changes always ask first.
export const AGENT_SPEND_KOBO = 0;

export function agentSettings(overrides: AgentOverrides = {}): AgentSettings {
  const out = { ...AGENT_DEFAULTS };
  for (const s of AGENT_SETTINGS) {
    const v = overrides[s.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) out[s.key] = v;
  }
  return out;
}

// What an admin sent: whole numbers within each range that differ from the default; anything else is dropped.
export function cleanAgentOverrides(input: unknown): AgentOverrides {
  const out: AgentOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const s of AGENT_SETTINGS) {
    const v = Number((input as Record<string, unknown>)[s.key]);
    if (Number.isInteger(v) && v >= s.min && v <= s.max && v !== s.def) out[s.key] = v;
  }
  return out;
}

// The choices the Connect screen and Edit permissions offer. The admin's default is always among them.
const withDefault = (list: number[], d: number, max = Infinity) => [...new Set([...list.filter((n) => n <= max), d])].sort((a, b) => a - b);
export const accessDayChoices = (s: AgentSettings) => withDefault([7, 30, 90, 180, 365], s.accessDays);
export const actionChoices = (s: AgentSettings) => withDefault([25, 50, 100, 250, 500, 1000], s.actionsPerDay);
export const discountChoices = (s: AgentSettings) => withDefault([0, 500, 1000, 2000, 5000, 10000], s.discountCapNaira);
