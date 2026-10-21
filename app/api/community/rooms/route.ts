import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail as failOther } from "@/lib/moments-api";
import { iceServers } from "@/lib/calls-server";
import { CommunityError } from "@/lib/community-server";
import { beatRoom, closeRoom, joinRoom, leaveRoom, liveRooms, raiseHand, setSpeaker, startRoom } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";
const fail = (err: unknown, fallback: string) => (err instanceof CommunityError ? NextResponse.json({ error: err.message }, { status: err.status }) : failOther(err, fallback));

// Audio rooms in a community (lib/rooms.ts).
// GET ?cid= → { rooms } (live rooms, for members)
// POST { action: "start", cid, title } → { id, iceServers } · { action: "join", id } → { iceServers } · { action: "beat", id } → { live }
//      { action: "leave", id } · { action: "hand", id, up } · { action: "speaker", id, uid, on } · { action: "end", id }
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages", false);
    return NextResponse.json({ rooms: await liveRooms(getAdminDb(), me.uid, String(req.nextUrl.searchParams.get("cid") ?? "")) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the rooms");
  }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const me = await authed(req, "messages", body.action === "start");
    const db = getAdminDb();
    switch (body.action) {
      case "start": {
        const limited = await rateLimit(req, "room-start", me.uid, 20, 3600);
        if (limited) return limited;
        return NextResponse.json({ ...(await startRoom(db, me.uid, body.cid, body.title)), iceServers: await iceServers() });
      }
      case "join": return NextResponse.json({ ...(await joinRoom(db, me.uid, body.id)), iceServers: await iceServers() });
      case "beat": return NextResponse.json(await beatRoom(db, me.uid, body.id));
      case "leave": return NextResponse.json(await leaveRoom(db, me.uid, body.id));
      case "hand": await raiseHand(db, me.uid, body.id, body.up); return NextResponse.json({ ok: true });
      case "speaker": return NextResponse.json(await setSpeaker(db, me.uid, body.id, body.uid, body.on));
      case "end": await closeRoom(db, me.uid, body.id); return NextResponse.json({ ok: true });
      default: throw new CommunityError(400, "Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't do that in the room");
  }
}
