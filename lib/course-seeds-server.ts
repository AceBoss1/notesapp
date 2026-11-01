import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { cleanCourseFields, cleanLesson, quizKeyId, type Lesson } from "./courses";
import { courseOf, lessonFields, lessonOf, lessonSummary, madeByFields, ownerFields, quizKeyFields, reserveSlug } from "./courses-server";
import { ensureMany } from "./subtopics-server";
import { ALL_COURSE_SEEDS, SEED_PROGRESS_NOTE, seedByKey, seedSummary, type SeedCourse } from "./course-seeds";
import { isOrganisation } from "./org";
import type { UserProfile } from "./users";

// Server-only. Writes the seeded courses (lib/course-seeds.ts and lib/course-seeds-ai.ts) into Firestore, from Admin → Academy
// (POST /api/admin/course-seeds). planSeeds is the dry run the card shows first; seedCourses writes. Both are safe to run again:
// - A new course is created as a DRAFT, so its owner previews and publishes it. Seeding again finds it (by its seedKey, or its
//   address) and rewrites it, whatever its status is by then.
// - A course that already exists (IT Support Training, existingId) is rewritten in place if it still belongs to its owner: its
//   details and lessons are replaced; its id, address, status, enrolments, reviews, likes, views and certificates are untouched. If
//   it has gone, the seed creates it as a draft like the others.
// - Each seed names its owner (ownerUsername). An organisation's course (LWB Academy's seven on AI, owned by @lwb) is made by a team
//   member (teacherUsername, @emmanuel), as the editor's "teach as the organisation" does: ownerUid is the organisation, isOrg is set,
//   createdByUid is the member, and madeByName credits them as the teacher on the course page. The member must be on the
//   organisation's team as an admin or writer; if the organisation or the membership is missing, the seed is refused.
// Lessons have fixed ids (lib/course-seeds.ts), so a second run rewrites the same lessons and learners keep their ticks on them.
// Lessons a rewrite drops are deleted (and a dropped quiz's answer key). Progress: SEED_PROGRESS_NOTE.
export class SeedError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type SeedAction = "create" | "update" | "rewrite" | "blocked";
export type SeedPlan = {
  key: string; title: string; action: SeedAction; reason?: string;
  ownerUsername: string; byline: string; teacherUsername: string; group: string;
  courseId: string | null; slug: string; status: "draft" | "published";
  before: { lessons: number; minutes: number; enrolCount: number; reviews: number } | null;
  after: ReturnType<typeof seedSummary>;
  progressNote?: string;
  done?: SeedAction; // after seeding: what was done
};

type Member = { uid: string; profile: UserProfile };
type Who = { owner: Member; maker: Member; isOrg: boolean };
const handle = (u: string) => String(u ?? "").trim().replace(/^@/, "").toLowerCase();
async function memberOf(db: Firestore, username: string): Promise<Member> {
  const u = handle(username);
  const found = await db.collection("users").where("username", "==", u).limit(1).get();
  const d = found.docs[0];
  if (!d) throw new SeedError(`No member has the username @${u}, so this can't be seeded.`, 404);
  return { uid: d.id, profile: d.data() as UserProfile };
}
// Who owns the seed's course and who makes it. An organisation's course needs its maker on the team (admin or writer).
async function whoOf(db: Firestore, s: SeedCourse): Promise<Who> {
  const owner = await memberOf(db, s.ownerUsername);
  const teacher = s.teacherUsername ? handle(s.teacherUsername) : "";
  if (!teacher || teacher === handle(s.ownerUsername)) return { owner, maker: owner, isOrg: isOrganisation(owner.profile) };
  if (!isOrganisation(owner.profile)) throw new SeedError(`@${handle(s.ownerUsername)} isn't an organisation account, so @${teacher} can't teach as it.`, 409);
  const maker = await memberOf(db, teacher);
  const role = (await db.doc(`orgMembers/${owner.uid}_${maker.uid}`).get()).data()?.role;
  if (role !== "admin" && role !== "writer") throw new SeedError(`@${teacher} isn't on @${handle(s.ownerUsername)}'s team as an admin or writer. Add them to the team first.`, 409);
  return { owner, maker, isOrg: true };
}
const groupOf = (s: SeedCourse) => `${s.group ?? s.byline} (@${handle(s.ownerUsername)})`;

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

