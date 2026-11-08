import type { Firestore } from "firebase-admin/firestore";
import { setting } from "@/lib/config";
import { gemModel, realDeps, runAi, type NanaDeps, type SystemBlock } from "./nana-server";
import { memberTier, type Meter } from "./nana-meter";
import { CourseError, accessTo, courseOf, lessonOf } from "./courses-server";
import { isPaid, orderedLessons, type Course } from "./courses";
import {
  TUTOR_PER_DAY, TUTOR_REPLY_TOKENS, cleanTutorMessages, cleanTutorSettings, isTutorLang, pickContext, tutorSystem,
  type TutorLang, type TutorSettings,
} from "./tutor";

// The Nana tutor on the server (lib/tutor.ts has the rules). courseTutor/{courseId} holds the teacher's switch and notes (server only);
// the course document carries tutorOn so the lesson page knows to show it. Who pays: the learner's own connected AI account first,
// else #NotesApp's Pearl from the learner's Nana allowance and then their Nana credit, like any question to Nana (lib/nana-meter.ts).
// Nothing the learner asks is stored: the page keeps the conversation and sends the newest turns each time.

// In development and screenshots with no AI key, a stand-in answers (never on the live site, where the emulator host is never set).
const standInAllowed = () => !!setting("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST");
const STAND_IN: Record<TutorLang, string> = {
  en: "(Stand-in tutor: no AI key here.) In this lesson: plants make their own food from sunlight, water and carbon dioxide. Want me to quiz you on it?",
  pcm: "(Stand-in tutor: no AI key here.) For dis lesson: plants dey make their own food from sunlight, water and carbon dioxide. You wan make I test you?",
  sw: "(Mwalimu wa mfano: hakuna ufunguo wa AI hapa.) Katika somo hili: mimea hutengeneza chakula chake kwa mwanga wa jua, maji na kaboni dioksidi. Nikuulize maswali?",
};

const safeId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function courseById(db: Firestore, courseId: unknown): Promise<Course> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  const s = await db.doc(`courses/${courseId}`).get();
  if (!s.exists) throw new CourseError("That course doesn't exist (any more).", 404);
  return courseOf(s.id, s.data()!);
}

export async function getTutorSettings(db: Firestore, uid: string, courseId: unknown): Promise<TutorSettings> {
  const c = await courseById(db, courseId);
  if (!(await accessTo(db, uid, c))) throw new CourseError("Only the course's tutors can see this.", 403);
  const d = (await db.doc(`courseTutor/${c.id}`).get()).data();
  return { on: d?.on === true, notes: String(d?.notes ?? "") };
}

export async function setTutorSettings(db: Firestore, uid: string, courseId: unknown, body: Record<string, unknown>, now = new Date()): Promise<TutorSettings> {
  const c = await courseById(db, courseId);
  const access = await accessTo(db, uid, c);
  if (!access) throw new CourseError("Only the course's tutors can change this.", 403);
  if (access === "viewer") throw new CourseError("You can view this course, but not edit it. Ask the lead tutor for edit access.", 403);
  const s = cleanTutorSettings(body);
  const batch = db.batch();
  batch.set(db.doc(`courseTutor/${c.id}`), { ...s, courseId: c.id, updatedAt: now.toISOString(), updatedBy: uid });
  batch.update(db.doc(`courses/${c.id}`), { tutorOn: s.on });
  await batch.commit();
  return s;
}

export type TutorReply = { reply: string; via: "own" | "platform"; notice?: string };

// One question to the tutor. The learner must be enrolled (a paid course: bought), or be one of its tutors trying it out (they may
// try it before switching it on).
export async function askTutor(
  db: Firestore, uid: string, input: { courseId?: unknown; lessonId?: unknown; messages?: unknown; lang?: unknown }, deps: NanaDeps = realDeps(),
): Promise<TutorReply> {
  const now = deps.now();
  const c = await courseById(db, input.courseId);
  const access = await accessTo(db, uid, c);
  const tutorDoc = (await db.doc(`courseTutor/${c.id}`).get()).data();
  if (!access) {
    if (c.status !== "published" || tutorDoc?.on !== true) throw new CourseError("This course doesn't have a Nana tutor.", 404);
    const e = (await db.doc(`enrolments/${c.id}_${uid}`).get()).data();
    if (!e || (isPaid(c) && !e.purchaseRef)) throw new CourseError(isPaid(c) ? "Buy the course to ask its tutor." : "Enrol in the course (it's free) to ask its tutor.", 403);
  }
  const me = (await db.doc(`users/${uid}`).get()).data() ?? {};
  if (me.suspended === true) throw new CourseError("The tutor isn't available while your account is suspended.", 403);
  const messages = cleanTutorMessages(input.messages);
  if (!messages.length) throw new CourseError("Ask the tutor something.");
  const lang: TutorLang = isTutorLang(input.lang) ? input.lang : "en";

  const lessons = orderedLessons((await db.collection(`courses/${c.id}/lessons`).orderBy("order").get()).docs.map((d) => lessonOf(d.id, d.data())), c.modules);
  const lessonId = safeId(input.lessonId) && lessons.some((l) => l.id === input.lessonId) ? input.lessonId : null;
  const question = messages[messages.length - 1].content;
  const teacher = c.madeByName || c.ownerName || "the teacher";
  const system: SystemBlock[] = [
    { type: "text", text: tutorSystem({ course: c, teacher, notes: String(tutorDoc?.notes ?? ""), lang, young: me.teen === true }), cache_control: { type: "ephemeral" } },
    { type: "text", text: `THE COURSE MATERIAL (everything you may use):\n\n${pickContext(lessons, lessonId, question) || "(This course has no written material yet.)"}` },
  ];
  const meter: Meter = { uid, tier: await memberTier(db, uid), gem: "pearl", effort: "low" };
  const ran = await runAi(db, deps, now, uid, { system, messages, maxTokens: TUTOR_REPLY_TOKENS, model: gemModel("pearl"), effort: "low" }, TUTOR_PER_DAY, meter);
  if (!ran.completion) {
    if (standInAllowed() && !ran.notice) return { reply: STAND_IN[lang], via: "platform" };
    throw new CourseError(ran.notice ?? "The tutor is resting for today (the day's questions are used up). Try again tomorrow, or go over the lesson.", 429);
  }
  const reply = ran.completion.refused || !ran.completion.text.trim()
    ? "I can only help with this course. Ask me about one of its lessons."
    : ran.completion.text.trim().replace(/\[\[(GAP|HANDOFF)\]\]/g, "").trim();
  return { reply, via: ran.via, ...(ran.notice ? { notice: ran.notice } : {}) };
}
