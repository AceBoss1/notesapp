// My Calendar on the server (lib/my-calendar-server.ts) against the Firestore emulator: every source read from where it lives (1:1
// sessions both ways, per-minute calls, hotel stays and a hotel's desk, event tickets, going and hosting, paid lives, interviews, money
// due), a source that fails leaving the rest, teen mode and child profiles, her choices, the private link (hashed, replaced at once,
// unknown → none), the feed (titles and times only, her kinds), and the bells and the Monday email, each sent once.
// Run: npm run test:my-calendar-server → "ALL OK".
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.ACCOUNT_DATA_KEY = randomBytes(32).toString("base64");
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { lagosAt, lagosMidnight, type CalEntry } from "../../lib/my-calendar";
import {
  SOURCES, calendarBells, feedFor, gatherCalendar, getPrefs, hashToken, linkView, newLink, savePrefs, stopLink, weekAheadEmails, type Source,
} from "../../lib/my-calendar-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const NOW = new Date("2026-11-14T08:40:00Z"); // Saturday 09:40 in Lagos
const NOV = { from: "2026-11-01", to: "2026-11-30" };
const ids = (es: CalEntry[]) => es.map((e) => e.id).sort();

async function seed() {
  const w = db.batch();
  const set = (p: string, d: Record<string, unknown>) => w.set(db.doc(p), d);
  set("users/alice", { username: "alice", displayName: "Alice Ade" });
  set("users/pub", { username: "tunde", displayName: "Tunde" });
  set("users/teen", { username: "teeny", teen: true });
  set("users/hotelo", { username: "osun" });
  // 1:1 sessions: alice booked @tunde at 10:00 today; a cancelled one stays out.
  set("bookings/NA-1", { reference: "NA-1", username: "tunde", date: "2026-11-14", slot: "10:00", minutes: 60, clientUid: "alice", publisherUid: "pub", clientEmail: "alice@example.test", amountKobo: 1500000, startsAt: "2026-11-14T09:00:00.000Z", status: "confirmed" });
  set("bookings/NA-2", { reference: "NA-2", username: "tunde", date: "2026-11-20", slot: "10:00", minutes: 30, clientUid: "alice", publisherUid: "pub", startsAt: "2026-11-20T09:00:00.000Z", status: "cancelled_by_client" });
  set("bookings/NA-3", { reference: "NA-3", username: "tunde", date: "2026-11-14", slot: "09:00", minutes: 30, clientUid: "teen", publisherUid: "pub", startsAt: "2026-11-14T08:00:00.000Z", status: "confirmed" });
  // A per-minute call tomorrow; one cancelled.
  set("ppmSessions/P1", { viewerUid: "alice", viewerName: "Alice Ade", viewerUsername: "alice", hostUid: "pub", hostName: "Tunde", hostUsername: "tunde", kind: "video", perMinuteKobo: 20000, holdMinutes: 30, holdKobo: 600000, date: "2026-11-15", slot: "11:00", startsAt: "2026-11-15T10:00:00.000Z", status: "booked", createdAt: "x" });
  set("ppmSessions/P2", { viewerUid: "alice", hostUid: "pub", hostUsername: "tunde", kind: "voice", holdMinutes: 15, startsAt: "2026-11-16T10:00:00.000Z", status: "cancelled" });
  // Hotel: alice's stay at Ọ̀ṣun Suites (16 to 19 November); the hotel's owner sees arrivals and departures.
  set("hotels/H1", { ownerUid: "hotelo", name: "Ọ̀ṣun Suites", branch: "", city: "Osogbo", address: "1 River Road", policy: { checkIn: "14:00", checkOut: "12:00" }, staff: {} });
  set("hotelBookings/B1", { hotelId: "H1", ownerUid: "hotelo", roomId: "R1", roomName: "Deluxe double", checkIn: "2026-11-16", checkOut: "2026-11-19", nights: 3, guests: 2, guestName: "Alice Ade", email: "alice@example.test", phone: "0800", unitPriceKobo: 4000000, totalKobo: 12000000, status: "confirmed", payMethod: "online", holdUntil: "x", code: "OSUN01", createdAt: "x", uid: "alice" });
  set("hotelBookings/B2", { hotelId: "H1", ownerUid: "hotelo", roomId: "R1", roomName: "Deluxe double", checkIn: "2026-11-22", checkOut: "2026-11-23", nights: 1, guests: 1, guestName: "Walk In", email: "w@example.test", phone: "0801", totalKobo: 4000000, status: "expired", payMethod: "online", holdUntil: "2026-11-01T00:00:00Z", code: "OSUN02", createdAt: "x" });
  // Events: two tickets for the meetup, a refunded ticket elsewhere, going to one, interested in another, hosting one.
  set("tickets/TK1", { code: "TK1", eventId: "E1", eventTitle: "Lagos Creators Meetup", typeId: "t", typeName: "Regular", priceKobo: 500000, holderUid: "alice", holderName: "Alice", reference: "r1", startsAt: "2026-11-21T09:00:00.000Z", endsAt: "2026-11-21T12:00:00.000Z", status: "valid", createdAt: "x" });
  set("tickets/TK2", { code: "TK2", eventId: "E1", eventTitle: "Lagos Creators Meetup", typeId: "t", typeName: "Regular", priceKobo: 500000, holderUid: "alice", holderName: "Alice", reference: "r1", startsAt: "2026-11-21T09:00:00.000Z", endsAt: "2026-11-21T12:00:00.000Z", status: "valid", createdAt: "x" });
  set("tickets/TK3", { code: "TK3", eventId: "E9", eventTitle: "Refunded show", typeId: "t", typeName: "Regular", holderUid: "alice", startsAt: "2026-11-22T09:00:00.000Z", endsAt: "2026-11-22T10:00:00.000Z", status: "refunded", createdAt: "x" });
  const ev = (title: string, start: string, extra: Record<string, unknown> = {}) => ({ hostUid: "pub", hostName: "Tunde", hostUsername: "tunde", title, description: "", startsAt: start, endsAt: new Date(Date.parse(start) + 2 * 3_600_000).toISOString(), nextStartAt: start, place: "Yaba Hub", state: "Lagos", city: "Lagos", liveUrl: "", repeat: "none", visibility: "public", going: 1, interested: 0, createdAt: "x", ...extra });
  set("events/E1", ev("Lagos Creators Meetup", "2026-11-21T09:00:00.000Z"));
  set("events/E2", ev("Book club", "2026-11-25T17:00:00.000Z", { communityName: "Readers" }));
  set("events/E3", ev("Maybe later", "2026-11-26T17:00:00.000Z"));
  set("events/E4", ev("Alice's workshop", "2026-11-27T09:00:00.000Z", { hostUid: "alice", hostUsername: "alice" }));
  set("events/E5", ev("Called off", "2026-11-28T09:00:00.000Z", { cancelled: true }));
  set("eventRsvps/E2_alice", { eventId: "E2", uid: "alice", status: "going", at: "x" });
  set("eventRsvps/E3_alice", { eventId: "E3", uid: "alice", status: "interested", at: "x" });
  set("eventRsvps/E5_alice", { eventId: "E5", uid: "alice", status: "going", at: "x" });
  // A paid live alice holds a ticket to.
  set("liveEvents/L1", { hostUid: "pub", hostName: "Tunde", hostUsername: "lwb", hostAvatar: "", title: "Pricing your craft", description: "", poster: "", startsAt: "2026-11-14T17:00:00.000Z", earlyUntil: "x", prices: {}, audience: "everyone", record: "off", lateWindowMin: 30, status: "scheduled", sold: 1, createdAt: "x" });
  set("liveTickets/L1_alice", { eventId: "L1", uid: "alice", holderName: "Alice", code: "ABCD1234", reference: "lr1", band: "normal", listKobo: 100000, discountPct: 0, paidKobo: 100000, status: "valid", createdAt: "x" });
  // An interview from Notes Jobs: alice applies, tunde interviews.
  set("interviews/I1", { kind: "job", applicationId: "app1", applicantUid: "alice", orgUid: "org1", org: "Kora", title: "Backend Engineer", date: "2026-11-19", time: "14:30", minutes: 45, mode: "video", startAt: "2026-11-19T13:30:00.000Z", endAt: "2026-11-19T14:15:00.000Z", roomId: "interview_I1", interviewerUids: ["pub"], createdBy: "pub", status: "scheduled", note: "Bring your portfolio", createdAt: "x" });
  set("interviews/I2", { kind: "job", applicationId: "app2", applicantUid: "alice", org: "Kora", title: "Old role", startAt: "2026-11-18T13:30:00.000Z", endAt: "2026-11-18T14:00:00.000Z", roomId: "interview_I2", interviewerUids: ["pub"], status: "cancelled" });
  // Business books: Chidi owes alice ₦12,500, due today; she owes a supplier, due on the 24th.
  set("bookParties/p1", { ownerUid: "alice", kind: "customer", name: "Chidi Okafor", balanceKobo: 1250000, createdAt: "x" });
  set("bookParties/p2", { ownerUid: "alice", kind: "supplier", name: "Mama Ngozi Rice", balanceKobo: 3000000, dueOn: "2026-11-24", createdAt: "x" });
  set("bookEntries/e1", { ownerUid: "alice", kind: "sale", source: "walkin", on: "2026-11-10", at: "x", by: "alice", lines: [{ title: "Ankara", qty: 1, unitKobo: 1250000 }], totalKobo: 1250000, paidKobo: 0, method: "credit", owesKobo: 1250000, settledKobo: 0, open: true, partyId: "p1", dueOn: "2026-11-14" });
  // The teen also had a debt recorded (books never show in teen mode).
  set("bookParties/tp", { ownerUid: "teen", kind: "customer", name: "Friend", balanceKobo: 100000, createdAt: "x" });
  set("bookEntries/te", { ownerUid: "teen", kind: "sale", source: "walkin", on: "2026-11-10", at: "x", by: "teen", lines: [], totalKobo: 100000, paidKobo: 0, method: "credit", owesKobo: 100000, settledKobo: 0, open: true, partyId: "tp", dueOn: "2026-11-14" });
  await w.commit();
}

