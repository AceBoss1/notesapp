import { FieldValue, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";
import { weeklyViews } from "./discovery-server";
import { canPublish, type UserProfile } from "./users";
import {
  MAX_COURSES_PER_MEMBER, MAX_LESSONS, cleanCourseFields, courseRating, cleanLesson, publishProblems, slugify,
  type Course, type CourseListing, type Enrolment, type Lesson, type LessonInput,
} from "./courses";

// Server-only. Notes Academy courses (docs/COURSES.md, step 1): every write to courses/{id}, courses/{id}/lessons/{lessonId},
// enrolments/{courseId}_{uid} and the slug reservations (courseSlugs/{slug}) happens here, called by the /api/academy routes.
export class CourseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const safeId = (id: unknown) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const iso = (now: Date) => now.toISOString();
const dayKey = (now: Date) => now.toISOString().slice(0, 10);

export function courseOf(id: string, d: FirebaseFirestore.DocumentData): Course {
  return {
    id, ownerUid: String(d.ownerUid ?? ""), ownerUsername: String(d.ownerUsername ?? ""), ownerName: String(d.ownerName ?? ""), ownerAvatar: String(d.ownerAvatar ?? ""),
    title: String(d.title ?? ""), slug: String(d.slug ?? ""), summary: String(d.summary ?? ""), topics: Array.isArray(d.topics) ? d.topics.map(String) : [], cover: String(d.cover ?? ""),
    free: true, status: d.status === "published" ? "published" : "draft", lessonIds: Array.isArray(d.lessonIds) ? d.lessonIds.map(String) : [],
    lessonCount: Number(d.lessonCount) || 0, minutes: Number(d.minutes) || 0, enrolCount: Number(d.enrolCount) || 0, viewCount: Number(d.viewCount) || 0,
    createdAt: String(d.createdAt ?? ""), updatedAt: String(d.updatedAt ?? ""), publishedAt: d.publishedAt ? String(d.publishedAt) : null,
    likeCount: Number(d.likeCount) || 0, ratingSum: Number(d.ratingSum) || 0, ratingCount: Number(d.ratingCount) || 0,
  };
}
export function lessonOf(id: string, d: FirebaseFirestore.DocumentData): Lesson {
  return {
    id, order: Number(d.order) || 0, title: String(d.title ?? ""), kind: d.kind === "text" ? "text" : "youtube",
    ...(d.youtubeId ? { youtubeId: String(d.youtubeId) } : {}), ...(Number(d.minutes) > 0 ? { minutes: Number(d.minutes) } : {}), ...(typeof d.body === "string" ? { body: d.body } : {}),
  };
}
const enrolmentOf = (d: FirebaseFirestore.DocumentData): Enrolment => ({
  courseId: String(d.courseId), uid: String(d.uid), enrolledAt: String(d.enrolledAt ?? ""), done: d.done && typeof d.done === "object" ? d.done : {},
  lastLessonId: d.lastLessonId ? String(d.lastLessonId) : null, completedAt: d.completedAt ? String(d.completedAt) : null,
  ...(d.certificateId ? { certificateId: String(d.certificateId) } : {}),
});

// The member as a teacher: a publishing account (free Basic and up) that isn't suspended.
async function teacher(db: Firestore, uid: string): Promise<UserProfile> {
  const p = (await db.doc(`users/${uid}`).get()).data() as UserProfile | undefined;
  if (!p) throw new CourseError("Profile not found.", 404);
  if (p.suspended === true) throw new CourseError("Teaching is paused while your account is suspended.", 403);
  if (!canPublish(p)) throw new CourseError("Teaching is for publishing accounts. Start publishing (it's free on Basic), then come back.", 403);
  return p;
}
const ownerFields = (p: UserProfile) => ({ ownerUsername: p.username, ownerName: p.displayName || p.username, ownerAvatar: p.avatar || "" });

async function ownCourse(db: Firestore, uid: string, id: string, t?: Transaction): Promise<{ ref: DocumentReference; c: Course }> {
  if (!safeId(id)) throw new CourseError("Which course?");
  const ref = db.doc(`courses/${id}`);
  const snap = t ? await t.get(ref) : await ref.get();
  if (!snap.exists) throw new CourseError("That course doesn't exist (any more).", 404);
  const c = courseOf(snap.id, snap.data()!);
  if (c.ownerUid !== uid) throw new CourseError("Only the teacher can change this course.", 403);
  return { ref, c };
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
export async function createCourse(db: Firestore, uid: string, body: Record<string, unknown>, now = new Date()): Promise<Course> {
  const p = await teacher(db, uid);
  const f = cleanCourseFields(body);
  if (typeof f === "string") throw new CourseError(f);
  if (!f.title) throw new CourseError("Give the course a title.");
  const mine = await db.collection("courses").where("ownerUid", "==", uid).count().get();
  if (mine.data().count >= MAX_COURSES_PER_MEMBER) throw new CourseError(`You can have up to ${MAX_COURSES_PER_MEMBER} courses. Delete one you no longer need first.`, 409);
  const ref = db.collection("courses").doc();
  const slug = await reserveSlug(db, f.title, ref.id);
  const data = {
    ownerUid: uid, ...ownerFields(p), title: f.title, slug, summary: f.summary ?? "", topics: f.topics ?? [], cover: f.cover ?? "", free: true, status: "draft",
    lessonIds: [], lessonCount: 0, minutes: 0, enrolCount: 0, viewCount: 0, createdAt: iso(now), updatedAt: iso(now), publishedAt: null,
  };
  await ref.set(data);
  return courseOf(ref.id, data);
}

export async function myCourses(db: Firestore, uid: string): Promise<Course[]> {
  const snap = await db.collection("courses").where("ownerUid", "==", uid).get();
  return snap.docs.map((d) => courseOf(d.id, d.data())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// One of the teacher's courses with its lessons in order (the editor, and the preview of a draft), by id or by address.
export async function courseForOwner(db: Firestore, uid: string, by: { id?: string; slug?: string }): Promise<{ course: Course; lessons: Lesson[] }> {
  let id = by.id;
  if (!id && by.slug) id = (await db.doc(`courseSlugs/${by.slug}`).get()).data()?.courseId;
  if (!id) throw new CourseError("That course doesn't exist (any more).", 404);
  const { ref, c } = await ownCourse(db, uid, id);
  const lessons = (await ref.collection("lessons").orderBy("order").get()).docs.map((d) => lessonOf(d.id, d.data()));
  return { course: c, lessons };
}

export async function updateCourse(db: Firestore, uid: string, id: string, body: Record<string, unknown>, now = new Date()): Promise<Course> {
  const p = await teacher(db, uid);
  const { ref, c } = await ownCourse(db, uid, id);
  const f = cleanCourseFields(body);
  if (typeof f === "string") throw new CourseError(f);
  if (f.title === "") throw new CourseError("Give the course a title.");
  if (c.status === "published" && f.summary === "") throw new CourseError("A published course needs a summary.");
  const patch: Record<string, unknown> = { ...f, ...ownerFields(p), updatedAt: iso(now) };
  // The address follows the title until the course is first published; after that, links people shared keep working.
  if (f.title && !c.publishedAt && slugify(f.title) !== slugify(c.title)) {
    patch.slug = await reserveSlug(db, f.title, id);
    await db.doc(`courseSlugs/${c.slug}`).delete().catch(() => {});
  }
  await ref.update(patch);
  return courseOf(id, { ...c, ...patch });
}

export async function deleteCourse(db: Firestore, uid: string, id: string): Promise<void> {
  await teacher(db, uid);
  const { ref, c } = await ownCourse(db, uid, id);
  const enrolled = await db.collection("enrolments").where("courseId", "==", id).get();
  for (let i = 0; i < enrolled.docs.length; i += 400) {
    const b = db.batch();
    enrolled.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  await db.recursiveDelete(ref); // the course and its lessons
  await db.doc(`courseSlugs/${c.slug}`).delete().catch(() => {});
}

export async function setPublished(db: Firestore, uid: string, id: string, publish: boolean, now = new Date()): Promise<Course> {
  const p = await teacher(db, uid);
  const { ref, c } = await ownCourse(db, uid, id);
  if (publish) {
    const missing = publishProblems(c, c.lessonIds.length);
    if (missing.length) throw new CourseError(`Before publishing, add ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}.`);
  }
  const patch = { status: publish ? "published" : "draft", ...ownerFields(p), updatedAt: iso(now), ...(publish && !c.publishedAt ? { publishedAt: iso(now) } : {}) };
  await ref.update(patch);
  return courseOf(id, { ...c, ...patch });
}

// ---- lessons: each change runs in one transaction with the course, so the order, the count and the minutes always agree ----
async function editLessons<T>(db: Firestore, uid: string, courseId: string, now: Date,
  fn: (t: Transaction, ctx: { ref: DocumentReference; course: Course; lessons: Lesson[] }) => { lessons: Lesson[]; result: T }): Promise<T> {
  await teacher(db, uid);
  return db.runTransaction(async (t) => {
    const { ref, c } = await ownCourse(db, uid, courseId, t);
    const lessons = (await t.get(ref.collection("lessons").orderBy("order"))).docs.map((d) => lessonOf(d.id, d.data()));
    const out = fn(t, { ref, course: c, lessons });
    const list = out.lessons;
    if (c.status === "published" && list.length === 0) throw new CourseError("A published course needs at least one lesson. Unpublish it first, or add another lesson before deleting this one.");
    t.update(ref, { lessonIds: list.map((l) => l.id), lessonCount: list.length, minutes: list.reduce((n, l) => n + (l.minutes ?? 0), 0), updatedAt: iso(now) });
    return out.result;
  });
}
const lessonFields = (l: LessonInput, order: number): Omit<Lesson, "id"> =>
  ({ order, title: l.title, kind: l.kind, ...(l.youtubeId ? { youtubeId: l.youtubeId } : {}), ...(l.minutes ? { minutes: l.minutes } : {}), ...(l.body ? { body: l.body } : {}) });

export async function addLesson(db: Firestore, uid: string, courseId: string, body: Record<string, unknown>, now = new Date()): Promise<Lesson> {
  const l = cleanLesson(body);
  if (typeof l === "string") throw new CourseError(l);
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    if (lessons.length >= MAX_LESSONS) throw new CourseError(`A course can have up to ${MAX_LESSONS} lessons.`, 409);
    const lr = ref.collection("lessons").doc();
    const fields = lessonFields(l, (lessons[lessons.length - 1]?.order ?? -1) + 1);
    t.set(lr, fields);
    const lesson: Lesson = { id: lr.id, ...fields };
    return { lessons: [...lessons, lesson], result: lesson };
  });
}

export async function updateLesson(db: Firestore, uid: string, courseId: string, lessonId: string, body: Record<string, unknown>, now = new Date()): Promise<Lesson> {
  const l = cleanLesson(body);
  if (typeof l === "string") throw new CourseError(l);
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    const old = lessons.find((x) => x.id === lessonId);
    if (!old) throw new CourseError("That lesson doesn't exist (any more).", 404);
    const fields = lessonFields(l, old.order);
    // set (not merge): a lesson switched from text to video loses its text, and the other way round.
    t.set(ref.collection("lessons").doc(lessonId), fields);
    const lesson: Lesson = { id: lessonId, ...fields };
    return { lessons: lessons.map((x) => (x.id === lessonId ? lesson : x)), result: lesson };
  });
}

export async function deleteLesson(db: Firestore, uid: string, courseId: string, lessonId: string, now = new Date()): Promise<void> {
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    if (!lessons.some((x) => x.id === lessonId)) throw new CourseError("That lesson doesn't exist (any more).", 404);
    t.delete(ref.collection("lessons").doc(lessonId));
    return { lessons: lessons.filter((x) => x.id !== lessonId), result: undefined };
  });
}

