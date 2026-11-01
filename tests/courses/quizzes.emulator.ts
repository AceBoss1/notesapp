// Quiz lessons (lib/courses-server.ts) against the Firestore emulator: the answers kept apart from the lesson, marking, retakes,
// and a quiz ticked off only once passed. Run: npm run test:quizzes-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CourseError, addLesson, courseForOwner, createCourse, deleteCourse, deleteLesson, enrol, markLesson, setPublished, submitQuiz, updateCourse, updateLesson } from "../../lib/courses-server";
import { openLesson } from "../../lib/course-sales-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, why: string) => {
  const e = await p.then(() => null, (x) => x);
  assert.ok(e instanceof CourseError, `${why}: expected a CourseError, got ${e}`);
  assert.equal((e as CourseError).status, status, `${why}: ${(e as Error).message}`);
};
const quiz = (passPercent = 70) => ({
  passPercent,
  questions: [
    { prompt: "Which adds up cells?", options: ["SUM", "COUNT"], answer: 0, explain: "SUM adds every number." },
    { prompt: "Which counts cells?", options: ["SUM", "COUNT", "MAX"], answer: 1 },
    { prompt: "Which finds the biggest?", options: ["MIN", "MAX"], answer: 1, explain: "MAX." },
  ],
});
const deps = { playerUrlFor: async () => "", checkDevice: async () => ({ ok: true, used: 1, max: 2, devices: [] }) };