async function main() {
  await seed();

  // ── Gathering: every source, from where it lives ──
  const a = await gatherCalendar(db, "alice", NOV, { now: NOW });
  assert.deepEqual(a.failed, []);
  assert.deepEqual(ids(a.entries), ["booking:NA-1", "event:E1", "event:E2", "event:E4", "interview:I1", "live:L1", "owe:p2", "owed:p1:2026-11-14", "ppm:P1", "stay:B1"].sort());
  const by = (id: string) => a.entries.find((e) => e.id === id)!;
  assert.equal(by("booking:NA-1").title, "1:1 with @tunde · 60 min"); assert.equal(by("booking:NA-1").end, "2026-11-14T10:00:00.000Z");
  assert.equal(by("ppm:P1").title, "Per-minute video call with @tunde"); assert.equal(by("ppm:P1").href, "/ppm/P1");
  const stay = by("stay:B1");
  assert.equal(stay.stay, true); assert.equal(stay.title, "Ọ̀ṣun Suites, Osogbo"); assert.equal(stay.start, lagosAt("2026-11-16", "14:00")); assert.equal(stay.end, lagosAt("2026-11-19", "12:00"));
  assert.equal(stay.sub, "Deluxe double · 3 nights · Confirmed ✓"); assert.equal(stay.href, "/hotel/OSUN01");
  assert.equal(by("event:E1").sub, "Ticket ✓ · 2 tickets", "two tickets, one entry");
  assert.equal(by("event:E2").sub, "Going · Readers");
  assert.match(by("event:E4").sub!, /^You're hosting/);
  assert.equal(by("live:L1").title, "Paid live: Pricing your craft"); assert.equal(by("live:L1").sub, "Ticket ✓ · @lwb");
  assert.equal(by("interview:I1").title, "Interview · Backend Engineer, Kora"); assert.equal(by("interview:I1").href, "/messages/interview_I1");
  assert.equal(by("interview:I1").sub, "Video call · from Notes Jobs");
  const owed = by("owed:p1:2026-11-14");
  assert.equal(owed.allDay, true); assert.equal(owed.start, lagosMidnight("2026-11-14")); assert.equal(owed.title, "Chidi owes you ₦12,500"); assert.equal(owed.feedTitle, "Money due from Chidi Okafor");
  assert.equal(by("owe:p2").title, "You owe Mama Ngozi Rice ₦30,000");
  // The publisher sees the same session and call from the other side, and the interview as an interviewer.
  const p = await gatherCalendar(db, "pub", NOV, { now: NOW });
  const pid = (id: string) => p.entries.find((e) => e.id === id);
  assert.equal(pid("booking:NA-1")!.title, "1:1 with @alice · 60 min"); assert.equal(pid("booking:NA-1")!.sub, "Booked with you");
  assert.equal(pid("ppm:P1")!.title, "Per-minute video call with @alice");
  assert.equal(pid("interview:I1")!.title, "Interviewing for Backend Engineer");
  assert.equal(pid("live:L1")!.sub, "You're hosting · 1 ticket sold");
  // The hotel's owner: arrivals and departures (not the expired hold).
  const h = await gatherCalendar(db, "hotelo", NOV, { now: NOW });
  assert.deepEqual(ids(h.entries), ["arrive:B1", "leave:B1"]);
  assert.equal(h.entries[0].title, "Arriving: Alice Ade · Deluxe double"); assert.equal(h.entries[0].feedTitle, "Arrival · Deluxe double (Ọ̀ṣun Suites)");
  // A narrower range only has what touches it; the stay covers the nights between.
  assert.deepEqual(ids((await gatherCalendar(db, "alice", { from: "2026-11-17", to: "2026-11-18" }, { now: NOW })).entries), ["stay:B1"]);

  // ── A source that fails leaves the rest ──
  const broken: Source = { id: "broken", label: "Hotel stays", read: async () => { throw new Error("down"); } };
  const partial = await gatherCalendar(db, "alice", NOV, { now: NOW, sources: [...SOURCES.filter((s) => s.id !== "hotelStays"), broken] });
  assert.deepEqual(partial.failed, ["Hotel stays"]);
  assert.ok(partial.entries.some((e) => e.id === "booking:NA-1") && !partial.entries.some((e) => e.id === "stay:B1"));

  // ── Teen mode and child profiles ──
  const t = await gatherCalendar(db, "teen", NOV, { now: NOW });
  assert.equal(t.mode.teen, true);
  assert.deepEqual(ids(t.entries), ["booking:NA-3"], "her session, never Business books money");
  const kid = await gatherCalendar(db, "kid_abc", NOV, { now: NOW });
  assert.equal(kid.mode.kid, true); assert.deepEqual(kid.entries, []);

  // ── Her choices ──
  assert.equal((await getPrefs(db, "alice")).feed.money, false, "money due is off by default");
  const saved = await savePrefs(db, "alice", { feed: { hotel: false }, bells: { sessionsMin: 5, weekAhead: true } }, NOW);
  assert.equal(saved.feed.hotel, false); assert.equal(saved.feed.sessions, true); assert.equal(saved.bells.sessionsMin, 5); assert.equal(saved.bells.weekAhead, true);
  assert.equal((await savePrefs(db, "alice", { bells: { sessionsMin: 60 } }, NOW)).bells.sessionsMin, 5, "an hour isn't offered; the last good value stays");

  // ── The private link ──
  assert.equal((await linkView(db, "alice")).has, false);
  const l1 = await newLink(db, "alice", NOW);
  const tok1 = l1.https!.match(/\/api\/calendar\/([A-Za-z0-9_-]{43})\.ics$/)![1];
  assert.ok(l1.webcal!.startsWith("webcal://"), "a webcal link from lib/host.ts");
  const stored = (await db.doc("myCalendar/alice").get()).data()!;
  assert.equal(stored.feedHash, hashToken(tok1));
  assert.ok(!JSON.stringify(stored).includes(tok1), "the token itself is never stored, only its hash (and an encrypted copy)");
  assert.equal((await db.doc(`calendarFeeds/${hashToken(tok1)}`).get()).data()!.uid, "alice");
  assert.equal((await linkView(db, "alice")).https, l1.https, "she can see her link again (ACCOUNT_DATA_KEY is set)");
  const feed = (await feedFor(db, tok1, NOW))!;
  assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(feed.includes("SUMMARY:1:1 with @tunde · 60 min") && feed.includes("SUMMARY:Interview · Backend Engineer\\, Kora"));
  assert.ok(!feed.includes("Ọ̀ṣun") && !feed.includes("Hotel stay"), "she turned hotel stays off");
  assert.ok(!feed.includes("₦") && !feed.includes("Chidi") && !feed.includes("Mama Ngozi"), "money due is off by default, and never an amount");
  assert.ok(!feed.includes("portfolio") && !feed.includes("LOCATION"), "titles and times only, never notes");
  await savePrefs(db, "alice", { feed: { money: true } }, NOW);
  const withMoney = (await feedFor(db, tok1, NOW))!;
  assert.ok(withMoney.includes("SUMMARY:Money due from Chidi Okafor") && withMoney.includes("SUMMARY:Pay Mama Ngozi Rice") && !withMoney.includes("₦"));
  // Make a new link: the old one stops at once.
  const l2 = await newLink(db, "alice", NOW);
  const tok2 = l2.https!.split("/").pop()!.replace(".ics", "");
  assert.notEqual(tok2, tok1);
  assert.equal(await feedFor(db, tok1, NOW), null, "the old link is gone");
  assert.equal((await db.doc(`calendarFeeds/${hashToken(tok1)}`).get()).exists, false);
  assert.ok(await feedFor(db, tok2, NOW));
  assert.equal(await feedFor(db, "A".repeat(43), NOW), null, "an unknown token");
  assert.equal(await feedFor(db, "short", NOW), null);
  await stopLink(db, "alice");
  assert.equal(await feedFor(db, tok2, NOW), null); assert.equal((await linkView(db, "alice")).has, false);

  // ── Bells: once each, only what nothing else sends ──
  const sent: { uid?: string | null; type: string; linkHref?: string; message: string }[] = [];
  const bell = async (b: { uid?: string | null; type: string; linkHref?: string; message: string }) => { sent.push(b); };
  // 09:39 Lagos: alice (5 min, her choice) isn't due for a 10:00 session yet; tunde (10 min by default) is.
  assert.equal(await calendarBells(db, new Date("2026-11-14T08:39:00Z"), bell as never), 1);
  assert.equal(sent[0].uid, "pub"); assert.equal(sent[0].type, "booking"); assert.match(sent[0].message, /^Your 1:1 session starts in about 21 minutes, at 10:00/);
  const at50 = new Date("2026-11-14T08:50:00Z");
  assert.equal(await calendarBells(db, at50, bell as never), 1, "alice now; tunde not again");
  assert.equal(sent[1].uid, "alice"); assert.match(sent[1].message, /^Your session with @tunde starts in about 10 minutes/);
  assert.equal(await calendarBells(db, new Date("2026-11-14T08:55:00Z"), bell as never), 0, "never twice");
  // Event ticket an hour before, for a holder not already reminded as going; turned off, nothing.
  sent.length = 0;
  const evAt = new Date("2026-11-21T08:10:00Z");
  assert.equal(await calendarBells(db, evAt, bell as never), 1);
  assert.equal(sent[0].type, "event"); assert.equal(sent[0].linkHref, "/events/E1"); assert.match(sent[0].message, /^Lagos Creators Meetup starts in about 50 minutes/);
  await db.doc("tickets/TK4").set({ code: "TK4", eventId: "E2", eventTitle: "Book club", holderUid: "alice", startsAt: "2026-11-25T17:00:00.000Z", endsAt: "x", status: "valid" });
  assert.equal(await calendarBells(db, new Date("2026-11-25T16:20:00Z"), bell as never), 0, "she's going to E2, so the events job already reminds her");
  await savePrefs(db, "pub", { bells: { events: false, sessionsMin: 0 } }, NOW);
  await db.doc("tickets/TK5").set({ code: "TK5", eventId: "E3", eventTitle: "Maybe later", holderUid: "pub", startsAt: "2026-11-26T17:00:00.000Z", endsAt: "x", status: "valid" });
  assert.equal(await calendarBells(db, new Date("2026-11-26T16:20:00Z"), bell as never), 0, "bells before events turned off");
  // Hotel check-in tomorrow, from 9 AM Lagos, once.
  sent.length = 0;
  assert.equal(await calendarBells(db, new Date("2026-11-15T07:00:00Z"), bell as never), 0, "8 AM: not yet");
  assert.equal(await calendarBells(db, new Date("2026-11-15T08:15:00Z"), bell as never), 1);
  assert.equal(sent[0].type, "hotel"); assert.match(sent[0].message, /^Tomorrow: check in at Ọ̀ṣun Suites from 14:00/);
  assert.equal(await calendarBells(db, new Date("2026-11-15T08:30:00Z"), bell as never), 0);
  // Per-minute call: both sides; tunde turned his off (the hotel bell went this morning).
  sent.length = 0;
  assert.equal(await calendarBells(db, new Date("2026-11-15T09:45:00Z"), bell as never), 1);
  assert.equal(sent[0].uid, "alice"); assert.equal(sent[0].linkHref, "/ppm/P1");

  // ── The Monday email: only for those who asked, once that Monday ──
  const mails: { to: string; subject: string; text: string }[] = [];
  const send = async (m: { to: string; subject: string; text: string }) => { mails.push(m); return true; };
  const email = async (uid: string) => `${uid}@example.test`;
  const monday = new Date("2026-11-16T06:30:00Z");
  assert.equal(await weekAheadEmails(db, new Date("2026-11-15T06:30:00Z"), { send: send as never, email }), 0, "Sunday");
  assert.equal(await weekAheadEmails(db, monday, { send: send as never, email }), 1);
  assert.equal(mails[0].to, "alice@example.test");
  assert.match(mails[0].text, /Monday 16 November\n {2}14:00 {2}Check in · Ọ̀ṣun Suites, Osogbo/);
  assert.match(mails[0].text, /Thursday 19 November/);
  assert.equal(await weekAheadEmails(db, new Date("2026-11-16T07:00:00Z"), { send: send as never, email }), 0, "once a Monday");
  console.log("ALL OK");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
