// Young members' age rules (lib/young.ts). Run: npm run test:young → "ALL OK".
import assert from "node:assert/strict";
import { ADULT_AT, ageOn, cleanBirth, cleanChoice, graduationDue, keepFlags, teenBirth, turnsOn } from "../../lib/young";

assert.equal(ageOn("2010-11", "2026-10-23"), 15); assert.equal(ageOn("2010-11", "2026-11-01"), 16, "from the first of the birth month");
assert.equal(ageOn("2008-10", "2026-10-01"), 18); assert.equal(turnsOn("2008-10", ADULT_AT), "2026-10-01");
assert.equal(cleanBirth("3", "2010"), "2010-03"); assert.throws(() => cleanBirth(13, 2010), /month and year/); assert.throws(() => cleanBirth(3, ""), /month and year/);
assert.equal(teenBirth(11, 2010, "2026-10-23"), "2010-11");
assert.throws(() => teenBirth(10, 2008, "2026-10-23"), /18 or older/); assert.throws(() => teenBirth(11, 2013, "2026-10-23"), /child profile/);
assert.equal(teenBirth(10, 2013, "2026-10-23"), "2013-10", "13 this month");
// Turning 18
assert.equal(graduationDue("2008-10", "2026-10-01"), true); assert.equal(graduationDue("2008-11", "2026-10-31"), false); assert.equal(graduationDue(undefined, "2026-10-01"), false);
assert.throws(() => cleanChoice({ search: true }), /Terms and Privacy/);
assert.deepEqual(cleanChoice({ consent: true, search: true, messages: "yes" }), { search: true, messages: false, replies: false, realName: false, offers: false }, "only a real yes turns one on");
assert.deepEqual(keepFlags(cleanChoice({ consent: true, search: true })), { keepHidden: false, keepDmFollowers: true, keepRepliesFollowers: true });
console.log("ALL OK");
