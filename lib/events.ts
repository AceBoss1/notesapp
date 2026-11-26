// Events (docs/COMMUNITY.md, phase 1): for every account, and for communities. Pure: cleaning, repeats, the Join live link, the calendar
// file and when reminders are due. The server side is lib/events-server.ts.
//
// events/{id}: { hostUid, hostName, hostUsername, cid?, communityName?, title, description, startsAt, endsAt, place, state, city, liveUrl,
// repeat, repeatUntil?, visibility, going, interested, cancelled?, createdAt }. RSVPs are eventRsvps/{eventId}_{uid} { status }.
// Times are wall-clock Lagos (WAT), stored as ISO instants. Members-only events belong to a community and only its members see them.
import { NIGERIAN_STATES } from "./merch";
import { cleanTheme, cleanWhere, isCategory, type EventCategory, type EventPattern, type EventThemeId, type Format, type OnlineVia } from "./event-kit";

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
  // Discover and the event kit (docs/EVENTS_DISCOVER.md, v0.210.0). All optional: events made before have none.
  category?: EventCategory; cover?: string; theme?: EventThemeId; pattern?: EventPattern;
  format?: Format; online?: OnlineVia | ""; // where: in person, online or both; online on #NotesApp (the host's live) or the host's link (liveUrl)
  approval?: boolean; // free events only: people ask to join and the host accepts
  capacity?: number; // the most people Going (0 or missing: no limit)
  requested?: number; // people waiting for the host to accept
  priceFromKobo?: number; // the cheapest ticket, kept by lib/tickets-server.ts, for cards
};
export type Rsvp = "going" | "interested" | "requested"; // requested: asked to join an event that needs the host's approval

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

export type EventInput = {
  title?: unknown; description?: unknown; startsAt?: unknown; endsAt?: unknown; place?: unknown; state?: unknown; city?: unknown; liveUrl?: unknown; repeat?: unknown; repeatUntil?: unknown; visibility?: unknown;
  category?: unknown; cover?: unknown; theme?: unknown; pattern?: unknown; format?: unknown; online?: unknown; approval?: unknown; capacity?: unknown;
};
export const CAPACITY_MAX = 100_000;
// A cover is one of our own uploaded pictures (lib/upload.ts uploadMarked, purpose "event").
export const isCoverUrl = (v: unknown): v is string => typeof v === "string" && /^https:\/\/[a-z0-9.-]+\/events\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(v) && v.length < 400;
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
  // Where: in person, online or both. Events made before formats had a place and/or a Join live link; read those as they were.
  const liveRaw = t(v.liveUrl, 500);
  const hasPlace = !!t(v.place, 200);
  const format = v.format ?? (hasPlace && liveRaw ? "hybrid" : liveRaw ? "online" : "in_person");
  const w = cleanWhere({ format, place: v.place, state: v.state, city: v.city, online: v.online ?? (liveRaw ? "link" : "notesapp"), link: liveRaw }, NIGERIAN_STATES);
  if (!w.ok) return { ok: false, error: w.error.replace("The online link", "The Join live link") };
  const { place, state, city, link: liveUrl } = w.where;
  const capacity = Math.max(0, Math.min(CAPACITY_MAX, Math.floor(Number(v.capacity) || 0)));
  if (v.cover && !isCoverUrl(v.cover)) return { ok: false, error: "Upload the cover picture again." };
  const repeat: Repeat = REPEATS.some((r) => r.id === v.repeat) ? (v.repeat as Repeat) : "none";
  const until = new Date(String(v.repeatUntil ?? ""));
  return {
    ok: true,
    event: {
      title, description: para(v.description, 4000), startsAt: start.toISOString(), endsAt: end.toISOString(), place, state, city, liveUrl,
      format: w.where.format, online: w.where.online, ...cleanTheme({ theme: v.theme, pattern: v.pattern }, title),
      ...(isCategory(v.category) ? { category: v.category } : {}), ...(isCoverUrl(v.cover) ? { cover: v.cover } : {}),
      approval: v.approval === true, capacity,
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
// Explore and Trending (owner, 2 Nov 2026: "explore and trending should also list events"). Only what anyone may see: a public event,
// not cancelled, with an occurrence that hasn't ended, and, for a community's event, a community anyone can find (not invite-only).
export function isListedEvent(e: Pick<EventDoc, "startsAt" | "endsAt" | "repeat" | "repeatUntil" | "cancelled" | "visibility" | "cid">, now: Date, communityFindable: boolean): boolean {
  if (e.visibility !== "public" || e.cancelled) return false;
  if (e.cid && !communityFindable) return false;
  return nextOccurrence(e, now) !== null;
}
// Trending → Events: interest in the period. A ticket sold counts most, then an RSVP (Going or Interested), then a visit to its page,
// like the store's "a save counts five looks" and communities' trendScore.
export const eventTrendScore = (a: { views: number; rsvps: number; tickets: number }) => a.tickets * 5 + a.rsvps * 3 + a.views;
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
// A calendar people subscribe to: a host's public upcoming events, one file (/api/events/calendar/<username>).
export function toIcsMany(list: (EventDoc & { id: string })[], urlOf: (id: string) => string, name: string, now = new Date()): string {
  const events = list.flatMap((e) => toIcs(e, urlOf(e.id), now).split("\r\n").filter((l, i, all) => {
    const b = all.indexOf("BEGIN:VEVENT"), en = all.indexOf("END:VEVENT");
    return i >= b && i <= en;
  }));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NotesApp//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", fold(`X-WR-CALNAME:${icsText(name)}`), ...events, "END:VCALENDAR"].join("\r\n") + "\r\n";
}
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
