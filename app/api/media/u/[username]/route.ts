import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { creatorMedia } from "@/lib/media-server";
import { mediaDeps, mediaFail, mediaViewer } from "@/lib/media-api";
import { momentDeps } from "@/lib/moments-api";

export const dynamic = "force-dynamic";

// GET → a creator's Media for whoever is looking (signed in or not): pinned Moments and posts, posts, site pictures, the profile picture
// album, Lives & replays, and the counts for the tab. Only what this viewer may see is sent.
export async function GET(req: NextRequest, { params }: { params: { username: string } }) {
  try {
    const viewer = await mediaViewer(req);
    const limited = await rateLimit(req, "media-read", viewer?.uid ?? clientIp(req), 120, 600);
    if (limited) return limited;
    return NextResponse.json(await creatorMedia(getAdminDb(), viewer, params.username, mediaDeps(), momentDeps), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return mediaFail(err, "Couldn't load the Media");
  }
}
