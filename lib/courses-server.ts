import { FieldValue, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { ensureMany } from "./subtopics-server";
import { ttlCache } from "./ttl-cache";
import type { Subtopic } from "./subtopics";
import { weeklyViews } from "./discovery-server";
import { canPublish, effectiveTier, type AccountTier, type UserProfile } from "./users";
import { canHaveTeam, isOrganisation } from "./org";
import { notifyBell } from "./email";
import { ownerVisitData, ownerVisitRef } from "./visits-server";
import type { Source } from "./analytics";
import {
  MAX_COURSES_PER_MEMBER, MAX_CO_TUTORS, MAX_LESSONS, MIN_LEAD_TUTOR_PERCENT, canSellCourses, canUploadVideo, cleanCourseFields, cleanLesson, cleanLink, cleanPrice,
  communityKindOf, courseRating, gradeQuiz, isPaid, leadTutorPercent, orderedLessons, publishProblems, quizAttemptId, quizForLearner, quizKeyId, slugify, tutorInviteId,
  QUIZ_PASS_DEFAULT,
  type Course, type CourseListing, type CourseModule, type Enrolment, type Lesson, type LessonInput, type OutlineItem, type Quiz, type QuizGrade, type QuizKey, type Tutor, type TutorInvite,
} from "./courses";

// Server-only. Notes Academy courses (docs/COURSES.md): every write to courses/{id}, courses/{id}/lessons/{lessonId},
// enrolments/{courseId}_{uid}, the slug reservations (courseSlugs/{slug}), the private links (courseLinks/{id}) and co-tutor
// invitations (courseTutorInvites/{courseId}_{uid}) happens here, called by the /api/academy routes. Quiz lessons keep their answers
// apart, in quizKeys/{courseId}_{lessonId}, and each learner's attempts in quizAttempts/{courseId}_{lessonId}_{uid} (both server-only). Paid courses' sales,
// lesson access and refunds are in lib/course-sales-server.ts.
export class CourseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const safeId = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const iso = (now: Date) => now.toISOString();
const dayKey = (now: Date) => now.toISOString().slice(0, 10);
const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const MAX_COURSES_PER_ORG = MAX_COURSES_PER_MEMBER * 3;

export function courseOf(id: string, d: FirebaseFirestore.DocumentData): Course {
  const priceKobo = Number(d.priceKobo) || 0;
  return {
    id, ownerUid: String(d.ownerUid ?? ""), ownerUsername: String(d.ownerUsername ?? ""), ownerName: String(d.ownerName ?? ""), ownerAvatar: String(d.ownerAvatar ?? ""),
    title: String(d.title ?? ""), slug: String(d.slug ?? ""), summary: String(d.summary ?? ""), topics: strings(d.topics), cover: String(d.cover ?? ""),
    free: priceKobo === 0, status: d.status === "published" ? "published" : "draft", lessonIds: strings(d.lessonIds),
    lessonCount: Number(d.lessonCount) || 0, minutes: Number(d.minutes) || 0, enrolCount: Number(d.enrolCount) || 0, viewCount: Number(d.viewCount) || 0,
    createdAt: String(d.createdAt ?? ""), updatedAt: String(d.updatedAt ?? ""), publishedAt: d.publishedAt ? String(d.publishedAt) : null,
    likeCount: Number(d.likeCount) || 0, ratingSum: Number(d.ratingSum) || 0, ratingCount: Number(d.ratingCount) || 0,
    subtopics: Array.isArray(d.subtopics) ? (d.subtopics as Subtopic[]).map((x) => ({ parent: String(x.parent), slug: String(x.slug), label: String(x.label) })) : [],
    priceKobo, certificateIncluded: d.certificateIncluded === true,
    level: typeof d.level === "string" ? (d.level as Course["level"]) : "", language: String(d.language || "English"), format: d.format === "live" ? "live" : "self",
    outcomes: strings(d.outcomes), requirements: strings(d.requirements), runsFor: String(d.runsFor ?? ""), schedule: String(d.schedule ?? ""),
    modules: Array.isArray(d.modules) ? (d.modules as CourseModule[]).map((m) => ({ id: String(m.id), title: String(m.title) })) : [],
    outline: Array.isArray(d.outline) ? (d.outline as OutlineItem[]) : undefined,
    hasClassLink: d.hasClassLink === true, hasCommunityLink: d.hasCommunityLink === true, communityKind: String(d.communityKind ?? ""),
    tutors: Array.isArray(d.tutors) ? (d.tutors as Tutor[]) : [], tutorUids: strings(d.tutorUids),
    isOrg: d.isOrg === true, createdByUid: String(d.createdByUid ?? d.ownerUid ?? ""),
  };
}
export function lessonOf(id: string, d: FirebaseFirestore.DocumentData): Lesson {
  const kind = d.kind === "text" || d.kind === "video" || d.kind === "pdf" || d.kind === "quiz" ? d.kind : "youtube";
  return {
    id, order: Number(d.order) || 0, title: String(d.title ?? ""), kind,
    ...(d.youtubeId ? { youtubeId: String(d.youtubeId) } : {}), ...(Number(d.minutes) > 0 ? { minutes: Number(d.minutes) } : {}), ...(typeof d.body === "string" ? { body: d.body } : {}),
    ...(d.preview === true ? { preview: true } : {}), ...(d.moduleId ? { moduleId: String(d.moduleId) } : {}),
    ...(d.streamUid ? { streamUid: String(d.streamUid) } : {}), ...(d.fileKey ? { fileKey: String(d.fileKey), fileName: String(d.fileName ?? "") } : {}),
    ...(kind === "quiz" ? { quiz: quizOf(d.quiz) } : {}),
  };
}
// A quiz lesson's questions as stored (never with answers).
function quizOf(q: unknown): Quiz {
  const o = (q && typeof q === "object" ? q : {}) as { passPercent?: unknown; questions?: unknown };
  const questions = Array.isArray(o.questions) ? (o.questions as Record<string, unknown>[]) : [];
  return quizForLearner({
    passPercent: Number(o.passPercent) || QUIZ_PASS_DEFAULT,
    questions: questions.map((x) => ({ id: String(x?.id ?? ""), prompt: String(x?.prompt ?? ""), options: strings(x?.options) })),
  });
}
const keyOf = (d: FirebaseFirestore.DocumentData | undefined): QuizKey | null =>
  d && Array.isArray(d.answers) ? { answers: d.answers.map(Number), explain: strings(d.explain), ...(Number(d.passPercent) > 0 ? { passPercent: Number(d.passPercent) } : {}) } : null;
// The quiz with its answers and explanations, for the course's tutors (the editor) only.
function withKey(l: Lesson, key: QuizKey | null): Lesson {
  if (l.kind !== "quiz" || !l.quiz || !key) return l;
  return { ...l, quiz: { ...l.quiz, questions: l.quiz.questions.map((q, i) => ({ ...q, ...(key.answers[i] !== undefined ? { answer: key.answers[i] } : {}), ...(key.explain[i] ? { explain: key.explain[i] } : {}) })) } };
}
export const enrolmentOf = (d: FirebaseFirestore.DocumentData): Enrolment => ({
  courseId: String(d.courseId), uid: String(d.uid), enrolledAt: String(d.enrolledAt ?? ""), done: d.done && typeof d.done === "object" ? d.done : {},
  lastLessonId: d.lastLessonId ? String(d.lastLessonId) : null, completedAt: d.completedAt ? String(d.completedAt) : null,
  ...(d.certificateId ? { certificateId: String(d.certificateId) } : {}), ...(d.purchaseRef ? { purchaseRef: String(d.purchaseRef) } : {}),
});
export const outlineOf = (l: Lesson): OutlineItem => ({
  id: l.id, title: l.title, kind: l.kind, ...(l.minutes ? { minutes: l.minutes } : {}), ...(l.preview ? { preview: true } : {}), ...(l.moduleId ? { moduleId: l.moduleId } : {}),
});

// ---- who may do what ----
async function profileOf(db: Firestore, uid: string): Promise<UserProfile> {
  const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!p) throw new CourseError("Profile not found.", 404);
  return p;
}
// The member as a teacher: a publishing account (free Basic and up) that isn't suspended.
async function teacher(db: Firestore, uid: string): Promise<UserProfile> {
  const p = await profileOf(db, uid);
  if (p.suspended === true) throw new CourseError("Teaching is paused while your account is suspended.", 403);
  if (!canPublish(p)) throw new CourseError("Teaching is for publishing accounts. Start publishing (it's free on Basic), then come back.", 403);
  return p;
}
const ownerFields = (p: UserProfile) => ({ ownerUsername: p.username, ownerName: p.displayName || p.username, ownerAvatar: p.avatar || "" });
export const tierOf = (p: Pick<UserProfile, "username" | "role" | "accountTier"> | undefined): AccountTier =>
  p ? effectiveTier({ username: p.username ?? "", role: p.role ?? "reader", accountTier: p.accountTier ?? "standard" }) : "standard";

