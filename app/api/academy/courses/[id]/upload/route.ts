import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { checkUploadStart, courseForOwner, CourseError } from "@/lib/courses-server";
import { startUpload } from "@/lib/course-uploads-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

// POST { kind: "video" | "pdf", name, size } → { uploadUrl, streamUid | fileKey }: where the editor sends a paid course's upload
// (whether the owner's plan may upload videos or PDFs, and how much, is set in Admin → Limits; see checkUploadStart). The lesson is
// then added with POST …/lessons, which checks the upload arrived and fits again.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-upload", uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    const { course } = await courseForOwner(db, uid, { id: params.id }, "tutor");
    if (!course.priceKobo) throw new CourseError("Uploads are for paid courses. Set a price first, or add a YouTube link.", 409);
    await checkUploadStart(db, course, b.kind, Number(b.size));
    return NextResponse.json(await startUpload(course.ownerUid, course.id, b.kind, b.name, b.size));
  } catch (err) {
    return academyError(err, "Couldn't start the upload");
  }
}
