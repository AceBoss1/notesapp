import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { courseForOwner, createCourse, myCourses, myTutorInvites, teachingStatus } from "@/lib/courses-server";
import { NO_STORE, academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// The signed-in teacher's courses (Notes Academy, /academy/teach).
// GET → { courses, invites, canTeach, reason? }: every course they can edit (their own, their organisations', ones they co-teach), drafts
//   too, newest change first, and co-tutor invitations waiting for them.
// GET ?slug=<address> → { course, lessons, … }: one of theirs (how a draft is previewed on its course page).
// POST { title, summary?, topics?, cover?, orgUid? } → { course }: a new draft (publishing accounts only, up to 30 each; orgUid: as
//   that organisation, for its admins and writers).
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
    const [courses, invites, status] = await Promise.all([myCourses(db, uid), myTutorInvites(db, uid), teachingStatus(db, uid)]);
    return NextResponse.json({ courses, invites, ...status }, { headers: NO_STORE });
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
