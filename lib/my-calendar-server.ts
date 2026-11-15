import { createHash, randomBytes } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getUserEmail } from "./firebase-admin";
import { notifyBell, sendEmail } from "./email";
import { MAIN_HOST, SITE_URL } from "./host";
import { isKidUid } from "./kids";
import { accountCryptoConfigured, decryptSecret, encryptSecret } from "./account-crypto";
import { myTickets } from "./tickets-server";
import { hostLives, myLiveTickets } from "./live-tickets-server";
import { myHotels } from "./hotel-server";
import { roleCan, type Booking as HotelBooking } from "./hotel";
import { debtors, firstName, naira, type Entry as BookEntry, type Party } from "./books";
import type { PpmSessionDoc } from "./ppm";
import type { EventDoc } from "./events";
import type { Interview } from "./interviews";
import {
  DEFAULT_PREFS, FEED_TOKEN_RE, addDays, allowedKinds, bellDue, buildIcs, cleanPrefs, feedHttpsUrl, feedKinds, feedWebcalUrl, filterKinds,
  hotelBellDue, inRange, lagosAt, lagosMidnight, lagosToday, mergeEntries, startsIn, weekAheadDue, weekAheadText,
  type CalEntry, type CalMode, type CalPrefs,
} from "./my-calendar";

// My Calendar on the server (docs/MY_CALENDAR.md; the rules are in lib/my-calendar.ts). Every entry is read from where it already lives,
// each time it's asked for: nothing is copied, so a change or a cancellation shows at once. A source that fails is left out and named
// (`failed`), and the rest still show.
//
//   myCalendar/{uid}       { prefs (CalPrefs), feedHash?, feedSecret? (the link, encrypted with ACCOUNT_DATA_KEY, so she can see it
//                            again), feedCreatedAt?, weekAheadSentFor? (that Monday), weekAhead (prefs.bells.weekAhead, copied for the Monday query) }
//   calendarFeeds/{sha256} { uid, createdAt }: the private link, found by the SHA-256 of its token; the token itself is never stored
//   calendarBells/{key}    { at }: a bell this job sent, so it goes out once
//
// All three are server-only in firestore.rules.

const SETTINGS = "myCalendar", FEEDS = "calendarFeeds", BELLS = "calendarBells";
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type Range = { from: string; to: string }; // Lagos days, inclusive
type Ctx = { db: Firestore; uid: string; range: Range; fromIso: string; toIso: string; now: Date };
export type Source = { id: string; label: string; read: (c: Ctx) => Promise<CalEntry[]> };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();
async function names(db: Firestore, uids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(uids.filter(Boolean))].slice(0, 200);
  if (!list.length) return out;
  const docs = await db.getAll(...list.map((u) => db.doc(`users/${u}`)));
  for (const d of docs) if (d.exists) out.set(d.id, str(d.get("username")));
  return out;
}

// ── The sources ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// 1:1 sessions (bookings/{reference}, lib/payments.ts), as the client and as the publisher. Confirmed ones only.
const bookings: Source = {
  id: "bookings", label: "1:1 sessions",
  async read({ db, uid }) {
    const [a, b] = await Promise.all([
      db.collection("bookings").where("clientUid", "==", uid).limit(500).get(),
      db.collection("bookings").where("publisherUid", "==", uid).limit(500).get(),
    ]);
    const asPub = b.docs.map((d) => d.data()).filter((x) => x.status === "confirmed");
    const who = await names(db, asPub.map((x) => str(x.clientUid)));
    const entry = (x: FirebaseFirestore.DocumentData, mine: boolean): CalEntry => {
      const minutes = Number(x.minutes) || 60, other = mine ? str(x.username) : who.get(str(x.clientUid)) ?? "";
      const title = `1:1 ${other ? `with @${other}` : "session"} · ${minutes} min`;
      return { id: `booking:${x.reference}`, kind: "session", title, feedTitle: title, start: x.startsAt, end: plus(x.startsAt, minutes * MIN), sub: mine ? "You booked" : "Booked with you", where: "On #NotesApp", href: "/bookings" };
    };
    return [...a.docs.map((d) => d.data()).filter((x) => x.status === "confirmed").map((x) => entry(x, true)), ...asPub.map((x) => entry(x, false))];
  },
};

