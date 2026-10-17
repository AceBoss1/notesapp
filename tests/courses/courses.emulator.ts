// Notes Academy server logic (lib/courses-server.ts) against the Firestore emulator. Run: npm run test:courses-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CourseError, addLesson, createCourse, deleteCourse, deleteLesson, enrol, markLesson, myCourses, recordCourseView, reorderLessons, setPublished, updateCourse, updateLesson } from "../../lib/courses-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, why: string) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof CourseError, `${why}: expected a CourseError, got ${e}`);
  assert.equal((e as CourseError).status, status, `${why}: ${(e as Error).message}`);
};

(async () => {
  await db.doc("users/u_t").set({ uid: "u_t", username: "teacher", displayName: "Tola Teacher", avatar: "/a.png", role: "reader", accountTier: "basic" });
  await db.doc("users/u_r").set({ uid: "u_r", username: "reader", displayName: "Reader", role: "reader", accountTier: "standard" });
  await db.doc("users/u_s").set({ uid: "u_s", username: "sus", displayName: "Sus", role: "reader", accountTier: "pro", suspended: true });

  // only publishing accounts teach, and the course needs a title
  await fails(createCourse(db, "u_r", { title: "Mine" }), 403, "a reader can't teach");
  await fails(createCourse(db, "u_s", { title: "Mine" }), 403, "a suspended member can't teach");
  await fails(createCourse(db, "u_t", { title: "  " }), 400, "a title is needed");
  const c = await createCourse(db, "u_t", { title: "Excel Basics" });
  assert.equal(c.slug, "excel-basics"); assert.equal(c.status, "draft"); assert.equal(c.ownerName, "Tola Teacher");
  const c2 = await createCourse(db, "u_t", { title: "Excel basics!" });
  assert.equal(c2.slug, "excel-basics-2", "addresses stay unique");

  // the address follows the title until the first publish
  const renamed = await updateCourse(db, "u_t", c2.id, { title: "Advanced Excel", summary: "More." });
  assert.equal(renamed.slug, "advanced-excel");
  assert.equal((await db.doc("courseSlugs/excel-basics-2").get()).exists, false, "the old address is freed");
  await fails(updateCourse(db, "u_r", c.id, { title: "Hijack" }), 403, "only the teacher edits");

  // publishing needs a summary and a lesson
  await fails(setPublished(db, "u_t", c.id, true), 400, "nothing to publish yet");
  await updateCourse(db, "u_t", c.id, { summary: "Learn Excel.", topics: ["data", "careers", "nope"] });
  const l1 = await addLesson(db, "u_t", c.id, { kind: "youtube", title: "Intro", url: "https://youtu.be/Vl0H-qTclOg", minutes: 10 });
  const l2 = await addLesson(db, "u_t", c.id, { kind: "text", title: "Notes", body: "## Read me", minutes: 5 });
  const l3 = await addLesson(db, "u_t", c.id, { kind: "youtube", title: "Charts", url: "https://www.youtube.com/watch?v=bR7kP9sQx1E" });
  await fails(addLesson(db, "u_t", c.id, { kind: "youtube", title: "Bad", url: "https://vimeo.com/1" }), 400, "only YouTube links");
  let doc = (await db.doc(`courses/${c.id}`).get()).data()!;
  assert.deepEqual(doc.lessonIds, [l1.id, l2.id, l3.id]); assert.equal(doc.lessonCount, 3); assert.equal(doc.minutes, 15); assert.deepEqual(doc.topics, ["data", "careers"]);

  // edit, switch kind, reorder
  await updateLesson(db, "u_t", c.id, l2.id, { kind: "youtube", title: "Notes as a video", url: "https://youtu.be/nT3vW6yZ0cD", minutes: 7 });
  const l2doc = (await db.doc(`courses/${c.id}/lessons/${l2.id}`).get()).data()!;
  assert.equal(l2doc.kind, "youtube"); assert.equal(l2doc.body, undefined, "a lesson switched to video loses its text"); assert.equal(l2doc.youtubeId, "nT3vW6yZ0cD");
  await reorderLessons(db, "u_t", c.id, [l3.id, l1.id, l2.id]);
  await fails(reorderLessons(db, "u_t", c.id, [l3.id, l1.id]), 409, "every lesson must be in the new order");
  doc = (await db.doc(`courses/${c.id}`).get()).data()!;
  assert.deepEqual(doc.lessonIds, [l3.id, l1.id, l2.id]); assert.equal(doc.minutes, 17);
  assert.deepEqual((await db.collection(`courses/${c.id}/lessons`).orderBy("order").get()).docs.map((d) => d.id), [l3.id, l1.id, l2.id]);

  // publish; the address is then fixed
  const pub = await setPublished(db, "u_t", c.id, true);
  assert.equal(pub.status, "published"); assert.ok(pub.publishedAt);
  assert.equal((await updateCourse(db, "u_t", c.id, { title: "Excel for everyone" })).slug, "excel-basics");
  await fails(updateCourse(db, "u_t", c.id, { summary: "" }), 400, "a published course keeps a summary");

  // learners: enrol (free, once), tick lessons off, complete
  await fails(enrol(db, "u_r", c2.id), 404, "a draft can't be joined");
  const e = await enrol(db, "u_r", c.id);
  assert.deepEqual(e.done, {}); await enrol(db, "u_r", c.id);
  assert.equal((await db.doc(`courses/${c.id}`).get()).data()!.enrolCount, 1, "enrolling twice counts once");
  await enrol(db, "u_t", c.id);
  assert.equal((await db.doc(`courses/${c.id}`).get()).data()!.enrolCount, 1, "the teacher trying it isn't a learner");
  await fails(markLesson(db, "u_s", c.id, l1.id, true), 403, "enrol before ticking off");
  await fails(markLesson(db, "u_r", c.id, "nope", true), 404, "only the course's lessons");
  await markLesson(db, "u_r", c.id, l1.id, true);
  await markLesson(db, "u_r", c.id, l2.id, true);
  let p = await markLesson(db, "u_r", c.id, l3.id, true);
  assert.ok(p.completedAt, "every lesson done completes the course"); assert.equal(p.lastLessonId, l3.id);
  p = await markLesson(db, "u_r", c.id, l2.id, false);
  assert.equal(p.completedAt, null, "un-ticking one reopens it"); assert.equal(p.done[l2.id], undefined);
  // a lesson added later means the course isn't finished any more; deleting it finishes it again on the next tick
  const l4 = await addLesson(db, "u_t", c.id, { kind: "text", title: "Extra", body: "x" });
  p = await markLesson(db, "u_r", c.id, l2.id, true);
  assert.equal(p.completedAt, null);
  await deleteLesson(db, "u_t", c.id, l4.id);
  p = await markLesson(db, "u_r", c.id, l2.id, true);
  assert.ok(p.completedAt);

  // views: one bucket per day, the teacher's own don't count, drafts aren't counted
  assert.equal(await recordCourseView(db, c.id, "u_r", new Date("2026-10-17T10:00:00Z")), true);
  assert.equal(await recordCourseView(db, c.id, undefined, new Date("2026-10-17T11:00:00Z")), true);
  assert.equal(await recordCourseView(db, c.id, "u_t"), false);
  assert.equal(await recordCourseView(db, c2.id), false);
  const bucket = (await db.doc(`pageViews/course_${c.id}_20261017`).get()).data()!;
  assert.equal(bucket.kind, "course"); assert.equal(bucket.count, 2); assert.equal(bucket.day, "2026-10-17");
  assert.equal((await db.doc(`courses/${c.id}`).get()).data()!.viewCount, 2);

  // the last lesson of a published course can't go; unpublish first
  const one = await createCourse(db, "u_t", { title: "One lesson", summary: "x" });
  const only = await addLesson(db, "u_t", one.id, { kind: "text", title: "Only", body: "x" });
  await setPublished(db, "u_t", one.id, true);
  await fails(deleteLesson(db, "u_t", one.id, only.id), 400, "a published course keeps a lesson");
  await setPublished(db, "u_t", one.id, false);
  await deleteLesson(db, "u_t", one.id, only.id);

  // deleting a course takes its lessons, learners' progress and address with it
  await fails(deleteCourse(db, "u_r", c.id), 403, "only the teacher deletes");
  await deleteCourse(db, "u_t", c.id);
  assert.equal((await db.doc(`courses/${c.id}`).get()).exists, false);
  assert.equal((await db.collection(`courses/${c.id}/lessons`).get()).size, 0);
  assert.equal((await db.doc(`enrolments/${c.id}_u_r`).get()).exists, false);
  assert.equal((await db.doc("courseSlugs/excel-basics").get()).exists, false);
  assert.deepEqual((await myCourses(db, "u_t")).map((x) => x.title).sort(), ["Advanced Excel", "One lesson"]);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
