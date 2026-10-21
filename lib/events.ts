// Events (docs/COMMUNITY.md, phase 1): for every account, and for communities. Pure: cleaning, repeats, the Join live link, the calendar
// file and when reminders are due. The server side is lib/events-server.ts.
//
// events/{id}: { hostUid, hostName, hostUsername, cid?, communityName?, title, description, startsAt, endsAt, place, state, city, liveUrl,
// repeat, repeatUntil?, visibility, going, interested, cancelled?, createdAt }. RSVPs are eventRsvps/{eventId}_{uid} { status }.
// Times are wall-clock Lagos (WAT), stored as ISO instants. Members-only events belong to a community and only its members see them.
import { NIGERIAN_STATES } from "./merch";

export const REPEATS = [
  { id: "none", label: "Doesn't repeat" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
] as const;
export type Repeat = (typeof REPEATS)[number]["id"];
export type EventDoc = {
  id?: string; hostUid: string; hostName: string; hostUsername: string; cid?: string; communityName?: string;
  title: string; description: string; startsAt: string; endsAt: string; place: string; state: string; city: string; liveUrl: string;
  repeat: Repeat; repeatUntil?: string; visibility: "public" | "members"; going: number; interested: number; cancelled?: boolean; createdAt: string;
};
export type Rsvp = "going" | "interested";

const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const HOUR = 3_600_000, DAY = 24 * HOUR;

// The services a Join live link can go to, by name (anything else https is "Join live").
const LIVE_HOSTS: [RegExp, string][] = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube Live"], [/(^|\.)facebook\.com$|(^|\.)fb\.watch$/, "Facebook Live"],
  [/(^|\.)zoom\.us$/, "Zoom"], [/(^|\.)meet\.google\.com$/, "Google Meet"], [/(^|\.)teams\.microsoft\.com$|(^|\.)teams\.live\.com$/, "Microsoft Teams"],
  [/(^|\.)instagram\.com$/, "Instagram Live"], [/(^|\.)tiktok\.com$/, "TikTok Live"], [/(^|\.)x\.com$|(^|\.)twitter\.com$/, "X"],
];
export function liveHost(url: string): string {
  try { const h = new URL(url).hostname.toLowerCase(); return LIVE_HOSTS.find(([re]) => re.test(h))?.[1] ?? "Join live"; } catch { return ""; }
}

