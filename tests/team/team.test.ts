// Team hub rules (lib/team.ts): several people on one item, monthly items. Run: npm run test:team → "ALL OK".
import assert from "node:assert/strict";
import { TeamError, addMonths, buildMorningSummary, cleanItem, isOwner, nextMonthly, ownerNames, ownersOf, workReminders, type TeamItem } from "../../lib/team";

// Several people, one person (older callers) or no one.
assert.deepEqual(cleanItem({ title: "Ship", ownerUids: ["a", "b", "a", " ", 7] }, false).ownerUids, ["a", "b"]);
assert.equal(cleanItem({ title: "Ship", ownerUids: ["b", "a"] }, false).ownerUid, "b", "the first person is also the single owner");
assert.deepEqual(cleanItem({ title: "Ship", ownerUid: "a" }, false).ownerUids, ["a"], "a single owner becomes a list of one");
assert.deepEqual(cleanItem({ title: "Ship", ownerUids: [] }, false), { ...cleanItem({ title: "Ship", ownerUids: [] }, false), ownerUid: "", ownerUids: [] });
assert.equal("ownerUids" in cleanItem({ status: "doing" }, true), false, "an update that doesn't mention people leaves them alone");
assert.equal(cleanItem({ title: "Ship", ownerUids: Array.from({ length: 80 }, (_, k) => `u${k}`) }, false).ownerUids!.length, 50, "capped");
assert.equal(cleanItem({ title: "Ship", repeat: "monthly" }, false).repeat, "monthly");
assert.throws(() => cleanItem({ title: "Ship", repeat: "hourly" }, false), TeamError);

// Older items with only ownerUid still count.
assert.deepEqual(ownersOf({ ownerUid: "a" }), ["a"]);
assert.deepEqual(ownersOf({ ownerUid: "a", ownerUids: ["b", "c"] }), ["b", "c"]);
assert.deepEqual(ownersOf({ ownerUid: "" }), []);
assert.ok(isOwner({ ownerUid: "b", ownerUids: ["b", "c"] }, "c"));
const name = (u: string) => ({ a: "Ada", b: "Tunde", c: "Chi", d: "Dayo" })[u] ?? "?";
assert.equal(ownerNames({ ownerUid: "a", ownerUids: ["a"] }, name), "Ada");
assert.equal(ownerNames({ ownerUid: "a", ownerUids: ["a", "b"] }, name), "Ada and Tunde");
assert.equal(ownerNames({ ownerUid: "a", ownerUids: ["a", "b", "c"] }, name), "Ada, Tunde and 1 other");
assert.equal(ownerNames({ ownerUid: "a", ownerUids: ["a", "b", "c", "d"] }, name), "Ada, Tunde and 2 others");

// Reminders go out when anyone is assigned.
assert.deepEqual(workReminders({ status: "todo", due: "2026-10-20", ownerUid: "", ownerUids: ["b"], remindedDays: [] }, "2026-10-19"), [3, 1]);
assert.deepEqual(workReminders({ status: "todo", due: "2026-10-20", ownerUid: "", ownerUids: [], remindedDays: [] }, "2026-10-19"), []);

// Months: the same day, or the last day of a shorter month.
assert.equal(addMonths("2026-10-17", 1), "2026-11-17");
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
assert.equal(addMonths("2026-12-05", 1), "2027-01-05");
assert.equal(addMonths("2026-08-31", 12), "2027-08-31");
// Done on time → next month; done late → the next monthly date after today; never today.
assert.equal(nextMonthly("2026-11-02", "2026-11-01"), "2026-12-02");
assert.equal(nextMonthly("2026-11-02", "2027-01-10"), "2027-02-02");
assert.equal(nextMonthly("2026-11-02", "2026-12-02"), "2027-01-02");
assert.equal(nextMonthly("", "2026-10-17"), "2026-11-17", "no date yet: a month from today");

// The morning summary lists a shared item for each person on it.
const item = (o: Partial<TeamItem>): TeamItem => ({ id: "x", title: "Shared", detail: "", ownerUid: "a", ownerUids: ["a", "b"], status: "todo", horizon: "today", due: "", blockedReason: "", decisionQuestion: "", decidedNote: "", createdByUid: "a", createdAt: "2026-10-17T08:00:00Z", updatedAt: "", doneAt: "", ...o });
for (const uid of ["a", "b"]) {
  const d = buildMorningSummary({ name: name(uid), uid, today: "2026-10-17", items: [item({})], signals: [], milestones: [], meetingsToday: [], nameOf: name, link: "x" });
  assert.ok(d.text.includes("- Shared"), `${uid} sees the shared item`);
}
assert.ok(!buildMorningSummary({ name: "Chi", uid: "c", today: "2026-10-17", items: [item({})], signals: [], milestones: [], meetingsToday: [], nameOf: name, link: "x" }).text.includes("Your day"));

console.log("ALL OK");