// The dry run for every seed, or one owner's (opts.owner). A seed whose owner or team membership is missing is "blocked", with why.
export async function planSeeds(db: Firestore, opts: { owner?: string } = {}): Promise<SeedPlan[]> {
  const list = ALL_COURSE_SEEDS.filter((s) => !opts.owner || handle(s.ownerUsername) === handle(opts.owner));
  return Promise.all(list.map(async (s) => {
    try { return await planOne(db, s, await whoOf(db, s)); } catch (e) {
      if (!(e instanceof SeedError)) throw e;
      return { ...planBase(s), action: "blocked" as const, reason: e.message, courseId: null, slug: s.slug, status: "draft" as const, before: null };
    }
  }));
}
const planBase = (s: SeedCourse) => ({
  key: s.key, title: s.title, ownerUsername: handle(s.ownerUsername), byline: s.byline, teacherUsername: handle(s.teacherUsername ?? s.ownerUsername),
  group: groupOf(s), after: seedSummary(s),
});
async function planOne(db: Firestore, s: SeedCourse, who: Who): Promise<SeedPlan> {
  const t = await targetOf(db, s, who.owner.uid);
  const c = t.ref && t.data ? courseOf(t.ref.id, t.data) : null;
  return {
    ...planBase(s), action: t.action, ...(t.reason ? { reason: t.reason } : {}),
    courseId: c?.id ?? null, slug: c?.slug ?? s.slug, status: c?.status ?? "draft",
    before: c ? { lessons: c.lessonCount, minutes: c.minutes, enrolCount: c.enrolCount, reviews: c.ratingCount ?? 0 } : null,
    ...(c && c.enrolCount > 0 ? { progressNote: SEED_PROGRESS_NOTE } : {}),
  };
}

// Writes the seeds and returns what each looks like now: one seed (opts.only, by key), or every seed of one owner (owner, e.g. "lwb"
// for LWB Academy's seven), or all of them. Every owner and membership is checked before anything is written. The course, its
// lessons and its quiz keys are written in one batch, so a failure leaves that course as it was.
export async function seedCourses(db: Firestore, owner?: string | null, now = new Date(), opts: { only?: string } = {}): Promise<SeedPlan[]> {
  const list = opts.only ? [seedByKey(opts.only)].filter((x): x is SeedCourse => !!x) : ALL_COURSE_SEEDS.filter((s) => !owner || handle(s.ownerUsername) === handle(owner));
  if (!list.length) throw new SeedError("Which course?");
  const whos = await Promise.all(list.map((s) => whoOf(db, s)));
  const out: SeedPlan[] = [];
  for (const [i, s] of list.entries()) out.push(await seedOne(db, s, whos[i], now));
  return out;
}

async function seedOne(db: Firestore, s: SeedCourse, who: Who, now: Date): Promise<SeedPlan> {
  const f = cleanCourseFields({ title: s.title, summary: s.summary, cover: s.cover, topics: s.topics, level: s.level, language: s.language, format: s.format, outcomes: s.outcomes, requirements: s.requirements, modules: s.modules });
  if (typeof f === "string") throw new SeedError(`${s.title}: ${f}`);
  if (f.modules!.map((m) => m.id).join() !== s.modules.map((m) => m.id).join()) throw new SeedError(`${s.title}: a module id isn't valid.`);
  const lessons = lessonsOf(s);
  const { owner, maker, isOrg } = who;
  const t = await targetOf(db, s, owner.uid);
  if (t.action === "blocked") throw new SeedError(t.reason ?? "That course can't be rewritten.", 409);
  const at = now.toISOString();
  const subtopics = await ensureMany(db, maker.uid, "topic", s.subtopics, now);
  let ref = t.ref;
  const base = {
    ...ownerFields(owner.profile), ...(isOrg ? madeByFields(maker.profile) : {}),
    title: f.title!, summary: f.summary!, cover: f.cover!, topics: f.topics!, subtopics, level: f.level!, language: f.language!, format: f.format!,
    outcomes: f.outcomes!, requirements: f.requirements!, modules: f.modules!, free: true, priceKobo: 0, seedKey: s.key, seededAt: at, updatedAt: at,
  };
  const batch = db.batch();
  const list: Lesson[] = lessons.map((l) => ({ id: l.id, ...l.fields }));
  if (!ref) {
    ref = db.collection("courses").doc();
    const slug = await reserveSlug(db, s.slug, ref.id); // the seed's own address (a slug slugifies to itself), or -2… if it is taken
    batch.set(ref, {
      ownerUid: owner.uid, ...base, slug, status: "draft", enrolCount: 0, viewCount: 0, createdAt: at, publishedAt: null,
      tutors: [], tutorUids: [], isOrg, createdByUid: maker.uid, certificateIncluded: false, ...lessonSummary(list, f.modules),
    });
  } else {
    const old = (await ref.collection("lessons").get()).docs.map((d) => lessonOf(d.id, d.data()));
    const keep = new Set(lessons.map((l) => l.id));
    for (const o of old) if (!keep.has(o.id)) {
      batch.delete(ref.collection("lessons").doc(o.id));
      if (o.kind === "quiz") batch.delete(db.doc(`quizKeys/${quizKeyId(ref.id, o.id)}`));
    }
    // Only the course's details and lesson order: its status, address, maker, learners, reviews, likes, views and tutors stay as they are.
    batch.update(ref, { ...base, ...lessonSummary(list, f.modules) });
  }
  for (const l of lessons) {
    batch.set(ref.collection("lessons").doc(l.id), l.fields); // set, not merge: a lesson that changed kind loses its old fields
    const key = db.doc(`quizKeys/${quizKeyId(ref.id, l.id)}`);
    if (l.input.quiz) batch.set(key, quizKeyFields(l.input, ref.id, l.id, now)); else batch.delete(key);
  }
  await batch.commit();
  return { ...(await planOne(db, s, who)), done: t.action };
}
