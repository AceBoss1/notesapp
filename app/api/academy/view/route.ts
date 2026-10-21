import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { recordCourseView } from "@/lib/courses-server";
import { signedInUid } from "@/lib/academy-api";
import { sourceFrom } from "@/lib/visits-server";

export const dynamic = "force-dynamic";

// POST { courseId }: counts one look at a published course (anyone; the teacher's own looks are ignored; one a day per visitor,
// and the page sends at most one a day too). Never an error to the page.
export async function POST(req: NextRequest) {
  try {
    if (!ACADEMY_LIVE || /bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i.test(req.headers.get("user-agent") || "")) return NextResponse.json({ ok: false });
    const body = await req.json().catch(() => ({}));
    const { courseId } = body;
    const id = String(courseId ?? "");
    if (await rateLimit(req, "course-view-ip", clientIp(req), 120, 600)) return NextResponse.json({ ok: false });
    if (await rateLimit(req, "course-view", `${clientIp(req)}:${id}`, 1, 86_400)) return NextResponse.json({ ok: false });
    const uid = req.headers.get("authorization") ? await signedInUid(req) : null;
    return NextResponse.json({ ok: await recordCourseView(getAdminDb(), id, uid ?? undefined, new Date(), sourceFrom(body, req.headers.get("host"))) });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
