import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { submitQuiz } from "@/lib/courses-server";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// Enrolled learners: POST { courseId, lessonId, answers } → { grade, attempt, enrolment }: a quiz lesson marked on the server (answers:
// an option's index per question). The grade says which were right, with the right answer and the tutor's explanation; a pass ticks
// the lesson off. Retakes are unlimited. The answers are never sent before this.
export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-quiz", uid, 60, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await submitQuiz(getAdminDb(), uid, String(b.courseId ?? ""), String(b.lessonId ?? ""), b.answers), { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't mark your quiz");
  }
}