// Pay-per-minute sessions (ppmSessions/{id}, lib/ppm-server.ts), as the viewer and as the host.
const ppm: Source = {
  id: "ppm", label: "Pay-per-minute calls",
  async read({ db, uid }) {
    const [a, b] = await Promise.all([
      db.collection("ppmSessions").where("viewerUid", "==", uid).orderBy("startsAt", "desc").limit(100).get(),
      db.collection("ppmSessions").where("hostUid", "==", uid).orderBy("startsAt", "desc").limit(100).get(),
    ]);
    const entry = (id: string, s: PpmSessionDoc, viewer: boolean): CalEntry | null => {
      if (s.status === "cancelled" || s.status === "expired") return null;
      const other = viewer ? s.hostUsername : s.viewerUsername;
      const title = `Per-minute ${s.kind} call with @${other || "a member"}`;
      return { id: `ppm:${id}`, kind: "session", title, feedTitle: title, start: s.startsAt, end: plus(s.startsAt, (Number(s.holdMinutes) || 15) * MIN), sub: `${viewer ? "You booked" : "Booked with you"} · ${plural(s.holdMinutes, "minute")} held${s.status === "ended" ? " · Ended" : ""}`, where: "On #NotesApp", href: `/ppm/${id}` };
    };
    return [...a.docs.map((d) => entry(d.id, d.data() as PpmSessionDoc, true)), ...b.docs.map((d) => entry(d.id, d.data() as PpmSessionDoc, false))].filter((e): e is CalEntry => !!e);
  },
};

// Hotel stays (hotelBookings, lib/hotel-server.ts): the guest's own, booked while signed in.
const hotelStays: Source = {
  id: "hotelStays", label: "Hotel stays",
  async read({ db, uid, now }) {
    const snap = await db.collection("hotelBookings").where("uid", "==", uid).limit(200).get();
    const list = snap.docs.map((d) => ({ ...(d.data() as HotelBooking), id: d.id }))
      .filter((b) => b.status === "confirmed" || b.status === "checked_in" || b.status === "checked_out" || (b.status === "held" && Date.parse(b.holdUntil) > now.getTime()));
    if (!list.length) return [];
    const hotels = await db.getAll(...[...new Set(list.map((b) => b.hotelId))].map((h) => db.doc(`hotels/${h}`)));
    const byId = new Map(hotels.filter((h) => h.exists).map((h) => [h.id, h.data()!]));
    return list.map((b) => {
      const h = byId.get(b.hotelId) ?? {};
      const name = [str(h.name) || "Hotel", str(h.city)].filter(Boolean).join(", ");
      const status = b.status === "held" ? "Held, not paid yet" : b.status === "checked_in" ? "Checked in" : b.status === "checked_out" ? "Checked out" : "Confirmed ✓";
      return {
        id: `stay:${b.id}`, kind: "hotel" as const, stay: true, title: name, feedTitle: `Hotel stay · ${name}`,
        start: lagosAt(b.checkIn, str(h.policy?.checkIn) || "14:00"), end: lagosAt(b.checkOut, str(h.policy?.checkOut) || "12:00"),
        sub: `${b.roomName} · ${plural(b.nights, "night")} · ${status}`, where: [str(h.address), str(h.city)].filter(Boolean).join(", ") || name, href: `/hotel/${b.code}`,
      };
    });
  },
};

