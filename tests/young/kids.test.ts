// Kids mode rules (lib/kids.ts). Run: npm run test:kids → "ALL OK".
import assert from "node:assert/strict";
import { cleanKid, cleanPin, isKidUid, kidMayOpen, playAdd, playLeft, weekReport } from "../../lib/kids";

const allow = { prep: true, academy: false, reading: false, life: true };
assert.equal(kidMayOpen("/kids", allow), true); assert.equal(kidMayOpen("/exam-prep/jamb", allow), true);
assert.equal(kidMayOpen("/exam-prep/paid", allow), false, "no buying"); assert.equal(kidMayOpen("/academy", allow), false, "not switched on");
assert.equal(kidMayOpen("/messages", allow), false); assert.equal(kidMayOpen("/profile/edit", allow), false); assert.equal(kidMayOpen("/life/play", allow), true);
assert.equal(kidMayOpen("/academy/teach", { ...allow, academy: true }), false);
assert.equal(isKidUid("kid_abc"), true); assert.equal(isKidUid("abc"), false);
assert.throws(() => cleanPin("12a4"), /4 digits/); assert.throws(() => cleanPin("1111"), /harder/); assert.equal(cleanPin("2580"), "2580");
const k = cleanKid({ nickname: "Ada-Star", birthMonth: 3, birthYear: 2015, pin: "2580", consent: true }, "2026-10-23");
assert.deepEqual(k.allow, { prep: true, academy: true, reading: false, life: false }, "practice and free courses on by default"); assert.equal(k.playMinutes, 30); assert.equal(k.birth, "2015-03");
assert.throws(() => cleanKid({ nickname: "Ada", birthMonth: 3, birthYear: 2012, pin: "2580", consent: true }, "2026-10-23"), /teen mode/);
assert.throws(() => cleanKid({ nickname: "Ada", birthMonth: 3, birthYear: 2015, pin: "2580" }, "2026-10-23"), /parent or guardian/);
assert.throws(() => cleanKid({ nickname: "1x", birthMonth: 3, birthYear: 2015, pin: "2580", consent: true }, "2026-10-23"), /nickname/);
assert.equal(playAdd(undefined, 1000), 0); assert.equal(playAdd(0, 1000), 0); assert.equal(playAdd(1000, 61_000), 60_000); assert.equal(playAdd(0 + 1, 10 * 60_000), 120_000, "a pause counts 2 minutes at most");
assert.equal(playLeft(29 * 60_000, 30), 60_000); assert.equal(playLeft(31 * 60_000, 30), 0);
const r = weekReport({ byQuestion: { a: { ok: true, at: "2026-10-20T10:00:00Z", t: "jamb/maths/Indices" }, b: { ok: false, at: "2026-10-21T10:00:00Z", t: "jamb/maths/Indices" }, c: { ok: true, at: "2026-10-01T10:00:00Z", t: "jamb/english/Lexis" } }, mocks: [{ subject: "Maths", score: 30, total: 40, at: "2026-10-22T10:00:00Z" }] }, "2026-10-18T17:00:00Z");
assert.deepEqual([r.answered, r.right, r.topics[0].topic, r.topics[0].answered, r.mocks.length], [2, 1, "Indices", 2, 1]);
console.log("ALL OK");
