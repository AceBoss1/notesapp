// Plan limits and switches set in Admin → Limits (lib/limits.ts), and the course rules read from them (lib/courses.ts).
// Run: npm run test:limits → "ALL OK".
import assert from "node:assert/strict";
import { LIMITS, LIMIT_TIERS, capOf, cleanOverrides, limitFor, limitTable, planHas, plansWith } from "../../lib/limits";
import { TIERS } from "../../lib/tiers";
import {
  GB, MAX_COURSES_PER_MEMBER, canMakeCourses, canSellCourses, canTeachFreeCourses, canUploadVideo, courseCap, onPlans, uploadRoomProblem,
} from "../../lib/courses";

// ── every row is well formed, and its defaults sit within its own range ──
assert.equal(new Set(LIMITS.map((l) => l.key)).size, LIMITS.length, "keys are unique");
for (const l of LIMITS) {
  for (const t of LIMIT_TIERS) assert.ok(l.defaults[t] >= l.min && l.defaults[t] <= l.max, `${l.key} ${t} default in range`);
  if (l.kind === "switch") assert.deepEqual([l.min, l.max], [0, 1], `${l.key} is on/off`);
}
assert.deepEqual(cleanOverrides(limitTable()), {}, "the defaults save as no overrides");

// ── the course switches default to the ladder in lib/tiers.ts, which is what shipped in v0.55.0 ──
const on = (k: "freeCourses" | "paidCourses" | "courseVideoUploads") => LIMIT_TIERS.filter((t) => planHas(k, t));
assert.deepEqual(on("freeCourses"), ["basic", "pro", "business", "enterprise"], "free courses: every publishing plan");
assert.deepEqual(on("paidCourses"), ["pro", "business", "enterprise"], "paid courses: Pro and up");
assert.deepEqual(on("courseVideoUploads"), ["business", "enterprise"], "uploaded video: Business and Enterprise");
for (const t of TIERS) {
  assert.equal(planHas("freeCourses", t.tier), !!t.freeCourses);
  assert.equal(planHas("paidCourses", t.tier), !!t.paidCourses);
  assert.equal(planHas("courseVideoUploads", t.tier), !!t.courseVideoUploads);
}
// the old hard-coded checks, unchanged by default
for (const t of LIMIT_TIERS) {
  assert.equal(canSellCourses(t), t === "pro" || t === "business" || t === "enterprise", `canSellCourses(${t})`);
  assert.equal(canUploadVideo(t), t === "business" || t === "enterprise", `canUploadVideo(${t})`);
  assert.equal(canTeachFreeCourses(t), t !== "standard");
}
assert.equal(canSellCourses(undefined), false); assert.equal(canSellCourses("nonsense"), false, "an unknown plan reads as Free Standard");
// numbers: 30 courses a member, 90 an organisation, and no storage or video-hour cap
for (const t of LIMIT_TIERS) {
  assert.equal(courseCap(t, false), MAX_COURSES_PER_MEMBER); assert.equal(courseCap(t, true), MAX_COURSES_PER_MEMBER * 3);
  assert.equal(capOf("courseStorageGB", t), Infinity); assert.equal(capOf("courseVideoHours", t), Infinity);
}
assert.equal(MAX_COURSES_PER_MEMBER, 30);

// ── copy comes from the settings, never a fixed list ──
assert.equal(plansWith("paidCourses"), "Pro, Business and Enterprise");
assert.equal(plansWith("courseVideoUploads"), "Business and Enterprise");
assert.equal(plansWith("freeCourses"), "Basic, Pro, Business and Enterprise", "Free Standard can't publish, so it's never named");
assert.equal(onPlans("paidCourses"), "on Pro, Business and Enterprise plans");
assert.equal(onPlans("courseVideoUploads", { courseVideoUploads: { business: 0 } }), "on the Enterprise plan");
assert.equal(onPlans("paidCourses", { paidCourses: { pro: 0, business: 0, enterprise: 0 } }), "not open on any plan right now");

// ── an admin's changes ──
const o = cleanOverrides({
  paidCourses: { basic: 1, pro: 0 }, courseVideoUploads: { pro: 1, basic: 7 }, coursesPerMember: { basic: 5 }, coursesPerOrganisation: { business: 0 },
  courseStorageGB: { pro: 2 }, courseVideoHours: { business: 10 },
});
assert.deepEqual(o, { paidCourses: { basic: 1, pro: 0 }, courseVideoUploads: { pro: 1 }, coursesPerMember: { basic: 5 }, courseStorageGB: { pro: 2 }, courseVideoHours: { business: 10 } },
  "switches take 0 or 1 only; a 0 where the minimum is 1 is dropped");
assert.equal(canSellCourses("basic", o), true); assert.equal(canSellCourses("pro", o), false);
assert.equal(canUploadVideo("pro", o), false, "uploaded video needs paid courses too");
assert.equal(canMakeCourses("pro", o), true, "free courses still on");
assert.equal(canMakeCourses("basic", { freeCourses: { basic: 0 } }), false);
assert.equal(canMakeCourses("basic", { freeCourses: { basic: 0 }, paidCourses: { basic: 1 } }), true, "a plan with paid courses only can still make one");
assert.equal(courseCap("basic", false, o), 5); assert.equal(courseCap("business", true, o), 90);
assert.equal(capOf("courseStorageGB", "pro", o), 2); assert.equal(limitFor("courseVideoHours", "business", o), 10);

// ── room for one more upload ──
const none = { storageGB: Infinity, videoHours: Infinity };
assert.equal(uploadRoomProblem("pdf", { pdfBytes: 999 * GB, videoMinutes: 0 }, { pdfBytes: GB }, none), "", "no limit by default");
assert.equal(uploadRoomProblem("video", { pdfBytes: 0, videoMinutes: 1e6 }, { videoMinutes: 60 }, none), "");
const cap = { storageGB: 2, videoHours: 10 };
assert.equal(uploadRoomProblem("pdf", { pdfBytes: GB, videoMinutes: 0 }, { pdfBytes: GB }, cap), "", "exactly at the limit fits");
assert.match(uploadRoomProblem("pdf", { pdfBytes: 1.5 * GB, videoMinutes: 0 }, { pdfBytes: GB }, cap), /up to 2 GB.*1\.5 GB is used/);
assert.equal(uploadRoomProblem("video", { pdfBytes: 0, videoMinutes: 540 }, { videoMinutes: 60 }, cap), "");
assert.match(uploadRoomProblem("video", { pdfBytes: 0, videoMinutes: 590 }, { videoMinutes: 11 }, cap), /up to 10 hours.*9 h 50 min is used/);
assert.match(uploadRoomProblem("video", { pdfBytes: 0, videoMinutes: 0 }, { videoMinutes: 61 }, { storageGB: 1, videoHours: 1 }), /up to 1 hour of.*none is used/);
assert.equal(uploadRoomProblem("pdf", { pdfBytes: 0, videoMinutes: 9e9 }, { pdfBytes: 1 }, cap), "", "video hours don't limit PDFs");

console.log("ALL OK");
