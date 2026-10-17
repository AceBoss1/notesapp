import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { enrol } from "@/lib/courses-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// Signed-in members: POST { courseId } → { enrolment }. Free; enrolling twice changes nothing.
export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-enrol", uid, 30, 600);
    if (limited) return limited;
    const { courseId } = await req.json().catch(() => ({}));
    return NextResponse.json({ enrolment: await enrol(getAdminDb(), uid, String(courseId ?? "")) });
  } catch (err) {
    return academyError(err, "Couldn't enrol you");
  }
}
