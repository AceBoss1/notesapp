// My Calendar's pure rules (lib/my-calendar.ts): Lagos days and times, merging and sorting, filters by kind, the day's agenda, the
// month's dots and hotel nights, who sees what, her choices, when a bell is due, and the .ics writer (RFC 5545).
// Run: npm run test:my-calendar → "ALL OK".
import assert from "node:assert/strict";
import {
  DEFAULT_PREFS, FEED_TOKEN_RE, addDays, agendaFor, allowedKinds, bellDue, buildIcs, cleanPrefs, countOn, dotsByDay, feedHttpsUrl, feedKinds,
  feedWebcalUrl, filterKinds, foldLine, hotelBellDue, icsEscape, icsFileName, icsUtc, inRange, lagosAt, lagosDay, lagosMidnight, lagosTime,
  mergeEntries, reminderText, startsIn, stayNights, time12, tokenFromPath, weekAheadDue, weekAheadText, whenText, type CalEntry,
} from "../../lib/my-calendar";

// ── Lagos days and times (UTC+1) ──
assert.equal(lagosDay("2026-11-14T23:30:00Z"), "2026-11-15", "half past midnight in Lagos is the next day");
assert.equal(lagosDay("2026-11-14T22:59:00Z"), "2026-11-14");
assert.equal(lagosTime("2026-11-19T13:30:00Z"), "14:30");
assert.equal(time12("2026-11-19T13:30:00Z"), "2:30 pm");
assert.equal(time12("2026-11-19T23:05:00Z"), "12:05 am");
assert.equal(lagosAt("2026-11-19", "14:00"), "2026-11-19T13:00:00.000Z");
assert.equal(lagosMidnight("2026-11-19"), "2026-11-18T23:00:00.000Z");
assert.equal(addDays("2026-11-30", 1), "2026-12-01"); assert.equal(addDays("2026-03-01", -1), "2026-02-28");

const E = (p: Partial<CalEntry> & Pick<CalEntry, "id" | "kind" | "start" | "end">): CalEntry => ({ title: p.id, feedTitle: p.id, href: "/x", ...p });
const tunde = E({ id: "booking:A1", kind: "session", title: "1:1 with @tunde · 60 min", start: "2026-11-14T09:00:00Z", end: "2026-11-14T10:00:00Z", sub: "You booked" });
const live = E({ id: "live:L1", kind: "live", title: "Paid live: Pricing your craft", start: "2026-11-14T17:00:00Z", end: "2026-11-14T18:00:00Z" });
const owed = E({ id: "owed:p1:2026-11-14", kind: "money", allDay: true, title: "Chidi owes you ₦12,500", feedTitle: "Money due from Chidi Okafor", start: lagosMidnight("2026-11-14"), end: lagosMidnight("2026-11-15") });
const stay = E({ id: "stay:H1", kind: "hotel", stay: true, title: "Ọ̀ṣun Suites, Osogbo", feedTitle: "Hotel stay · Ọ̀ṣun Suites, Osogbo", start: lagosAt("2026-11-16", "14:00"), end: lagosAt("2026-11-19", "12:00") });
const kora = E({ id: "interview:I1", kind: "interview", title: "Interview · Backend Engineer, Kora", start: "2026-11-19T13:30:00Z", end: "2026-11-19T14:15:00Z", where: "Video call link" });

// ── Merging: soonest first, the same thing from two sources once (the first wins) ──
const ticket = E({ id: "event:E1", kind: "event", title: "Lagos Creators Meetup", sub: "Ticket ✓", start: "2026-11-21T09:00:00Z", end: "2026-11-21T12:00:00Z" });
const goingToo = { ...ticket, sub: "Going" };
const all = mergeEntries([[kora, live], [ticket, owed], [goingToo, tunde, stay], [E({ id: "bad", kind: "event", start: "nope", end: "nope" })]]);
assert.deepEqual(all.map((e) => e.id), ["owed:p1:2026-11-14", "booking:A1", "live:L1", "stay:H1", "interview:I1", "event:E1"]);
assert.equal(all.find((e) => e.id === "event:E1")!.sub, "Ticket ✓", "the ticket, not the RSVP");
assert.equal(all.length, 6, "a broken entry is dropped");
assert.deepEqual(filterKinds(all, ["session", "live"]).map((e) => e.kind), ["session", "live"]);
assert.deepEqual(inRange(all, "2026-11-17", "2026-11-18").map((e) => e.id), ["stay:H1"], "a stay covers the days between");
assert.deepEqual(inRange(all, "2026-11-15", "2026-11-15").map((e) => e.id), [], "an all-day entry ends at midnight");

