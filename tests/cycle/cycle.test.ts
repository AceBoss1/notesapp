// My Cycle, the pure rules (lib/cycle.ts, lib/cycle-nana.ts): cycle length, the next period, ovulation and the fertile window, the
// four phases, pill mode, "early guess", the teen filter, the calendar, insights, red flags and the fallback tips.
// Run: npm run test:cycle → "ALL OK" (then the emulator test prints it again).
import assert from "node:assert/strict";
import {
  CycleError, DEFAULT_LENGTH, addDays, addPeriod, averageLength, calendar, cleanLength, cleanLog, cycleLengths, endPeriod, fallbackNote,
  forTeen, insights, isDay, nanaSummary, phaseOfDay, redFlags, ringOf, teenCalendar, todayView, type Log, type Period,
} from "../../lib/cycle";
import { cycleSystem } from "../../lib/cycle-nana";

const P = (...starts: string[]): Period[] => starts.map((start) => ({ start }));
const S = { cycleLength: null, pill: false, pillStart: null };

// Days.
assert.equal(isDay("2026-11-12"), true);
assert.equal(isDay("2026-02-30"), false);
assert.equal(isDay("12/11/2026"), false);
assert.equal(addDays("2026-10-30", 3), "2026-11-02");

// Length: the average of the last 6 logged cycles, else her setting, else 28, always 21 to 45.
assert.equal(averageLength([], null), DEFAULT_LENGTH);
assert.equal(averageLength([], 32), 32);
assert.equal(averageLength([], 60), 45);
assert.equal(averageLength([], 10), 21);
assert.equal(averageLength(P("2026-01-01", "2026-01-31"), 26), 30); // logs beat the setting
// Eight cycles logged: only the last 6 count (the two 40s at the start are left out).
const eight = P("2026-01-01", "2026-02-10", "2026-03-22", "2026-04-19", "2026-05-17", "2026-06-14", "2026-07-12", "2026-08-09", "2026-09-06");
assert.deepEqual(cycleLengths(eight).slice(-6), [28, 28, 28, 28, 28, 28]);
assert.equal(averageLength(eight, null), 28);
assert.equal(averageLength(P("2026-01-01", "2026-01-17", "2026-02-02"), null), 21); // 16-day cycles clamp to 21
assert.deepEqual(cycleLengths(P("2026-01-01", "2026-04-15")), []); // a 104-day gap is a missed log, not a cycle

// Today: day 18 of 28, luteal; next period in 11 days; ovulation 14 days before it; fertile window -5..+1.
const three = P("2026-08-31", "2026-09-28", "2026-10-26");
const t = todayView(three, S, "2026-11-12");
assert.equal(t.day, 18);
assert.equal(t.length, 28);
assert.equal(t.nextPeriod, "2026-11-23");
assert.equal(t.daysToNext, 11);
assert.equal(t.ovulation, "2026-11-09");
assert.equal(t.fertileStart, "2026-11-04");
assert.equal(t.fertileEnd, "2026-11-10");
assert.equal(t.phase, "luteal");
assert.equal(t.earlyGuess, false);
assert.equal(t.late, 0);
// Fewer than 3 periods: an early guess. None: not set up.
assert.equal(todayView(P("2026-10-26"), S, "2026-11-12").earlyGuess, true);
assert.equal(todayView([], S, "2026-11-12").setUp, false);
assert.equal(todayView([], S, "2026-11-12").phase, null);
// The four phases.
assert.equal(phaseOfDay(2, 28, 5), "menstrual");
assert.equal(phaseOfDay(8, 28, 5), "follicular");
assert.equal(phaseOfDay(14, 28, 5), "ovulation");
assert.equal(phaseOfDay(20, 28, 5), "luteal");
assert.equal(todayView(three, S, "2026-10-27").phase, "menstrual");
// Late: the next period is "any day now" and the late days count.
const late = todayView(three, S, "2026-11-30");
assert.equal(late.late, 7);
assert.equal(late.nextPeriod, "2026-11-30");
// A period with an end day shortens the menstrual phase.
assert.equal(todayView(endPeriod(three, "2026-10-26", "2026-10-28"), S, "2026-10-30").phase, "follicular");

// Pill mode: Active days 1 to 21, Break 22 to 28; no fertile fields shown as phases.
const pill = todayView(three, { cycleLength: null, pill: true, pillStart: "2026-11-01" }, "2026-11-12");
assert.equal(pill.phase, "active");
assert.equal(pill.day, 12);
assert.equal(pill.nextPeriod, "2026-11-22");
assert.equal(todayView(three, { cycleLength: null, pill: true, pillStart: "2026-11-01" }, "2026-11-24").phase, "break");
assert.deepEqual(ringOf(28, 5, true, false).map((r) => r.phase), ["active", "break"]);

// Teens: no ovulation, fertile window or pill mode, from the rules and again from the filter.
const teen = todayView(three, { cycleLength: null, pill: true, pillStart: "2026-11-01" }, "2026-11-12", true);
assert.equal(teen.pill, false);
assert.equal("ovulation" in teen, false);
assert.equal("fertileStart" in teen, false);
assert.equal(teen.phase, "luteal");
assert.ok(teen.ring.every((r) => r.phase !== "fertile" && r.phase !== "ovulation"));
assert.equal(todayView(three, S, "2026-11-09", true).phase, "luteal"); // ovulation day reads as luteal for a teen
const filtered = forTeen(t);
assert.equal("ovulation" in filtered, false);
assert.equal("fertileEnd" in filtered, false);
assert.ok(filtered.ring!.every((r) => r.phase !== "fertile" && r.phase !== "ovulation"));
assert.equal(forTeen({ ...t, phase: "ovulation" as const }).phase, "follicular");

