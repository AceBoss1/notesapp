// Schools on Naija Exam Prep (lib/prep-schools.ts). Run: npm run test:prep-schools → "ALL OK".
import assert from "node:assert/strict";
import { classCode, classCsv, cleanClass, cleanSchool, isCode, normaliseCode, studentLabel, studentWeek } from "../../lib/prep-schools";

let n = 0; const rand = () => [0.1, 0.5, 0.9][n++ % 3];
const code = classCode("Greenfield College, Abuja", "SS3 Gold", rand);
assert.match(code, /^GCA-SS3G-[A-Z0-9]{3}$/); assert.equal(isCode(code), true);
assert.equal(classCode("The School of Light", "JSS1", rand).slice(0, 3), "SLX", "skips the, of; pads");
assert.equal(normaliseCode("gca ss3g 7kq"), "GCA-SS3G-7KQ"); assert.equal(normaliseCode(" GCA-SS3G-7KQ "), "GCA-SS3G-7KQ");
assert.equal(studentLabel("Tobi Adeyemi"), "Tobi A."); assert.equal(studentLabel("Musa"), "Musa"); assert.equal(studentLabel("  "), "Student");
assert.throws(() => cleanSchool({ name: "GC", state: "FCT", leadName: "A B", leadRole: "Principal", students: 10 }), /full name/);
assert.throws(() => cleanSchool({ name: "Greenfield", state: "FCT", leadName: "A B", leadRole: "Teacher", students: 10 }), /role/);
assert.equal(cleanSchool({ name: "Greenfield College", state: "FCT", leadName: "Mrs Okonkwo", leadRole: "Proprietor", students: "120" }).students, 120);
assert.throws(() => cleanClass({ name: "SS3", exam: "gce" }), /exam/);
const w = studentWeek({ a: { ok: true, at: "2026-10-20T00:00:00Z", t: "jamb/maths/indices" }, b: { ok: false, at: "2026-10-20T00:00:00Z", t: "jamb/maths/indices" }, c: { ok: false, at: "2026-10-21T00:00:00Z", t: "jamb/maths/indices" }, d: { ok: true, at: "2026-10-21T00:00:00Z", t: "jamb/english/lexis" }, e: { ok: true, at: "2026-09-01T00:00:00Z", t: "jamb/maths/sets" } }, "2026-10-18T00:00:00Z");
assert.deepEqual(w, { answered: 4, right: 2, weakest: "indices" });
assert.equal(studentWeek({ d: { ok: true, at: "2026-10-21T00:00:00Z", t: "jamb/english/lexis" } }, "2026-10-18T00:00:00Z", ["maths"]).answered, 0, "only the class's subjects");
assert.match(classCsv([{ name: "Tobi A.", answered: 4, right: 2, weakest: "indices" }]), /Tobi A\.,4,2,50,indices/);
console.log("ALL OK");
