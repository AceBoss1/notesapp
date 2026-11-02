import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { cleanCourseFields, cleanLesson, quizKeyId, type Lesson } from "./courses";
import { courseOf, lessonFields, lessonOf, lessonSummary, ownerFields, quizKeyFields, reserveSlug } from "./courses-server";
import { ensureMany } from "./subtopics-server";
import { COURSE_SEEDS, SEED_OWNER_USERNAME, SEED_PROGRESS_NOTE, seedByKey, seedSummary, type SeedCourse } from "./course-seeds";
import type { UserProfile } from "./users";

// Server-only. Writes the owner's seeded courses (lib/course-seeds.ts) into Firestore, from Admin → Academy (POST /api/admin/course-seeds).
// planSeeds is the dry run the card shows first; seedCourses writes. Both are safe to run again:
// - A new course (How to Restart Your Life After a Breakdown) is created as a DRAFT owned by @emmanuel, so he previews and publishes
//   it himself. Seeding again finds it (by its seedKey, or its address) and rewrites it, whatever its status is by then.
// - A course that already exists (IT Support Training, existingId) is rewritten in place if it still belongs to @emmanuel: its
//   details and lessons are replaced; its id, address, status, enrolments, reviews, likes, views and certificates are untouched. If
//   it has gone, the seed creates it as a draft like the other.
// Lessons have fixed ids (lib/course-seeds.ts), so a second run rewrites the same lessons and learners keep their ticks on them.
// Lessons a rewrite drops are deleted (and a dropped quiz's answer key). Progress: SEED_PROGRESS_NOTE.
export class SeedError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type SeedAction = "create" | "update" | "rewrite" | "blocked";
export type SeedPlan = {
  key: string; title: string; action: SeedAction; reason?: string;
  courseId: string | null; slug: string; status: "draft" | "published";
  before: { lessons: number; minutes: number; enrolCount: number; reviews: number } | null;
  after: ReturnType<typeof seedSummary>;
  progressNote?: string;
  done?: SeedAction; // after seeding: what was done
};

async function ownerOf(db: Firestore, username: string): Promise<{ uid: string; profile: UserProfile }> {
  const u = String(username ?? "").trim().replace(/^@/, "").toLowerCase();
  const found = await db.collection("users").where("username", "==", u).limit(1).get();
  const d = found.docs[0];
  if (!d) throw new SeedError(`No member has the username @${u}.`, 404);
  return { uid: d.id, profile: d.data() as UserProfile };
}

// The course this seed writes to: the existing one it rewrites, the one an earlier run made, or none yet.
async function targetOf(db: Firestore, s: SeedCourse, ownerUid: string): Promise<{ action: SeedAction; ref: DocumentReference | null; data: FirebaseFirestore.DocumentData | null; reason?: string }> {
  if (s.existingId) {
    const snap = await db.doc(`courses/${s.existingId}`).get();
    if (snap.exists) {
      if (snap.data()!.ownerUid !== ownerUid) return { action: "blocked", ref: snap.ref, data: snap.data()!, reason: `That course belongs to @${String(snap.data()!.ownerUsername ?? "someone else")}, not the owner, so it's left alone.` };
      return { action: "rewrite", ref: snap.ref, data: snap.data()! };
    }
  }
  const bySeed = await db.collection("courses").where("ownerUid", "==", ownerUid).where("seedKey", "==", s.key).limit(1).get();
  if (!bySeed.empty) return { action: "update", ref: bySeed.docs[0].ref, data: bySeed.docs[0].data() };
  const slugged = (await db.doc(`courseSlugs/${s.slug}`).get()).data()?.courseId;
  if (slugged) {
    const snap = await db.doc(`courses/${slugged}`).get();
    if (snap.exists && snap.data()!.ownerUid === ownerUid) return { action: "update", ref: snap.ref, data: snap.data()! };
  }
  return { action: "create", ref: null, data: null };
}

// The seed's lessons, checked as the editor's would be (lib/courses.ts cleanLesson), in course order.
function lessonsOf(s: SeedCourse) {
  return s.lessons.map((l, order) => {
    const input = cleanLesson({ kind: l.kind, title: l.title, minutes: l.minutes, body: l.body, url: l.youtubeId, videoCredit: l.videoCredit, moduleId: l.moduleId, quiz: l.quiz });
    if (typeof input === "string") throw new SeedError(`"${l.title}": ${input}`);
    if (l.kind === "youtube" && !input.videoCredit) throw new SeedError(`"${l.title}": a seeded video needs its creator's credit.`);
    if (input.moduleId !== l.moduleId) throw new SeedError(`"${l.title}": its module id isn't valid.`);
    return { id: l.id, input, fields: lessonFields(input, order) };
  });
}

