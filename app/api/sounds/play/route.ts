import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { countLifePlay } from "@/lib/sounds-server";
import { soundCaller, soundFail } from "@/lib/sounds-api";

export const dynamic = "force-dynamic";

// POST { songId } → Notes Life: the player heard this song at the hotel (counted once a day per player per song).
// Media, Moments and lives count their plays on the server as they happen (lib/media-server.ts, moments-server.ts, rooms-server.ts).
export async function POST(req: NextRequest) {
  try {
    const me = await soundCaller(req);
    const limited = await rateLimit(req, "sound-play", me.uid, 60, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ counted: await countLifePlay(getAdminDb(), me.uid, body.songId) });
  } catch (err) {
    return soundFail(err, "Couldn't count the play");
  }
}
