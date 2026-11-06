import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { soundHead } from "@/lib/sounds-server";
import { mediaWithSong } from "@/lib/media-server";
import { momentsWithSong } from "@/lib/moments-server";
import { momentDeps } from "@/lib/moments-api";
import { MEDIA_LIVE } from "@/lib/media-rules";
import { MOMENTS_LIVE } from "@/lib/moments-rules";
import { publicOnly, soundFail, soundViewer } from "@/lib/sounds-api";

export const dynamic = "force-dynamic";

// GET → a song's page: { song, artist, plays, posts, moments, media: [{ post, owner }], momentGroups } for whoever is looking. Only the
// posts and moments this viewer may see are sent (moments only to signed-in members, like everywhere else).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await soundViewer(req);
    const limited = await rateLimit(req, "sound-page", viewer?.uid ?? clientIp(req), 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const head = await soundHead(db, params.id, publicOnly);
    const [media, momentGroups] = await Promise.all([
      MEDIA_LIVE ? mediaWithSong(db, viewer, params.id, publicOnly) : Promise.resolve([]),
      MOMENTS_LIVE ? momentsWithSong(db, viewer?.uid ?? null, params.id, momentDeps) : Promise.resolve([]),
    ]);
    return NextResponse.json({ ...head, media, momentGroups, signedIn: !!viewer }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return soundFail(err, "Couldn't load the sound");
  }
}
