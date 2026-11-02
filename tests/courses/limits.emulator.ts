// Course plan switches and limits set in Admin → Limits (lib/limits.ts, lib/limits-server.ts), enforced by lib/courses-server.ts and
// lib/course-sales-server.ts, against the Firestore emulator with fake Stream and bucket checks. Run: npm run test:courses-server → "LIMITS OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CourseError, addLesson, checkUploadStart, courseForOwner, createCourse, setPublished, teachingStatus, updateCourse, updateLesson, uploadUse, type UploadChecks } from "../../lib/courses-server";
import { courseCheckout } from "../../lib/course-sales-server";
import { resetLimitCache, saveLimitOverrides } from "../../lib/limits-server";
import { GB } from "../../lib/courses";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, why: string, msg?: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof CourseError, `${why}: expected a CourseError, got ${e}`);
  assert.equal((e as CourseError).status, status, `${why}: ${(e as Error).message}`);
  if (msg) assert.match((e as Error).message, msg, why);
};
const V1 = "1".repeat(32), V2 = "2".repeat(32), V3 = "3".repeat(32);
const checks: UploadChecks = {
  video: async (uid) => ({ [V1]: { creator: "lb_biz", duration: 610 }, [V2]: { creator: "lb_biz", duration: 3_000 }, [V3]: { creator: "lb_biz", duration: 1_200 } } as Record<string, { creator: string; duration: number }>)[uid] ?? null,
  file: async (key) => (key.endsWith("big.pdf") ? { size: 0.6 * GB } : key.endsWith("small.pdf") ? { size: 1000 } : null),
};

