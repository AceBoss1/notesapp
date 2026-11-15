// My Calendar (docs/MY_CALENDAR.md): one calendar for everything a member has booked, bought or been invited to. Pure and client-safe:
// the entry shape, merging and sorting, filters by kind, the day's agenda, the month's dots, the member's choices, when a bell is due,
// and the .ics writer (RFC 5545) used by "Add to my calendar" and the private feed. The reads are in lib/my-calendar-server.ts; nothing
// is copied: every entry is read from where it already lives, each time.
//
// Times are Lagos time (WAT, UTC+1, no summer time), as the rest of booking (lib/booking-time.ts). Days and times are worked out by
// hand, never with toLocaleDateString, so the server and every browser print the same words (it broke hydration once).
import { dayLabel } from "./month-calendar";

export type CalKind = "session" | "hotel" | "event" | "live" | "interview" | "money";
export const KINDS: CalKind[] = ["session", "hotel", "event", "live", "interview", "money"];
export const KIND_LABEL: Record<CalKind, string> = { session: "Sessions", hotel: "Hotel", event: "Events", live: "Lives", interview: "Interviews", money: "Money due" };
// The dot colours, as drawn in the mockups.
export const KIND_COLOUR: Record<CalKind, string> = { session: "#A6093D", hotel: "#B07A4F", event: "#2FA37A", live: "#E0123E", interview: "#3B6FD8", money: "#F2C14E" };

export type CalEntry = {
  id: string; // stable and unique: "<source>:<id>", e.g. "booking:NA-123"
  kind: CalKind;
  title: string; // in the app (money due names the amount)
  feedTitle: string; // what leaves #NotesApp in the private feed: a title only, never an amount or a note
  start: string; // ISO time (UTC). All-day entries start at Lagos midnight
  end: string;
  allDay?: boolean;
  stay?: boolean; // a hotel stay: check-in at `start`, check-out at `end`, the nights between shaded
  sub?: string; // the second line ("You booked", "Ticket ✓ · @lwb")
  where?: string; // "Video call link", "Ọ̀ṣun Suites, Osogbo"
  href: string; // where it came from, a path on our site ("/bookings", "/events/abc")
};

