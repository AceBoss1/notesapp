// The Nana tutor end to end on the Firestore emulator, with a stand-in AI (lib/tutor-server.ts): only the course's tutors switch it
// on; enrolled learners (a paid course: buyers) may ask; what the AI is given is the course's own material in the learner's language,
// never a graded quiz's answers. Run: npm run test:tutor → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const T = await import("../../lib/tutor-server");
  const { CourseError } = await import("../../lib/courses-server");
  const refused = async (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof CourseError && e.status === status);
  let seen: { system: string; messages: unknown[] } | null = null;
  const deps = { now: () => new Date("2026-11-09T10:00:00Z"), complete: async (a: { system: { text: string }[]; messages: unknown[] }) => { seen = { system: a.system.map((b) => b.text).join("\n\n"), messages: a.messages }; return { text: "Plants use sunlight to make food.", refused: false }; } };

  const now = "2026-11-01T00:00:00Z";
  await db.doc("users/teach").set({ username: "ada", displayName: "Ada Obi", accountTier: "pro" });
  await db.doc("users/cotutor").set({ username: "bayo", displayName: "Bayo", accountTier: "pro" });
  await db.doc("users/learn").set({ username: "chi", displayName: "Chi", accountTier: "pro" });
  await db.doc("users/teen").set({ username: "tee", displayName: "Tee", accountTier: "pro", teen: true });
  await db.doc("users/stranger").set({ username: "dayo", displayName: "Dayo", accountTier: "pro" });
  const course = { ownerUid: "teach", ownerName: "Ada Obi", ownerUsername: "ada", title: "Farm science", slug: "farm-science", summary: "How crops grow", status: "published", priceKobo: 0, lessonIds: ["l1", "l2", "l3"], lessonCount: 3, createdAt: now, updatedAt: now, tutors: [{ uid: "cotutor", access: "view" }], tutorUids: ["cotutor"] };
  await db.doc("courses/c1").set(course);
  await db.doc("courses/c1/lessons/l1").set({ order: 1, title: "Photosynthesis", kind: "text", body: "Plants make food from sunlight, water and carbon dioxide." });
  await db.doc("courses/c1/lessons/l2").set({ order: 2, title: "Check yourself", kind: "quiz", quiz: { passPercent: 50, questions: [{ id: "q1", prompt: "What do plants need to make food?", options: ["Sunlight", "Sand"] }] } });
  await db.doc("courses/c1/lessons/l3").set({ order: 3, title: "Field video", kind: "pdf", fileKey: "k", fileName: "f.pdf" });
  await db.doc("quizKeys/c1_l2").set({ answers: [0], explains: ["SECRET-EXPLANATION"] });
  await db.doc("enrolments/c1_learn").set({ courseId: "c1", uid: "learn", enrolledAt: now, done: {} });
  await db.doc("enrolments/c1_teen").set({ courseId: "c1", uid: "teen", enrolledAt: now, done: {} });
  const ask = (uid: string, extra: Record<string, unknown> = {}) => T.askTutor(db, uid, { courseId: "c1", lessonId: "l1", lang: "en", messages: [{ role: "user", content: "How do plants make food?" }], ...extra }, deps as never);

  // off: learners can't ask; the course's tutors can try it
  await refused(ask("learn"), 404);
  assert.equal((await ask("teach")).reply, "Plants use sunlight to make food.");

  // who switches it on: the lead (or an editing co-tutor), not a view-only co-tutor or a stranger
  await refused(T.setTutorSettings(db, "stranger", "c1", { on: true }), 403);
  await refused(T.setTutorSettings(db, "cotutor", "c1", { on: true }), 403);
  await T.setTutorSettings(db, "teach", "c1", { on: true, notes: "My learners are SS2 students; use farming examples." });
  assert.equal((await db.doc("courses/c1").get()).data()!.tutorOn, true);
  assert.deepEqual(await T.getTutorSettings(db, "cotutor", "c1"), { on: true, notes: "My learners are SS2 students; use farming examples." });
  await refused(T.getTutorSettings(db, "stranger", "c1"), 403);

  // a learner asks, in Pidgin: the AI gets the course's material, the teacher's notes, the language, and never the quiz answers
  const r = await ask("learn", { lang: "pcm" });
  assert.equal(r.reply, "Plants use sunlight to make food.");
  assert.ok(seen!.system.includes("Plants make food from sunlight"), "the lesson text");
  assert.ok(seen!.system.includes("What do plants need to make food?"), "the quiz question");
  assert.ok(!seen!.system.includes("SECRET-EXPLANATION") && !seen!.system.includes("Sand"), "never the answers or options");
  assert.ok(seen!.system.includes("Nigerian Pidgin") && seen!.system.includes("use farming examples") && seen!.system.includes("Ada Obi"));
  assert.ok(!seen!.system.includes("child or a teenager"));
  await ask("teen");
  assert.ok(seen!.system.includes("child or a teenager"), "a teen learner gets school-appropriate examples");

  // not enrolled, or nothing asked
  await refused(ask("stranger"), 403);
  await refused(T.askTutor(db, "learn", { courseId: "c1", messages: [] }, deps as never), 400);

  // a paid course: only buyers
  await db.doc("courses/c1").update({ priceKobo: 500000 });
  await refused(ask("learn"), 403);
  await db.doc("enrolments/c1_learn").update({ purchaseRef: "ref1" });
  assert.ok((await ask("learn")).reply);

  // switched off again: learners lose it at once
  await T.setTutorSettings(db, "teach", "c1", { on: false });
  await refused(ask("learn"), 404);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