// For hotel staff who handle bookings: their hotel's arrivals and departures.
const hotelDesk: Source = {
  id: "hotelDesk", label: "Your hotel's bookings",
  async read({ db, uid, range, now }) {
    const mine = (await myHotels(db, uid)).filter((h) => roleCan(h.role, "bookings"));
    const out: CalEntry[] = [];
    for (const h of mine.slice(0, 5)) {
      const hotel = (await db.doc(`hotels/${h.id}`).get()).data() ?? {};
      const snap = await db.collection("hotelBookings").where("hotelId", "==", h.id).where("checkOut", ">=", range.from).limit(500).get();
      const label = [h.name, h.branch].filter(Boolean).join(" · ");
      for (const d of snap.docs) {
        const b = d.data() as HotelBooking;
        if (b.checkIn > range.to) continue;
        if (!(b.status === "confirmed" || b.status === "checked_in" || (b.status === "held" && Date.parse(b.holdUntil) > now.getTime()))) continue;
        const inAt = lagosAt(b.checkIn, str(hotel.policy?.checkIn) || "14:00"), outAt = lagosAt(b.checkOut, str(hotel.policy?.checkOut) || "12:00");
        const sub = `${label} · ${plural(b.nights, "night")} · ${b.guests} ${b.guests === 1 ? "guest" : "guests"}`;
        out.push({ id: `arrive:${d.id}`, kind: "hotel", title: `Arriving: ${b.guestName} · ${b.roomName}`, feedTitle: `Arrival · ${b.roomName} (${h.name})`, start: inAt, end: plus(inAt, 30 * MIN), sub, href: `/profile/hotel?h=${h.id}` });
        out.push({ id: `leave:${d.id}`, kind: "hotel", title: `Leaving: ${b.guestName} · ${b.roomName}`, feedTitle: `Departure · ${b.roomName} (${h.name})`, start: outAt, end: plus(outAt, 30 * MIN), sub, href: `/profile/hotel?h=${h.id}` });
      }
    }
    return out;
  },
};

// Event tickets (tickets, lib/tickets-server.ts), events she said she's going to (eventRsvps) and events she hosts (events).
const eventLen = (e: EventDoc) => Math.max(30 * MIN, Date.parse(e.endsAt) - Date.parse(e.startsAt) || 2 * HOUR);
const tickets: Source = {
  id: "tickets", label: "Event tickets",
  async read({ db, uid }) {
    const all = (await myTickets(db, uid)).filter((t) => t.status === "valid");
    const by = new Map<string, typeof all>();
    for (const t of all) by.set(t.eventId, [...(by.get(t.eventId) ?? []), t]);
    return [...by.values()].map((ts) => {
      const t = ts[0];
      return { id: `event:${t.eventId}`, kind: "event" as const, title: t.eventTitle, feedTitle: t.eventTitle, start: t.startsAt, end: t.endsAt || plus(t.startsAt, 2 * HOUR), sub: `Ticket ✓ · ${ts.length > 1 ? `${ts.length} tickets` : t.typeName}`, href: `/events/${t.eventId}` };
    });
  },
};
type Ev = EventDoc & { nextStartAt?: string | null };
const eventEntry = (id: string, e: Ev, sub: string): CalEntry | null => {
  const start = e.nextStartAt || e.startsAt;
  if (e.cancelled || !start) return null;
  return { id: `event:${id}`, kind: "event", title: e.title, feedTitle: e.title, start, end: plus(start, eventLen(e)), sub, where: e.place || (e.liveUrl ? "Online" : ""), href: `/events/${id}` };
};
const going: Source = {
  id: "going", label: "Events you're going to",
  async read({ db, uid }) {
    const rs = (await db.collection("eventRsvps").where("uid", "==", uid).limit(200).get()).docs.filter((d) => d.get("status") === "going");
    if (!rs.length) return [];
    const evs = await db.getAll(...rs.map((d) => db.doc(`events/${d.get("eventId")}`)));
    return evs.filter((d) => d.exists).map((d) => { const e = d.data() as Ev; return eventEntry(d.id, e, `Going · ${e.communityName || `@${e.hostUsername}`}`); }).filter((e): e is CalEntry => !!e);
  },
};
const hosting: Source = {
  id: "hosting", label: "Events you host",
  async read({ db, uid, fromIso }) {
    const snap = await db.collection("events").where("hostUid", "==", uid).where("nextStartAt", ">=", fromIso).limit(100).get();
    return snap.docs.map((d) => eventEntry(d.id, d.data() as Ev, `You're hosting · ${plural(Number(d.get("going")) || 0, "person")} going`)).filter((e): e is CalEntry => !!e);
  },
};

