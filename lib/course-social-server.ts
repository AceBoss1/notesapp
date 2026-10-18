import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { notifyBell } from "./email";
import { notifyMentions } from "./mentions-server";
import { whoIs } from "./reviews-server";
import { ReviewError, breakdownOf, cleanReply, cleanReview, summarise, type RatingSummary, type Review } from "./reviews";
import { courseHref, reviewProgress, type Enrolment } from "./courses";

// Likes, saves and reviews on Notes Academy courses. Server only; the pages go through /api/academy/social and /api/academy/reviews.
//   courseLikes/{uid}_{courseId}   a like (courses/{id}.likeCount keeps the total)
//   savedCourses/{uid}_{courseId}  a save, shown under Saved → Courses (each member reads their own)
//   courseReviews/{uid}_{courseId} a review: one each, editable; courses/{id}.ratingSum and ratingCount keep the totals.
// Learners may review once they've done half the lessons (lib/courses.ts reviewProgress); the teacher can reply once to each review.
const need = (cond: boolean, msg: string, status = 403) => { if (!cond) throw new ReviewError(msg, status); };
const safe = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
type CourseDoc = { title?: string; slug?: string; ownerUid?: string; status?: string; lessonIds?: string[]; likeCount?: number; ratingSum?: number; ratingCount?: number };

async function published(db: Firestore, courseId: string) {
  need(safe(courseId), "Which course?", 400);
  const ref = db.doc(`courses/${courseId}`);
  const c = (await ref.get()).data() as CourseDoc | undefined;
  need(!!c && c.status === "published", "That course isn't published.", 404);
  return { ref, c: c! };
}

export async function toggleCourseLike(db: Firestore, uid: string, courseId: string, now = new Date()): Promise<{ liked: boolean; likeCount: number }> {
  const { ref } = await published(db, courseId);
  const like = db.doc(`courseLikes/${uid}_${courseId}`);
  return db.runTransaction(async (t) => {
    const [l, c] = await Promise.all([t.get(like), t.get(ref)]);
    const count = Number(c.data()?.likeCount) || 0;
    if (l.exists) { t.delete(like); t.update(ref, { likeCount: FieldValue.increment(-1) }); return { liked: false, likeCount: Math.max(0, count - 1) }; }
    t.set(like, { uid, courseId, at: now.toISOString() });
    t.update(ref, { likeCount: FieldValue.increment(1) });
    return { liked: true, likeCount: count + 1 };
  });
}

export async function toggleCourseSave(db: Firestore, uid: string, courseId: string, now = new Date()): Promise<{ saved: boolean }> {
  const save = db.doc(`savedCourses/${uid}_${courseId}`);
  if ((await save.get()).exists) { await save.delete(); return { saved: false }; }
  await published(db, courseId);
  await save.set({ uid, courseId, savedAt: now.toISOString() });
  return { saved: true };
}

// What the course page shows above the fold: the likes (and whether you liked and saved it) and the stars.
export async function courseSocial(db: Firestore, courseId: string, uid?: string): Promise<{ likeCount: number; liked: boolean; saved: boolean; rating: RatingSummary }> {
  const { c } = await published(db, courseId);
  const [l, s] = uid ? await db.getAll(db.doc(`courseLikes/${uid}_${courseId}`), db.doc(`savedCourses/${uid}_${courseId}`)) : [null, null];
  return { likeCount: Number(c.likeCount) || 0, liked: !!l?.exists, saved: !!s?.exists, rating: summarise(Number(c.ratingSum) || 0, Number(c.ratingCount) || 0) };
}

const toReview = (id: string, d: FirebaseFirestore.DocumentData): Review => ({
  id, itemId: String(d.courseId), itemTitle: String(d.courseTitle ?? ""), ownerUid: String(d.ownerUid), uid: String(d.uid), name: String(d.name ?? "Member"),
  username: String(d.username ?? ""), avatar: String(d.avatar ?? ""), rating: Number(d.rating) || 0, text: String(d.text ?? ""), createdAt: String(d.createdAt ?? ""),
  ...(d.updatedAt ? { updatedAt: String(d.updatedAt) } : {}), ...(d.reply ? { reply: d.reply } : {}), verified: d.finished === true,
});

async function enrolmentOf(db: Firestore, uid: string, courseId: string): Promise<Enrolment | undefined> {
  return (await db.doc(`enrolments/${courseId}_${uid}`).get()).data() as Enrolment | undefined;
}