// An organisation a member may teach for: they're its admin or writer, and it's on a plan with a team (Business, Enterprise).
async function orgForMember(db: Firestore, uid: string, orgUid: string): Promise<{ org: UserProfile; role: "admin" | "writer" }> {
  if (!safeId(orgUid)) throw new CourseError("Which organisation?");
  const [m, o] = await Promise.all([db.doc(`orgMembers/${orgUid}_${uid}`).get(), db.doc(`users/${orgUid}`).get()]);
  const role = m.data()?.role;
  const org = o.data() as UserProfile | undefined;
  if (!org || (role !== "admin" && role !== "writer")) throw new CourseError("You're not on that organisation's team.", 403);
  if (!isOrganisation(org) || org.suspended === true || !canHaveTeam(tierOf(org)) || !canPublish(org)) throw new CourseError("That organisation can't publish courses right now.", 403);
  return { org, role };
}

// "lead": the course's owner, or for an organisation's course its admins and the team member who made it. "tutor": an accepted co-tutor.
export type CourseAccess = "lead" | "tutor";
export async function accessTo(db: Firestore, uid: string, c: Pick<Course, "ownerUid" | "isOrg" | "createdByUid" | "tutorUids">): Promise<CourseAccess | null> {
  if (!uid) return null;
  if (c.ownerUid === uid) return "lead";
  if (c.isOrg) {
    const role = (await db.doc(`orgMembers/${c.ownerUid}_${uid}`).get()).data()?.role;
    if (role === "admin" || (role === "writer" && c.createdByUid === uid)) return "lead";
  }
  return c.tutorUids?.includes(uid) ? "tutor" : null;
}

async function editable(db: Firestore, uid: string, id: string, need: CourseAccess, t?: Transaction): Promise<{ ref: DocumentReference; c: Course; access: CourseAccess }> {
  if (!safeId(id)) throw new CourseError("Which course?");
  const ref = db.doc(`courses/${id}`);
  const snap = t ? await t.get(ref) : await ref.get();
  if (!snap.exists) throw new CourseError("That course doesn't exist (any more).", 404);
  const c = courseOf(snap.id, snap.data()!);
  const access = await accessTo(db, uid, c);
  if (!access) throw new CourseError("Only the course's tutors can change it.", 403);
  if (need === "lead" && access !== "lead") throw new CourseError(c.isOrg ? "Only the organisation's admins and the course's maker can do that." : "Only the course's lead tutor can do that.", 403);
  return { ref, c, access };
}
// The member making a change: not suspended; a personal lead or co-tutor needs a publishing account (an organisation's team member
// teaches under the organisation's).
async function actor(db: Firestore, uid: string, c: Course, access: CourseAccess): Promise<UserProfile> {
  const p = await profileOf(db, uid);
  if (p.suspended === true) throw new CourseError("Teaching is paused while your account is suspended.", 403);
  if (!(access === "lead" && c.isOrg) && !canPublish(p)) throw new CourseError("Teaching is for publishing accounts. Start publishing (it's free on Basic), then come back.", 403);
  return p;
}

// A free address under /academy: the title's slug, then -2, -3 … Reserved atomically (create fails when it's taken).
async function reserveSlug(db: Firestore, title: string, courseId: string): Promise<string> {
  const base = slugify(title);
  for (let i = 1; i <= 30; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const ok = await db.doc(`courseSlugs/${slug}`).create({ courseId }).then(() => true, (e) => (String(e?.code) === "6" || /ALREADY_EXISTS/i.test(String(e)) ? false : Promise.reject(e)));
    if (ok) return slug;
  }
  const slug = `${base}-${courseId.slice(0, 6).toLowerCase()}`;
  await db.doc(`courseSlugs/${slug}`).set({ courseId });
  return slug;
}