(async () => {
  resetLimitCache();
  await db.doc("serverConfig/limits").delete();
  await db.doc("users/lb_basic").set({ username: "lbbasic", displayName: "Basic", role: "reader", accountTier: "basic" });
  await db.doc("users/lb_pro").set({ username: "lbpro", displayName: "Pro", role: "reader", accountTier: "pro" });
  await db.doc("users/lb_biz").set({ username: "lbbiz", displayName: "Biz", role: "reader", accountTier: "business" });
  await db.doc("users/lb_l").set({ username: "lblearner", displayName: "Learner", role: "reader", accountTier: "standard" });
  await db.doc("payoutAccounts/lb_pro").set({ recipientCode: "RCP_x" });

  // ---- the defaults: exactly what shipped in v0.55.0 ----
  assert.deepEqual(await teachingStatus(db, "lb_basic"), { canTeach: true, maxCourses: 30 });
  assert.equal((await teachingStatus(db, "lb_l")).canTeach, false, "Free Standard can't publish");
  const b1 = await createCourse(db, "lb_basic", { title: "Basic One" });
  await fails(updateCourse(db, "lb_basic", b1.id, { priceNaira: "5000" }), 403, "Basic can't sell", /on Pro, Business and Enterprise plans/);
  const p1 = await createCourse(db, "lb_pro", { title: "Pro One" });
  await updateCourse(db, "lb_pro", p1.id, { summary: "Pro.", priceNaira: "5000" });
  const ed = await courseForOwner(db, "lb_pro", { id: p1.id });
  assert.deepEqual([ed.plan.canSell, ed.plan.canUploadVideo, ed.plan.paidPlans, ed.plan.videoPlans], [true, false, "on Pro, Business and Enterprise plans", "on Business and Enterprise plans"]);
  await fails(checkUploadStart(db, p1, "video", 1000), 403, "video uploads: Business and up", /on Business and Enterprise plans/);
  await checkUploadStart(db, p1, "pdf", 1000);
  const pdf = await addLesson(db, "lb_pro", p1.id, { kind: "pdf", title: "Big", fileKey: `courses/${p1.id}/1-big.pdf`, fileName: "big.pdf" }, new Date(), checks);
  assert.equal(pdf.fileBytes, 0.6 * GB, "the PDF's size is kept, from the bucket");
  assert.equal((await db.doc(`courses/${p1.id}/lessons/${pdf.id}`).get()).data()!.fileBytes, 0.6 * GB);
  await setPublished(db, "lb_pro", p1.id, true);
  assert.equal((await courseCheckout(db, "lb_l", p1.id)).course.id, p1.id, "on sale");

  const z1 = await createCourse(db, "lb_biz", { title: "Biz One" });
  await updateCourse(db, "lb_biz", z1.id, { summary: "Biz.", priceNaira: "5000" });
  const v1 = await addLesson(db, "lb_biz", z1.id, { kind: "video", title: "Ten minutes", streamUid: V1 }, new Date(), checks);
  assert.equal(v1.videoSeconds, 610); assert.equal(v1.minutes, 10);
  const v2 = await addLesson(db, "lb_biz", z1.id, { kind: "video", title: "Fifty minutes", streamUid: V2, minutes: 1 }, new Date(), checks);
  assert.equal(v2.minutes, 1, "the minutes typed are shown"); assert.equal(v2.videoSeconds, 3_000, "but the real length is kept");
  const use = await uploadUse(db, "lb_biz");
  assert.equal(Math.round(use.videoMinutes * 60), 3_610, "video use counts the real length, not the minutes typed");

  // ---- an admin changes them ----
  await saveLimitOverrides(db, {
    freeCourses: { basic: 0 }, paidCourses: { pro: 0 }, coursesPerMember: { business: 1 }, courseVideoHours: { business: 1 }, courseStorageGB: { business: 1 },
  }, "admin_1");
  resetLimitCache(); // read back what was saved, as another server would
  assert.equal((await teachingStatus(db, "lb_basic")).canTeach, false);
  assert.match((await teachingStatus(db, "lb_basic")).reason!, /on Pro, Business and Enterprise plans/, "free courses off on Basic; the others still teach");
  await fails(createCourse(db, "lb_basic", { title: "Basic Two" }), 403, "no new courses on Basic");
  await updateCourse(db, "lb_basic", b1.id, { summary: "Still editable." });
  await db.doc(`courses/${b1.id}`).update({ lessonIds: ["x"], lessonCount: 1 });
  await fails(setPublished(db, "lb_basic", b1.id, true), 403, "can't publish a free course", /Publishing free courses is on Pro, Business and Enterprise plans/);

  await fails(courseCheckout(db, "lb_l", p1.id), 409, "a paid course goes off sale while its plan can't sell");
  await fails(updateCourse(db, "lb_pro", p1.id, { priceNaira: "6000" }), 403, "Pro can't price", /on Business and Enterprise plans/);
  assert.equal((await courseForOwner(db, "lb_pro", { id: p1.id })).plan.canSell, false);
  await fails(checkUploadStart(db, p1, "pdf", 1000), 403, "no PDFs either");

  assert.equal((await teachingStatus(db, "lb_biz")).maxCourses, 1);
  await fails(createCourse(db, "lb_biz", { title: "Biz Two" }), 409, "one course on Business now", /up to 1 course on your plan/);
  // video hours: 1 hour, 60m10s used
  await fails(checkUploadStart(db, z1, "video", 1000), 409, "no room to start another video", /up to 1 hour of uploaded video.*1 h 0 min is used|up to 1 hour of uploaded video.*1 h is used/);
  await fails(addLesson(db, "lb_biz", z1.id, { kind: "video", title: "Twenty", streamUid: V3 }, new Date(), checks), 409, "over the video hours");
  const renamed = await updateLesson(db, "lb_biz", z1.id, v2.id, { kind: "video", title: "Fifty minutes, renamed", streamUid: V2, minutes: 50 }, new Date(), checks);
  assert.equal(renamed.lesson.title, "Fifty minutes, renamed", "the same upload kept on an edit is never stopped");
  const swapped = await updateLesson(db, "lb_biz", z1.id, v2.id, { kind: "video", title: "Twenty instead", streamUid: V3 }, new Date(), checks);
  assert.equal(swapped.replaced?.streamUid, V2, "replacing a video counts the new one instead of the old one (10m10s + 20m fits)");
  // storage: 1 GB of PDFs
  await checkUploadStart(db, z1, "pdf", 0.6 * GB);
  await addLesson(db, "lb_biz", z1.id, { kind: "pdf", title: "Big", fileKey: `courses/${z1.id}/1-big.pdf`, fileName: "big.pdf" }, new Date(), checks);
  await fails(checkUploadStart(db, z1, "pdf", 0.6 * GB), 409, "a second big PDF won't fit", /up to 1 GB/);
  await fails(addLesson(db, "lb_biz", z1.id, { kind: "pdf", title: "Big 2", fileKey: `courses/${z1.id}/2-big.pdf`, fileName: "big.pdf" }, new Date(), checks), 409, "nor when it arrives");
  await addLesson(db, "lb_biz", z1.id, { kind: "pdf", title: "Small", fileKey: `courses/${z1.id}/3-small.pdf`, fileName: "small.pdf" }, new Date(), checks);

  // ---- back to the defaults ----
  await saveLimitOverrides(db, {}, "admin_1");
  resetLimitCache();
  await createCourse(db, "lb_biz", { title: "Biz Two" });
  await addLesson(db, "lb_biz", z1.id, { kind: "pdf", title: "Big 2", fileKey: `courses/${z1.id}/2-big.pdf`, fileName: "big.pdf" }, new Date(), checks);
  assert.equal((await courseCheckout(db, "lb_l", p1.id)).course.id, p1.id, "on sale again");

  console.log("LIMITS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