export async function planSeeds(db: Firestore, ownerUsername = SEED_OWNER_USERNAME): Promise<SeedPlan[]> {
  const { uid } = await ownerOf(db, ownerUsername);
  return Promise.all(COURSE_SEEDS.map((s) => planOne(db, s, uid)));
}
async function planOne(db: Firestore, s: SeedCourse, ownerUid: string): Promise<SeedPlan> {
  const t = await targetOf(db, s, ownerUid);
  const c = t.ref && t.data ? courseOf(t.ref.id, t.data) : null;
  return {
    key: s.key, title: s.title, action: t.action, ...(t.reason ? { reason: t.reason } : {}),
    courseId: c?.id ?? null, slug: c?.slug ?? s.slug, status: c?.status ?? "draft",
    before: c ? { lessons: c.lessonCount, minutes: c.minutes, enrolCount: c.enrolCount, reviews: c.ratingCount ?? 0 } : null,
    after: seedSummary(s),
    ...(c && c.enrolCount > 0 ? { progressNote: SEED_PROGRESS_NOTE } : {}),
  };
}

// Writes the seeds (or only one, by key) and returns what each looks like now. The course, its lessons and its quiz keys are written
// in one batch, so a failure leaves the course as it was.
export async function seedCourses(db: Firestore, ownerUsername = SEED_OWNER_USERNAME, now = new Date(), opts: { only?: string } = {}): Promise<SeedPlan[]> {
  const list = opts.only ? [seedByKey(opts.only)].filter((x): x is SeedCourse => !!x) : COURSE_SEEDS;
  if (!list.length) throw new SeedError("Which course?");
  const owner = await ownerOf(db, ownerUsername);
  const out: SeedPlan[] = [];
  for (const s of list) out.push(await seedOne(db, s, owner, now));
  return out;
}

async function seedOne(db: Firestore, s: SeedCourse, owner: { uid: string; profile: UserProfile }, now: Date): Promise<SeedPlan> {
  const f = cleanCourseFields({ title: s.title, summary: s.summary, cover: s.cover, topics: s.topics, level: s.level, language: s.language, format: s.format, outcomes: s.outcomes, requirements: s.requirements, modules: s.modules });
  if (typeof f === "string") throw new SeedError(`${s.title}: ${f}`);
  if (f.modules!.map((m) => m.id).join() !== s.modules.map((m) => m.id).join()) throw new SeedError(`${s.title}: a module id isn't valid.`);
  const lessons = lessonsOf(s);
  const t = await targetOf(db, s, owner.uid);
  if (t.action === "blocked") throw new SeedError(t.reason ?? "That course can't be rewritten.", 409);
  const at = now.toISOString();
  const subtopics = await ensureMany(db, owner.uid, "topic", s.subtopics, now);
  let ref = t.ref;
  const base = {
    ...ownerFields(owner.profile), title: f.title!, summary: f.summary!, cover: f.cover!, topics: f.topics!, subtopics, level: f.level!, language: f.language!, format: f.format!,
    outcomes: f.outcomes!, requirements: f.requirements!, modules: f.modules!, free: true, priceKobo: 0, seedKey: s.key, seededAt: at, updatedAt: at,
  };
  const batch = db.batch();
  const list: Lesson[] = lessons.map((l) => ({ id: l.id, ...l.fields }));
  if (!ref) {
    ref = db.collection("courses").doc();
    const slug = await reserveSlug(db, s.slug, ref.id); // the seed's own address (a slug slugifies to itself), or -2… if it is taken
    batch.set(ref, {
      ownerUid: owner.uid, ...base, slug, status: "draft", enrolCount: 0, viewCount: 0, createdAt: at, publishedAt: null,
      tutors: [], tutorUids: [], isOrg: false, createdByUid: owner.uid, certificateIncluded: false, ...lessonSummary(list, f.modules),
    });
  } else {
    const old = (await ref.collection("lessons").get()).docs.map((d) => lessonOf(d.id, d.data()));
    const keep = new Set(lessons.map((l) => l.id));
    for (const o of old) if (!keep.has(o.id)) {
      batch.delete(ref.collection("lessons").doc(o.id));
      if (o.kind === "quiz") batch.delete(db.doc(`quizKeys/${quizKeyId(ref.id, o.id)}`));
    }
    // Only the course's details and lesson order: its status, address, learners, reviews, likes, views and tutors stay as they are.
    batch.update(ref, { ...base, ...lessonSummary(list, f.modules) });
  }
  for (const l of lessons) {
    batch.set(ref.collection("lessons").doc(l.id), l.fields); // set, not merge: a lesson that changed kind loses its old fields
    const key = db.doc(`quizKeys/${quizKeyId(ref.id, l.id)}`);
    if (l.input.quiz) batch.set(key, quizKeyFields(l.input, ref.id, l.id, now)); else batch.delete(key);
  }
  await batch.commit();
  return { ...(await planOne(db, s, owner.uid)), done: t.action };
}