// ---- the teacher's own courses ----
// body.orgUid: teach as that organisation (its admins and writers may).
export async function createCourse(db: Firestore, uid: string, body: Record<string, unknown>, now = new Date()): Promise<Course> {
  const f = cleanCourseFields(body);
  if (typeof f === "string") throw new CourseError(f);
  if (!f.title) throw new CourseError("Give the course a title.");
  let owner: UserProfile, ownerUid = uid;
  if (typeof body.orgUid === "string" && body.orgUid && body.orgUid !== uid) {
    const me = await profileOf(db, uid);
    if (me.suspended === true) throw new CourseError("Teaching is paused while your account is suspended.", 403);
    owner = (await orgForMember(db, uid, body.orgUid)).org;
    ownerUid = body.orgUid;
  } else owner = await teacher(db, uid);
  const isOrg = ownerUid !== uid;
  const mine = await db.collection("courses").where("ownerUid", "==", ownerUid).count().get();
  const max = isOrg ? MAX_COURSES_PER_ORG : MAX_COURSES_PER_MEMBER;
  if (mine.data().count >= max) throw new CourseError(`${isOrg ? "An organisation" : "You"} can have up to ${max} courses. Delete one you no longer need first.`, 409);
  const ref = db.collection("courses").doc();
  const slug = await reserveSlug(db, f.title, ref.id);
  const data = {
    ownerUid, ...ownerFields(owner), title: f.title, slug, summary: f.summary ?? "", topics: f.topics ?? [], cover: f.cover ?? "", free: true, priceKobo: 0, status: "draft",
    lessonIds: [], outline: [], lessonCount: 0, minutes: 0, enrolCount: 0, viewCount: 0, createdAt: iso(now), updatedAt: iso(now), publishedAt: null,
    level: "", language: "English", format: "self", outcomes: [], requirements: [], modules: [], tutors: [], tutorUids: [],
    isOrg, createdByUid: uid,
  };
  await ref.set(data);
  return courseOf(ref.id, data);
}

