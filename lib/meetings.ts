// Meetings (docs/EVENTS_DISCOVER.md; owner approved 26 Nov 2026): a small group at a set time — office hours, a workshop, a cohort call,
// group coaching. 2 to 50 seats, free or a price per seat; in person, online (a #NotesApp meeting room, or the host's Zoom, Meet or Teams
// link) or both. Paid seats
// carry the host's plan commission, like sessions, and the session cancellation policy (lib/cancellation.ts). Pure; the server side is
// lib/meetings-server.ts.
//
// meetings/{id}: MeetingDoc. meetingSeats/{meetingId}_{uid}: SeatDoc (server-only). A paid seat is a payment of kind "meeting".
import { cleanTheme, cleanWhere, isCategory, type EventCategory, type EventPattern, type EventThemeId, type Where } from "./event-kit";
import { NIGERIAN_STATES } from "./merch";

export const SEATS_MIN = 2;
export const SEATS_MAX = 50;
export const SEAT_PRICE_MIN_KOBO = 500 * 100;
export const SEAT_PRICE_MAX_KOBO = 500_000 * 100;
export const MEETING_MAX_HOURS = 12;
export const MEETINGS_UPCOMING_MAX = 60;

export type MeetingDoc = {
  hostUid: string; hostName: string; hostUsername: string;
  title: string; description: string; category?: EventCategory; theme: EventThemeId; pattern: EventPattern;
  startsAt: string; endsAt: string; where: Where; seats: number; priceKobo: number; booked: number;
  visibility: "public" | "unlisted"; cancelled?: boolean; createdAt: string; updatedAt?: string;
  roomId?: string; // the #NotesApp meeting room while it is open (online on #NotesApp)
};
export type SeatDoc = {
  meetingId: string; uid: string; name: string; status: "booked" | "cancelled" | "refunded";
  reference?: string; amountKobo: number; refundKobo?: number; createdAt: string; cancelledAt?: string; cancelledBy?: "client" | "host";
};
export type MeetingInput = {
  title?: unknown; description?: unknown; category?: unknown; theme?: unknown; pattern?: unknown; startsAt?: unknown; endsAt?: unknown;
  format?: unknown; place?: unknown; state?: unknown; city?: unknown; online?: unknown; link?: unknown; seats?: unknown; priceKobo?: unknown; visibility?: unknown;
};

const t = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const para = (v: unknown, max: number) => String(v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const HOUR = 3_600_000;

// What a host sends, made safe. `booked`: seats already taken (an edit can't go below it). Errors are words for the host.
export function cleanMeeting(v: MeetingInput, now: Date, seed: string, booked = 0): { ok: true; meeting: Omit<MeetingDoc, "hostUid" | "hostName" | "hostUsername" | "booked" | "createdAt"> } | { ok: false; error: string } {
  const title = t(v.title, 120);
  if (title.length < 3) return { ok: false, error: "Give the meeting a name." };
  const start = new Date(String(v.startsAt ?? ""));
  if (Number.isNaN(start.getTime())) return { ok: false, error: "Choose when it starts." };
  if (start.getTime() < now.getTime() - HOUR) return { ok: false, error: "That start time has passed." };
  if (start.getTime() > now.getTime() + 400 * 24 * HOUR) return { ok: false, error: "Meetings can be up to a year ahead." };
  let end = new Date(String(v.endsAt ?? ""));
  if (Number.isNaN(end.getTime())) end = new Date(start.getTime() + HOUR);
  if (end <= start) return { ok: false, error: "It has to end after it starts." };
  if (end.getTime() - start.getTime() > MEETING_MAX_HOURS * HOUR) return { ok: false, error: `A meeting can last up to ${MEETING_MAX_HOURS} hours.` };
  // Online: a #NotesApp meeting room (a live room on the Cloudflare relay that only people with a seat can enter) or the host's own link.
  const w = cleanWhere({ format: v.format, place: v.place, state: v.state, city: v.city, online: v.online ?? (String(v.link ?? "").trim() ? "link" : "notesapp"), link: v.link }, NIGERIAN_STATES);
  if (!w.ok) return { ok: false, error: w.error };
  const seats = Math.floor(Number(v.seats));
  if (!Number.isFinite(seats) || seats < SEATS_MIN || seats > SEATS_MAX) return { ok: false, error: `Seats: ${SEATS_MIN} to ${SEATS_MAX}.` };
  if (seats < booked) return { ok: false, error: `${booked} seats are already booked; keep at least that many.` };
  const priceKobo = Math.round(Number(v.priceKobo) || 0);
  if (priceKobo !== 0 && (priceKobo < SEAT_PRICE_MIN_KOBO || priceKobo > SEAT_PRICE_MAX_KOBO)) return { ok: false, error: "A paid seat costs ₦500 to ₦500,000 (or 0 for a free meeting)." };
  return {
    ok: true,
    meeting: {
      title, description: para(v.description, 4000), ...(isCategory(v.category) ? { category: v.category } : {}), ...cleanTheme({ theme: v.theme, pattern: v.pattern }, seed),
      startsAt: start.toISOString(), endsAt: end.toISOString(), where: w.where, seats, priceKobo, visibility: v.visibility === "unlisted" ? "unlisted" : "public",
    },
  };
}

export const seatsLeft = (m: Pick<MeetingDoc, "seats" | "booked">) => Math.max(0, m.seats - (m.booked ?? 0));
// Can this person take a seat now? null when they can, else why not.
export function seatNo(m: Pick<MeetingDoc, "seats" | "booked" | "cancelled" | "startsAt" | "hostUid">, uid: string, now: Date, already: boolean): string | null {
  if (m.cancelled) return "This meeting has been cancelled.";
  if (new Date(m.startsAt).getTime() <= now.getTime()) return "This meeting has already started.";
  if (m.hostUid === uid) return "It's your meeting.";
  if (already) return "You already have a seat.";
  if (seatsLeft(m) <= 0) return "This meeting is full.";
  return null;
}
// What a link to the meeting shows a person: the online link only to the host and people with a seat.
export function forViewer<M extends MeetingDoc>(m: M, inIt: boolean): M & { linkHidden?: boolean } {
  return inIt || !m.where.link ? m : { ...m, where: { ...m.where, link: "" }, linkHidden: true };
}

// The next one, from a meeting: the same day and time a week on (or a week after today, if that has passed too), same length.
export function nextFrom(m: Pick<MeetingDoc, "startsAt" | "endsAt">, now: Date): { startsAt: string; endsAt: string } {
  const len = new Date(m.endsAt).getTime() - new Date(m.startsAt).getTime();
  let start = new Date(m.startsAt).getTime() + 7 * 24 * HOUR;
  while (start <= now.getTime()) start += 7 * 24 * HOUR;
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(start + len).toISOString() };
}
// The host can open the #NotesApp meeting room from ROOM_EARLY_MS before the start until the end.
export const ROOM_EARLY_MS = 30 * 60_000;
export const roomOpenable = (m: Pick<MeetingDoc, "startsAt" | "endsAt" | "cancelled" | "where">, now: Date) =>
  !m.cancelled && m.where.format !== "in_person" && m.where.online === "notesapp" && now.getTime() >= new Date(m.startsAt).getTime() - ROOM_EARLY_MS && now.getTime() <= new Date(m.endsAt).getTime();
