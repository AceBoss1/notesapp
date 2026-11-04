// Staff test pass (owner, 3 Nov 2026: "exempt staff/team accounts from live limits with a toggle available to super admins so we can
// properly test it before challenge time"). Pure and client-safe; the server side is lib/staff-pass-server.ts.
//
// A super admin switches it on from Admin → Limits, always with an end ("on until", 7 days by default, at most 30), so it can't be left
// on by mistake. While it is on, a #NotesApp team account (lib/users.ts isTeamMember: role admin, staff or volunteer, not suspended)
// skips the live limits that are about plans and budgets:
//   - the listener cap when they join a room, and for every room they host (up to the hard ceiling below, never past it);
//   - the video-minutes budget in rooms they host (lib/rooms-live.ts);
//   - the longest recording (Admin → Limits → Live recording), up to that setting's own top value;
//   - the plan switches for recording a live and publishing a replay (lib/limits.ts liveRecording, replayPublish).
// It never skips safety: teen rules, bans and suspensions, recording notices and consent, moderation, the stage size, rate limits,
// the relay's ceiling and how long recordings are kept. The numbers in Admin → Limits stay as they are; the pass only steps around them.
//
// Stored in serverConfig/staffPass (server-only); every change is written to staffPassLog (server-only, never edited), like pricingLog.

import { ROOM_LISTENERS_CEILING, ROOM_SETTINGS, type RoomMode, type RoomSettings } from "./rooms";
import { RECORDING_SETTINGS } from "./live-recording";

export type StaffPass = { on: boolean; until: string | null; byUid?: string; byEmail?: string; at?: string };
export const STAFF_PASS_OFF: StaffPass = { on: false, until: null };
export const STAFF_PASS_DEFAULT_DAYS = 7;
export const STAFF_PASS_MAX_DAYS = 30;
const DAY_MS = 86_400_000;

// On, with an end still ahead.
export const passActive = (p: StaffPass | null | undefined, now = Date.now()): boolean =>
  !!p && p.on === true && !!p.until && Date.parse(p.until) > now;
// Whether one account skips the live limits now: the pass is on and they are on the #NotesApp team.
export const passApplies = (p: StaffPass | null | undefined, team: boolean, now = Date.now()) => team && passActive(p, now);
// A room opened by a team member while the pass was on keeps its exemption only while the pass is still on.
export const roomPassActive = (r: { staffPass?: boolean } | null | undefined, p: StaffPass | null | undefined, now = Date.now()) =>
  r?.staffPass === true && passActive(p, now);

// The default end: STAFF_PASS_DEFAULT_DAYS from now.
export const defaultUntil = (now = Date.now()) => new Date(now + STAFF_PASS_DEFAULT_DAYS * DAY_MS).toISOString();

// What a super admin sent: { on, until? }. Turning it on needs an end in the future, at most STAFF_PASS_MAX_DAYS away (none given:
// the default). Turning it off clears the end. Returns the pass to save, or an error to show.
export function cleanPassInput(input: unknown, now = Date.now()): { ok: true; pass: Pick<StaffPass, "on" | "until"> } | { ok: false; error: string } {
  const o = (input && typeof input === "object" ? input : {}) as { on?: unknown; until?: unknown };
  if (o.on !== true) return { ok: true, pass: { on: false, until: null } };
  const raw = o.until === undefined || o.until === null || o.until === "" ? defaultUntil(now) : String(o.until);
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return { ok: false, error: "Choose the date and time it turns off." };
  if (t <= now) return { ok: false, error: "The end must be in the future." };
  if (t > now + STAFF_PASS_MAX_DAYS * DAY_MS) return { ok: false, error: `The pass can be on for at most ${STAFF_PASS_MAX_DAYS} days.` };
  return { ok: true, pass: { on: true, until: new Date(t).toISOString() } };
}

// ── What the pass changes ──
// The hard ceiling a room can never pass: on the relay, the most the listener setting may ever be raised to (ROOM_LISTENERS_CEILING);
// phone to phone, the top of that setting's range (the host's phone sends to each listener, so this is a technical limit).
const settingMax = (key: string) => ROOM_SETTINGS.find((s) => s.key === key)!.max;
export const staffListenerCap = (mode: RoomMode | undefined): number => (mode === "relay" ? ROOM_LISTENERS_CEILING : settingMax("p2pListeners"));
// Video minutes in a room on the pass: far more than any live runs (a week of camera time), so the budget never runs out, but the
// numbers stay finite for the host's screen.
export const STAFF_PASS_VIDEO_MINUTES = 7 * 24 * 60;
export const liveSettingsWithPass = (s: RoomSettings, on: boolean): RoomSettings => (on ? { ...s, videoBudgetMinutes: STAFF_PASS_VIDEO_MINUTES } : s);
// The longest recording on the pass: the top of the "Longest recording" setting's range (the recorder's own limit).
export const STAFF_PASS_RECORDING_HOURS = RECORDING_SETTINGS.find((s) => s.key === "maxHours")!.max;
export const recordingHoursWithPass = (maxHours: number, on: boolean) => (on ? Math.max(maxHours, STAFF_PASS_RECORDING_HOURS) : maxHours);

// ── What staff see ──
export const passUntilText = (until: string) =>
  new Date(until).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) + " (Lagos)";
export const passNotice = (p: StaffPass, now = Date.now()) => (passActive(p, now) && p.until ? `Staff test pass is on until ${passUntilText(p.until)}` : "");
// One line for the log: "on until 10 Nov 2026, 18:00 (Lagos)" or "off".
export const describePass = (p: Pick<StaffPass, "on" | "until">) => (p.on && p.until ? `on until ${passUntilText(p.until)}` : "off");
