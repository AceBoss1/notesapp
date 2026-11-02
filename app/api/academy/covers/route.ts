import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { coverStatus, generateCover } from "@/lib/covers-server";
import { NO_STORE, academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Course covers made with Nana (lib/covers-server.ts), for the course's tutors and admins.
// GET ?courseId= → { limit, used, left, resetsAt, items, allowance }: today's count, the recent covers and what pays for the AI.
// POST { courseId, prompt?, baseId? } → { item, status, fallback }: a new cover, or with baseId an edit of that one (prompt says what to
// change). Each counts 1 of the day's covers; the Pearl call comes from the member's Nana allowance (then credit) unless they use their
// own AI key. Use the item's url as the course's cover with PATCH /api/academy/courses/<id> { cover }.
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-read", uid, 120, 600);
    if (limited) return limited;
    return NextResponse.json(await coverStatus(getAdminDb(), uid, req.nextUrl.searchParams.get("courseId")), { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load the covers");
  }
}

export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-covers", uid, 30, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await generateCover(getAdminDb(), uid, { courseId: b.courseId, prompt: b.prompt, baseId: b.baseId }), { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't make the cover");
  }
}
