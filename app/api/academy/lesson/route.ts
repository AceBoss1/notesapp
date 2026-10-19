import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { ACADEMY_LIVE } from "@/lib/courses";
import { CourseError } from "@/lib/courses-server";
import { DeviceLimit, openLesson } from "@/lib/course-sales-server";
import { lessonDeps } from "@/lib/course-uploads-server";
import { getR2Client } from "@/lib/r2";
import { privateBucket, privateFilesConfigured } from "@/lib/private-files";
import { cleanDeviceId, deviceView, removeDevice } from "@/lib/view-access";
import { academyClosed, academyError, NO_STORE } from "@/lib/academy-api";

export const dynamic = "force-dynamic";

// POST { courseId, lessonId, deviceId, deviceLabel, bytes? } → { lesson }: one lesson of a course (a paid course's lessons are never
// public). Free courses and free previews: anyone. Otherwise the tutors, or a buyer on one of their two devices (403 device_limit with
// their devices when this would be a third). A PDF lesson with bytes:true returns the PDF itself, inline, for the in-page viewer.
// POST { action: "removeDevice", courseId, reference, deviceId } → { devices, removalsLeft }: a buyer frees one of their two places.
export async function POST(req: NextRequest) {
  if (!ACADEMY_LIVE) return academyClosed();
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    const limited = await rateLimit(req, "academy-lesson", user?.uid ?? "anon", 300, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (b.action === "removeDevice") {
      if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      const r = await removeDevice(String(b.reference ?? ""), user.uid, cleanDeviceId(b.deviceId));
      return NextResponse.json({ devices: deviceView(r.devices, ""), removalsLeft: r.removalsLeft }, { headers: NO_STORE });
    }
    const deviceId = b.deviceId ? cleanDeviceId(b.deviceId) : undefined;
    const viewer = user ? { uid: user.uid, email: user.email ?? "" } : null;
    const { content, lesson, purchaseRef } = await openLesson(getAdminDb(), viewer, { courseId: b.courseId, lessonId: b.lessonId, deviceId, deviceLabel: String(b.deviceLabel ?? "") }, lessonDeps);
    if (b.bytes === true && lesson.kind === "pdf") {
      if (!privateFilesConfigured() || !lesson.fileKey) throw new CourseError("This file isn't available right now. Try again soon.", 503);
      const obj = await getR2Client().send(new GetObjectCommand({ Bucket: privateBucket(), Key: lesson.fileKey }));
      if (!obj.Body) throw new CourseError("This file isn't available right now.", 503);
      return new Response(obj.Body.transformToWebStream(), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
      });
    }
    return NextResponse.json({ lesson: content, purchaseRef }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof DeviceLimit) return NextResponse.json({ code: "device_limit", error: err.message, devices: deviceView(err.devices as Parameters<typeof deviceView>[0], ""), max: err.max }, { status: 403 });
    if (err instanceof Error && err.name === "DigitalFail") return NextResponse.json({ error: err.message }, { status: (err as Error & { status?: number }).status ?? 400 });
    return academyError(err, "Couldn't open this lesson");
  }
}