export type MyCourse = Course & { access: CourseAccess };
// Every course the member can edit: their own, ones they made for an organisation, their organisations' (as admin), and ones they co-teach.
export async function myCourses(db: Firestore, uid: string): Promise<MyCourse[]> {
  const adminOf = (await db.collection("orgMembers").where("memberUid", "==", uid).where("role", "==", "admin").get()).docs.map((d) => String(d.data().orgUid)).slice(0, 10);
  const snaps = await Promise.all([
    db.collection("courses").where("ownerUid", "==", uid).get(),
    db.collection("courses").where("createdByUid", "==", uid).get(),
    db.collection("courses").where("tutorUids", "array-contains", uid).get(),
    ...(adminOf.length ? [db.collection("courses").where("ownerUid", "in", adminOf).get()] : []),
  ]);
  const seen = new Map<string, MyCourse>();
  for (const [i, s] of snaps.entries()) for (const d of s.docs) {
    if (seen.has(d.id)) continue;
    const c = courseOf(d.id, d.data());
    const access: CourseAccess = i === 2 && c.ownerUid !== uid && c.createdByUid !== uid && !adminOf.includes(c.ownerUid) ? "tutor" : "lead";
    // A writer who left the organisation no longer edits its courses.
    if (i === 1 && c.isOrg && !(await accessTo(db, uid, c))) continue;
    seen.set(d.id, { ...c, access });
  }
  return Array.from(seen.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export type CourseLinks = { classUrl: string; communityUrl: string };
export async function linksOf(db: Firestore, courseId: string): Promise<CourseLinks> {
  const d = (await db.doc(`courseLinks/${courseId}`).get()).data();
  return { classUrl: String(d?.classUrl ?? ""), communityUrl: String(d?.communityUrl ?? "") };
}
export type EditorView = {
  course: Course; lessons: Lesson[]; access: CourseAccess; links: CourseLinks; invites: TutorInvite[];
  plan: { tier: AccountTier; canSell: boolean; canUploadVideo: boolean; payoutsReady: boolean };
};
// One of the member's courses with its lessons in order (the editor, and the preview of a draft), by id or by address.
export async function courseForOwner(db: Firestore, uid: string, by: { id?: string; slug?: string }): Promise<EditorView> {
  let id = by.id;
  if (!id && by.slug) id = (await db.doc(`courseSlugs/${by.slug}`).get()).data()?.courseId;
  if (!id) throw new CourseError("That course doesn't exist (any more).", 404);
  const { ref, c, access } = await editable(db, uid, id, "tutor");
  const [ls, links, inv, owner, payout] = await Promise.all([
    ref.collection("lessons").orderBy("order").get(), linksOf(db, id), db.collection("courseTutorInvites").where("courseId", "==", id).get(),
    db.doc(`users/${c.ownerUid}`).get(), db.doc(`payoutAccounts/${c.ownerUid}`).get(),
  ]);
  const plain = orderedLessons(ls.docs.map((d) => lessonOf(d.id, d.data())), c.modules);
  const quizzes = plain.filter((l) => l.kind === "quiz");
  const keys = quizzes.length ? await db.getAll(...quizzes.map((l) => db.doc(`quizKeys/${quizKeyId(id!, l.id)}`))) : [];
  const keyFor = new Map(keys.map((k, i) => [quizzes[i].id, keyOf(k.data())]));
  const lessons = plain.map((l) => withKey(l, keyFor.get(l.id) ?? null));
  const tier = tierOf(owner.data() as UserProfile | undefined);
  return {
    course: c, lessons, access, links,
    invites: inv.docs.map((d) => d.data() as TutorInvite).filter((i) => i.status === "pending" || i.status === "accepted").sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    plan: { tier, canSell: canSellCourses(tier), canUploadVideo: canUploadVideo(tier), payoutsReady: !!payout.data()?.recipientCode },
  };
}

// The lessons in their course order, with the fields the course document keeps in step with them.
function lessonSummary(list: Lesson[], modules: CourseModule[] = []) {
  const ordered = orderedLessons(list, modules);
  return { lessonIds: ordered.map((l) => l.id), outline: ordered.map(outlineOf), lessonCount: ordered.length, minutes: ordered.reduce((n, l) => n + (l.minutes ?? 0), 0) };
}

export async function updateCourse(db: Firestore, uid: string, id: string, body: Record<string, unknown>, now = new Date()): Promise<Course> {
  const { ref, c, access } = await editable(db, uid, id, "tutor");
  await actor(db, uid, c, access);
  const owner = await profileOf(db, c.ownerUid);
  const f = cleanCourseFields(body);
  if (typeof f === "string") throw new CourseError(f);
  if (f.title === "") throw new CourseError("Give the course a title.");
  if (c.status === "published" && f.summary === "") throw new CourseError("A published course needs a summary.");
  const patch: Record<string, unknown> = { ...f, ...ownerFields(owner), updatedAt: iso(now) };
  // The price and whether the certificate is included are the lead's to set, within what the owner's plan allows.
  if (body.priceKobo !== undefined || body.priceNaira !== undefined || f.certificateIncluded !== undefined) {
    if (access !== "lead") throw new CourseError("Only the lead tutor sets the price.", 403);
  }
  if (body.priceKobo !== undefined || body.priceNaira !== undefined) {
    const price = cleanPrice(body as { priceKobo?: unknown; priceNaira?: unknown });
    if (typeof price === "string") throw new CourseError(price);
    if (price > 0 && !canSellCourses(tierOf(owner))) throw new CourseError("Paid courses are for Pro, Business and Enterprise plans. Upgrade to sell this course, or keep it free.", 403);
    if (price === 0 && isPaid(c)) {
      const uploads = (await ref.collection("lessons").where("kind", "in", ["video", "pdf"]).limit(1).get()).size;
      if (uploads) throw new CourseError("Uploaded videos and PDFs are for paid courses. Remove them (or use YouTube links) before making the course free.", 409);
    }
    patch.priceKobo = price;
    patch.free = price === 0;
    if (price > 0 && !isPaid(c) && f.certificateIncluded === undefined) patch.certificateIncluded = true; // the usual choice for a paid course
  }
  // The live class and the learners' group: private, shown only to people who enrolled or bought (and the tutors).
  if (body.classUrl !== undefined || body.communityUrl !== undefined) {
    const cur = await linksOf(db, id);
    const classUrl = body.classUrl !== undefined ? cleanLink(body.classUrl) : cur.classUrl;
    const communityUrl = body.communityUrl !== undefined ? cleanLink(body.communityUrl) : cur.communityUrl;
    if (classUrl === null) throw new CourseError("The class link must be a full https:// address (Zoom, Google Meet, Teams…).");
    if (communityUrl === null) throw new CourseError("The community link must be a full https:// address (a WhatsApp or Telegram group…).");
    await db.doc(`courseLinks/${id}`).set({ courseId: id, classUrl, communityUrl, updatedAt: iso(now) });
    Object.assign(patch, { hasClassLink: !!classUrl, hasCommunityLink: !!communityUrl, communityKind: communityUrl ? communityKindOf(communityUrl) : "" });
  }
  // Subtopics under the course's topics (Nana's suggestions): any new one is created now (lib/subtopics-server.ts).
  if (body.subtopics !== undefined) {
    const topics = (f.topics ?? c.topics) as string[];
    const wanted = Array.isArray(body.subtopics) ? (body.subtopics as { parent?: unknown }[]).filter((x) => topics.includes(String(x?.parent))) : [];
    try { patch.subtopics = await ensureMany(db, uid, "topic", wanted, now); } catch (e) { throw new CourseError(e instanceof Error ? e.message : "Couldn't save the subtopics."); }
  } else if (f.topics) patch.subtopics = (c.subtopics ?? []).filter((x) => f.topics!.includes(x.parent));
  // The address follows the title until the course is first published; after that, links people shared keep working.
  if (f.title && !c.publishedAt && slugify(f.title) !== slugify(c.title)) {
    patch.slug = await reserveSlug(db, f.title, id);
    await db.doc(`courseSlugs/${c.slug}`).delete().catch(() => {});
  }
  // New modules (or a new module order) change the lessons' order: kept in step with the lessons in one transaction.
  if (f.modules) {
    await db.runTransaction(async (t) => {
      const lessons = (await t.get(ref.collection("lessons"))).docs.map((d) => lessonOf(d.id, d.data()));
      t.update(ref, { ...patch, ...lessonSummary(lessons, f.modules) });
    });
  } else await ref.update(patch);
  return courseOf(id, { ...c, ...patch });
}

export async function deleteCourse(db: Firestore, uid: string, id: string, deps: { dropUpload?: (l: Lesson) => Promise<void> } = {}): Promise<void> {
  const { ref, c, access } = await editable(db, uid, id, "lead");
  await actor(db, uid, c, access);
  const bought = await db.collection("coursePurchases").where("courseId", "==", id).where("status", "==", "active").limit(1).get();
  if (!bought.empty) throw new CourseError("People have bought this course, so it can't be deleted. Unpublish it instead: they keep their access.", 409);
  const lessons = (await ref.collection("lessons").get()).docs.map((d) => lessonOf(d.id, d.data()));
  const enrolled = await db.collection("enrolments").where("courseId", "==", id).get();
  for (let i = 0; i < enrolled.docs.length; i += 400) {
    const b = db.batch();
    enrolled.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  const invites = await db.collection("courseTutorInvites").where("courseId", "==", id).get();
  await Promise.all(invites.docs.map((d) => d.ref.delete()));
  const attempts = await db.collection("quizAttempts").where("courseId", "==", id).get();
  await Promise.all([...lessons.filter((l) => l.kind === "quiz").map((l) => db.doc(`quizKeys/${quizKeyId(id, l.id)}`).delete()), ...attempts.docs.map((d) => d.ref.delete())]);
  await db.recursiveDelete(ref); // the course and its lessons
  await Promise.all([db.doc(`courseSlugs/${c.slug}`).delete().catch(() => {}), db.doc(`courseLinks/${id}`).delete().catch(() => {})]);
  if (deps.dropUpload) for (const l of lessons) if (l.streamUid || l.fileKey) await deps.dropUpload(l).catch(() => {});
}

export async function setPublished(db: Firestore, uid: string, id: string, publish: boolean, now = new Date()): Promise<Course> {
  const { ref, c, access } = await editable(db, uid, id, "lead");
  await actor(db, uid, c, access);
  const owner = await profileOf(db, c.ownerUid);
  if (publish) {
    const missing = publishProblems(c, c.lessonIds.length);
    if (missing.length) throw new CourseError(`Before publishing, add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.`);
    if (isPaid(c)) {
      if (!canSellCourses(tierOf(owner))) throw new CourseError("Paid courses are for Pro, Business and Enterprise plans. Upgrade, or make the course free.", 403);
      const payout = (await db.doc(`payoutAccounts/${c.ownerUid}`).get()).data();
      if (!payout?.recipientCode) throw new CourseError("Add the bank account your earnings are paid to first (Rates & payouts), then publish.", 409);
    }
  }
  const patch = { status: publish ? "published" : "draft", ...ownerFields(owner), updatedAt: iso(now), ...(publish && !c.publishedAt ? { publishedAt: iso(now) } : {}) };
  await ref.update(patch);
  return courseOf(id, { ...c, ...patch });
}

// ---- lessons: each change runs in one transaction with the course, so the order, the outline, the count and the minutes agree ----
export type UploadChecks = {
  // The uploaded video, as Stream knows it (null when there's no such video), and the PDF in the private bucket.
  video: (uid: string) => Promise<{ creator?: string; duration?: number } | null>;
  file: (key: string) => Promise<{ size: number } | null>;
};
async function checkUpload(db: Firestore, c: Course, l: LessonInput, checks?: UploadChecks): Promise<LessonInput> {
  if (l.kind !== "video" && l.kind !== "pdf") return l;
  if (!isPaid(c)) throw new CourseError("Uploaded videos and PDFs are for paid courses. Set a price first, or use a YouTube link.", 409);
  const tier = tierOf(await profileOf(db, c.ownerUid));
  if (l.kind === "video" && !canUploadVideo(tier)) throw new CourseError("Uploading videos is on Business and Enterprise plans. On Pro, add text lessons, PDFs or YouTube links.", 403);
  if (l.kind === "pdf" && !canSellCourses(tier)) throw new CourseError("Uploading PDFs is on Pro, Business and Enterprise plans.", 403);
  if (!checks) throw new CourseError("Uploads aren't available right now.", 503);
  if (l.kind === "video") {
    const v = await checks.video(l.streamUid!);
    if (!v || (v.creator && v.creator !== c.ownerUid)) throw new CourseError("That video wasn't found. Upload it again.", 404);
    return { ...l, minutes: l.minutes ?? (v.duration && v.duration > 0 ? Math.max(1, Math.round(v.duration / 60)) : null) };
  }
  if (!l.fileKey!.startsWith(`courses/${c.id}/`) || !(await checks.file(l.fileKey!))) throw new CourseError("That PDF wasn't found. Upload it again.", 404);
  return l;
}

async function editLessons<T>(db: Firestore, uid: string, courseId: string, now: Date,
  fn: (t: Transaction, ctx: { ref: DocumentReference; course: Course; lessons: Lesson[] }) => { lessons: Lesson[]; result: T }): Promise<T> {
  const first = await editable(db, uid, courseId, "tutor");
  await actor(db, uid, first.c, first.access);
  return db.runTransaction(async (t) => {
    const { ref, c } = await editable(db, uid, courseId, "tutor", t);
    const lessons = (await t.get(ref.collection("lessons").orderBy("order"))).docs.map((d) => lessonOf(d.id, d.data()));
    const out = fn(t, { ref, course: c, lessons });
    const list = out.lessons;
    if (c.status === "published" && list.length === 0) throw new CourseError("A published course needs at least one lesson. Unpublish it first, or add another lesson before deleting this one.");
    t.update(ref, { ...lessonSummary(list, c.modules), updatedAt: iso(now) });
    return out.result;
  });
}
const lessonFields = (l: LessonInput, order: number): Omit<Lesson, "id"> => ({
  order, title: l.title, kind: l.kind, ...(l.youtubeId ? { youtubeId: l.youtubeId } : {}), ...(l.minutes ? { minutes: l.minutes } : {}), ...(l.body ? { body: l.body } : {}),
  ...(l.preview ? { preview: true } : {}), ...(l.moduleId ? { moduleId: l.moduleId } : {}),
  ...(l.streamUid ? { streamUid: l.streamUid } : {}), ...(l.fileKey ? { fileKey: l.fileKey, fileName: l.fileName ?? "" } : {}),
  ...(l.quiz ? { quiz: quizForLearner(l.quiz) } : {}), // the questions only: the answers go to quizKeys
});
// A quiz's answers and explanations, kept apart from the lesson (written in the same transaction).
const quizKeyFields = (l: LessonInput, courseId: string, lessonId: string, now: Date) => ({
  courseId, lessonId, answers: l.quiz!.questions.map((q) => q.answer), explain: l.quiz!.questions.map((q) => q.explain ?? ""), passPercent: l.quiz!.passPercent, updatedAt: iso(now),
});
const moduleOk = (c: Course, l: LessonInput): LessonInput => (l.moduleId && !(c.modules ?? []).some((m) => m.id === l.moduleId) ? { ...l, moduleId: undefined } : l);

export async function addLesson(db: Firestore, uid: string, courseId: string, body: Record<string, unknown>, now = new Date(), checks?: UploadChecks): Promise<Lesson> {
  const raw = cleanLesson(body);
  if (typeof raw === "string") throw new CourseError(raw);
  const { c } = await editable(db, uid, courseId, "tutor");
  const l = moduleOk(c, await checkUpload(db, c, raw, checks));
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    if (lessons.length >= MAX_LESSONS) throw new CourseError(`A course can have up to ${MAX_LESSONS} lessons.`, 409);
    if (l.streamUid && lessons.some((x) => x.streamUid === l.streamUid)) throw new CourseError("That video is already a lesson.", 409);
    const lr = ref.collection("lessons").doc();
    const fields = lessonFields(l, (lessons.reduce((m, x) => Math.max(m, x.order), -1)) + 1);
    t.set(lr, fields);
    const lesson: Lesson = { id: lr.id, ...fields };
    if (l.quiz) { const k = quizKeyFields(l, courseId, lr.id, now); t.set(db.doc(`quizKeys/${quizKeyId(courseId, lr.id)}`), k); return { lessons: [...lessons, lesson], result: withKey(lesson, k) }; }
    return { lessons: [...lessons, lesson], result: lesson };
  });
}

// Returns the lesson and, when an upload was replaced, the old one (for the route to delete from Stream or the bucket).
export async function updateLesson(db: Firestore, uid: string, courseId: string, lessonId: string, body: Record<string, unknown>, now = new Date(), checks?: UploadChecks): Promise<{ lesson: Lesson; replaced: Lesson | null }> {
  const raw = cleanLesson(body);
  if (typeof raw === "string") throw new CourseError(raw);
  const { c } = await editable(db, uid, courseId, "tutor");
  const l = moduleOk(c, await checkUpload(db, c, raw, checks));
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    const old = lessons.find((x) => x.id === lessonId);
    if (!old) throw new CourseError("That lesson doesn't exist (any more).", 404);
    const fields = lessonFields(l, old.order);
    // set (not merge): a lesson switched from text to video loses its text, and the other way round.
    t.set(ref.collection("lessons").doc(lessonId), fields);
    const lesson: Lesson = { id: lessonId, ...fields };
    const replaced = (old.streamUid && old.streamUid !== lesson.streamUid) || (old.fileKey && old.fileKey !== lesson.fileKey) ? old : null;
    const keyRef = db.doc(`quizKeys/${quizKeyId(courseId, lessonId)}`);
    let k: QuizKey | null = null;
    if (l.quiz) { k = quizKeyFields(l, courseId, lessonId, now); t.set(keyRef, k); } else if (old.kind === "quiz") t.delete(keyRef);
    return { lessons: lessons.map((x) => (x.id === lessonId ? lesson : x)), result: { lesson: withKey(lesson, k), replaced } };
  });
}

