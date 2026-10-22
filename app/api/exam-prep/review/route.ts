import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { PrepError, allSubjects, reviewerOf, reviewQueue, reviewQuestion } from "@/lib/exam-prep-server";
import { bearer, body, db, fail, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// The review queue, for reviewers (invited) and content admins only: never payments, students or anything else.
async function reviewer(req: NextRequest) {
  const u = await needUser(req);
  const admin = await verifyAdminRequest(bearer(req), ["content"]).then(() => true).catch(() => false);
  const rev = admin ? null : await reviewerOf(db(), u.uid);
  if (!admin && !rev) throw new PrepError("The review queue is for Naija Exam Prep reviewers.", 403);
  const me = (await db().doc(`users/${u.uid}`).get()).data();
  // A content admin reviews any subject; a reviewer only the subjects their invites named.
  return { uid: u.uid, name: String(me?.displayName || me?.username || "Reviewer"), admin, subjects: rev ? rev.subjects : null, reviews: rev?.reviews ?? 0 };
}
// GET ?status=&exam= → questions in that state.
export async function GET(req: NextRequest) {
  try {
    const r = await reviewer(req);
    const q = req.nextUrl.searchParams;
    const status = r.admin ? q.get("status") : "in_review";
    const subs = await allSubjects(db());
    const labels = r.subjects?.map((k) => { const x = subs.find((y) => `${y.exam}_${y.id}` === k); return x ? `${x.exam.toUpperCase()} ${x.name}` : k; }) ?? null;
    return ok({ me: { name: r.name, admin: r.admin, subjects: labels, reviews: r.reviews }, questions: await reviewQueue(db(), { status, exam: q.get("exam"), subjects: r.subjects }) });
  } catch (e) { return fail(e); }
}
// POST { id, decision: approve | changes, note } → a review.
export async function POST(req: NextRequest) {
  try {
    const r = await reviewer(req);
    const b = await body(req);
    return ok(await reviewQuestion(db(), r, b.id, b.decision, b.note));
  } catch (e) { return fail(e); }
}