// Paid lives (liveEvents and liveTickets, lib/live-tickets-server.ts): tickets she holds, and lives she hosts.
const lives: Source = {
  id: "lives", label: "Paid lives",
  async read({ db, uid }) {
    const [held, hosted] = await Promise.all([myLiveTickets(db, uid), hostLives(db, uid)]);
    const out: CalEntry[] = [];
    for (const l of hosted) if (l.status !== "cancelled") out.push({ id: `live:${l.id}`, kind: "live", title: `Paid live: ${l.title}`, feedTitle: `Paid live: ${l.title}`, start: l.startsAt, end: plus(l.startsAt, HOUR), sub: `You're hosting · ${plural(l.sold, "ticket")} sold`, where: "On #NotesApp", href: `/lives/${l.id}` });
    for (const l of held) if (l.status !== "cancelled" && l.ticketStatus === "valid") out.push({ id: `live:${l.id}`, kind: "live", title: `Paid live: ${l.title}`, feedTitle: `Paid live: ${l.title}`, start: l.startsAt, end: plus(l.startsAt, HOUR), sub: `Ticket ✓ · @${l.hostUsername}`, where: "On #NotesApp", href: `/lives/${l.id}` });
    return out;
  },
};

// Interviews (interviews/{id}, lib/interviews-server.ts), from Notes Jobs or our own roles: as the applicant or an interviewer.
const interviews: Source = {
  id: "interviews", label: "Interviews",
  async read({ db, uid }) {
    const [a, b] = await Promise.all([
      db.collection("interviews").where("applicantUid", "==", uid).limit(100).get(),
      db.collection("interviews").where("interviewerUids", "array-contains", uid).limit(100).get(),
    ]);
    const entry = (id: string, i: Omit<Interview, "id">, applicant: boolean): CalEntry | null => {
      if (i.status !== "scheduled") return null;
      const title = applicant ? `Interview · ${i.title}, ${i.org}` : `Interviewing for ${i.title}`;
      return { id: `interview:${id}`, kind: "interview", title, feedTitle: title, start: i.startAt, end: i.endAt, sub: `${i.mode === "audio" ? "Voice" : "Video"} call · from ${i.kind === "career" ? "Careers at #NotesApp" : "Notes Jobs"}`, where: `${i.mode === "audio" ? "Voice" : "Video"} call link`, href: `/messages/${i.roomId}` };
    };
    return [...a.docs.map((d) => entry(d.id, d.data() as Omit<Interview, "id">, true)), ...b.docs.map((d) => entry(d.id, d.data() as Omit<Interview, "id">, false))].filter((e): e is CalEntry => !!e);
  },
};

// Money due in Business books (bookParties and bookEntries, lib/books-server.ts), for the books' owner: what customers owe by a date,
// and what she owes suppliers by a date. All day on the due date. The amount is in the app only, never in the feed.
const money: Source = {
  id: "money", label: "Money due",
  async read({ db, uid, now }) {
    const parties = (await db.collection("bookParties").where("ownerUid", "==", uid).limit(1000).get()).docs.map((d) => ({ ...(d.data() as Omit<Party, "id">), id: d.id }) as Party);
    if (!parties.length) return [];
    const open = (await db.collection("bookEntries").where("ownerUid", "==", uid).where("open", "==", true).limit(2000).get()).docs.map((d) => ({ ...(d.data() as Omit<BookEntry, "id">), id: d.id }) as BookEntry);
    const out: CalEntry[] = [];
    for (const d of debtors(parties, open, lagosToday(now))) {
      const byDue = new Map<string, number>();
      for (const e of d.entries) if (e.dueOn) byDue.set(e.dueOn, (byDue.get(e.dueOn) ?? 0) + e.openKobo);
      for (const [due, kobo] of byDue) {
        out.push({ id: `owed:${d.party.id}:${due}`, kind: "money", allDay: true, title: `${firstName(d.party.name)} owes you ${naira(kobo)}`, feedTitle: `Money due from ${d.party.name}`, start: lagosMidnight(due), end: lagosMidnight(addDays(due, 1)), sub: "Business books · Send a reminder", href: "/profile/books?tab=owed" });
      }
    }
    for (const p of parties) {
      if (p.kind !== "supplier" || !(p.balanceKobo > 0) || !p.dueOn) continue;
      out.push({ id: `owe:${p.id}`, kind: "money", allDay: true, title: `You owe ${p.name} ${naira(p.balanceKobo)}`, feedTitle: `Pay ${p.name}`, start: lagosMidnight(p.dueOn), end: lagosMidnight(addDays(p.dueOn, 1)), sub: "Business books · Suppliers", href: "/profile/books?tab=owed" });
    }
    return out;
  },
};