export type EventInput = { title?: unknown; description?: unknown; startsAt?: unknown; endsAt?: unknown; place?: unknown; state?: unknown; city?: unknown; liveUrl?: unknown; repeat?: unknown; repeatUntil?: unknown; visibility?: unknown };
// What a host sends, made safe. Errors are words for the host.
export function cleanEvent(v: EventInput, now: Date, opts: { community: boolean }): { ok: true; event: Omit<EventDoc, "hostUid" | "hostName" | "hostUsername" | "going" | "interested" | "createdAt"> } | { ok: false; error: string } {
  const title = t(v.title, 120);
  if (title.length < 3) return { ok: false, error: "Give the event a name." };
  const start = new Date(String(v.startsAt ?? ""));
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Choose when it starts." };
  if (start.getTime() < now.getTime() - HOUR) return { ok: false, error: "That start time has passed." };
  if (start.getTime() > now.getTime() + 400 * DAY) return { ok: false, error: "Events can be up to a year ahead." };
  let end = new Date(String(v.endsAt ?? ""));
  if (Number.isNaN(end.getTime())) end = new Date(start.getTime() + 2 * HOUR);
  if (end <= start) return { ok: false, error: "It has to end after it starts." };
  if (end.getTime() - start.getTime() > 14 * DAY) return { ok: false, error: "An event can last up to 14 days." };
  const liveRaw = t(v.liveUrl, 500);
  const liveUrl = /^https:\/\/[^\s"'<>]+$/i.test(liveRaw) ? liveRaw : "";
  if (liveRaw && !liveUrl) return { ok: false, error: "The Join live link has to start with https://." };
  const place = t(v.place, 200);
  if (!place && !liveUrl) return { ok: false, error: "Say where it is, or add a Join live link (or both)." };
  const state = NIGERIAN_STATES.includes(String(v.state) as (typeof NIGERIAN_STATES)[number]) ? String(v.state) : "";
  const repeat: Repeat = REPEATS.some((r) => r.id === v.repeat) ? (v.repeat as Repeat) : "none";
  const until = new Date(String(v.repeatUntil ?? ""));
  return {
    ok: true,
    event: {
      title, description: para(v.description, 4000), startsAt: start.toISOString(), endsAt: end.toISOString(), place, state, city: t(v.city, 60), liveUrl,
      repeat, ...(repeat !== "none" && !Number.isNaN(until.getTime()) && until > start ? { repeatUntil: until.toISOString() } : {}),
      visibility: opts.community && v.visibility === "members" ? "members" : "public",
    },
  };
}

// ---- Repeats ----
function addMonths(d: Date, n: number): Date {
  // the same day of the month in Lagos time, or the month's last day when it's shorter
  const x = new Date(d.getTime() + HOUR); // to Lagos wall-clock (UTC+1), then work in UTC fields
  const day = x.getUTCDate();
  const y = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1, x.getUTCHours(), x.getUTCMinutes()));
  const last = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth() + 1, 0)).getUTCDate();
  y.setUTCDate(Math.min(day, last));
  return new Date(y.getTime() - HOUR);
}
// The next `count` starts on or after `from` (the first one included while it hasn't ended).
export function occurrences(e: Pick<EventDoc, "startsAt" | "endsAt" | "repeat" | "repeatUntil">, from: Date, count = 5): { start: Date; end: Date }[] {
  const s0 = new Date(e.startsAt), len = new Date(e.endsAt).getTime() - s0.getTime();
  const until = e.repeatUntil ? new Date(e.repeatUntil).getTime() : Infinity;
  const out: { start: Date; end: Date }[] = [];
  for (let i = 0; out.length < count && i < 600; i++) {
    const start = e.repeat === "weekly" ? new Date(s0.getTime() + i * 7 * DAY) : e.repeat === "monthly" ? addMonths(s0, i) : i === 0 ? s0 : null;
    if (!start || start.getTime() > until) break;
    if (start.getTime() + len > from.getTime()) out.push({ start, end: new Date(start.getTime() + len) });
    if (e.repeat === "none") break;
  }
  return out;
}
export const nextOccurrence = (e: Pick<EventDoc, "startsAt" | "endsAt" | "repeat" | "repeatUntil" | "cancelled">, now: Date) => (e.cancelled ? null : occurrences(e, now, 1)[0] ?? null);
export const isLive = (e: Pick<EventDoc, "startsAt" | "endsAt" | "repeat" | "repeatUntil" | "cancelled">, now: Date) => { const o = nextOccurrence(e, now); return !!o && o.start <= now && o.end > now; };

// ---- Reminders: 24 hours and 1 hour before each start (the cron runs every ~15 minutes; each is sent once, keyed by the start) ----
export type ReminderKind = "day" | "hour";
export function reminderDue(start: Date, now: Date): ReminderKind | null {
  const left = start.getTime() - now.getTime();
  if (left <= 0) return null;
  if (left <= HOUR) return "hour";
  if (left <= DAY && left > HOUR) return "day";
  return null;
}

// ---- When, in words (Lagos time) ----
export function whenText(start: Date, end: Date): string {
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", ...o });
  const sameDay = f(start, { dateStyle: "short" }) === f(end, { dateStyle: "short" });
  return `${f(start, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${f(start, { hour: "numeric", minute: "2-digit" })} – ${sameDay ? "" : `${f(end, { day: "numeric", month: "short" })}, `}${f(end, { hour: "numeric", minute: "2-digit" })} (Lagos time)`;
}

// ---- The calendar file (.ics) ----
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
// Long lines are folded at 75 characters, as the format asks.
const fold = (line: string) => line.match(/.{1,74}/g)!.join("\r\n ");
export function toIcs(e: EventDoc & { id: string }, url: string, now = new Date()): string {
  const rule = e.repeat === "weekly" ? "FREQ=WEEKLY" : e.repeat === "monthly" ? "FREQ=MONTHLY" : "";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NotesApp//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.id}@notesapp.name.ng`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(new Date(e.startsAt))}`, `DTEND:${icsDate(new Date(e.endsAt))}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText([e.description, e.liveUrl ? `Join live: ${e.liveUrl}` : "", url].filter(Boolean).join("\n\n"))}`,
    ...(e.place ? [`LOCATION:${icsText([e.place, e.city, e.state].filter(Boolean).join(", "))}`] : []),
    `URL:${url}`,
    ...(rule ? [`RRULE:${rule}${e.repeatUntil ? `;UNTIL=${icsDate(new Date(e.repeatUntil))}` : ""}`] : []),
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