export async function deleteLesson(db: Firestore, uid: string, courseId: string, lessonId: string, now = new Date()): Promise<Lesson> {
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    const old = lessons.find((x) => x.id === lessonId);
    if (!old) throw new CourseError("That lesson doesn't exist (any more).", 404);
    t.delete(ref.collection("lessons").doc(lessonId));
    if (old.kind === "quiz") t.delete(db.doc(`quizKeys/${quizKeyId(courseId, lessonId)}`));
    return { lessons: lessons.filter((x) => x.id !== lessonId), result: old };
  });
}

// ids: every lesson of the course, in the new order (within their modules).
export async function reorderLessons(db: Firestore, uid: string, courseId: string, ids: unknown, now = new Date()): Promise<string[]> {
  if (!Array.isArray(ids) || !ids.every(safeId)) throw new CourseError("Send the lessons in their new order.");
  return editLessons(db, uid, courseId, now, (t, { ref, course, lessons }) => {
    const byId = new Map(lessons.map((l) => [l.id, l]));
    if (ids.length !== lessons.length || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id as string))) throw new CourseError("The lessons changed in the meantime. Reload the page and try again.", 409);
    const list = (ids as string[]).map((id, i) => ({ ...byId.get(id)!, order: i }));
    list.forEach((l) => { if (byId.get(l.id)!.order !== l.order) t.update(ref.collection("lessons").doc(l.id), { order: l.order }); });
    return { lessons: list, result: orderedLessons(list, course.modules).map((l) => l.id) };
  });
}

