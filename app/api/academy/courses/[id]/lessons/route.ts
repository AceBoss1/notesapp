import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { addLesson, reorderLessons } from "@/lib/courses-server";
import { academyClosed, academyError, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

// A course's lessons, for its teacher only.
// POST { kind: "youtube", title, url, minutes? } or { kind: "text", title, body, minutes? } → { lesson }: added at the end.
// PUT { ids } → { ids }: every lesson's id, in the new order.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-write", uid, 120, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ lesson: await addLesson(getAdminDb(), uid, params.id, b) });
  } catch (err) {
    return academyError(err, "Couldn't add the lesson");
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    const limited = await rateLimit(req, "academy-write", uid, 120, 600);
    if (limited) return limited;
    const { ids } = await req.json().catch(() => ({}));
    return NextResponse.json({ ids: await reorderLessons(getAdminDb(), uid, params.id, ids) });
  } catch (err) {
    return academyError(err, "Couldn't move the lesson");
  }
}