// ids: every lesson of the course, in the new order.
export async function reorderLessons(db: Firestore, uid: string, courseId: string, ids: unknown, now = new Date()): Promise<string[]> {
  if (!Array.isArray(ids) || !ids.every(safeId)) throw new CourseError("Send the lessons in their new order.");
  return editLessons(db, uid, courseId, now, (t, { ref, lessons }) => {
    const byId = new Map(lessons.map((l) => [l.id, l]));
    if (ids.length !== lessons.length || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id as string))) throw new CourseError("The lessons changed in the meantime. Reload the page and try again.", 409);
    const list = (ids as string[]).map((id, i) => ({ ...byId.get(id)!, order: i }));
    list.forEach((l) => { if (byId.get(l.id)!.order !== l.order) t.update(ref.collection("lessons").doc(l.id), { order: l.order }); });
    return { lessons: list, result: list.map((l) => l.id) };
  });
}

// ---- learners ----
// Enrolling is free and idempotent. The teacher may enrol in their own course to try it, without counting as a learner.
export async function enrol(db: Firestore, uid: string, courseId: string, now = new Date()): Promise<Enrolment> {
  if (!safeId(courseId)) throw new CourseError("Which course?");
  const ref = db.doc(`courses/${courseId}`), eref = db.doc(`enrolments/${courseId}_${uid}`);
  return db.runTransaction(async (t) => {
    const [c, e] = await Promise.all([t.get(ref), t.get(eref)]);
    if (!c.exists || (c.data()!.status !== "published" && c.data()!.ownerUid !== uid)) throw new CourseError("That course isn't open.", 404);
    if (e.exists) return enrolmentOf(e.data()!);
    const data: Enrolment = { courseId, uid, enrolledAt: iso(now), done: {}, lastLessonId: null, completedAt: null };
    t.set(eref, data);
    if (c.data()!.ownerUid !== uid) t.update(ref, { enrolCount: FieldValue.increment(1) });
    return data;
  });
}

