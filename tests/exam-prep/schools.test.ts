// Schools on Naija Exam Prep (lib/prep-schools.ts). Run: npm run test:prep-schools → "ALL OK".
import assert from "node:assert/strict";
import { classCode, classCsv, cleanClass, cleanSchool, cleanSeats, isCode, normaliseCode, seatsLeft, studentLabel, studentWeek } from "../../lib/prep-schools";
import { recomputeExpiry } from "../../lib/exam-prep";

let n = 0; const rand = () => [0.1, 0.5, 0.9][n++ % 3];
const code = classCode("Greenfield College, Abuja", "SS3 Gold", rand);
assert.match(code, /^GCA-SS3G-[A-Z0-9]{3}$/); assert.equal(isCode(code), true);
assert.equal(classCode("The School of Light", "JSS1", rand).slice(0, 3), "SLX", "skips the, of; pads");
assert.equal(normaliseCode("gca ss3g 7kq"), "GCA-SS3G-7KQ"); assert.equal(normaliseCode(" GCA-SS3G-7KQ "), "GCA-SS3G-7KQ");
assert.equal(studentLabel("Tobi Adeyemi"), "Tobi A."); assert.equal(studentLabel("Musa"), "Musa"); assert.equal(studentLabel("  "), "Student");
assert.throws(() => cleanSchool({ name: "GC", state: "FCT", leadName: "A B", leadRole: "Principal", students: 10 }), /full name/);
assert.throws(() => cleanSchool({ name: "Greenfield", state: "FCT", leadName: "A B", leadRole: "Teacher", students: 10 }), /role/);
assert.equal(cleanSchool({ name: "Greenfield College", state: "FCT", leadName: "Mrs Okonkwo", leadRole: "Proprietor", students: "120" }).students, 120);
assert.throws(() => cleanClass({ name: "SS3", exam: "gce", seats: 40 }), /exam/);
// the school pack's places: the class size is required, 1 to 300, and never below who has joined
assert.throws(() => cleanClass({ name: "SS3 Gold", exam: "jamb" }), /How many students/);
assert.equal(cleanClass({ name: "SS3 Gold", exam: "jamb", seats: "41" }).seats, 41);
assert.throws(() => cleanSeats(301), /1 to 300/); assert.throws(() => cleanSeats(30, 35), /35 students have already joined/);
assert.equal(seatsLeft({ seats: 41, members: 38 }), 3); assert.equal(seatsLeft({ seats: 2, members: 5 }), 0);
// a school place that ended no longer counts towards the expiry; a paid pack still does
assert.equal(recomputeExpiry({ uid: "u", pack: "jamb", startedAt: "2026-10-01T00:00:00.000Z", expiresAt: "x", sources: [
  { kind: "payment", ref: "p1", months: 12, at: "2026-10-01T00:00:00.000Z" }, { kind: "school", ref: "school:c1", months: 12, at: "2026-10-05T00:00:00.000Z", endedAt: "2026-11-01T00:00:00.000Z" }] }), "2027-10-01T00:00:00.000Z");
const w = studentWeek({ a: { ok: true, at: "2026-10-20T00:00:00Z", t: "jamb/maths/indices" }, b: { ok: false, at: "2026-10-20T00:00:00Z", t: "jamb/maths/indices" }, c: { ok: false, at: "2026-10-21T00:00:00Z", t: "jamb/maths/indices" }, d: { ok: true, at: "2026-10-21T00:00:00Z", t: "jamb/english/lexis" }, e: { ok: true, at: "2026-09-01T00:00:00Z", t: "jamb/maths/sets" } }, "2026-10-18T00:00:00Z");
assert.deepEqual(w, { answered: 4, right: 2, weakest: "indices" });
assert.equal(studentWeek({ d: { ok: true, at: "2026-10-21T00:00:00Z", t: "jamb/english/lexis" } }, "2026-10-18T00:00:00Z", ["maths"]).answered, 0, "only the class's subjects");
assert.match(classCsv([{ name: "Tobi A.", answered: 4, right: 2, weakest: "indices" }]), /Tobi A\.,4,2,50,indices/);
console.log("ALL OK");
