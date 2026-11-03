import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { createMediaPost } from "@/lib/media-server";
import { mediaCaller, mediaDeps, mediaFail } from "@/lib/media-api";

export const dynamic = "force-dynamic";

// POST { kind: "pictures", pictureKeys[] | kind: "video", videoUploadId, caption, audience, allowComments, allowShares, allowGifts,
// allowDownloads, pinned } → { post }
export async function POST(req: NextRequest) {
  try {
    const me = await mediaCaller(req, true);
    const limited = await rateLimit(req, "media-post", me.uid, 30, 600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ post: await createMediaPost(getAdminDb(), me, me.tier, body, mediaDeps()) });
  } catch (err) {
    return mediaFail(err, "Couldn't post that");
  }
}
