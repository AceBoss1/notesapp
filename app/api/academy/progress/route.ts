import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { markLesson } from "@/lib/courses-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";
import { firstValue } from "@/lib/growth-server";

export const dynamic = "force-dynamic";

// Enrolled learners: POST { courseId, lessonId, done } → { enrolment }: ticks the lesson off (done: true, the default) or back on.
export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-progress", uid, 240, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const enrolment = await markLesson(getAdminDb(), uid, String(b.courseId ?? ""), String(b.lessonId ?? ""), b.done !== false);
    if (b.done !== false) await firstValue(getAdminDb(), uid, "lesson"); // growth: a learner's first value
    return NextResponse.json({ enrolment });
  } catch (err) {
    return academyError(err, "Couldn't save your progress");
  }
}
