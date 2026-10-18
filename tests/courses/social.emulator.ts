// Course likes, saves and reviews (lib/course-social-server.ts) against the Firestore emulator. Part of npm run test:courses-server → "SOCIAL OK".
import assert from "node:assert/strict";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ReviewError } from "../../lib/reviews";
import { courseSocial, deleteCourseReview, listCourseReviews, replyToCourseReview, submitCourseReview, toggleCourseLike, toggleCourseSave } from "../../lib/course-social-server";
if (!getApps().length) initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, re: RegExp) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof ReviewError, `expected a ReviewError, got ${e}`);
  assert.equal((e as ReviewError).status, status, (e as Error).message);
  assert.match((e as Error).message, re);
};

(async () => {
  const bells: string[] = [];
  const notify = async (n: { uid?: string | null; message: string }) => { bells.push(`${n.uid}: ${n.message}`); };
  for (const [uid, name] of [["s_t", "Tola Teacher"], ["s_a", "Ada"], ["s_b", "Bisi"], ["s_c", "Chidi"]]) await db.doc(`users/${uid}`).set({ uid, username: uid, displayName: name });
  await db.doc("courses/sc1").set({ title: "IT Support", slug: "it-support", ownerUid: "s_t", status: "published", lessonIds: ["l1", "l2", "l3", "l4"] });
  await db.doc("courses/sc2").set({ title: "Draft", slug: "draft", ownerUid: "s_t", status: "draft", lessonIds: ["x"] });
  const enrol = (uid: string, done: string[], completed = false) => db.doc(`enrolments/sc1_${uid}`).set({ courseId: "sc1", uid, done: Object.fromEntries(done.map((d) => [d, "2026-10-18"])), completedAt: completed ? "2026-10-18T10:00:00Z" : null });

  // likes: a toggle, counted on the course; only published courses
  assert.deepEqual(await toggleCourseLike(db, "s_a", "sc1"), { liked: true, likeCount: 1 });
  assert.deepEqual(await toggleCourseLike(db, "s_b", "sc1"), { liked: true, likeCount: 2 });
  assert.deepEqual(await toggleCourseLike(db, "s_a", "sc1"), { liked: false, likeCount: 1 });
  await fails(toggleCourseLike(db, "s_a", "sc2"), 404, /isn't published/);
  await fails(toggleCourseLike(db, "s_a", "../x"), 400, /Which course/);

  // saves: private to each member; one already saved can be removed even if the course is gone
  assert.deepEqual(await toggleCourseSave(db, "s_a", "sc1"), { saved: true });
  assert.equal((await db.doc("savedCourses/s_a_sc1").get()).data()!.uid, "s_a");
  const s = await courseSocial(db, "sc1", "s_b");
  assert.deepEqual(s, { likeCount: 1, liked: true, saved: false, rating: { count: 0, average: 0 } });
  assert.equal((await courseSocial(db, "sc1", "s_a")).saved, true);
  assert.equal((await courseSocial(db, "sc1")).liked, false, "signed out");
  assert.deepEqual(await toggleCourseSave(db, "s_a", "sc1"), { saved: false });

  // reviews: enrolled learners who've done half the lessons; never the teacher
  await fails(submitCourseReview(db, "s_a", "sc1", { rating: 5 }, new Date(), notify), 403, /Enrol/);
  await enrol("s_a", ["l1"]);
  await fails(submitCourseReview(db, "s_a", "sc1", { rating: 5 }, new Date(), notify), 403, /done 2 of its 4 lessons \(you've done 1\)/);
  assert.deepEqual((await listCourseReviews(db, "sc1", "s_a")).progress, { done: 1, total: 4, needed: 2, ok: false });
  assert.equal((await listCourseReviews(db, "sc1", "s_a")).canReview, false);
  await enrol("s_a", ["l1", "l2"]);
  await fails(submitCourseReview(db, "s_t", "sc1", { rating: 5 }, new Date(), notify), 403, /You teach this course/);
  await fails(submitCourseReview(db, "s_a", "sc1", { rating: 0 }, new Date(), notify), 400, /1 to 5 stars/);
  assert.deepEqual(await submitCourseReview(db, "s_a", "sc1", { rating: 4, text: "Clear and practical lessons." }, new Date("2026-10-18T09:00:00Z"), notify), { summary: { count: 1, average: 4 } });
  assert.match(bells.at(-1)!, /^s_t: Ada left 4 stars on your course IT Support/);
  await enrol("s_b", ["l1", "l2", "l3", "l4"], true);
  await submitCourseReview(db, "s_b", "sc1", { rating: 5 }, new Date("2026-10-18T10:00:00Z"), notify);
  // editing replaces the rating, it doesn't add one
  assert.deepEqual(await submitCourseReview(db, "s_a", "sc1", { rating: 2, text: "Clear, but too short." }, new Date("2026-10-18T11:00:00Z"), notify), { summary: { count: 2, average: 3.5 } });
  const c = (await db.doc("courses/sc1").get()).data()!;
  assert.equal(c.ratingSum, 7); assert.equal(c.ratingCount, 2);

  const list = await listCourseReviews(db, "sc1", "s_a");
  assert.deepEqual(list.reviews.map((r) => [r.uid, r.rating, r.verified]), [["s_b", 5, true], ["s_a", 2, false]], "newest first; finished the course or not");
  assert.deepEqual(list.breakdown, [0, 1, 0, 0, 1]);
  assert.equal(list.mine?.rating, 2); assert.equal(list.canReview, true); assert.ok(list.mine?.updatedAt);
  assert.equal((await listCourseReviews(db, "sc1", "s_t")).progress, null, "the teacher has no progress");
  await fails(listCourseReviews(db, "sc2"), 404, /isn't published/);

  // the teacher replies once; only the teacher
  await fails(replyToCourseReview(db, "s_b", "s_a_sc1", "Thanks!", new Date(), notify), 403, /Only the teacher/);
  await replyToCourseReview(db, "s_t", "s_a_sc1", "Thanks Ada, more lessons are coming.", new Date(), notify);
  assert.match(bells.at(-1)!, /^s_a: The teacher replied to your review of IT Support/);
  await fails(replyToCourseReview(db, "s_t", "s_a_sc1", "Again", new Date(), notify), 409, /already replied/);
  assert.equal((await listCourseReviews(db, "sc1")).reviews.find((r) => r.uid === "s_a")!.reply?.text, "Thanks Ada, more lessons are coming.");

  // removing your own review takes it out of the totals; nobody else's
  await fails(deleteCourseReview(db, "s_b", "s_a_sc1"), 403, /your own review/);
  await deleteCourseReview(db, "s_a", "s_a_sc1");
  const after = (await db.doc("courses/sc1").get()).data()!;
  assert.equal(after.ratingSum, 5); assert.equal(after.ratingCount, 1);
  assert.deepEqual((await courseSocial(db, "sc1")).rating, { count: 1, average: 5 });

  console.log("SOCIAL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
