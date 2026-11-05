import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { authed, fail as failOther } from "@/lib/moments-api";
import { iceServers } from "@/lib/calls-server";
import { CommunityError } from "@/lib/community-server";
import { consentToRecording, recordingChoice } from "@/lib/live-recording-server";
import { mintLiveToken } from "@/lib/live-rooms-server";
import {
  answerInvite, askConsent, banFromLive, beatRoom, cameraOff, closeRoom, declineRequest, inviteToStage, joinRoom, leaveRoom, liveRoomFigures, liveRooms, liveVideoConfig, muteSpeaker,
  pinMessage, raiseHand, relayStep, removeChat, roomLiveStatus, roomModLog, roomPeople, roomStaff, sendRoomChat, setPoster, setRoomMods, setRoomSong, setSpeaker, setStageMode, setStageVideo, startRoom, takeSeat,
} from "@/lib/rooms-server";

export const dynamic = "force-dynamic";
const fail = (err: unknown, fallback: string) => (err instanceof CommunityError ? NextResponse.json({ error: err.message }, { status: err.status }) : failOther(err, fallback));

// Audio rooms in a community (lib/rooms.ts).
// GET ?cid= → { rooms, figures, recording } (live rooms, for members; figures: what a room opened now holds, from Admin → Limits;
//      recording: whether this host can switch recording on, and the keep days: lib/live-recording.ts)
// POST { action: "start", …, record } (record: the host's recording switch) · { action: "consent", id } (a speaker agrees to speak on the
//      record, before their microphone goes up)
// POST { action: "start", cid, title } → { id, mode, note?, iceServers } · { action: "join", id } → { mode, cap, iceServers } · { action: "beat", id } → { live }
//      { action: "leave", id } · { action: "hand", id, up } · { action: "speaker", id, uid, on } · { action: "end", id } · { action: "unchat", id, messageId }
//      { action: "relay", id, op, … } → relay rooms only: the browser's steps with Cloudflare, checked and passed on by the server
//        (lib/rooms-server.ts relayStep; the Cloudflare token never leaves the server)
//      { action: "people", id, after? } → { people, next } (relay rooms: who is listening, a page at a time)
//      { action: "chat", id, text } (relay rooms: the chat goes through the server, with slow mode in big rooms)
//      Live mode (lib/rooms-live.ts): start and join also carry video (the camera's limits from the settings); start takes poster?
//      { source, url? }. { action: "poster", id, source: "upload" | "profile" | "challenge" | "none", url? } (host) ·
//      { action: "song", id, songId } (host: a NotesApp Sounds song is playing in their mix, or "" when it stops: lib/songs.ts) ·
//      { action: "stagevideo", id, on } (host: speakers may use video) · { action: "live", id } → the host's minutes and prompt.
//      Cameras go up and down through "relay" (ops video / unvideo; pull with video: true).
//      The stage (lib/rooms.ts "Stage seats"): start also takes stageMode ("solo" | "approve" | "open") and mods ([uid or @username,
//      or { who, perms }]); GET also returns staff (the community's moderators and admins, for the form).
//      { action: "seat", id } (a listener's + on an empty seat) · { action: "invite", id, uid } · { action: "invited", id, yes } (the
//      invited person answers) · { action: "decline", id, uid } (a request) · { action: "mic", id, uid, on } (a speaker's microphone off
//      or on) · { action: "stagemode", id, mode } · { action: "mods", id, mods } (host) · { action: "camoff", id, uid } ·
//      { action: "ban", id, uid } (out of this live) · { action: "pin", id, text } · { action: "consentask", id, uid } ·
//      { action: "modlog", id } → { log } (host). Each needs its permission (lib/rooms.ts MOD_PERMS), checked in lib/rooms-server.ts.
//      { action: "livetoken", id } → { url, token, exp } (relay rooms on the live-rooms worker: a 10-minute token for the room's
//        WebSocket, for someone already in the room; lib/live-rooms-server.ts)
export async function GET(req: NextRequest) {
  try {
    const me = await authed(req, "messages", false);
    const db = getAdminDb();
    const cid = String(req.nextUrl.searchParams.get("cid") ?? "");
    const [rooms, figures, recording, staff] = await Promise.all([liveRooms(db, me.uid, cid), liveRoomFigures(db), recordingChoice(db, me.uid).catch(() => null), roomStaff(db, me.uid, cid).catch(() => [])]);
    return NextResponse.json({ rooms, figures, recording, staff }, { headers: { "Cache-Control": "no-store" } });
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
        return NextResponse.json({ ...(await startRoom(db, me.uid, body.cid, body.title, undefined, undefined, poster, { record: body.record === true, stageMode: body.stageMode, mods: body.mods })), iceServers: await iceServers(), video: await liveVideoConfig(db) });
      }
      case "join": return NextResponse.json({ ...(await joinRoom(db, me.uid, body.id)), iceServers: await iceServers(), video: await liveVideoConfig(db) });
      case "consent": return NextResponse.json(await consentToRecording(db, me.uid, body.id));
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
      case "song": return NextResponse.json(await setRoomSong(db, me.uid, body.id, body.songId));
      case "stagevideo": return NextResponse.json(await setStageVideo(db, me.uid, body.id, body.on));
      case "live": return NextResponse.json(await roomLiveStatus(db, me.uid, body.id));
      case "livetoken": {
        const limited = await rateLimit(req, "room-live", me.uid, 30, 600);
        if (limited) return limited;
        return NextResponse.json(await mintLiveToken(db, me.uid, body.id), { headers: { "Cache-Control": "no-store" } });
      }
      case "unchat": await removeChat(db, me.uid, body.id, body.messageId); return NextResponse.json({ ok: true });
      case "seat": return NextResponse.json(await takeSeat(db, me.uid, body.id));
      case "invite": {
        const limited = await rateLimit(req, "room-invite", me.uid, 30, 600);
        if (limited) return limited;
        return NextResponse.json(await inviteToStage(db, me.uid, body.id, body.uid));
      }
      case "invited": return NextResponse.json(await answerInvite(db, me.uid, body.id, body.yes));
      case "decline": return NextResponse.json(await declineRequest(db, me.uid, body.id, body.uid));
      case "mic": return NextResponse.json(await muteSpeaker(db, me.uid, body.id, body.uid, body.on));
      case "stagemode": return NextResponse.json(await setStageMode(db, me.uid, body.id, body.mode));
      case "mods": return NextResponse.json(await setRoomMods(db, me.uid, body.id, body.mods));
      case "camoff": return NextResponse.json(await cameraOff(db, me.uid, body.id, body.uid));
      case "ban": return NextResponse.json(await banFromLive(db, me.uid, body.id, body.uid));
      case "pin": return NextResponse.json(await pinMessage(db, me.uid, body.id, body.text));
      case "consentask": return NextResponse.json(await askConsent(db, me.uid, body.id, body.uid));
      case "modlog": return NextResponse.json(await roomModLog(db, me.uid, body.id), { headers: { "Cache-Control": "no-store" } });
      default: throw new CommunityError(400, "Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't do that in the room");
  }
}