(async () => {
  await db.doc("users/q_t").set({ uid: "q_t", username: "quizteacher", displayName: "Quiz Teacher", role: "reader", accountTier: "basic" });
  await db.doc("users/q_r").set({ uid: "q_r", username: "quizreader", displayName: "Reader", role: "reader", accountTier: "standard" });

  // a tutor on a free Basic plan adds a quiz: the questions go on the lesson, the answers only to quizKeys
  const c = await createCourse(db, "q_t", { title: "Spreadsheets quiz course", summary: "Learn and test it." });
  const read = await addLesson(db, "q_t", c.id, { kind: "text", title: "Read me", body: "SUM, COUNT, MAX." });
  await fails(addLesson(db, "q_t", c.id, { kind: "quiz", title: "Bad", quiz: { questions: [{ prompt: "x", options: ["a"], answer: 0 }] } }), 400, "a question needs two answers");
  const ql = await addLesson(db, "q_t", c.id, { kind: "quiz", title: "Check yourself", quiz: quiz() });
  assert.equal(ql.kind, "quiz");
  assert.deepEqual(ql.quiz!.questions.map((q) => q.answer), [0, 1, 1], "the tutor gets the answers back");
  const ldoc = (await db.doc(`courses/${c.id}/lessons/${ql.id}`).get()).data()!;
  assert.equal(ldoc.kind, "quiz"); assert.equal(ldoc.quiz.passPercent, 70); assert.equal(ldoc.quiz.questions.length, 3);
  assert.equal(JSON.stringify(ldoc).includes("answer"), false, "no answers on the lesson");
  assert.equal(JSON.stringify(ldoc).includes("SUM adds every number"), false, "no explanations on the lesson");
  const key = (await db.doc(`quizKeys/${c.id}_${ql.id}`).get()).data()!;
  assert.deepEqual(key.answers, [0, 1, 1]); assert.deepEqual(key.explain, ["SUM adds every number.", "", "MAX."]);
  const course = (await db.doc(`courses/${c.id}`).get()).data()!;
  assert.equal(course.outline.find((o: { id: string }) => o.id === ql.id).kind, "quiz", "the outline says Quiz");

  // the editor loads the answers for the tutors only
  const ed = await courseForOwner(db, "q_t", { id: c.id });
  assert.deepEqual(ed.lessons.find((l) => l.id === ql.id)!.quiz!.questions.map((q) => [q.answer, q.explain]), [[0, "SUM adds every number."], [1, undefined], [1, "MAX."]]);
  await fails(courseForOwner(db, "q_r", { id: c.id }), 403, "only tutors read the key");

  // editing keeps the key in step
  const q2 = quiz(60); q2.questions[2].answer = 0;
  const upd = await updateLesson(db, "q_t", c.id, ql.id, { kind: "quiz", title: "Check yourself", quiz: { ...q2, questions: q2.questions.map((q, i) => ({ ...q, id: ql.quiz!.questions[i].id })) } });
  assert.deepEqual(upd.lesson.quiz!.questions.map((q) => q.id), ql.quiz!.questions.map((q) => q.id), "question ids are kept");
  assert.deepEqual((await db.doc(`quizKeys/${c.id}_${ql.id}`).get()).data()!.answers, [0, 1, 0]);
  assert.equal((await db.doc(`courses/${c.id}/lessons/${ql.id}`).get()).data()!.quiz.passPercent, 60);
  await updateLesson(db, "q_t", c.id, ql.id, { kind: "quiz", title: "Check yourself", quiz: quiz() });

  await setPublished(db, "q_t", c.id, true);

  // a learner opening it sees questions, never answers
  const open = await openLesson(db, { uid: "q_r", email: "r@example.com" }, { courseId: c.id, lessonId: ql.id }, deps);
  assert.equal(open.content.kind, "quiz"); assert.equal(open.content.quiz!.questions.length, 3);
  assert.equal(JSON.stringify(open.content).includes("answer"), false);
  assert.equal(JSON.stringify(open.content).includes("SUM adds every number"), false);

  // enrol first; the quiz can't be ticked off by hand
  await fails(submitQuiz(db, "q_r", c.id, ql.id, [0, 1, 1]), 403, "enrol before taking the quiz");
  await enrol(db, "q_r", c.id);
  await fails(markLesson(db, "q_r", c.id, ql.id, true), 409, "Mark done can't skip the quiz");
  await fails(submitQuiz(db, "q_r", c.id, read.id, [0]), 404, "only quiz lessons are marked");
  await fails(submitQuiz(db, "q_r", c.id, ql.id, [0, 1]), 400, "every question needs an answer");
  await fails(submitQuiz(db, "q_r", c.id, ql.id, "0,1,1"), 400, "answers are a list");
  await markLesson(db, "q_r", c.id, read.id, true);

  // fail: graded, explained, nothing ticked off
  const t0 = new Date("2026-10-30T10:00:00Z");
  let r = await submitQuiz(db, "q_r", c.id, ql.id, [1, 1, 0], t0);
  assert.deepEqual([r.grade.correct, r.grade.total, r.grade.percent, r.grade.passed], [1, 3, 33, false]);
  assert.deepEqual(r.grade.results.map((x) => [x.correct, x.answer]), [[false, 0], [true, 1], [false, 1]]);
  assert.equal(r.grade.results[0].explain, "SUM adds every number.", "explanations come back after submitting");
  assert.equal(r.enrolment.done[ql.id], undefined); assert.equal(r.enrolment.completedAt, null);
  let att = (await db.doc(`quizAttempts/${c.id}_${ql.id}_q_r`).get()).data()!;
  assert.deepEqual([att.attempts, att.best, att.lastPercent, att.passedAt], [1, 33, 33, undefined]);
  await fails(markLesson(db, "q_r", c.id, ql.id, true), 409, "still not passed");

  // pass on the retake: ticked off, and the course is complete
  const t1 = new Date("2026-10-30T10:05:00Z");
  r = await submitQuiz(db, "q_r", c.id, ql.id, [0, 1, 0], t1);
  assert.deepEqual([r.grade.percent, r.grade.passed], [67, false], "67% is under 70%");
  r = await submitQuiz(db, "q_r", c.id, ql.id, [0, 1, 1], t1);
  assert.deepEqual([r.grade.percent, r.grade.passed], [100, true]);
  assert.equal(r.enrolment.done[ql.id], t1.toISOString()); assert.equal(r.enrolment.completedAt, t1.toISOString(), "passing the last lesson completes the course");
  const e = (await db.doc(`enrolments/${c.id}_q_r`).get()).data()!;
  assert.ok(e.done[ql.id]); assert.equal(e.completedAt, t1.toISOString());
  att = (await db.doc(`quizAttempts/${c.id}_${ql.id}_q_r`).get()).data()!;
  assert.deepEqual([att.attempts, att.best, att.lastPercent, att.passedAt], [3, 100, 100, t1.toISOString()]);

  // a later, worse attempt doesn't take the pass away; un-ticking and ticking again is fine once passed
  r = await submitQuiz(db, "q_r", c.id, ql.id, [1, 0, 0], new Date("2026-10-30T11:00:00Z"));
  assert.equal(r.grade.passed, false); assert.ok(r.enrolment.done[ql.id]);
  att = (await db.doc(`quizAttempts/${c.id}_${ql.id}_q_r`).get()).data()!;
  assert.deepEqual([att.attempts, att.best, att.lastPercent, att.passedAt], [4, 100, 0, t1.toISOString()]);
  let p = await markLesson(db, "q_r", c.id, ql.id, false);
  assert.equal(p.completedAt, null);
  p = await markLesson(db, "q_r", c.id, ql.id, true);
  assert.ok(p.completedAt, "a passed quiz can be ticked again");

  // switching a quiz to another kind, or deleting it, drops its key; deleting the course drops attempts too
  const q3 = await addLesson(db, "q_t", c.id, { kind: "quiz", title: "Another", quiz: quiz() });
  await updateLesson(db, "q_t", c.id, q3.id, { kind: "text", title: "Now text", body: "x" });
  assert.equal((await db.doc(`quizKeys/${c.id}_${q3.id}`).get()).exists, false);
  const q4 = await addLesson(db, "q_t", c.id, { kind: "quiz", title: "Third", quiz: quiz() });
  await deleteLesson(db, "q_t", c.id, q4.id);
  assert.equal((await db.doc(`quizKeys/${c.id}_${q4.id}`).get()).exists, false);
  await updateCourse(db, "q_t", c.id, { summary: "Still here." });
  await deleteCourse(db, "q_t", c.id);
  assert.equal((await db.doc(`quizKeys/${c.id}_${ql.id}`).get()).exists, false);
  assert.equal((await db.doc(`quizAttempts/${c.id}_${ql.id}_q_r`).get()).exists, false);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
