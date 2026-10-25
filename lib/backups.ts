// Admin → Backups (v0.93.0): point-in-time recovery, scheduled backups and restores for the Firestore database, run from the
// owner's own Google sign-in (lib/backups-client.ts calls Google's Firestore Admin API from the browser). The site's server key
// never gets these powers, so a leaked key can't switch recovery off or delete backups. Pure: names, rules and request shapes.

export const ADMIN_API = "https://firestore.googleapis.com/v1";
export const OAUTH_SCOPE = "https://www.googleapis.com/auth/datastore";
export const LIVE_DB = "(default)";

// Google's limits: one daily and one weekly schedule per database, each kept up to 14 weeks.
export const MAX_RETENTION_DAYS = 98;
export const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const isWeekday = (d: unknown): d is Weekday => typeof d === "string" && (WEEKDAYS as readonly string[]).includes(d);

export type Database = {
  name: string; locationId?: string; createTime?: string;
  pointInTimeRecoveryEnablement?: "POINT_IN_TIME_RECOVERY_ENABLED" | "POINT_IN_TIME_RECOVERY_DISABLED" | "POINT_IN_TIME_RECOVERY_ENABLEMENT_UNSPECIFIED";
  deleteProtectionState?: "DELETE_PROTECTION_ENABLED" | "DELETE_PROTECTION_DISABLED" | "DELETE_PROTECTION_STATE_UNSPECIFIED";
  earliestVersionTime?: string; versionRetentionPeriod?: string;
  sourceInfo?: { backup?: { backup?: string }; operation?: string };
};
export type Schedule = { name: string; retention?: string; dailyRecurrence?: object; weeklyRecurrence?: { day?: Weekday }; createTime?: string };
export type Backup = { name: string; database?: string; snapshotTime?: string; expireTime?: string; state?: "CREATING" | "READY" | "NOT_AVAILABLE" | "STATE_UNSPECIFIED"; stats?: { sizeBytes?: string; documentCount?: string } };
export type Operation = { name: string; done?: boolean; error?: { message?: string }; metadata?: { progressPercentage?: number; progressBytes?: { completedWork?: string; estimatedWork?: string } } };

export const pitrOn = (d?: Database | null) => d?.pointInTimeRecoveryEnablement === "POINT_IN_TIME_RECOVERY_ENABLED";
export const protectionOn = (d?: Database | null) => d?.deleteProtectionState === "DELETE_PROTECTION_ENABLED";
export const dbIdOf = (name: string) => name.split("/databases/")[1] ?? name;

// Google's rule for a database id: 4 to 63 characters, lower-case letters, digits and hyphens, starting with a letter and not
// ending with a hyphen. A restore always makes a new database (it never writes over the live one).
export const validDbId = (id: unknown): id is string => typeof id === "string" && /^[a-z][a-z0-9-]{2,61}[a-z0-9]$/.test(id) && id !== LIVE_DB;
// restore-20261024-2315 (Lagos time), or clone- for a point-in-time copy.
export function newDbId(kind: "restore" | "clone", now = new Date()): string {
  const lagos = new Date(now.getTime() + 60 * 60_000).toISOString(); // WAT is UTC+1 all year
  return `${kind}-${lagos.slice(0, 10).replace(/-/g, "")}-${lagos.slice(11, 16).replace(":", "")}`;
}

// "7d" → "604800s", as Google's API wants it; null when out of range.
export function retentionSeconds(days: number): string | null {
  return Number.isInteger(days) && days >= 1 && days <= MAX_RETENTION_DAYS ? `${days * 86_400}s` : null;
}
export const retentionDays = (s?: string) => (s ? Math.round(parseFloat(s) / 86_400) : 0);

export function describeSchedule(s: Schedule): string {
  const keep = retentionDays(s.retention);
  const kept = keep % 7 === 0 && keep >= 14 ? `${keep / 7} weeks` : `${keep} day${keep === 1 ? "" : "s"}`;
  if (s.weeklyRecurrence) return `Every ${(s.weeklyRecurrence.day ?? "").charAt(0)}${(s.weeklyRecurrence.day ?? "").slice(1).toLowerCase()}, kept ${kept}`;
  return `Every day, kept ${kept}`;
}

export function fmtBytes(raw?: string | number): string {
  const n = Number(raw ?? 0);
  if (!n) return "–";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log10(n) / 3));
  return `${(n / 1000 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

// A point-in-time copy needs a whole minute inside the last 7 days (from the database's earliestVersionTime) and not in the future.
export function pitrMinute(input: string, earliest?: string, now = new Date()): string | null {
  const t = new Date(input);
  if (Number.isNaN(t.getTime())) return null;
  t.setUTCSeconds(0, 0);
  if (t > now || (earliest && t < new Date(earliest))) return null;
  return t.toISOString();
}

// Request shapes for Google's Firestore Admin API (paths under ADMIN_API).
export const req = {
  database: (p: string) => ({ path: `projects/${p}/databases/${LIVE_DB}` }),
  databases: (p: string) => ({ path: `projects/${p}/databases` }),
  setPitr: (p: string) => ({ path: `projects/${p}/databases/${LIVE_DB}?updateMask=pointInTimeRecoveryEnablement`, method: "PATCH", body: { pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" } }),
  setProtection: (p: string) => ({ path: `projects/${p}/databases/${LIVE_DB}?updateMask=deleteProtectionState`, method: "PATCH", body: { deleteProtectionState: "DELETE_PROTECTION_ENABLED" } }),
  schedules: (p: string) => ({ path: `projects/${p}/databases/${LIVE_DB}/backupSchedules` }),
  createSchedule: (p: string, s: { weekly?: Weekday; days: number }) => {
    const retention = retentionSeconds(s.days);
    if (!retention) throw new Error(`Keep backups 1 to ${MAX_RETENTION_DAYS} days.`);
    return { path: `projects/${p}/databases/${LIVE_DB}/backupSchedules`, method: "POST", body: s.weekly ? { retention, weeklyRecurrence: { day: s.weekly } } : { retention, dailyRecurrence: {} } };
  },
  deleteSchedule: (name: string) => ({ path: name, method: "DELETE" }),
  backups: (p: string) => ({ path: `projects/${p}/locations/-/backups` }),
  restore: (p: string, backup: string, databaseId: string) => ({ path: `projects/${p}/databases:restore`, method: "POST", body: { databaseId, backup } }),
  clone: (p: string, snapshotTime: string, databaseId: string) => ({ path: `projects/${p}/databases:clone`, method: "POST", body: { databaseId, pitrSnapshot: { database: `projects/${p}/databases/${LIVE_DB}`, snapshotTime } } }),
  operation: (name: string) => ({ path: name }),
};

// What Google's 403 means here, in plain words.
export const NO_RIGHTS = "Your Google account can't do this on the project. Sign in with the project's owner, or give your account the Cloud Datastore Owner role.";

// The server's record of who did what on this page (backupLog).
export const LOG_ACTIONS = ["pitr_on", "protection_on", "schedule_create", "schedule_delete", "restore", "clone"] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];
export const isLogAction = (a: unknown): a is LogAction => typeof a === "string" && (LOG_ACTIONS as readonly string[]).includes(a);
export type LogEntry = { id: string; at: string; byName: string; action: LogAction; detail: string };