// ── The day's agenda: timed first by time, then all day; a stay on check-in and check-out days ──
const today = agendaFor(all, "2026-11-14");
assert.deepEqual(today.map((i) => [i.time, i.label]), [["10:00", "1:1 with @tunde · 60 min"], ["18:00", "Paid live: Pricing your craft"], ["All day", "Chidi owes you ₦12,500"]]);
assert.equal(countOn(all, "2026-11-14"), 3);
assert.deepEqual(agendaFor(all, "2026-11-19").map((i) => [i.time, i.label, i.at]), [["12:00", "Check out · Ọ̀ṣun Suites, Osogbo", "end"], ["14:30", "Interview · Backend Engineer, Kora", "start"]]);
assert.deepEqual(agendaFor(all, "2026-11-16").map((i) => i.label), ["Check in · Ọ̀ṣun Suites, Osogbo"]);
assert.equal(agendaFor(all, "2026-11-17").length, 0, "a night in between has no line, only shading");
const dots = dotsByDay(all);
assert.deepEqual(dots["2026-11-14"], ["session", "live", "money"]);
assert.deepEqual(dots["2026-11-19"], ["hotel", "interview"]);
assert.deepEqual([...stayNights(all)], ["2026-11-17", "2026-11-18"]);
assert.equal(whenText(kora), "Thu 19 Nov, 2:30–3:15 pm (WAT)");
assert.equal(whenText(tunde), "Sat 14 Nov, 10:00–11:00 am (WAT)");
assert.equal(whenText(owed), "Sat 14 Nov, all day");
assert.equal(whenText(stay), "Mon 16 Nov, 2:00 pm to Thu 19 Nov, 12:00 pm (WAT)");

// ── Who sees what ──
assert.deepEqual(allowedKinds({ teen: false, kid: false }), ["session", "hotel", "event", "live", "interview", "money"]);
assert.ok(!allowedKinds({ teen: true, kid: false }).includes("money"), "teen mode has no Business books money");
assert.deepEqual(allowedKinds({ teen: false, kid: true }), [], "a child profile has no calendar");

// ── Her choices: money due off by default; anything odd falls back ──
assert.equal(DEFAULT_PREFS.feed.money, false); assert.equal(DEFAULT_PREFS.feed.sessions, true);
assert.equal(DEFAULT_PREFS.bells.weekAhead, false); assert.equal(DEFAULT_PREFS.bells.sessionsMin, 10);
assert.ok(!feedKinds(DEFAULT_PREFS).includes("money"));
assert.deepEqual(feedKinds(cleanPrefs({ feed: { sessions: false, hotel: false, events: true, interviews: false, money: true } })), ["event", "live", "money"]);
const odd = cleanPrefs({ feed: { sessions: "yes", cycle: true }, bells: { sessionsMin: 60, weekAhead: true, events: 1 }, extra: 1 });
assert.equal(odd.feed.sessions, true, "not a boolean: unchanged"); assert.equal((odd.feed as Record<string, boolean>).cycle, undefined, "no unknown kinds");
assert.equal(odd.bells.sessionsMin, 10, "an hour isn't offered: bookings already remind an hour before"); assert.equal(odd.bells.weekAhead, true); assert.equal(odd.bells.events, true);
assert.equal(cleanPrefs({ bells: { sessionsMin: 0 } }).bells.sessionsMin, 0, "off");
assert.equal(cleanPrefs({ bells: { events: false } }, odd).bells.weekAhead, true, "a partial save keeps the rest");
assert.equal(reminderText(tunde, DEFAULT_PREFS), "10 min before 🔔");
assert.equal(reminderText(kora, DEFAULT_PREFS), "A day and an hour before 🔔");
assert.equal(reminderText(stay, cleanPrefs({ bells: { hotelDayBefore: false } })), "Off");