// My Cycle is not a source in this release: her periods and predictions are kept only encrypted (lib/cycle-server.ts, ACCOUNT_DATA_KEY)
// and open with her passkey, so the calendar can't read even the coarse dates without unlocking them.
export const SOURCES: Source[] = [bookings, ppm, hotelStays, hotelDesk, tickets, going, hosting, lives, interviews, money];

// ── Gathering ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function calendarMode(db: Firestore, uid: string): Promise<CalMode> {
  if (isKidUid(uid)) return { teen: false, kid: true };
  const u = (await db.doc(`users/${uid}`).get()).data();
  return { teen: u?.teen === true, kid: u?.kid === true };
}
export function cleanRange(from: unknown, to: unknown, now = new Date(), maxDays = 62): Range {
  const today = lagosToday(now);
  const ok = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
  const f = ok(from) ? from : today;
  let t = ok(to) && to >= f ? to : f;
  if (Date.parse(t) - Date.parse(f) > maxDays * DAY) t = addDays(f, maxDays);
  return { from: f, to: t };
}
export async function gatherCalendar(db: Firestore, uid: string, range: Range, opts: { now?: Date; sources?: Source[]; mode?: CalMode } = {}) {
  const now = opts.now ?? new Date();
  const mode = opts.mode ?? (await calendarMode(db, uid));
  const kinds = allowedKinds(mode);
  if (!kinds.length) return { entries: [] as CalEntry[], failed: [] as string[], mode };
  const ctx: Ctx = { db, uid, range, now, fromIso: lagosMidnight(range.from), toIso: lagosMidnight(addDays(range.to, 1)) };
  const results = await Promise.allSettled((opts.sources ?? SOURCES).map((s) => s.read(ctx)));
  const failed: string[] = [];
  const lists: CalEntry[][] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") lists.push(r.value);
    else { failed.push((opts.sources ?? SOURCES)[i].label); console.error(`my calendar: ${(opts.sources ?? SOURCES)[i].id} failed`, r.reason); }
  });
  return { entries: filterKinds(inRange(mergeEntries(lists), range.from, range.to), kinds), failed, mode };
}

// ── Her choices ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function getPrefs(db: Firestore, uid: string): Promise<CalPrefs> {
  return cleanPrefs((await db.doc(`${SETTINGS}/${uid}`).get()).data()?.prefs);
}
export async function savePrefs(db: Firestore, uid: string, raw: unknown, now = new Date()): Promise<CalPrefs> {
  const prefs = cleanPrefs(raw, await getPrefs(db, uid));
  await db.doc(`${SETTINGS}/${uid}`).set({ uid, prefs, weekAhead: prefs.bells.weekAhead, updatedAt: now.toISOString() }, { merge: true });
  return prefs;
}

// ── The private link ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type LinkView = { has: boolean; https: string | null; webcal: string | null; createdAt: string | null; shownOnce: boolean };
const view = (token: string | null, has: boolean, createdAt: string | null, shownOnce = false): LinkView =>
  ({ has, https: token ? feedHttpsUrl(SITE_URL, token) : null, webcal: token ? feedWebcalUrl(SITE_URL, token) : null, createdAt, shownOnce });
