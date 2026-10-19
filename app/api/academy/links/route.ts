import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ACADEMY_LIVE } from "@/lib/courses";
import { linksFor } from "@/lib/courses-server";
import { academyClosed, academyError, NO_STORE, signInFirst, signedInUid } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// GET ?courseId= → { links: { classUrl, communityUrl } | null }: the live class and the learners' group, for people who enrolled (a paid
// course: bought) and for its tutors. Never on the public course page.
export async function GET(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const uid = await signedInUid(req);
    if (!uid) return signInFirst();
    return NextResponse.json({ links: await linksFor(getAdminDb(), uid, String(req.nextUrl.searchParams.get("courseId") ?? "")) }, { headers: NO_STORE });
  } catch (err) {
    return academyError(err, "Couldn't load the links");
  }
}