// ── Bells ──
const at = new Date("2026-11-14T08:40:00Z"); // 09:40 Lagos; tunde is at 10:00
assert.equal(bellDue(tunde.start, 10, at), true, "20 minutes left: within 10 minutes plus one 15-minute step");
assert.equal(bellDue(tunde.start, 10, new Date("2026-11-14T08:30:00Z")), false, "30 minutes left: the next run sends it");
assert.equal(bellDue(tunde.start, 0, at), false, "off");
assert.equal(bellDue(tunde.start, 10, new Date("2026-11-14T09:01:00Z")), false, "never after the start");
assert.equal(startsIn(tunde.start, at), "starts in about 20 minutes, at 10:00");
assert.equal(hotelBellDue("2026-11-16", new Date("2026-11-15T08:30:00Z")), true, "the day before, 9:30 Lagos");
assert.equal(hotelBellDue("2026-11-16", new Date("2026-11-15T07:30:00Z")), false, "not before 9 AM");
assert.equal(hotelBellDue("2026-11-17", new Date("2026-11-15T08:30:00Z")), false);
assert.equal(weekAheadDue(new Date("2026-11-16T06:30:00Z")), true, "Monday 7:30 Lagos");
assert.equal(weekAheadDue(new Date("2026-11-16T05:30:00Z")), false, "Monday 6:30");
assert.equal(weekAheadDue(new Date("2026-11-17T06:30:00Z")), false, "Tuesday");
const week = weekAheadText(all, "2026-11-16", "https://www.example.test");
assert.match(week, /Monday 16 November\n  14:00  Check in · Ọ̀ṣun Suites, Osogbo/);
assert.match(week, /Thursday 19 November\n  12:00  Check out/);
assert.match(week, /https:\/\/www\.example\.test\/calendar/);
assert.match(weekAheadText([], "2026-11-16", "https://x.test"), /Nothing booked this week/);

// ── The private link ──
assert.equal(tokenFromPath("abc.ics"), "abc");
assert.ok(FEED_TOKEN_RE.test("A".repeat(43))); assert.ok(!FEED_TOKEN_RE.test("A".repeat(42))); assert.ok(!FEED_TOKEN_RE.test(`${"A".repeat(42)}/`));
assert.equal(feedHttpsUrl("https://www.example.test/", "TOKEN"), "https://www.example.test/api/calendar/TOKEN.ics");
assert.equal(feedWebcalUrl("https://www.example.test", "TOKEN"), "webcal://www.example.test/api/calendar/TOKEN.ics");

// ── The .ics writer ──
assert.equal(icsEscape("a, b; c\\d\ne"), "a\\, b\\; c\\\\d\\ne");
assert.equal(icsUtc("2026-11-19T13:30:00.000Z"), "20261119T133000Z");
assert.equal(foldLine("short"), "short");
const long = `SUMMARY:${"Ọ̀ṣun ".repeat(30)}`;
const folded = foldLine(long);
for (const l of folded.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75, "each line at most 75 octets");
assert.equal(folded.split("\r\n").map((l, i) => (i ? l.slice(1) : l)).join(""), long, "unfolding gives the line back, no character split");
const opts = { now: new Date("2026-11-14T10:00:00Z"), host: "www.example.test", siteUrl: "https://www.example.test" };
const one = buildIcs([kora], opts);
assert.ok(one.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:"));
assert.ok(one.endsWith("END:VCALENDAR\r\n"));
for (const l of ["BEGIN:VEVENT", "UID:interview:I1@www.example.test", "DTSTAMP:20261114T100000Z", "DTSTART:20261119T133000Z", "DTEND:20261119T141500Z", "SUMMARY:Interview · Backend Engineer\\, Kora", "LOCATION:Video call link", "URL:https://www.example.test/x", "END:VEVENT"]) assert.ok(one.includes(`\r\n${l}\r\n`), l);
assert.ok(!/[^\r]\n/.test(one), "every line ends in CRLF");
const allDay = buildIcs([owed], opts);
assert.ok(allDay.includes("DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261115\r\n"), "all day: a date, ending the next day");
assert.ok(allDay.includes("SUMMARY:Chidi owes you ₦12\\,500"), "a single download is hers, with the amount");
const feed = buildIcs([owed, kora, stay], { ...opts, feed: true, name: "#NotesApp" });
assert.ok(!feed.includes("₦") && !feed.includes("12\\,500") && !feed.includes("12,500") && !feed.includes("owes you"), "the feed never carries an amount");
assert.ok(feed.includes("SUMMARY:Money due from Chidi Okafor"));
assert.ok(!feed.includes("LOCATION:"), "titles and times only");
assert.ok(feed.includes("X-WR-CALNAME:#NotesApp") && feed.includes("REFRESH-INTERVAL;VALUE=DURATION:PT1H"));
assert.equal((feed.match(/BEGIN:VEVENT/g) ?? []).length, 3);
assert.equal(icsFileName(tunde), "11-with-tunde-60-min.ics");
assert.equal(icsFileName({ title: "₦₦" }), "event.ics");
console.log("ALL OK");
