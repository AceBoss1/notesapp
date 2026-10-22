// Team time rules (lib/time.ts) and hourly payroll lines (lib/payroll.ts). Run: npm run test:time → "ALL OK".
import assert from "node:assert/strict";
import {
  WEEK_MINUTES, approvedMinutesInMonth, canApprove, canSee, cleanLeave, cleanManual, cleanProject, confirmTimer, entryFromTimer, fridayNudgeDue, hm, clock,
  lagosMidnightAfter, leaveDays, locked, parseDuration, payFor, plusMin, settle, startTimer, teamCsv, weekRows, weekSummary, type Target, type Viewer,
} from "../../lib/time";
import { buildLines, cleanStaff, type PayStaff } from "../../lib/payroll";

const t0 = "2026-10-19T08:52:00.000Z"; // Monday 9:52 am Lagos
const work: Target = { kind: "item", refId: "i1", label: "Paid courses build", dept: "engineering", billable: true };

// Durations
assert.equal(parseDuration("2:30"), 150); assert.equal(parseDuration("1h30"), 90); assert.equal(parseDuration("1h"), 60); assert.equal(parseDuration("90m"), 90);
assert.equal(parseDuration("2.5"), 150); assert.equal(parseDuration("3"), 180); assert.equal(parseDuration(""), 0); assert.equal(parseDuration("abc"), null);
assert.equal(hm(65), "1h 05m"); assert.equal(hm(-30), "-0h 30m"); assert.equal(clock(150), "2:30");

// The timer: asks every 30 minutes; unanswered for 10 more, it stops at the last answer (so the last half hour isn't counted)
const t = startTimer("u1", work, "", t0);
assert.equal(t.checkAt, plusMin(t0, 30)); assert.equal(t.safeUntil, t0);
assert.equal(settle(t, plusMin(t0, 35)), null, "asking, still within the 10 minutes");
assert.deepEqual(settle(t, plusMin(t0, 41)), { endedAt: t0, flag: "no-answer" });
assert.equal(entryFromTimer(t, t0, "no-answer", t0), null, "never answered: nothing counted");
const t2 = confirmTimer(t, plusMin(t0, 31));
assert.equal(t2.safeUntil, plusMin(t0, 31)); assert.equal(t2.checkAt, plusMin(t0, 61));
assert.equal(settle(t2, plusMin(t0, 70)), null);
const s2 = settle(t2, plusMin(t0, 72));
assert.deepEqual(s2, { endedAt: plusMin(t0, 31), flag: "no-answer" });
const e2 = entryFromTimer(t2, s2!.endedAt, s2!.flag, plusMin(t0, 72))!;
assert.deepEqual([e2.minutes, e2.day, e2.flag, e2.source], [31, "2026-10-19", "no-answer", "timer"]);

// A meeting waits for its planned length, and its time counts if the check then goes unanswered
assert.throws(() => startTimer("u1", { ...work, kind: "meeting" }, "", t0), /planned/);
const m = startTimer("u1", { ...work, kind: "meeting" }, "", t0, 60);
assert.equal(m.checkAt, plusMin(t0, 60)); assert.equal(settle(m, plusMin(t0, 45)), null, "no check during the meeting");
assert.deepEqual(settle(m, plusMin(t0, 75)), { endedAt: plusMin(t0, 60), flag: "no-answer" });
assert.equal(entryFromTimer(m, plusMin(t0, 60), "no-answer", t0)!.minutes, 60);

// Midnight (Lagos): a timer kept alive past it stops there
const late = "2026-10-19T22:40:00.000Z"; // 11:40 pm Lagos
assert.equal(lagosMidnightAfter(late), "2026-10-19T23:00:00.000Z");
let lt = confirmTimer(startTimer("u1", work, "", late), plusMin(late, 15));
lt = confirmTimer(lt, plusMin(late, 25));
assert.equal(settle(lt, plusMin(late, 19)), null, "11:59 pm: still going");
assert.deepEqual(settle(lt, "2026-10-19T23:00:00.000Z"), { endedAt: "2026-10-19T23:00:00.000Z", flag: "midnight" });
assert.equal(entryFromTimer(lt, "2026-10-19T23:00:00.000Z", "midnight", late)!.minutes, 20);