// Ticks a lesson off (or back on). Completed when every lesson the course has now is done.
export async function markLesson(db: Firestore, uid: string, courseId: string, lessonId: string, done: boolean, now = new Date()): Promise<Enrolment> {
  if (!safeId(courseId) || !safeId(lessonId)) throw new CourseError("Which lesson?");
  const ref = db.doc(`courses/${courseId}`), eref = db.doc(`enrolments/${courseId}_${uid}`);
  return db.runTransaction(async (t) => {
    const [cs, es] = await Promise.all([t.get(ref), t.get(eref)]);
    if (!cs.exists) throw new CourseError("That course doesn't exist (any more).", 404);
    const c = courseOf(cs.id, cs.data()!);
    if (c.status !== "published" && c.ownerUid !== uid) throw new CourseError("That course isn't open.", 404);
    if (!es.exists) throw new CourseError("Enrol first (it's free).", 403);
    if (!c.lessonIds.includes(lessonId)) throw new CourseError("That lesson isn't in this course any more.", 404);
    const e = enrolmentOf(es.data()!);
    const map = { ...e.done };
    if (done) map[lessonId] = map[lessonId] || iso(now); else delete map[lessonId];
    const complete = c.lessonIds.length > 0 && c.lessonIds.every((id) => !!map[id]);
    const next: Enrolment = { ...e, done: map, lastLessonId: lessonId, completedAt: complete ? e.completedAt || iso(now) : null };
    t.set(eref, { done: map, lastLessonId: lessonId, completedAt: next.completedAt }, { merge: true });
    return next;
  });
}

// One more look at a published course, and the day's bucket (pageViews/course_{id}_{yyyymmdd}) that Most viewed and Trending
// rank by. The teacher's own looks don't count; the route lets each visitor count once a day.
export async function recordCourseView(db: Firestore, courseId: string, viewerUid?: string, now = new Date()): Promise<boolean> {
  if (!safeId(courseId)) return false;
  const ref = db.doc(`courses/${courseId}`);
  return db.runTransaction(async (t) => {
    const c = await t.get(ref);
    if (!c.exists || c.data()!.status !== "published") return false;
    if (viewerUid && viewerUid === c.data()!.ownerUid) return false;
    t.update(ref, { viewCount: FieldValue.increment(1) });
    t.set(db.doc(`pageViews/course_${courseId}_${dayKey(now).replace(/-/g, "")}`), { kind: "course", id: courseId, day: dayKey(now), count: FieldValue.increment(1) }, { merge: true });
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
