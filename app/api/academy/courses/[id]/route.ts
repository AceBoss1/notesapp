import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { courseForOwner, deleteCourse, setPublished, updateCourse } from "@/lib/courses-server";
import { NO_STORE, academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";
import { dropUpload } from "@/lib/course-uploads-server";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

// One course, for its tutors only (the course editor, /academy/teach/<id>).
// GET → { course, lessons, access, links, invites, plan }. PATCH { title?, summary?, topics?, cover?, level?, language?, format?, outcomes?,
// requirements?, runsFor?, schedule?, modules?, classUrl?, communityUrl?; the lead also priceNaira?, certificateIncluded? } → { course }.
// DELETE → { ok } (with its lessons, uploads and learners' progress; not once it's been bought). POST { action: "publish" | "unpublish" }
// → { course }: publishing needs a title, a summary and a lesson (and for a paid course, a payout account).
// The signed-in member's id, or the response to send instead (not signed in, or too many requests).
async function teacherUid(req: NextRequest, bucket: string, max: number): Promise<string | NextResponse> {
  const uid = await signedInUid(req);
  if (!uid) return signInFirst();
  return (await rateLimit(req, bucket, uid, max, 600)) ?? uid;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const t = await teacherUid(req, "academy-read", 120);
    if (typeof t !== "string") return t;
    return NextResponse.json(await courseForOwner(getAdminDb(), t, { id: params.id }), { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load the course");
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const t = await teacherUid(req, "academy-write", 120);
    if (typeof t !== "string") return t;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ course: await updateCourse(getAdminDb(), t, params.id, b) });
  } catch (err) {
    return academyError(err, "Couldn't save the course");
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const t = await teacherUid(req, "academy-delete", 20);
    if (typeof t !== "string") return t;
    await deleteCourse(getAdminDb(), t, params.id, { dropUpload });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return academyError(err, "Couldn't delete the course");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const t = await teacherUid(req, "academy-write", 120);
    if (typeof t !== "string") return t;
    const { action } = await req.json().catch(() => ({}));
    if (action !== "publish" && action !== "unpublish") return NextResponse.json({ error: "Publish or unpublish?" }, { status: 400 });
    return NextResponse.json({ course: await setPublished(getAdminDb(), t, params.id, action === "publish") });
  } catch (err) {
    return academyError(err, "Couldn't change the course");
  }
}