// The calendar: logged, predicted, fertile and ovulation days; a teen's has only periods.
const cal = calendar(three, S, "2026-11-12", "2026-11-01", "2026-11-30");
assert.equal(cal["2026-11-09"], "ovulation");
assert.equal(cal["2026-11-04"], "fertile");
assert.equal(cal["2026-11-10"], "fertile");
assert.equal(cal["2026-11-23"], "predicted");
assert.equal(cal["2026-11-27"], "predicted");
assert.equal(cal["2026-11-28"], undefined);
assert.equal(calendar(three, S, "2026-11-12", "2026-10-01", "2026-10-31")["2026-10-26"], "period");
const tcal = calendar(three, S, "2026-11-12", "2026-11-01", "2026-11-30", true);
assert.ok(Object.values(tcal).every((k) => k === "period" || k === "predicted"));
assert.ok(Object.values(teenCalendar(cal)).every((k) => k === "period" || k === "predicted"));
const pcal = calendar(three, { cycleLength: null, pill: true, pillStart: "2026-11-01" }, "2026-11-12", "2026-11-01", "2026-11-30");
assert.equal(pcal["2026-11-21"], "active");
assert.equal(pcal["2026-11-22"], "break");

// Logging periods: a start within 10 days moves the same period; no future days.
assert.deepEqual(addPeriod(three, "2026-10-28", "2026-11-12").map((p) => p.start), ["2026-08-31", "2026-09-28", "2026-10-28"]);
assert.throws(() => addPeriod(three, "2026-11-20", "2026-11-12"), CycleError);
assert.throws(() => endPeriod(three, "2026-10-26", "2026-11-20"), CycleError);

// Cleaning: lengths 21 to 45 or none; a check-in keeps only known moods, caps numbers and refuses the future.
assert.equal(cleanLength(""), null);
assert.equal(cleanLength(30), 30);
assert.throws(() => cleanLength(50), CycleError);
const log = cleanLog({ day: "2026-11-12", moods: ["tired", "tired", "evil"], symptoms: ["Bloating", "  "], energy: "ok", pain: 9, water: 5, sleep: 6, flow: "x", note: " hi " }, "2026-11-12");
assert.deepEqual(log.moods, ["tired"]);
assert.deepEqual(log.symptoms, ["Bloating"]);
assert.equal(log.pain, 5);
assert.equal(log.flow, null);
assert.equal(log.note, "hi");
assert.throws(() => cleanLog({ day: "2026-11-13" }, "2026-11-12"), CycleError);
assert.throws(() => cleanLog({ day: "2026-11-12", note: "x".repeat(501) }, "2026-11-12"), CycleError);

// Insights: lengths, spread, regularity, top symptoms, moods before a period.
const L = (day: string, o: Partial<Log> = {}): Log => ({ day, moods: [], symptoms: [], energy: null, pain: null, water: null, sleep: null, flow: null, note: "", ...o });
const logs = [
  L("2026-10-22", { moods: ["tired", "irritable"], symptoms: ["Bloating"] }),
  L("2026-10-23", { moods: ["irritable"], symptoms: ["Bloating", "Cramps"] }),
  L("2026-11-01", { moods: ["happy"], symptoms: ["Headache"] }),
];
const ins = insights(three, logs);
assert.deepEqual(ins.lengths, [28, 28]);
assert.equal(ins.average, 28);
assert.equal(ins.spread, 0);
assert.equal(ins.regular, true);
assert.deepEqual(ins.topSymptoms[0], { name: "Bloating", count: 2 });
assert.deepEqual(ins.beforePeriod, ["irritable", "tired"]);
assert.ok(ins.moodCurve.length >= 2);

// Red flags.
assert.deepEqual(redFlags(three, logs, "2026-11-12"), []);
assert.ok(redFlags(P("2026-07-01"), [], "2026-11-12").some((f) => f.includes("3 months")));
const heavy = Array.from({ length: 7 }, (_, i) => L(addDays("2026-11-01", i), { flow: "heavy" }));
assert.ok(redFlags(three, heavy, "2026-11-12").some((f) => f.includes("heavy flow")));
assert.ok(redFlags(three, [L("2026-11-10", { pain: 5 }), L("2026-11-11", { pain: 5 })], "2026-11-12").some((f) => f.includes("severe pain")));

// What Nana is told: the phase and her logs, never a name; a teen's summary says so.
const sum = nanaSummary(t, logs, [], false);
assert.match(sum, /Cycle day 18 of about 28/);
assert.match(sum, /Luteal/);
assert.doesNotMatch(sum, /ovulat/i);
assert.match(nanaSummary(todayView(three, S, "2026-11-12", true), logs, [], true), /13 to 17/);
assert.match(cycleSystem(true), /trusted adult/);
assert.match(cycleSystem(true), /Do not discuss ovulation/);
assert.match(cycleSystem(false), /doctor or clinic/);
assert.match(cycleSystem(false), /not contraception/);

// The fallback when no AI is available: our own phase words, a doctor line for a red flag, a trusted adult for teens.
assert.match(fallbackNote(t, [], false), /Energy often dips/);
assert.match(fallbackNote(t, ["heavy flow for 7 days or more"], true), /doctor or clinic, and tell a trusted adult/);
assert.match(fallbackNote(late, [], false), /later than the estimate/);

console.log("ALL OK");