// ---- co-tutors ----
export async function inviteTutor(db: Firestore, uid: string, courseId: string, body: { username?: unknown; percent?: unknown }, now = new Date()): Promise<TutorInvite> {
  const { c, access } = await editable(db, uid, courseId, "lead");
  const me = await actor(db, uid, c, access);
  const username = String(body.username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.-]{2,40}$/.test(username)) throw new CourseError("Type their @username.");
  const percent = Number(body.percent ?? 0);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100 - MIN_LEAD_TUTOR_PERCENT) throw new CourseError(`Their share: a whole percent from 0 to ${100 - MIN_LEAD_TUTOR_PERCENT}.`);
  const found = await db.collection("users").where("username", "==", username).limit(1).get();
  const who = found.docs[0];
  if (!who) throw new CourseError("No member has that username.", 404);
  const p = who.data() as UserProfile;
  if (who.id === c.ownerUid || who.id === uid) throw new CourseError("You already teach this course.", 409);
  if (p.suspended === true) throw new CourseError("That member can't teach right now.", 409);
  if (isOrganisation(p)) throw new CourseError("Invite a person, not an organisation.", 409);
  const all = (await db.collection("courseTutorInvites").where("courseId", "==", courseId).get()).docs.map((d) => d.data() as TutorInvite);
  const live = all.filter((i) => (i.status === "pending" || i.status === "accepted") && i.uid !== who.id);
  if (all.some((i) => i.uid === who.id && (i.status === "pending" || i.status === "accepted"))) throw new CourseError("They're already invited.", 409);
  if (live.length >= MAX_CO_TUTORS) throw new CourseError(`A course can have up to ${MAX_CO_TUTORS} co-tutors.`, 409);
  if (leadTutorPercent([...live, { percent, status: "pending" }]) < MIN_LEAD_TUTOR_PERCENT) throw new CourseError(`The lead keeps at least ${MIN_LEAD_TUTOR_PERCENT}% of each sale. Lower the shares.`);
  const inv: TutorInvite = {
    courseId, courseTitle: c.title, courseSlug: c.slug, ownerUid: c.ownerUid, ownerName: c.ownerName,
    uid: who.id, username: p.username, name: p.displayName || p.username, avatar: p.avatar || "", percent, status: "pending", invitedByUid: uid, createdAt: iso(now),
  };
  await db.doc(`courseTutorInvites/${tutorInviteId(courseId, who.id)}`).set(inv);
  await notifyBell({ uid: who.id, type: "course", linkHref: "/academy/teach", message: `${me.displayName || me.username} invited you to co-teach "${c.title}"${percent ? ` for ${percent}% of each sale` : ""}. Accept or decline on Teach.` });
  return inv;
}

export async function myTutorInvites(db: Firestore, uid: string): Promise<TutorInvite[]> {
  const s = await db.collection("courseTutorInvites").where("uid", "==", uid).where("status", "==", "pending").get();
  return s.docs.map((d) => d.data() as TutorInvite);
}

export async function respondTutor(db: Firestore, uid: string, courseId: string, accept: boolean, now = new Date()): Promise<void> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  if (accept) await teacher(db, uid); // a share of the sales is paid out to a publishing account
  const iref = db.doc(`courseTutorInvites/${tutorInviteId(courseId, uid)}`), cref = db.doc(`courses/${courseId}`);
  const p = await profileOf(db, uid);
  const inv = await db.runTransaction(async (t) => {
    const [is, cs] = await Promise.all([t.get(iref), t.get(cref)]);
    const i = is.data() as TutorInvite | undefined;
    if (!i || i.status !== "pending") throw new CourseError("That invitation isn't open any more.", 404);
    if (!cs.exists) throw new CourseError("That course doesn't exist (any more).", 404);
    t.update(iref, { status: accept ? "accepted" : "declined", respondedAt: iso(now) });
    if (accept) {
      const tutor: Tutor = { uid, username: p.username, name: p.displayName || p.username, avatar: p.avatar || "", role: "co" };
      const tutors = ((cs.data()!.tutors as Tutor[] | undefined) ?? []).filter((x) => x.uid !== uid);
      t.update(cref, { tutors: [...tutors, tutor], tutorUids: FieldValue.arrayUnion(uid) });
    }
    return i;
  });
  await notifyBell({ uid: inv.invitedByUid, type: "course", linkHref: `/academy/teach/${courseId}`, message: `${p.displayName || p.username} ${accept ? "accepted" : "declined"} your invitation to co-teach "${inv.courseTitle}".` });
}