// The link as it stands: shown again when it was kept encrypted (ACCOUNT_DATA_KEY set), otherwise only that one exists.
export async function linkView(db: Firestore, uid: string): Promise<LinkView> {
  const d = (await db.doc(`${SETTINGS}/${uid}`).get()).data();
  if (!d?.feedHash) return view(null, false, null);
  let token: string | null = null;
  if (typeof d.feedSecret === "string" && accountCryptoConfigured()) { try { token = decryptSecret(d.feedSecret); } catch { token = null; } }
  return view(token && hashToken(token) === d.feedHash ? token : null, true, str(d.feedCreatedAt) || null);
}
// Make a new link: a fresh random token; the old one stops working at once.
export async function newLink(db: Firestore, uid: string, now = new Date()): Promise<LinkView> {
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  const ref = db.doc(`${SETTINGS}/${uid}`);
  await db.runTransaction(async (t) => {
    const old = (await t.get(ref)).data();
    if (old?.feedHash) t.delete(db.doc(`${FEEDS}/${old.feedHash}`));
    t.set(db.doc(`${FEEDS}/${hash}`), { uid, createdAt: now.toISOString() });
    t.set(ref, { uid, feedHash: hash, feedSecret: accountCryptoConfigured() ? encryptSecret(token) : null, feedCreatedAt: now.toISOString() }, { merge: true });
  });
  return view(token, true, now.toISOString(), !accountCryptoConfigured());
}
export async function stopLink(db: Firestore, uid: string): Promise<void> {
  const ref = db.doc(`${SETTINGS}/${uid}`);
  await db.runTransaction(async (t) => {
    const old = (await t.get(ref)).data();
    if (old?.feedHash) t.delete(db.doc(`${FEEDS}/${old.feedHash}`));
    t.set(ref, { feedHash: null, feedSecret: null, feedCreatedAt: null }, { merge: true });
  });
}
// The feed for a token: null when the token is unknown (the route answers 404). Titles and times only, the kinds she chose, from a
// month back to six months ahead.
export async function feedFor(db: Firestore, token: string, now = new Date(), sources?: Source[]): Promise<string | null> {
  if (!FEED_TOKEN_RE.test(token)) return null;
  const f = (await db.doc(`${FEEDS}/${hashToken(token)}`).get()).data();
  if (!f?.uid) return null;
  const uid = String(f.uid);
  const s = (await db.doc(`${SETTINGS}/${uid}`).get()).data();
  if (s?.feedHash !== hashToken(token)) return null; // replaced: the old link stops at once
  const prefs = cleanPrefs(s?.prefs);
  const today = lagosToday(now);
  const { entries } = await gatherCalendar(db, uid, { from: addDays(today, -31), to: addDays(today, 183) }, { now, sources });
  return buildIcs(filterKinds(entries, feedKinds(prefs)), { now, host: MAIN_HOST, siteUrl: SITE_URL, feed: true, name: "#NotesApp" });
}

