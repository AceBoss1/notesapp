import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ReviewError } from "@/lib/reviews";
import { courseSocial, toggleCourseLike, toggleCourseSave } from "@/lib/course-social-server";

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

// Anyone: GET ?courseId=… → { likeCount, liked, saved, rating } (liked and saved are yours when signed in).
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "course-social-read", clientIp(req), 120, 60);
    if (limited) return limited;
    return NextResponse.json(await courseSocial(getAdminDb(), req.nextUrl.searchParams.get("courseId") || "", await uidOf(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load that");
  }
}

// Signed in: POST { action: "like" | "save", courseId } → toggles it.
export async function POST(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) throw new ReviewError("Sign in first.", 401);
    const limited = await rateLimit(req, "course-social-write", uid, 60, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const courseId = String(b.courseId ?? "");
    if (b.action === "like") return NextResponse.json(await toggleCourseLike(getAdminDb(), uid, courseId));
    if (b.action === "save") return NextResponse.json(await toggleCourseSave(getAdminDb(), uid, courseId));
    throw new ReviewError("Unknown action.");
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
