// The public profile's stats line, Work rows and bio cut (lib/profile-view.ts). Run: npm run test:profile-view
import assert from "node:assert/strict";
import { bioIsLong, compactCount, countText, joinedText, workRows } from "../../lib/profile-view";

assert.equal(compactCount(0), "0");
assert.equal(compactCount(999), "999");
assert.equal(compactCount(1000), "1K");
assert.equal(compactCount(1234), "1.2K");
assert.equal(compactCount(7_150), "7.1K");
assert.equal(compactCount(9_999), "9.9K"); // never rounds up past what they have
assert.equal(compactCount(18_000), "18K");
assert.equal(compactCount(1_250_000), "1.2M");
assert.equal(compactCount(-3), "0");
assert.equal(countText(1, "follower", "followers"), "1 follower");
assert.equal(countText(3700, "follower", "followers"), "3.7K followers");

assert.equal(joinedText(undefined), "");
assert.equal(joinedText("not a date"), "");
assert.match(joinedText("2026-10-12T09:00:00.000Z"), /^Joined October 2026$/);

assert.deepEqual(workRows(null), []);
assert.deepEqual(workRows({ jobTitle: "CEO", workplace: "Acme", industry: "tech" }), [
  { kind: "role", text: "CEO at Acme", key: "role" },
  { kind: "industry", text: "Technology or software", key: "industry" },
]);
assert.deepEqual(workRows({ workplace: "Acme", industry: "other" }), [{ kind: "role", text: "Acme", key: "role" }]); // "Something else" says nothing
assert.deepEqual(workRows({ industry: "made-up" }), []);
// Other roles, now and past (owner, 22 Nov 2026): current first, then the latest; tidied; bad months dropped; at most ten.
assert.deepEqual(workRows({ experience: [
  { title: "Lecturer", org: "Unilag", from: "2015-01", to: "2019-06", current: false },
  { title: "Lead", org: "Precheks", from: "2024-02", to: "2025-01", current: true },
  { title: "Volunteer", org: "", from: "", to: "", current: false },
  { title: "", org: "" },
  { title: "<i>Bad</i>", org: "X", from: "2020-13", to: "nope", current: false },
] }), [
  { kind: "now", text: "Lead at Precheks", key: "x0", sub: "Feb 2024 – now" },
  { kind: "past", text: "Lecturer at Unilag", key: "x1", sub: "Past · Jan 2015 – Jun 2019" },
  { kind: "past", text: "Volunteer", key: "x2", sub: "Past" }, // no dates: kept in the order typed
  { kind: "past", text: "Bad at X", key: "x3", sub: "Past" },
]);
assert.equal(workRows({ experience: Array.from({ length: 30 }, (_, i) => ({ title: `R${i}`, org: "", from: "", to: "", current: false })) }).length, 10);
assert.deepEqual(workRows({ experience: "not a list" }), []);

assert.equal(bioIsLong("Therapist in Abuja."), false);
assert.equal(bioIsLong("a".repeat(111)), true);
assert.equal(bioIsLong("one\ntwo\nthree"), true);

console.log("profile-view: ok");
