import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail as failOther } from "@/lib/moments-api";
import { iceServers } from "@/lib/calls-server";
import { CommunityError } from "@/lib/community-server";
import { mintLiveToken } from "@/lib/live-rooms-server";
import { beatRoom, closeRoom, joinRoom, leaveRoom, liveRoomFigures, liveRooms, liveVideoConfig, raiseHand, relayStep, removeChat, roomLiveStatus, roomPeople, sendRoomChat, setPoster, setSpeaker, setStageVideo, startRoom } from "@/lib/rooms-server";

export const dynamic = "force-dynamic";
const fail = (err: unknown, fallback: string) => (err instanceof CommunityError ? NextResponse.json({ error: err.message }, { status: err.status }) : failOther(err, fallback));

// Audio rooms in a community (lib/rooms.ts).
// GET ?cid= → { rooms, figures } (live rooms, for members; figures: what a room opened now holds, from Admin → Limits)
// POST { action: "start", cid, title } → { id, mode, note?, iceServers } · { action: "join", id } → { mode, cap, iceServers } · { action: "beat", id } → { live }
//      { action: "leave", id } · { action: "hand", id, up } · { action: "speaker", id, uid, on } · { action: "end", id } · { action: "unchat", id, messageId }
//      { action: "relay", id, op, … } → relay rooms only: the browser's steps with Cloudflare, checked and passed on by the server
//        (lib/rooms-server.ts relayStep; the Cloudflare token never leaves the server)
//      { action: "people", id, after? } → { people, next } (relay rooms: who is listening, a page at a time)
//      { action: "chat", id, text } (relay rooms: the chat goes through the server, with slow mode in big rooms)
//      Live mode (lib/rooms-live.ts): start and join also carry video (the camera's limits from the settings); start takes poster?
//      { source, url? }. { action: "poster", id, source: "upload" | "profile" | "challenge" | "none", url? } (host) ·
//      { action: "stagevideo", id, on } (host: speakers may use video) · { action: "live", id } → the host's minutes and prompt.
//      Cameras go up and down through "relay" (ops video / unvideo; pull with video: true).
//      { action: "livetoken", id } → { url, token, exp } (relay rooms on the live-rooms worker: a 10-minute token for the room's
//        WebSocket, for someone already in the room; lib/live-rooms-server.ts)
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages", false);
    const db = getAdminDb();
    const [rooms, figures] = await Promise.all([liveRooms(db, me.uid, String(req.nextUrl.searchParams.get("cid") ?? "")), liveRoomFigures(db)]);
    return NextResponse.json({ rooms, figures }, { headers: { "Cache-Control": "no-store" } });
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
        const poster = body.poster && typeof body.poster === "object" ? body.poster : undefined;
        return NextResponse.json({ ...(await startRoom(db, me.uid, body.cid, body.title, undefined, undefined, poster)), iceServers: await iceServers(), video: await liveVideoConfig(db) });
      }
      case "join": return NextResponse.json({ ...(await joinRoom(db, me.uid, body.id)), iceServers: await iceServers(), video: await liveVideoConfig(db) });
      case "beat": return NextResponse.json(await beatRoom(db, me.uid, body.id));
      case "leave": return NextResponse.json(await leaveRoom(db, me.uid, body.id));
      case "hand": await raiseHand(db, me.uid, body.id, body.up); return NextResponse.json({ ok: true });
      case "speaker": return NextResponse.json(await setSpeaker(db, me.uid, body.id, body.uid, body.on));
      case "end": await closeRoom(db, me.uid, body.id); return NextResponse.json({ ok: true });
      case "relay": {
        const limited = await rateLimit(req, "room-relay", me.uid, 240, 600);
        if (limited) return limited;
        return NextResponse.json(await relayStep(db, me.uid, body.id, body));
      }
      case "people": return NextResponse.json(await roomPeople(db, me.uid, body.id, body.after));
      case "chat": {
        const limited = await rateLimit(req, "room-chat", me.uid, 30, 60);
        if (limited) return limited;
        return NextResponse.json(await sendRoomChat(db, me.uid, body.id, body.text));
      }
      case "poster": return NextResponse.json(await setPoster(db, me.uid, body.id, body.source, body.url));
      case "stagevideo": return NextResponse.json(await setStageVideo(db, me.uid, body.id, body.on));
      case "live": return NextResponse.json(await roomLiveStatus(db, me.uid, body.id));
      case "livetoken": {
        const limited = await rateLimit(req, "room-live", me.uid, 30, 600);
        if (limited) return limited;
        return NextResponse.json(await mintLiveToken(db, me.uid, body.id), { headers: { "Cache-Control": "no-store" } });
      }
      case "unchat": await removeChat(db, me.uid, body.id, body.messageId); return NextResponse.json({ ok: true });
      default: throw new CommunityError(400, "Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't do that in the room");
  }
}