// The lead removes a co-tutor, or a co-tutor leaves (tutorUid = themselves). A pending invitation is withdrawn the same way.
export async function removeTutor(db: Firestore, uid: string, courseId: string, tutorUid: string, now = new Date()): Promise<void> {
  if (!safeId(courseId) || !safeId(tutorUid)) throw new CourseError("Which tutor?");
  if (tutorUid !== uid) await editable(db, uid, courseId, "lead");
  const iref = db.doc(`courseTutorInvites/${tutorInviteId(courseId, tutorUid)}`), cref = db.doc(`courses/${courseId}`);
  await db.runTransaction(async (t) => {
    const [is, cs] = await Promise.all([t.get(iref), t.get(cref)]);
    const i = is.data() as TutorInvite | undefined;
    if (!i || (i.status !== "pending" && i.status !== "accepted")) throw new CourseError("They aren't a tutor on this course.", 404);
    t.update(iref, { status: "removed", respondedAt: iso(now) });
    if (cs.exists) t.update(cref, { tutors: ((cs.data()!.tutors as Tutor[] | undefined) ?? []).filter((x) => x.uid !== tutorUid), tutorUids: FieldValue.arrayRemove(tutorUid) });
  });
}

// ---- learners ----
// Enrolling in a free course is free and idempotent. A paid course's enrolment is made when it's bought (lib/course-sales-server.ts);
// its tutors may enrol to try it, without counting as learners.
export async function enrol(db: Firestore, uid: string, courseId: string, now = new Date()): Promise<Enrolment> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  const ref = db.doc(`courses/${courseId}`), eref = db.doc(`enrolments/${courseId}_${uid}`);
  const cs = await ref.get();
  if (!cs.exists) throw new CourseError("That course isn't open.", 404);
  const c = courseOf(cs.id, cs.data()!);
  const access = await accessTo(db, uid, c);
  if (c.status !== "published" && !access) throw new CourseError("That course isn't open.", 404);
  if (isPaid(c) && !access) {
    const e = await eref.get();
    if (e.exists) return enrolmentOf(e.data()!);
    throw new CourseError("Buy the course to start it.", 402);
  }
  return db.runTransaction(async (t) => {
    const e = await t.get(eref);
    if (e.exists) return enrolmentOf(e.data()!);
    const data: Enrolment = { courseId, uid, enrolledAt: iso(now), done: {}, lastLessonId: null, completedAt: null };
    t.set(eref, data);
    if (!access) t.update(ref, { enrolCount: FieldValue.increment(1) });
    return data;
  });
}

// The course and the learner's enrolment, read in a transaction, with the checks every tick (and every quiz) needs.
async function learnerIn(db: Firestore, t: Transaction, uid: string, courseId: string, lessonId: string, access: CourseAccess | null) {
  const ref = db.doc(`courses/${courseId}`), eref = db.doc(`enrolments/${courseId}_${uid}`);
  const [cs, es] = await Promise.all([t.get(ref), t.get(eref)]);
  if (!cs.exists) throw new CourseError("That course doesn't exist (any more).", 404);
  const c = courseOf(cs.id, cs.data()!);
  if (c.status !== "published" && !access) throw new CourseError("That course isn't open.", 404);
  if (!es.exists) throw new CourseError(isPaid(c) ? "Buy the course to start it." : "Enrol first (it's free).", 403);
  if (!c.lessonIds.includes(lessonId)) throw new CourseError("That lesson isn't in this course any more.", 404);
  return { c, e: enrolmentOf(es.data()!), eref };
}
// Writes the tick (after every read of the transaction). Completed when every lesson the course has now is done.
function tick(t: Transaction, c: Course, e: Enrolment, eref: DocumentReference, lessonId: string, done: boolean, now: Date): Enrolment {
  const map = { ...e.done };
  if (done) map[lessonId] = map[lessonId] || iso(now); else delete map[lessonId];
  const complete = c.lessonIds.length > 0 && c.lessonIds.every((id) => !!map[id]);
  const next: Enrolment = { ...e, done: map, lastLessonId: lessonId, completedAt: complete ? e.completedAt || iso(now) : null };
  t.set(eref, { done: map, lastLessonId: lessonId, completedAt: next.completedAt }, { merge: true });
  return next;
}
async function kindIn(db: Firestore, t: Transaction, c: Course, lessonId: string): Promise<string> {
  const o = c.outline?.find((x) => x.id === lessonId);
  if (o) return o.kind;
  return String((await t.get(db.doc(`courses/${c.id}/lessons/${lessonId}`))).data()?.kind ?? "");
}

// Ticks a lesson off (or back on). Completed when every lesson the course has now is done. A quiz is ticked off only once the
// learner has passed it (submitQuiz does it then); un-ticking is always fine.
export async function markLesson(db: Firestore, uid: string, courseId: string, lessonId: string, done: boolean, now = new Date()): Promise<Enrolment> {
  if (!safeId(courseId) || !safeId(lessonId)) throw new CourseError("Which lesson?");
  const pre = await db.doc(`courses/${courseId}`).get();
  const access = pre.exists ? await accessTo(db, uid, courseOf(pre.id, pre.data()!)) : null;
  return db.runTransaction(async (t) => {
    const { c, e, eref } = await learnerIn(db, t, uid, courseId, lessonId, access);
    if (done && !e.done[lessonId] && (await kindIn(db, t, c, lessonId)) === "quiz") {
      const a = (await t.get(db.doc(`quizAttempts/${quizAttemptId(courseId, lessonId, uid)}`))).data();
      if (!a?.passedAt) throw new CourseError("Pass the quiz to tick this lesson off.", 409);
    }
    return tick(t, c, e, eref, lessonId, done, now);
  });
}

