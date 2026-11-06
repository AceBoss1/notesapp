import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { listSongs } from "@/lib/sounds-server";
import { publicOnly, soundFail } from "@/lib/sounds-api";

export const dynamic = "force-dynamic";

// GET → { songs }: every NotesApp Sounds song anyone may use now (house songs, then approved artist songs). For the pickers.
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "sounds-list", clientIp(req), 120, 600);
    if (limited) return limited;
    return NextResponse.json({ songs: await listSongs(getAdminDb(), publicOnly) }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
  } catch (err) {
    return soundFail(err, "Couldn't load the sounds");
  }
}
