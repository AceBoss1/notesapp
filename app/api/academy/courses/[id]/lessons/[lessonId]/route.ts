import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { deleteLesson, updateLesson } from "@/lib/courses-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";
import { dropUpload, uploadChecks } from "@/lib/course-uploads-server";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string; lessonId: string } };

// One lesson, for the course's tutors only. PATCH (the same body as adding one) → { lesson }. DELETE → { ok }. A replaced or deleted
// upload is removed from Stream or the bucket.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-write", uid, 120, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const { lesson, replaced } = await updateLesson(getAdminDb(), uid, params.id, params.lessonId, b, new Date(), uploadChecks);
    if (replaced) await dropUpload(replaced);
    return NextResponse.json({ lesson });
  } catch (err) {
    return academyError(err, "Couldn't save the lesson");
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-write", uid, 120, 600);
    if (limited) return limited;
    await dropUpload(await deleteLesson(getAdminDb(), uid, params.id, params.lessonId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return academyError(err, "Couldn't delete the lesson");
  }
}
