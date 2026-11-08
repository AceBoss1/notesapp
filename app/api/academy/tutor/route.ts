import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { askTutor, getTutorSettings, setTutorSettings } from "@/lib/tutor-server";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// The Nana tutor (lib/tutor.ts, lib/tutor-server.ts).
// GET ?courseId= → { settings }: the course's tutors read the switch and their notes.
// POST { action: "settings", courseId, on, notes } → { settings }: a lead or editing tutor switches it on or off.
// POST { courseId, lessonId?, lang, messages } → { reply, via, notice? }: an enrolled learner (or a tutor trying it) asks.
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    return NextResponse.json({ settings: await getTutorSettings(getAdminDb(), uid, req.nextUrl.searchParams.get("courseId")) }, { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load the tutor's settings");
  }
}

export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const b = await req.json().catch(() => ({}));
    if (b.action === "settings") {
      return NextResponse.json({ settings: await setTutorSettings(getAdminDb(), uid, b.courseId, b) }, { headers: NO_STORE });
    }
    const limited = await rateLimit(req, "academy-tutor", uid, 30, 600);
    if (limited) return limited;
    return NextResponse.json(await askTutor(getAdminDb(), uid, b), { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "The tutor couldn't answer just now");
  }
}