// ── Lagos days and times ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const HOUR = 3_600_000, DAY = 24 * HOUR;
const pad = (n: number) => String(n).padStart(2, "0");
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
// The Lagos calendar day of a moment.
export const lagosDay = (iso: string | Date) => new Date(new Date(iso).getTime() + HOUR).toISOString().slice(0, 10);
export const lagosToday = (now = new Date()) => lagosDay(now);
// "14:30", Lagos time.
export const lagosTime = (iso: string) => new Date(new Date(iso).getTime() + HOUR).toISOString().slice(11, 16);
// "2:30 pm"
export function time12(iso: string): string {
  const [h, m] = lagosTime(iso).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? "pm" : "am"}`;
}
// Lagos midnight at the start of a day, as an ISO time.
export const lagosMidnight = (day: string) => new Date(Date.parse(`${day}T00:00:00+01:00`)).toISOString();
// A Lagos wall-clock time on a day ("2026-11-19", "14:00"), as an ISO time.
export const lagosAt = (day: string, time: string) => new Date(Date.parse(`${day}T${/^\d{2}:\d{2}$/.test(time) ? time : "00:00"}:00+01:00`)).toISOString();
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
// 0 = Sunday … 6 = Saturday, and the hour, in Lagos.
export const lagosWeekday = (now: Date) => new Date(now.getTime() + HOUR).getUTCDay();
export const lagosHour = (now: Date) => new Date(now.getTime() + HOUR).getUTCHours();
// The last day an entry covers (an all-day entry ends at the next midnight, which isn't one of its days).
const lastDay = (e: Pick<CalEntry, "start" | "end">) => lagosDay(new Date(Math.max(Date.parse(e.start), Date.parse(e.end) - 1)));

// "Thu 19 Nov, 2:30–3:15 pm (WAT)"; "Mon 16 Nov, 2:00 pm to Thu 19 Nov, 12:00 pm (WAT)"; "Sat 21 Nov, all day".
export function whenText(e: Pick<CalEntry, "start" | "end" | "allDay">): string {
  const sd = lagosDay(e.start), ed = lastDay(e);
  if (e.allDay) return sd === ed ? `${dayLabel(sd, true)}, all day` : `${dayLabel(sd, true)} to ${dayLabel(ed, true)}, all day`;
  const a = time12(e.start), b = time12(e.end);
  if (sd !== lagosDay(e.end)) return `${dayLabel(sd, true)}, ${a} to ${dayLabel(lagosDay(e.end), true)}, ${b} (WAT)`;
  const same = a.slice(-2) === b.slice(-2);
  return `${dayLabel(sd, true)}, ${same ? a.slice(0, -3) : a}–${b} (WAT)`;
}

// ── Merging, sorting and filtering ───────────────────────────────────────────────────────────────────────────────────────────────
const ORDER: Record<CalKind, number> = { session: 0, interview: 1, live: 2, event: 3, hotel: 4, money: 5 };
export const byTime = (a: CalEntry, b: CalEntry) => a.start.localeCompare(b.start) || ORDER[a.kind] - ORDER[b.kind] || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
// Every source's entries in one list, soonest first. The same thing from two sources (a ticket and "going" to that event) keeps the first.
export function mergeEntries(lists: CalEntry[][]): CalEntry[] {
  const seen = new Map<string, CalEntry>();
  for (const list of lists) for (const e of list) if (e && !seen.has(e.id) && !Number.isNaN(Date.parse(e.start)) && !Number.isNaN(Date.parse(e.end))) seen.set(e.id, e);
  return [...seen.values()].sort(byTime);
}
export const filterKinds = (entries: CalEntry[], kinds: Iterable<CalKind>) => { const k = new Set(kinds); return entries.filter((e) => k.has(e.kind)); };
// Entries that touch the days from `from` to `to` (both Lagos days, inclusive).
export const inRange = (entries: CalEntry[], from: string, to: string) => entries.filter((e) => lagosDay(e.start) <= to && lastDay(e) >= from);

// Who sees what. Teens see what teen mode already allows (no Business books money); a child profile has no calendar of its own.
export type CalMode = { teen: boolean; kid: boolean };
export const allowedKinds = (m: CalMode): CalKind[] => (m.kid ? [] : m.teen ? KINDS.filter((k) => k !== "money") : [...KINDS]);

// ── The day's agenda and the month's dots ────────────────────────────────────────────────────────────────────────────────────────
export type AgendaItem = { entry: CalEntry; time: string; label: string; at: "start" | "end" };
// A day's list: an entry on the day it starts (a hotel stay also on the day it ends, as "Check out"). Timed first, then all day.
export function agendaFor(entries: CalEntry[], day: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const e of entries) {
    const sd = lagosDay(e.start);
    if (e.stay) {
      if (sd === day) out.push({ entry: e, time: lagosTime(e.start), label: `Check in · ${e.title}`, at: "start" });
      if (lagosDay(e.end) === day && sd !== day) out.push({ entry: e, time: lagosTime(e.end), label: `Check out · ${e.title}`, at: "end" });
      continue;
    }
    if (sd === day) out.push({ entry: e, time: e.allDay ? "All day" : lagosTime(e.start), label: e.title, at: "start" });
  }
  const key = (i: AgendaItem) => (i.time === "All day" ? "99" : i.time);
  return out.sort((a, b) => key(a).localeCompare(key(b)) || byTime(a.entry, b.entry));
}
export const countOn = (entries: CalEntry[], day: string) => agendaFor(entries, day).length;
// The kinds on each day, for the coloured dots under the month's days.
export function dotsByDay(entries: CalEntry[]): Record<string, CalKind[]> {
  const out: Record<string, CalKind[]> = {};
  const add = (d: string, k: CalKind) => { const l = (out[d] ??= []); if (!l.includes(k)) l.push(k); };
  for (const e of entries) {
    add(lagosDay(e.start), e.kind);
    if (e.stay) add(lagosDay(e.end), e.kind);
  }
  for (const d of Object.keys(out)) out[d].sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b));
  return out;
}
// Hotel nights to shade: the days after check-in and before check-out.
export function stayNights(entries: CalEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    if (!e.stay) continue;
    const end = lagosDay(e.end);
    for (let d = addDays(lagosDay(e.start), 1), n = 0; d < end && n < 62; d = addDays(d, 1), n++) out.add(d);
  }
  return out;
}

// ── The member's choices ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// What goes to the phone (the private feed), as drawn: money due and My Cycle are off until she turns them on. My Cycle isn't in this
// release (its dates are only kept encrypted, lib/cycle-server.ts), so it has no switch yet.
export type FeedGroup = "sessions" | "hotel" | "events" | "interviews" | "money";
export const FEED_GROUPS: { id: FeedGroup; label: string; kinds: CalKind[]; on: boolean }[] = [
  { id: "sessions", label: "Sessions and calls", kinds: ["session"], on: true },
  { id: "hotel", label: "Hotel stays", kinds: ["hotel"], on: true },
  { id: "events", label: "Events and lives", kinds: ["event", "live"], on: true },
  { id: "interviews", label: "Interviews", kinds: ["interview"], on: true },
  { id: "money", label: "Money due (Business books)", kinds: ["money"], on: false },
];
export const SESSION_BELL_MINUTES = [0, 5, 10, 15, 30] as const; // 0 = off. Never an hour: bookings already remind an hour before.
export type CalPrefs = {
  feed: Record<FeedGroup, boolean>;
  bells: { sessionsMin: number; events: boolean; hotelDayBefore: boolean; weekAhead: boolean };
};
export const DEFAULT_PREFS: CalPrefs = {
  feed: Object.fromEntries(FEED_GROUPS.map((g) => [g.id, g.on])) as Record<FeedGroup, boolean>,
  bells: { sessionsMin: 10, events: true, hotelDayBefore: true, weekAhead: false },
};
// Anything stored or sent, made safe: unknown keys dropped, missing ones from the defaults.
export function cleanPrefs(raw: unknown, base: CalPrefs = DEFAULT_PREFS): CalPrefs {
  const o = (raw && typeof raw === "object" ? raw : {}) as { feed?: Record<string, unknown>; bells?: Record<string, unknown> };
  const feed = { ...base.feed };
  for (const g of FEED_GROUPS) if (typeof o.feed?.[g.id] === "boolean") feed[g.id] = o.feed[g.id] as boolean;
  const b = o.bells ?? {};
  const min = Number(b.sessionsMin);
  return {
    feed,
    bells: {
      sessionsMin: (SESSION_BELL_MINUTES as readonly number[]).includes(min) ? min : base.bells.sessionsMin,
      events: typeof b.events === "boolean" ? b.events : base.bells.events,
      hotelDayBefore: typeof b.hotelDayBefore === "boolean" ? b.hotelDayBefore : base.bells.hotelDayBefore,
      weekAhead: typeof b.weekAhead === "boolean" ? b.weekAhead : base.bells.weekAhead,
    },
  };
}
export const feedKinds = (p: CalPrefs): CalKind[] => FEED_GROUPS.filter((g) => p.feed[g.id]).flatMap((g) => g.kinds);

// What an entry's reminder row says on its detail card.
export function reminderText(e: Pick<CalEntry, "kind">, p: CalPrefs): string {
  if (e.kind === "session") return p.bells.sessionsMin ? `${p.bells.sessionsMin} min before 🔔` : "Off";
  if (e.kind === "interview") return "A day and an hour before 🔔";
  if (e.kind === "event" || e.kind === "live") return p.bells.events ? "1 hour before 🔔" : "Off";
  if (e.kind === "hotel") return p.bells.hotelDayBefore ? "The day before 🔔" : "Off";
  return "";
}

// ── Bells (the 15-minute reminders job) ──────────────────────────────────────────────────────────────────────────────────────────
// The job runs about every 15 minutes, so a bell set for 10 minutes before goes out between 10 and 25 minutes before; never after the start.
export const CRON_STEP_MIN = 15;
export function bellDue(startIso: string, leadMin: number, now: Date): boolean {
  if (!leadMin) return false;
  const left = Date.parse(startIso) - now.getTime();
  return left > 0 && left <= (leadMin + CRON_STEP_MIN) * 60_000;
}
// "starts in about 20 minutes, at 10:00"
export function startsIn(startIso: string, now: Date): string {
  const min = Math.max(1, Math.round((Date.parse(startIso) - now.getTime()) / 60_000));
  return `starts in about ${min} minute${min === 1 ? "" : "s"}, at ${lagosTime(startIso)}`;
}
// A hotel check-in tomorrow (Lagos), from 9 AM.
export const hotelBellDue = (checkInDay: string, now: Date) => addDays(lagosToday(now), 1) === checkInDay && lagosHour(now) >= 9;
// The week-ahead email: Mondays from 7 AM Lagos. Its key is that Monday.
export const weekAheadDue = (now: Date) => lagosWeekday(now) === 1 && lagosHour(now) >= 7;
export function weekAheadText(entries: CalEntry[], today: string, siteUrl: string): string {
  const lines: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const items = agendaFor(entries, d);
    if (!items.length) continue;
    lines.push(`${dayLabel(d)}`);
    for (const it of items) lines.push(`  ${it.time === "All day" ? "All day" : it.time}  ${it.label}`);
    lines.push("");
  }
  const body = lines.length ? lines.join("\n") : "Nothing booked this week.\n";
  return `Your week ahead on #NotesApp (Lagos time):\n\n${body}\nOpen My Calendar: ${siteUrl}/calendar\n\nYou asked for this email on Mondays. Turn it off in My Calendar → Settings.`;
}

