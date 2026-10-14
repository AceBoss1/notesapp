// Rules shared by the follow lists and the online status, in one place so the server, the screens and the tests agree.

// @na-notesapp has no login, so the follows made in its name are recorded under this stand-in id (follows/na-notesapp_<username>).
export const NA_UID = "na-notesapp";

// Heartbeat: the app writes "I'm here" about every 3 minutes while a tab is open and visible. Someone counts as online for 7 minutes after their last one.
export const BEAT_MS = 180_000;
export const ONLINE_WINDOW_MS = 7 * 60_000;
export const PAGE_SIZE = 30;
export const MAX_STATUS_LOOKUPS = 25;

// What a member chooses. Both default to on; absent in the profile means on.
export type Visibility = { showOnline: boolean; showLists: boolean };
export const visibilityOf = (u: { showOnline?: unknown; showLists?: unknown } | null | undefined): Visibility => ({
  showOnline: u?.showOnline !== false,
  showLists: u?.showLists !== false,
});

export type ListDecision = { ok: true } | { ok: false; reason: "viewer-off" | "target-off" };

// Followers and following lists: you see someone's lists only if they have theirs public, and only if you have yours public too. Your own are always yours to see.
export function canViewList(opts: { self: boolean; viewerShowLists: boolean; targetShowLists: boolean }): ListDecision {
  if (opts.self) return { ok: true };
  if (!opts.viewerShowLists) return { ok: false, reason: "viewer-off" };
  if (!opts.targetShowLists) return { ok: false, reason: "target-off" };
  return { ok: true };
}

// Online and last seen: only between two people who follow each other, and only while both have their online visibility on.
export function canSeeOnline(opts: { viewerShowOnline: boolean; targetShowOnline: boolean; mutual: boolean }): boolean {
  return opts.viewerShowOnline && opts.targetShowOnline && opts.mutual;
}

export const isOnline = (lastSeenMs: number, nowMs = Date.now()) => nowMs - lastSeenMs <= ONLINE_WINDOW_MS;

export type PresenceStatus = { online: boolean; lastSeen: string | null };

// "Online", "Last seen 2:05 PM", "Last seen yesterday, 2:05 PM", "Last seen 12 Oct, 2:05 PM".
export function lastSeenLabel(s: PresenceStatus | undefined, now = new Date()): string {
  if (!s) return "";
  if (s.online) return "Online";
  if (!s.lastSeen) return "Last seen: not recorded yet"; // they haven't opened #NotesApp since last seen was switched on
  const d = new Date(s.lastSeen);
  const time = d.toLocaleTimeString("en-NG", { hour: "numeric", hour12: true, minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Last seen ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Last seen yesterday, ${time}`;
  return `Last seen ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) })}, ${time}`;
}

export type ListedPerson = { username: string; displayName: string; avatar: string; isOrg: boolean; channel: boolean };
export type FollowPage = { people: ListedPerson[]; next: string | null; total: number | null; official?: string[] };
