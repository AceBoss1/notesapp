// The owner's course seeds (lib/course-seeds-server.ts) against the Firestore emulator: a dry run, then seeding twice. No duplicates,
// the existing course is rewritten in place (id, address, status, enrolments, reviews and certificates kept), a new course is a draft.
// Run: npm run test:course-seeds-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SeedError, planSeeds, seedCourses } from "../../lib/course-seeds-server";
import { IT_SUPPORT_COURSE, RESTART_COURSE } from "../../lib/course-seeds";
import { AI_COURSE_SEEDS } from "../../lib/course-seeds-ai";
import { markLesson, setPublished } from "../../lib/courses-server";
import { progressOf } from "../../lib/courses";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const IT = "wLQCJdqolPh6A3WbvEZL";
const now = new Date("2026-11-01T10:00:00Z");

(async () => {
  await db.doc("users/u_e").set({ uid: "u_e", username: "emmanuel", displayName: "Emmanuel Adams", avatar: "/e.png", role: "reader", accountTier: "pro" });
  await db.doc("users/u_l").set({ uid: "u_l", username: "learner", displayName: "Learner", role: "reader", accountTier: "standard" });
  await db.doc("users/u_o").set({ uid: "u_o", username: "other", displayName: "Other", role: "reader", accountTier: "basic" });
  // The IT course as it is in production: published, free, 8 text lessons (30 minutes), 2 learners, 1 review, a certificate issued
  const old = Array.from({ length: 8 }, (_, i) => ({ id: `old${i + 1}`, title: `Old lesson ${i + 1}`, kind: "text", minutes: i < 6 ? 4 : 3 }));
  await db.doc(`courses/${IT}`).set({
    ownerUid: "u_e", ownerUsername: "emmanuel", ownerName: "Emmanuel Adams", ownerAvatar: "", title: "IT Support Staff Training", slug: "it-support-staff-training",
    summary: "Old summary -----", topics: ["tech"], cover: "", free: true, priceKobo: 0, status: "published", lessonIds: old.map((l) => l.id),
    outline: old.map((l) => ({ id: l.id, title: l.title, kind: "text", minutes: l.minutes })), lessonCount: 8, minutes: 30, enrolCount: 2, viewCount: 40, likeCount: 3,
    ratingSum: 5, ratingCount: 1, createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z", publishedAt: "2026-10-21T00:00:00.000Z",
    modules: [], tutors: [], tutorUids: [], isOrg: false, createdByUid: "u_e",
  });
  await db.doc("courseSlugs/it-support-staff-training").set({ courseId: IT });
  for (const [i, l] of old.entries()) await db.doc(`courses/${IT}/lessons/${l.id}`).set({ order: i, title: l.title, kind: "text", body: "Old text", minutes: l.minutes });
  const done = Object.fromEntries(old.map((l) => [l.id, "2026-10-25T00:00:00.000Z"]));
  await db.doc(`enrolments/${IT}_u_l`).set({ courseId: IT, uid: "u_l", enrolledAt: "2026-10-22T00:00:00.000Z", done, lastLessonId: "old8", completedAt: "2026-10-25T00:00:00.000Z", certificateId: "NA-C-TEST2345" });
  await db.doc(`enrolments/${IT}_u_o`).set({ courseId: IT, uid: "u_o", enrolledAt: "2026-10-22T00:00:00.000Z", done: { old1: "2026-10-23T00:00:00.000Z" }, lastLessonId: "old1", completedAt: null });
  await db.doc(`courseReviews/u_l_${IT}`).set({ courseId: IT, uid: "u_l", rating: 5, text: "Great", createdAt: "2026-10-26T00:00:00.000Z" });
  await db.doc("certificates/NA-C-TEST2345").set({ id: "NA-C-TEST2345", courseId: IT, uid: "u_l", status: "valid" });

  // the dry run: nothing written yet
  const plans = await planSeeds(db);
  const pa = plans.find((p) => p.key === RESTART_COURSE.key)!, pb = plans.find((p) => p.key === IT_SUPPORT_COURSE.key)!;
  assert.equal(pa.action, "create"); assert.equal(pa.courseId, null); assert.equal(pa.after.lessons, RESTART_COURSE.lessons.length);
  assert.equal(pb.action, "rewrite"); assert.equal(pb.courseId, IT); assert.deepEqual(pb.before, { lessons: 8, minutes: 30, enrolCount: 2, reviews: 1 });
  assert.ok(pb.progressNote && /certificate/.test(pb.progressNote), "the card says what happens to learners");
  assert.equal((await db.collection("courses").where("ownerUid", "==", "u_e").get()).size, 1, "a dry run writes nothing");
  assert.equal(plans.length, 9, "Emmanuel's two and LWB Academy's seven");
  // @lwb doesn't exist yet: its seven are blocked, and seeding them is refused
  const noOrg = plans.filter((p) => p.ownerUsername === "lwb");
  assert.equal(noOrg.length, 7); assert.ok(noOrg.every((p) => p.action === "blocked" && /@lwb/.test(p.reason ?? "") && p.group === "LWB Academy (@lwb)"));
  await assert.rejects(seedCourses(db, "lwb", now), (e) => e instanceof SeedError && e.status === 404);

  // seed both
  const r1 = await seedCourses(db, "emmanuel", now);
  assert.deepEqual(r1.map((r) => r.done), ["create", "rewrite"]);
  const mine = async () => (await db.collection("courses").where("ownerUid", "==", "u_e").get()).docs;
  assert.equal((await mine()).length, 2);
  const a = (await mine()).find((d) => d.id !== IT)!;
  const ad = a.data();
  assert.equal(ad.status, "draft", "a new course is a draft the owner publishes himself"); assert.equal(ad.slug, RESTART_COURSE.slug); assert.equal(ad.ownerName, "Emmanuel Adams");
  assert.equal(ad.lessonCount, RESTART_COURSE.lessons.length); assert.equal(ad.cover, RESTART_COURSE.cover); assert.equal(ad.free, true); assert.equal(ad.level, "beginner");
  assert.deepEqual(ad.lessonIds, RESTART_COURSE.lessons.map((l) => l.id));
  assert.equal((await db.doc(`courseSlugs/${RESTART_COURSE.slug}`).get()).data()!.courseId, a.id);
  const vid = (await db.doc(`courses/${a.id}/lessons/ra-01-rest`).get()).data()!;
  assert.equal(vid.kind, "youtube"); assert.equal(vid.youtubeId, "5MuIMqhT8DM"); assert.equal(vid.videoCredit.name, "TED"); assert.ok(vid.body.includes("Matt Walker"));
  assert.deepEqual((await db.doc(`quizKeys/${a.id}_ra-11-reflection`).get()).data()!.answers, [1, 1, 2, 1, 1], "the quiz's answers are kept apart");
  assert.equal((await db.doc(`courses/${a.id}/lessons/ra-11-reflection`).get()).data()!.quiz.questions[0].answer, undefined, "and never on the lesson");

  let b = (await db.doc(`courses/${IT}`).get()).data()!;
  assert.equal(b.status, "published"); assert.equal(b.slug, "it-support-staff-training"); assert.equal(b.publishedAt, "2026-10-21T00:00:00.000Z");
  assert.equal(b.enrolCount, 2); assert.equal(b.ratingCount, 1); assert.equal(b.ratingSum, 5); assert.equal(b.likeCount, 3); assert.equal(b.viewCount, 40);
  assert.equal(b.title, "IT Support Training"); assert.equal(b.cover, IT_SUPPORT_COURSE.cover); assert.deepEqual(b.requirements, IT_SUPPORT_COURSE.requirements);
  assert.deepEqual(b.topics, ["freelancing", "tech", "careers"]); assert.deepEqual(b.subtopics.map((s: { label: string }) => s.label), ["Remote Work", "Monetization", "IT Support"]);
  assert.deepEqual(b.lessonIds, IT_SUPPORT_COURSE.lessons.map((l) => l.id)); assert.equal(b.lessonCount, 14); assert.equal(b.outline.length, 14);
  const lessons = await db.collection(`courses/${IT}/lessons`).get();
  assert.equal(lessons.size, 14); assert.ok(!lessons.docs.some((d) => d.id.startsWith("old")), "the old lessons are replaced");
  // learners: enrolments, reviews and certificates kept; progress shows the new lessons
  const e = (await db.doc(`enrolments/${IT}_u_l`).get()).data()!;
  assert.equal(e.certificateId, "NA-C-TEST2345"); assert.equal(e.completedAt, "2026-10-25T00:00:00.000Z");
  assert.equal((await db.doc("certificates/NA-C-TEST2345").get()).data()!.status, "valid", "no certificate is revoked");
  assert.ok((await db.doc(`courseReviews/u_l_${IT}`).get()).exists);
  assert.deepEqual(progressOf(b.lessonIds, e as never), { done: 0, total: 14, pct: 0, next: "it-01-role", complete: false });
  await markLesson(db, "u_l", IT, "it-01-role", true, now);

  // seed again: no duplicates, the same lessons, ticks and a published status kept
  await setPublished(db, "u_e", a.id, true, now);
  const r2 = await seedCourses(db, "emmanuel", new Date("2026-11-02T10:00:00Z"));
  assert.deepEqual(r2.map((r) => r.done), ["update", "rewrite"]);
  assert.equal((await mine()).length, 2, "seeding twice makes no copies");
  assert.equal((await db.collection("courseSlugs").where("courseId", "==", a.id).get()).size, 1);
  assert.equal((await db.doc(`courses/${a.id}`).get()).data()!.status, "published", "the owner's publish is kept");
  assert.equal((await db.collection(`courses/${IT}/lessons`).get()).size, 14);
  assert.ok((await db.doc(`enrolments/${IT}_u_l`).get()).data()!.done["it-01-role"], "ticks on seeded lessons survive a re-seed");
  b = (await db.doc(`courses/${IT}`).get()).data()!;
  assert.equal(b.enrolCount, 2); assert.equal(b.status, "published");

  // a course that belongs to someone else is never touched
  await db.doc(`courses/${IT}`).update({ ownerUid: "u_o", ownerUsername: "other" });
  const blocked = await planSeeds(db, { owner: "emmanuel" });
  assert.equal(blocked.length, 2); assert.equal(blocked.find((p) => p.key === IT_SUPPORT_COURSE.key)!.action, "blocked");
  await assert.rejects(seedCourses(db, null, now, { only: IT_SUPPORT_COURSE.key }), (x) => x instanceof SeedError && x.status === 409);
  assert.equal((await db.doc(`courses/${IT}`).get()).data()!.ownerUid, "u_o");
  await db.doc(`courses/${IT}`).update({ ownerUid: "u_e", ownerUsername: "emmanuel" });

  // when the existing course has gone, it's found again by its seed (or made afresh as a draft)
  await db.recursiveDelete(db.doc(`courses/${IT}`)); await db.doc("courseSlugs/it-support-staff-training").delete();
  const [made] = await seedCourses(db, "emmanuel", now, { only: IT_SUPPORT_COURSE.key });
  assert.equal(made.done, "create"); assert.equal(made.status, "draft"); assert.equal(made.slug, "it-support-staff-training");
  const [again] = await seedCourses(db, "emmanuel", now, { only: IT_SUPPORT_COURSE.key });
  assert.equal(again.done, "update"); assert.equal(again.courseId, made.courseId);
  await assert.rejects(seedCourses(db, "emmanuel", now, { only: "nope" }), SeedError);

  // ---- LWB Academy: seven AI courses owned by the @lwb organisation, made by @emmanuel (a member of its team) ----
  await db.doc("users/u_lwb").set({ uid: "u_lwb", username: "lwb", displayName: "LWB Academy", avatar: "/lwb.png", role: "publisher", accountTier: "business", accountKind: "organisation" });
  // the organisation exists but Emmanuel isn't on its team yet: refused, nothing written
  const notMember = (await planSeeds(db, { owner: "lwb" }));
  assert.ok(notMember.every((p) => p.action === "blocked" && /isn't on @lwb's team/.test(p.reason ?? "")));
  await assert.rejects(seedCourses(db, "lwb", now), (e) => e instanceof SeedError && e.status === 409);
  await assert.rejects(seedCourses(db, null, now, { only: AI_COURSE_SEEDS[0].key }), (e) => e instanceof SeedError && e.status === 409);
  const lwbCourses = async () => (await db.collection("courses").where("ownerUid", "==", "u_lwb").get()).docs;
  assert.equal((await lwbCourses()).length, 0);
  // a reader on the team doesn't count; a writer does
  await db.doc("orgMembers/u_lwb_u_e").set({ orgUid: "u_lwb", memberUid: "u_e", role: "reader" });
  await assert.rejects(seedCourses(db, "lwb", now), (e) => e instanceof SeedError && e.status === 409);
  await db.doc("orgMembers/u_lwb_u_e").set({ orgUid: "u_lwb", memberUid: "u_e", role: "writer" });
  const ready = await planSeeds(db, { owner: "lwb" });
  assert.equal(ready.length, 7); assert.ok(ready.every((p) => p.action === "create" && p.teacherUsername === "emmanuel" && p.byline === "Emmanuel Adams"));
  // seed all seven: drafts owned by the organisation, made by (and crediting) Emmanuel
  const all = await seedCourses(db, "lwb", now);
  assert.equal(all.length, 7); assert.ok(all.every((r) => r.done === "create" && r.status === "draft"));
  const docs = await lwbCourses();
  assert.equal(docs.length, 7);
  for (const d of docs) {
    const c = d.data(), seed = AI_COURSE_SEEDS.find((x) => x.key === c.seedKey)!;
    assert.ok(seed, "each course remembers its seed");
    assert.equal(c.status, "draft"); assert.equal(c.isOrg, true); assert.equal(c.createdByUid, "u_e"); assert.equal(c.ownerUsername, "lwb"); assert.equal(c.ownerName, "LWB Academy");
    assert.equal(c.madeByName, "Emmanuel Adams"); assert.equal(c.madeByUsername, "emmanuel"); assert.equal(c.cover, `/images/academy/covers/${seed.slug}.webp`);
    assert.equal(c.slug, seed.slug); assert.equal(c.lessonCount, seed.lessons.length); assert.equal(c.publishedAt, null);
    assert.equal((await db.collection(`courses/${d.id}/lessons`).get()).size, seed.lessons.length);
  }
  const first = docs.find((d) => d.data().seedKey === AI_COURSE_SEEDS[0].key)!;
  const { courseOf } = await import("../../lib/courses-server");
  const shown = courseOf(first.id, first.data());
  assert.equal(shown.madeByName, "Emmanuel Adams", "the course page credits him as the teacher");
  // Emmanuel, as a writer on the team, edits them like any course he made for the organisation
  const { myCourses } = await import("../../lib/courses-server");
  assert.ok((await myCourses(db, "u_e")).filter((c) => c.isOrg).length === 7);
  // seeding one again, then all seven again: the same courses, no copies, still drafts
  const [one] = await seedCourses(db, null, new Date("2026-11-03T10:00:00Z"), { only: AI_COURSE_SEEDS[0].key });
  assert.equal(one.done, "update"); assert.equal(one.courseId, first.id); assert.equal(one.status, "draft");
  const again2 = await seedCourses(db, "lwb", new Date("2026-11-03T11:00:00Z"));
  assert.ok(again2.every((r) => r.done === "update"));
  assert.equal((await lwbCourses()).length, 7, "re-seeding makes no copies");
  assert.equal((await db.doc(`courses/${first.id}`).get()).data()!.createdByUid, "u_e");
  // Emmanuel's own courses are untouched by LWB's seeding
  assert.equal((await mine()).length, 2);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