// ── The private link ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 32 random bytes in base64url: 43 characters. The link may end in ".ics" (calendar apps like it).
export const FEED_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const tokenFromPath = (raw: string) => decodeURIComponent(String(raw ?? "")).replace(/\.ics$/i, "");
export const feedHttpsUrl = (siteUrl: string, token: string) => `${siteUrl.replace(/\/$/, "")}/api/calendar/${token}.ics`;
export const feedWebcalUrl = (siteUrl: string, token: string) => feedHttpsUrl(siteUrl, token).replace(/^https?:\/\//i, "webcal://");

// ── The .ics writer (RFC 5545) ───────────────────────────────────────────────────────────────────────────────────────────────────
// Text values: backslash, semicolon, comma and line breaks escaped (§3.3.11).
export const icsEscape = (v: string) => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
// Lines longer than 75 octets are folded: CRLF and one space, never splitting a UTF-8 character (§3.1).
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { parts.push(cur); cur = ""; bytes = 0; limit = 74; } // later lines start with the space
    cur += ch; bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}
// 20261119T133000Z
export const icsUtc = (iso: string | Date) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDate = (day: string) => day.replace(/-/g, "");

export type IcsOptions = { now: Date; host: string; siteUrl: string; feed?: boolean; name?: string };
// One VCALENDAR with a VEVENT per entry. In the feed (`feed`), only the feed title and the times go out: no amounts, no notes.
export function buildIcs(entries: CalEntry[], o: IcsOptions): string {
  const site = o.siteUrl.replace(/\/$/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NotesApp//My Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...(o.feed ? [`X-WR-CALNAME:${icsEscape(o.name || "#NotesApp")}`, "X-WR-TIMEZONE:Africa/Lagos", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"] : []),
  ];
  const stamp = icsUtc(o.now);
  for (const e of entries) {
    lines.push("BEGIN:VEVENT", `UID:${icsEscape(e.id.replace(/[^A-Za-z0-9:_.-]/g, "-"))}@${o.host}`, `DTSTAMP:${stamp}`);
    if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${icsDate(lagosDay(e.start))}`, `DTEND;VALUE=DATE:${icsDate(addDays(lastDay(e), 1))}`);
    else lines.push(`DTSTART:${icsUtc(e.start)}`, `DTEND:${icsUtc(e.end)}`);
    lines.push(`SUMMARY:${icsEscape(o.feed ? e.feedTitle : e.title)}`);
    if (!o.feed && e.where) lines.push(`LOCATION:${icsEscape(e.where)}`);
    lines.push(`URL:${site}${e.href.startsWith("/") ? e.href : `/${e.href}`}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
// "1-1-with-tunde.ics"
export const icsFileName = (e: Pick<CalEntry, "title">) => `${e.title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 50) || "event"}.ics`;