// ---- quizzes ----
export type QuizAttempt = { courseId: string; lessonId: string; uid: string; attempts: number; best: number; lastPercent: number; lastAt: string; passedAt?: string };
// A learner's answers to a quiz lesson (an option's index per question, in order): marked here, the attempt recorded, and on a pass
// the lesson ticked off. Returns the grade with each question's right answer and explanation. Retakes are unlimited.
export async function submitQuiz(db: Firestore, uid: string, courseId: string, lessonId: string, answers: unknown, now = new Date()): Promise<{ grade: QuizGrade; attempt: QuizAttempt; enrolment: Enrolment }> {
  if (!safeId(courseId) || !safeId(lessonId)) throw new CourseError("Which quiz?");
  if (!Array.isArray(answers) || answers.length > 100) throw new CourseError("Send your answers.");
  const pre = await db.doc(`courses/${courseId}`).get();
  const access = pre.exists ? await accessTo(db, uid, courseOf(pre.id, pre.data()!)) : null;
  return db.runTransaction(async (t) => {
    const { c, e, eref } = await learnerIn(db, t, uid, courseId, lessonId, access);
    const aref = db.doc(`quizAttempts/${quizAttemptId(courseId, lessonId, uid)}`);
    const [ls, ks, as] = await Promise.all([t.get(db.doc(`courses/${courseId}/lessons/${lessonId}`)), t.get(db.doc(`quizKeys/${quizKeyId(courseId, lessonId)}`)), t.get(aref)]);
    const lesson = ls.exists ? lessonOf(ls.id, ls.data()!) : null;
    const key = keyOf(ks.data());
    if (!lesson || lesson.kind !== "quiz" || !lesson.quiz || !key) throw new CourseError("That lesson isn't a quiz.", 404);
    if (answers.length !== key.answers.length || answers.some((a) => !Number.isInteger(a))) throw new CourseError("Answer every question first.");
    const grade = gradeQuiz(key, answers, lesson.quiz.passPercent);
    const old = as.data();
    const attempt: QuizAttempt = {
      courseId, lessonId, uid, attempts: (Number(old?.attempts) || 0) + 1, best: Math.max(Number(old?.best) || 0, grade.percent), lastPercent: grade.percent, lastAt: iso(now),
      ...(old?.passedAt ? { passedAt: String(old.passedAt) } : grade.passed ? { passedAt: iso(now) } : {}),
    };
    t.set(aref, attempt);
    const enrolment = grade.passed ? tick(t, c, e, eref, lessonId, true, now) : e;
    return { grade, attempt, enrolment };
  });
}

// The class and community links, for a learner who enrolled (or bought) and for the tutors. Null for anyone else.
export async function linksFor(db: Firestore, uid: string, courseId: string): Promise<CourseLinks | null> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  const cs = await db.doc(`courses/${courseId}`).get();
  if (!cs.exists) throw new CourseError("That course doesn't exist (any more).", 404);
  const c = courseOf(cs.id, cs.data()!);
  if (!(await accessTo(db, uid, c))) {
    const e = (await db.doc(`enrolments/${courseId}_${uid}`).get()).data();
    if (!e || (isPaid(c) && !e.purchaseRef)) return null;
  }
  return linksOf(db, courseId);
}

// One more look at a published course, and the day's bucket (pageViews/course_{id}_{yyyymmdd}) that Most viewed and Trending
// rank by. The tutors' own looks don't count; the route lets each visitor count once a day.
export async function recordCourseView(db: Firestore, courseId: string, viewerUid?: string, now = new Date(), source: Source = "direct"): Promise<boolean> {
  if (!safeId(courseId)) return false;
  const ref = db.doc(`courses/${courseId}`);
  return db.runTransaction(async (t) => {
    const c = await t.get(ref);
    if (!c.exists || c.data()!.status !== "published") return false;
    if (viewerUid && (viewerUid === c.data()!.ownerUid || strings(c.data()!.tutorUids).includes(viewerUid))) return false;
    t.update(ref, { viewCount: FieldValue.increment(1) });
    t.set(db.doc(`pageViews/course_${courseId}_${dayKey(now).replace(/-/g, "")}`), { kind: "course", id: courseId, day: dayKey(now), count: FieldValue.increment(1) }, { merge: true });
    const owner = String(c.data()!.ownerUid ?? "");
    if (owner) t.set(ownerVisitRef(db, owner, dayKey(now)), ownerVisitData(owner, dayKey(now), "course", courseId, source), { merge: true }); // the teacher's analytics
    return true;
  });
}

// ---- everyone: the published courses, with each teacher as they are now (suspended teachers' courses are left out) ----
async function buildListing(db: Firestore): Promise<CourseListing[]> {
  const snap = await db.collection("courses").where("status", "==", "published").get();
  const courses = snap.docs.map((d) => courseOf(d.id, d.data()));
  if (!courses.length) return [];
  const uids = Array.from(new Set(courses.map((c) => c.ownerUid)));
  const [owners, week] = await Promise.all([db.getAll(...uids.map((u) => db.doc(`users/${u}`))), weeklyViews()]);
  const who = new Map(owners.map((o) => [o.id, o.data()]));
  return courses.flatMap((c) => {
    const u = who.get(c.ownerUid);
    if (!u || u.suspended === true || !u.username) return [];
    return [{
      id: c.id, slug: c.slug, title: c.title, summary: c.summary, cover: c.cover, topics: c.topics, lessonIds: c.lessonIds, lessonCount: c.lessonCount, minutes: c.minutes,
      enrolCount: c.enrolCount, views: c.viewCount, viewsWeek: week.course[c.id] ?? 0, publishedAt: c.publishedAt || c.createdAt,
      ownerUid: c.ownerUid, ownerUsername: String(u.username), ownerName: String(u.displayName || u.username), ownerAvatar: String(u.avatar ?? ""),
      likeCount: c.likeCount ?? 0, rating: courseRating(c),
      priceKobo: c.priceKobo ?? 0, level: c.level ?? "", format: c.format ?? "self", language: c.language ?? "English", subtopics: c.subtopics ?? [],
      tutorCount: 1 + (c.tutors?.length ?? 0), isOrg: !!c.isOrg,
    }];
  });
}
const listing = ttlCache(60_000, () => buildListing(getAdminDb()));
// Notes Academy (/academy, GET /api/public/academy), profiles, member sites and Trending. Kept a minute.
export const getAcademy = (): Promise<CourseListing[]> => listing().catch(() => []);

// Whether the member may teach now, and if not, why (the Teach page shows it).
export async function teachingStatus(db: Firestore, uid: string): Promise<{ canTeach: boolean; reason?: string }> {
  try { await teacher(db, uid); return { canTeach: true }; } catch (e) { return { canTeach: false, reason: e instanceof Error ? e.message : undefined }; }
}