export async function submitCourseReview(db: Firestore, uid: string, courseId: string, input: { rating?: unknown; text?: unknown }, now = new Date(), notify = notifyBell): Promise<{ summary: RatingSummary }> {
  const clean = cleanReview(input);
  const { ref: courseRef, c } = await published(db, courseId);
  need(c.ownerUid !== uid, "You teach this course, so you can't review it.");
  const e = await enrolmentOf(db, uid, courseId);
  need(!!e, "Enrol and work through the course first, then review it.");
  const p = reviewProgress(c.lessonIds ?? [], e!.done);
  need(p.ok, `You can review this course once you've done ${p.needed} of its ${p.total} lessons (you've done ${p.done}).`);
  const me = await whoIs(db, uid);
  const ref = db.doc(`courseReviews/${uid}_${courseId}`);
  const at = now.toISOString();
  const summary = await db.runTransaction(async (t) => {
    const [old, cs] = await Promise.all([t.get(ref), t.get(courseRef)]);
    let sum = Number(cs.data()?.ratingSum) || 0, count = Number(cs.data()?.ratingCount) || 0;
    if (old.exists) sum -= Number(old.data()!.rating) || 0; else count += 1;
    sum += clean.rating;
    t.update(courseRef, { ratingSum: sum, ratingCount: count });
    t.set(ref, {
      courseId, courseTitle: String(c.title ?? ""), ownerUid: String(c.ownerUid), uid, name: me.name, username: me.username, avatar: me.avatar,
      rating: clean.rating, text: clean.text, finished: !!e!.completedAt, createdAt: old.exists ? old.data()!.createdAt : at,
      ...(old.exists ? { updatedAt: at, reply: old.data()!.reply ?? null } : {}),
    });
    return summarise(sum, count);
  });
  const href = `${courseHref(String(c.slug ?? ""))}#reviews`;
  await notify({ uid: String(c.ownerUid), type: "review", linkHref: href, message: `${me.name} left ${clean.rating} star${clean.rating === 1 ? "" : "s"} on your course ${String(c.title ?? "")}.` }).catch(() => {});
  if (clean.text) await notifyMentions(db, { kind: "review", sourceId: ref.id, text: clean.text, author: { uid, name: me.name, username: me.username, avatar: me.avatar }, where: `in a review of the course ${String(c.title ?? "")}`, linkHref: href, skipUids: [String(c.ownerUid)] }, now).catch(() => {});
  return { summary };
}

export async function deleteCourseReview(db: Firestore, uid: string, reviewId: string): Promise<void> {
  need(safe(reviewId.replace("_", "")), "Which review?", 400);
  const ref = db.doc(`courseReviews/${reviewId}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(ref);
    need(s.exists, "That review wasn't found.", 404);
    need(s.data()!.uid === uid, "You can only remove your own review.");
    const courseRef = db.doc(`courses/${s.data()!.courseId}`);
    const c = await t.get(courseRef);
    t.delete(ref);
    if (c.exists) t.update(courseRef, { ratingSum: Math.max(0, (Number(c.data()?.ratingSum) || 0) - Number(s.data()!.rating)), ratingCount: Math.max(0, (Number(c.data()?.ratingCount) || 0) - 1) });
  });
}

export async function replyToCourseReview(db: Firestore, teacherUid: string, reviewId: string, text: unknown, now = new Date(), notify = notifyBell): Promise<void> {
  const reply = cleanReply(text);
  need(safe(reviewId.replace("_", "")), "Which review?", 400);
  const ref = db.doc(`courseReviews/${reviewId}`);
  const s = await ref.get();
  need(s.exists, "That review wasn't found.", 404);
  const r = s.data()!;
  need(r.ownerUid === teacherUid, "Only the teacher can reply to a review of their course.");
  need(!r.reply, "You've already replied to this review.", 409);
  await ref.update({ reply: { text: reply, at: now.toISOString() } });
  const slug = String((await db.doc(`courses/${r.courseId}`).get()).data()?.slug ?? "");
  await notify({ uid: String(r.uid), type: "review", linkHref: `${courseHref(slug)}#reviews`, message: `The teacher replied to your review of ${String(r.courseTitle ?? "their course")}.` }).catch(() => {});
}

export type CourseReviewList = {
  reviews: Review[]; summary: RatingSummary; breakdown: number[]; canReview: boolean; mine: Review | null;
  progress: { done: number; total: number; needed: number; ok: boolean } | null; // the viewer's, when they're enrolled
};

export async function listCourseReviews(db: Firestore, courseId: string, viewerUid?: string): Promise<CourseReviewList> {
  const { c } = await published(db, courseId);
  const snap = await db.collection("courseReviews").where("courseId", "==", courseId).get();
  const all = snap.docs.map((d) => toReview(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mine = viewerUid ? all.find((r) => r.uid === viewerUid) ?? null : null;
  let progress: CourseReviewList["progress"] = null;
  if (viewerUid && viewerUid !== c.ownerUid) {
    const e = await enrolmentOf(db, viewerUid, courseId);
    if (e) progress = reviewProgress(c.lessonIds ?? [], e.done);
  }
  return {
    reviews: all.slice(0, 50), summary: summarise(Number(c.ratingSum) || 0, Number(c.ratingCount) || 0), breakdown: breakdownOf(all.map((r) => r.rating)),
    canReview: !!mine || !!progress?.ok, mine, progress,
  };
}
