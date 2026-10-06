import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { friendlyMessage } from "@/lib/api-errors";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { DigitalFail } from "@/lib/digital-server";
import { getR2Client } from "@/lib/r2";
import { privateBucket, privateFilesConfigured } from "@/lib/private-files";
import { rateLimit } from "@/lib/rate-limit";
import { playbackToken, playerUrl, streamConfigured } from "@/lib/stream";
import { checkDevice, cleanDeviceId, loadViewPurchase } from "@/lib/view-access";

export const dynamic = "force-dynamic";

// POST { reference, deviceId, lessonId, bytes? } — for a video lesson, a short-lived player URL; for a PDF lesson with
// bytes:true, the PDF itself (never a link, never as an attachment) for the in-page viewer. Only a device already
// registered on this purchase gets anything.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "view-lesson", user.uid, 300, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const deviceId = cleanDeviceId(body.deviceId);
    const { p, lessons } = await loadViewPurchase(user.uid, String(body.reference || ""));
    const r = await checkDevice(p.reference, user.uid, p.itemId, deviceId, "", false);
    if (!r.ok) return NextResponse.json({ code: "device_unregistered", error: "This device isn't registered for this purchase. Reload the page to check." }, { status: 403 });
    const lesson = lessons.find((l) => l.id === String(body.lessonId || ""));
    if (!lesson) throw new DigitalFail("Lesson not found.", 404);

    if (lesson.kind === "video") {
      if (!streamConfigured() || !lesson.uid) throw new DigitalFail("Video isn't available right now. Try again soon.", 503);
      return NextResponse.json({ kind: "video", src: playerUrl(await playbackToken(lesson.uid)) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.bytes !== true) return NextResponse.json({ kind: "pdf" }, { headers: { "Cache-Control": "no-store" } });
    if (!privateFilesConfigured() || !lesson.key) throw new DigitalFail("This file isn't available right now. Try again soon.", 503);
    const obj = await getR2Client().send(new GetObjectCommand({ Bucket: privateBucket(), Key: lesson.key }));
    if (!obj.Body) throw new DigitalFail("This file isn't available right now.", 503);
    return new Response(obj.Body.transformToWebStream(), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    if (err instanceof DigitalFail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't open this lesson");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