// Input
assert.throws(() => cleanManual({ day: "2026-10-30", duration: "1h" }, "2026-10-22"), /hasn't come/);
assert.throws(() => cleanManual({ day: "2026-10-20", duration: "17h" }, "2026-10-22"), /16 hours/);
assert.deepEqual(cleanManual({ day: "2026-10-20", duration: "1:15" }, "2026-10-22"), { day: "2026-10-20", minutes: 75 });
assert.deepEqual(leaveDays({ from: "2026-10-23", to: "2026-10-27" }), ["2026-10-23", "2026-10-26", "2026-10-27"], "weekends skipped");
assert.throws(() => cleanLeave({ kind: "annual", from: "2026-10-24", to: "2026-10-25" }), /weekend/);
assert.equal(cleanLeave({ kind: "sick", from: "2026-10-20", to: "2026-10-20", counts: false }).counts, false);
assert.equal(cleanLeave({ kind: "sick", from: "2026-10-20", to: "2026-10-20" }).counts, true, "counts unless unticked");
assert.throws(() => cleanProject({ name: "X", billable: true, rate: "" }), /hourly rate/);
assert.equal(cleanProject({ name: "Digital Witch", billable: true, rate: "5,000", budgetHours: 60 }).rateKobo, 500000);

// Who sees and approves: self, team leads of the person's departments, super admins; never your own (the owner aside)
const ada = { uid: "ada", depts: ["engineering"] }, tola = { uid: "tola", depts: ["growth"] };
const lead: Viewer = { uid: "lead", superAdmin: false, owner: false, leads: ["engineering"] };
const boss: Viewer = { uid: "boss", superAdmin: true, owner: false, leads: [] };
const adaV: Viewer = { uid: "ada", superAdmin: false, owner: false, leads: ["engineering"] };
assert.equal(canSee(lead, ada), true); assert.equal(canSee(lead, tola), false); assert.equal(canSee(boss, tola), true);
assert.equal(canApprove(lead, ada), true); assert.equal(canApprove(lead, tola), false);
assert.equal(canApprove(adaV, ada), false, "a lead can't approve their own week");
assert.equal(canApprove({ ...boss, uid: "boss" }, { uid: "boss" }), false, "nor a super admin");
assert.equal(canApprove({ ...boss, uid: "boss", owner: true }, { uid: "boss" }), true, "the owner can");
assert.equal(locked("submitted"), true); assert.equal(locked("draft"), false);

// The week: grid rows, attendance (late after 9, leave that counts), shares
const day = (d: string, minutes: number, extra: object = {}) => ({ kind: "item" as const, refId: "i1", label: "Paid courses build", dept: "engineering", billable: true, day: d, minutes, startedAt: "", source: "manual" as const, ...extra });
const entries = [
  day("2026-10-19", 150, { source: "timer", startedAt: "2026-10-19T07:52:00.000Z" }), // in 8:52 am
  day("2026-10-20", 120, { source: "timer", startedAt: "2026-10-20T08:20:00.000Z" }), // in 9:20 am: late
  day("2026-10-20", -30, { source: "adjust" }),
  { ...day("2026-10-21", 60), kind: "other" as const, refId: "", label: "Support inbox", billable: false },
];
const rows = weekRows(entries);
assert.equal(rows.length, 2); assert.equal(rows[0].days["2026-10-20"], 90, "corrections net off"); assert.equal(rows[0].total, 240);
const sum = weekSummary("2026-10-19", entries, [{ from: "2026-10-22", to: "2026-10-22", kind: "sick", counts: true, status: "approved" }, { from: "2026-10-23", to: "2026-10-23", kind: "annual", counts: false, status: "approved" }], "2026-10-23");
assert.deepEqual([sum.tracked, sum.billable, sum.assigned, sum.target], [300, 240, 240, WEEK_MINUTES]);
assert.deepEqual([sum.daysPresent, sum.daysDue, sum.late, sum.leaveDays], [4, 5, 1, 2], "Thu sick leave counts; Fri annual leave doesn't");
assert.equal(sum.firstInAvg, "09:06");

// Pay by the hour, approved weeks only, split by month
assert.equal(payFor(90, 200000), 300000); assert.equal(payFor(-5, 200000), 0);
const month = [{ day: "2026-09-29", minutes: 120 }, { day: "2026-10-01", minutes: 60 }, { day: "2026-10-19", minutes: 240 }];
assert.equal(approvedMinutesInMonth(month, new Set(["2026-09-28"]), "2026-10"), 60, "the September week's October day");
assert.equal(approvedMinutesInMonth(month, new Set(["2026-09-28", "2026-10-19"]), "2026-10"), 300);
const staff = (o: Partial<PayStaff>): PayStaff => ({ id: "s", name: "A", role: "", basis: "monthly", monthlyKobo: 0, hourlyKobo: 0, payDay: 28, bankName: "", accountName: "", accountLast4: "", hasAccount: false, startedOn: "2026-01-01", active: true, note: "", createdAt: "", ...o });
const lines = buildLines([staff({ id: "m", name: "Monthly", monthlyKobo: 5_000_000 }), staff({ id: "h", name: "Hourly", basis: "hourly", hourlyKobo: 200000, uid: "u_h" }), staff({ id: "z", name: "No hours", basis: "hourly", hourlyKobo: 200000, uid: "u_z" })], "2026-10", new Map([["u_h", 300]]));
assert.deepEqual(lines.map((l) => [l.name, l.amountKobo, l.minutes]), [["Hourly", 1_000_000, 300], ["Monthly", 5_000_000, undefined]], "5 h × ₦2,000; no line without hours");
assert.equal(cleanStaff({ name: "B", hourly: "2,000", startedOn: "2026-10-01" }).hourlyKobo, 200000, "hourly is the default");
assert.throws(() => cleanStaff({ name: "B", startedOn: "2026-10-01" }), /hourly rate/);
assert.throws(() => cleanStaff({ name: "B", basis: "monthly", startedOn: "2026-10-01" }), /monthly pay/);

// Friday 4 pm Lagos
assert.equal(fridayNudgeDue(new Date("2026-10-23T14:59:00Z")), false); assert.equal(fridayNudgeDue(new Date("2026-10-23T15:00:00Z")), true); assert.equal(fridayNudgeDue(new Date("2026-10-22T16:00:00Z")), false);

// CSV
const csv = teamCsv([{ name: "Okafor, Ada", depts: "engineering", s: sum, status: "approved", payKobo: 1_000_000 }]);
assert.match(csv, /^Name,Departments,Week/); assert.match(csv, /"Okafor, Ada",engineering,2026-10-19,5\.00,4\.00,4\.00,4,5,1,2,approved,10000\.00/);

console.log("ALL OK");
