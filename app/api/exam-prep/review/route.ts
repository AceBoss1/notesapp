import { NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { PrepError, isReviewer, reviewQueue, reviewQuestion } from "@/lib/exam-prep-server";
import { bearer, body, db, fail, needUser, ok } from "@/lib/exam-prep-api";

export const dynamic = "force-dynamic";
// The review queue, for reviewers (invited) and content admins only: never payments, students or anything else.
async function reviewer(req: NextRequest) {
  const u = await needUser(req);
  const admin = await verifyAdminRequest(bearer(req), ["content"]).then(() => true).catch(() => false);
  if (!admin && !(await isReviewer(db(), u.uid))) throw new PrepError("The review queue is for Naija Exam Prep reviewers.", 403);
  const me = (await db().doc(`users/${u.uid}`).get()).data();
  return { uid: u.uid, name: String(me?.displayName || me?.username || "Reviewer"), admin };
}
// GET ?status=&exam= → questions in that state.
export async function GET(req: NextRequest) {
  try {
    const r = await reviewer(req);
    const q = req.nextUrl.searchParams;
    const status = r.admin ? q.get("status") : "in_review";
    return ok({ me: { name: r.name, admin: r.admin }, questions: await reviewQueue(db(), { status, exam: q.get("exam") }) });
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
