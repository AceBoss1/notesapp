// Meetings (lib/meetings.ts). Pure. Run: npm run test:events-discover (with event-kit) → "ALL OK".
import assert from "node:assert/strict";
import { SEAT_PRICE_MIN_KOBO, cleanMeeting, forViewer, nextFrom, roomOpenable, seatNo, seatsLeft, type MeetingDoc } from "../../lib/meetings";

const NOW = new Date("2026-11-26T09:00:00.000Z");
const base = { title: "Founder office hours", startsAt: "2026-11-30T18:00:00.000Z", endsAt: "2026-11-30T19:00:00.000Z", format: "online", link: "https://meet.google.com/abc", seats: 12, priceKobo: 200_000 };
const ok = (v: object, booked = 0) => { const r = cleanMeeting(v, NOW, "u_host", booked); assert.ok(r.ok, JSON.stringify(r)); return r.ok ? r.meeting : null!; };
const no = (v: object, re: RegExp, booked = 0) => { const r = cleanMeeting(v, NOW, "u_host", booked); assert.ok(!r.ok); if (!r.ok) assert.match(r.error, re); };

const m = ok(base);
assert.equal(m.where.format, "online");
assert.equal(m.where.link, "https://meet.google.com/abc");
assert.equal(m.priceKobo, 200_000);
assert.equal(m.visibility, "public");
assert.equal(ok({ ...base, link: "" }).where.online, "notesapp", "no link: the #NotesApp meeting room");
no({ ...base, online: "link", link: "" }, /online link/);
assert.equal(ok({ ...base, online: "notesapp" }).where.link, "", "the room needs no link");
assert.equal(ok({ ...base, format: "in_person", place: "Co-Creation Hub, Yaba", city: "Lagos", state: "Lagos", link: "" }).where.link, "");
no({ ...base, format: "in_person", place: "" }, /where it is/);
const hy = ok({ ...base, format: "hybrid", place: "The Library, Ikeja", city: "Lagos" });
assert.equal(hy.where.format, "hybrid");
assert.ok(hy.where.link && hy.where.place);
no({ ...base, seats: 1 }, /Seats: 2 to 50/);
no({ ...base, seats: 51 }, /Seats/);
no({ ...base, seats: 3 }, /5 seats are already booked/, 5);
no({ ...base, priceKobo: SEAT_PRICE_MIN_KOBO - 100 }, /₦500/);
assert.equal(ok({ ...base, priceKobo: 0 }).priceKobo, 0, "free");
no({ ...base, startsAt: "2026-11-20T10:00:00.000Z" }, /passed/);
no({ ...base, endsAt: "2026-11-30T17:00:00.000Z" }, /end after/);
no({ ...base, endsAt: "2026-12-01T08:00:00.000Z" }, /12 hours/);
no({ ...base, title: "x" }, /name/);
assert.equal(ok({ ...base, visibility: "unlisted" }).visibility, "unlisted");

const doc: MeetingDoc = { ...m, hostUid: "u_host", hostName: "Host", hostUsername: "host", booked: 11, createdAt: NOW.toISOString() };
assert.equal(seatsLeft(doc), 1);
assert.equal(seatNo(doc, "u_a", NOW, false), null);
assert.match(String(seatNo(doc, "u_a", NOW, true)), /already have a seat/);
assert.match(String(seatNo({ ...doc, booked: 12 }, "u_a", NOW, false)), /full/);
assert.match(String(seatNo(doc, "u_host", NOW, false)), /your meeting/);
assert.match(String(seatNo({ ...doc, cancelled: true }, "u_a", NOW, false)), /cancelled/);
assert.match(String(seatNo(doc, "u_a", new Date("2026-11-30T18:30:00.000Z"), false)), /started/);
// The link only for people with a seat (and the host).
assert.equal(forViewer(doc, true).where.link, "https://meet.google.com/abc");
const out = forViewer(doc, false);
assert.equal(out.where.link, "");
assert.equal(out.linkHidden, true);
assert.equal(forViewer({ ...doc, where: { ...doc.where, format: "in_person", link: "", online: "" } }, false).linkHidden, undefined);

// The next one, a week on; the room's window.
assert.deepEqual(nextFrom({ startsAt: "2026-11-30T18:00:00.000Z", endsAt: "2026-11-30T19:00:00.000Z" }, NOW), { startsAt: "2026-12-07T18:00:00.000Z", endsAt: "2026-12-07T19:00:00.000Z" });
assert.deepEqual(nextFrom({ startsAt: "2026-11-02T18:00:00.000Z", endsAt: "2026-11-02T20:00:00.000Z" }, NOW).startsAt, "2026-11-30T18:00:00.000Z", "a past one moves to the next week to come");
const room = { ...doc, where: { ...doc.where, online: "notesapp" as const, link: "" } };
assert.equal(roomOpenable(room, new Date("2026-11-30T17:20:00.000Z")), false);
assert.equal(roomOpenable(room, new Date("2026-11-30T17:31:00.000Z")), true, "30 minutes before");
assert.equal(roomOpenable(room, new Date("2026-11-30T19:01:00.000Z")), false, "after the end");
assert.equal(roomOpenable(doc, new Date("2026-11-30T18:00:00.000Z")), false, "a link meeting has no room");
console.log("ALL OK");
