import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { courseForOwner, createCourse, myCourses, teachingStatus } from "@/lib/courses-server";
import { NO_STORE, academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// The signed-in teacher's courses (Notes Academy, /academy/teach).
// GET → { courses, canTeach, reason? }: theirs, drafts too, newest change first.
// GET ?slug=<address> → { course, lessons }: one of theirs (how a draft is previewed on its course page).
// POST { title, summary?, topics?, cover? } → { course }: a new draft (publishing accounts only, up to 30 each).
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-read", uid, 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const slug = req.nextUrl.searchParams.get("slug");
    if (slug !== null) {
      if (!/^[a-z0-9-]{1,80}$/.test(slug)) return NextResponse.json({ error: "Which course?" }, { status: 400 });
      return NextResponse.json(await courseForOwner(db, uid, { slug }), { headers: NO_STORE });
    }
    const [courses, status] = await Promise.all([myCourses(db, uid), teachingStatus(db, uid)]);
    return NextResponse.json({ courses, ...status }, { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load your courses");
  }
}

export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-create", uid, 10, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ course: await createCourse(getAdminDb(), uid, b) });
  } catch (err) {
    return academyError(err, "Couldn't create the course");
  }
}