// ── Bells and the week ahead (the 15-minute reminders job, app/api/cron/reminders) ───────────────────────────────────────────────
// Only what doesn't already remind: a short bell before sessions and per-minute calls (bookings already send a day and an hour before),
// an hour before an event for ticket holders who didn't also say they're going (going and interested already get one, and paid lives
// remind their ticket holders), and the day before a hotel check-in. Each goes out once (calendarBells/{key}).
async function once(db: Firestore, key: string, now: Date): Promise<boolean> {
  try { await db.doc(`${BELLS}/${key.replace(/\//g, "_")}`).create({ at: now.toISOString() }); return true; } catch { return false; }
}
export async function calendarBells(db: Firestore, now = new Date(), bell = notifyBell): Promise<number> {
  const prefsCache = new Map<string, CalPrefs>();
  const prefs = async (uid: string) => { if (!prefsCache.has(uid)) prefsCache.set(uid, await getPrefs(db, uid).catch(() => DEFAULT_PREFS)); return prefsCache.get(uid)!; };
  let n = 0;
  const nowIso = now.toISOString(), soon = plus(nowIso, 45 * MIN);
  // Sessions and per-minute calls.
  const [bk, pp] = await Promise.all([
    db.collection("bookings").where("startsAt", ">", nowIso).where("startsAt", "<=", soon).get(),
    db.collection("ppmSessions").where("startsAt", ">", nowIso).where("startsAt", "<=", soon).get(),
  ]);
  const calls: { key: string; uid: string; start: string; text: string; href: string }[] = [];
  for (const d of bk.docs) {
    const b = d.data();
    if (b.status !== "confirmed") continue;
    calls.push({ key: `bk_${d.id}_${b.clientUid}`, uid: b.clientUid, start: b.startsAt, text: `Your session with @${b.username}`, href: "/bookings" });
    calls.push({ key: `bk_${d.id}_${b.publisherUid}`, uid: b.publisherUid, start: b.startsAt, text: "Your 1:1 session", href: "/bookings" });
  }
  for (const d of pp.docs) {
    const s = d.data() as PpmSessionDoc;
    if (s.status !== "booked") continue;
    calls.push({ key: `pp_${d.id}_${s.viewerUid}`, uid: s.viewerUid, start: s.startsAt, text: `Your per-minute ${s.kind} call with @${s.hostUsername}`, href: `/ppm/${d.id}` });
    calls.push({ key: `pp_${d.id}_${s.hostUid}`, uid: s.hostUid, start: s.startsAt, text: `Your per-minute ${s.kind} call with @${s.viewerUsername}`, href: `/ppm/${d.id}` });
  }
  for (const c of calls) {
    if (!c.uid || !bellDue(c.start, (await prefs(c.uid)).bells.sessionsMin, now)) continue;
    if (!(await once(db, c.key, now))) continue;
    await bell({ uid: c.uid, type: "booking", linkHref: c.href, message: `${c.text} ${startsIn(c.start, now)} (Lagos time).` }).catch(() => {});
    n++;
  }
  // Event tickets, an hour before, for holders who aren't already reminded as "going" or "interested".
  const tk = await db.collection("tickets").where("startsAt", ">", nowIso).where("startsAt", "<=", plus(nowIso, 75 * MIN)).limit(2000).get();
  const seen = new Set<string>();
  for (const d of tk.docs) {
    const t = d.data();
    const key = `ev_${t.eventId}_${t.holderUid}`;
    if (t.status !== "valid" || seen.has(key)) continue;
    seen.add(key);
    if (!bellDue(t.startsAt, 60, now) || !(await prefs(t.holderUid)).bells.events) continue;
    if ((await db.doc(`eventRsvps/${t.eventId}_${t.holderUid}`).get()).exists) continue;
    if ((await db.doc(`events/${t.eventId}`).get()).data()?.cancelled) continue;
    if (!(await once(db, `${key}_${String(t.startsAt).replace(/[:.]/g, "")}`, now))) continue;
    await bell({ uid: t.holderUid, type: "event", linkHref: `/events/${t.eventId}`, message: `${t.eventTitle} ${startsIn(t.startsAt, now)}. Your ticket is in My tickets.` }).catch(() => {});
    n++;
  }
  // Hotel check-in tomorrow, from 9 AM Lagos.
  const tomorrow = addDays(lagosToday(now), 1);
  if (hotelBellDue(tomorrow, now)) {
    const hb = await db.collection("hotelBookings").where("checkIn", "==", tomorrow).limit(2000).get();
    for (const d of hb.docs) {
      const b = d.data() as HotelBooking;
      if (b.status !== "confirmed" || !b.uid || !(await prefs(b.uid)).bells.hotelDayBefore) continue;
      if (!(await once(db, `ht_${d.id}`, now))) continue;
      const h = (await db.doc(`hotels/${b.hotelId}`).get()).data() ?? {};
      await bell({ uid: b.uid, type: "hotel", linkHref: `/hotel/${b.code}`, message: `Tomorrow: check in at ${str(h.name) || "your hotel"} from ${str(h.policy?.checkIn) || "14:00"} (${b.roomName}, ${plural(b.nights, "night")}).` }).catch(() => {});
      n++;
    }
  }
  return n;
}

// The optional Monday email: the week ahead, for members who turned it on. A few per run; each once that Monday.
export async function weekAheadEmails(db: Firestore, now = new Date(), opts: { max?: number; send?: typeof sendEmail; email?: (uid: string) => Promise<string | null> } = {}): Promise<number> {
  if (!weekAheadDue(now)) return 0;
  const monday = lagosToday(now);
  const snap = await db.collection(SETTINGS).where("weekAhead", "==", true).limit(500).get();
  const send = opts.send ?? sendEmail, email = opts.email ?? getUserEmail;
  let n = 0;
  for (const d of snap.docs) {
    if (n >= (opts.max ?? 25)) break;
    if (d.get("weekAheadSentFor") === monday) continue;
    await d.ref.update({ weekAheadSentFor: monday });
    const to = await email(d.id).catch(() => null);
    if (!to) continue;
    const { entries } = await gatherCalendar(db, d.id, { from: monday, to: addDays(monday, 6) }, { now });
    await send({ to, subject: `Your week ahead on #NotesApp`, text: weekAheadText(entries, monday, SITE_URL), action: { label: "Open My Calendar", url: `${SITE_URL}/calendar` } }).catch(() => false);
    n++;
  }
  return n;
}
