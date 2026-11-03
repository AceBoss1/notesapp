import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { CommunityError } from "@/lib/community-server";
import { ingestLive } from "@/lib/live-rooms-server";
import { LIVE_SIG_HEADER } from "@/lib/live-token";

export const dynamic = "force-dynamic";

// The live-rooms worker (workers/live-rooms) reports here, signed with LIVE_ROOMS_SECRET over the exact body (header x-live-sig):
// POST { roomId, chat, removed, banned, count?, peak?, final? } → { ok, wrote, removed, counted } (lib/live-rooms-server.ts ingestLive).
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 512_000) return NextResponse.json({ error: "Too big." }, { status: 413 });
    return NextResponse.json(await ingestLive(getAdminDb(), raw, req.headers.get(LIVE_SIG_HEADER)));
  } catch (err) {
    if (err instanceof CommunityError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[live-rooms] batch failed:", err);
    return NextResponse.json({ error: "Couldn't take the batch." }, { status: 500 });
  }
}
