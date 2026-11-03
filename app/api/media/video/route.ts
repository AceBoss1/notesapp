import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { startMediaVideo } from "@/lib/media-server";
import { mediaCaller, mediaDeps, mediaFail } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// POST { durationSec, size, name } → { uploadId, uploadURL, maxSeconds }: the browser then sends the file straight to Cloudflare Stream
// (a form post to uploadURL) and posts it with { kind: "video", videoUploadId }.
export async function POST(req: NextRequest) {
  try {
    const me = await mediaCaller(req, true);
    const limited = await rateLimit(req, "media-video", me.uid, 20, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await startMediaVideo(getAdminDb(), me, me.tier, body, mediaDeps()));
  } catch (err) {
    return mediaFail(err, "Couldn't start the upload");
  }
}
