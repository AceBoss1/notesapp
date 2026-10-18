import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ReviewError } from "@/lib/reviews";
import { deleteCourseReview, listCourseReviews, replyToCourseReview, submitCourseReview } from "@/lib/course-social-server";

export const dynamic = "force-dynamic";
const uidOf = async (req: NextRequest) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token ? (await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null))?.uid : undefined;
};
const fail = (err: unknown, fallback: string) => {
  if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Anyone: GET ?courseId=… → the reviews, the stars and how they split. Signed in: also yours, your progress and whether you can review.
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "course-reviews-read", clientIp(req), 120, 60);
    if (limited) return limited;
    return NextResponse.json(await listCourseReviews(getAdminDb(), req.nextUrl.searchParams.get("courseId") || "", await uidOf(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load reviews");
  }
}

// Signed in: POST { action: "review", courseId, rating, text } | { action: "delete", id } | { action: "reply", id, text } (the teacher).
export async function POST(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) throw new ReviewError("Sign in first.", 401);
    const limited = await rateLimit(req, "course-reviews-write", uid, 30, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "review": return NextResponse.json(await submitCourseReview(db, uid, String(b.courseId ?? ""), b));
      case "delete": await deleteCourseReview(db, uid, String(b.id ?? "")); return NextResponse.json({ ok: true });
      case "reply": await replyToCourseReview(db, uid, String(b.id ?? ""), b.text); return NextResponse.json({ ok: true });
      default: throw new ReviewError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
