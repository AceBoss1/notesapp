import type { Firestore } from "firebase-admin/firestore";
import { can } from "./community";
import { CommunityError, activeRole, memberOf } from "./community-server";
import { LIVE_TOKEN_TTL_S, signLiveToken, verifyBody } from "./live-token";
import { cleanLiveText, isLiveChatId, type LiveBatch } from "./live-rooms";
import { liveConfigFor, liveRoomsOn, liveRoomsSecret, liveRoomsUrl, tellLiveRoom } from "./live-rooms-edge";
import { chatSlowFor, isFresh, presentIn, roomRole, stageOf, type RoomChat, type RoomDoc, type RoomPersonDoc } from "./rooms";
import { getRoomSettings } from "./rooms-server";

// The live-rooms worker, our server's half (lib/live-rooms.ts explains the design). Firestore stays the source of truth for who may be
// in a room and who is on stage: a token is minted only for someone the room already let in (joinRoom holds the cap), with the role the
// room doc gives them now; stage moves and the room's end are pushed to the worker by lib/rooms-server.ts. The worker sends back, signed:
// the chat in batches (written to communityRooms/{id}/chat for the record and for anyone on the Firestore fallback), removals, bans for
// the room (communityRooms/{id}/edge/state, server-only), and the listener count (onto the room doc, for the cap and the cards).

const CONFIG_EVERY_MS = 10 * 60_000; // the room's settings are sent again with a token at most this often (a worker restarted, say)
const edgeState = (db: Firestore, id: string) => db.doc(`communityRooms/${id}/edge/state`);
type EdgeState = { banned?: Record<string, string>; configAt?: string; finalPeak?: number };

export async function mintLiveToken(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ url: string; token: string; exp: number }> {
  const roomId = String(id ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(roomId)) throw new CommunityError(404, "That room wasn't found.");
  const ref = db.doc(`communityRooms/${roomId}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r) throw new CommunityError(404, "That room wasn't found.");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (r.mode !== "relay" || !r.edge || !liveRoomsOn()) throw new CommunityError(409, "This room's chat runs through the app.");
  // In the room now: on stage (the room doc), or a listener the room let in (their people doc, heard from recently).
  let who: { name: string; avatar: string } | null = presentIn(r, now.getTime()).includes(uid) ? r.joined[uid] : null;
  if (!who) {
    const p = (await ref.collection("people").doc(uid).get()).data() as RoomPersonDoc | undefined;
    if (isFresh(p, now.getTime())) who = p!;
  }
  if (!who) throw new CommunityError(409, "Join the room first.");
  const [state, member] = await Promise.all([edgeState(db, roomId).get().then((d) => (d.data() ?? {}) as EdgeState), memberOf(db, r.cid, uid)]);
  if (state.banned?.[uid]) throw new CommunityError(403, "You've been removed from this room.");
  const role = activeRole(member);
  if (!role) throw new CommunityError(403, "Rooms are for the community's members.");
  if (!state.configAt || now.getTime() - Date.parse(state.configAt) >= CONFIG_EVERY_MS) {
    if (await tellLiveRoom(roomId, { op: "config", config: liveConfigFor(roomId, r.hostUid, await getRoomSettings(db)) }, now.getTime())) {
      await edgeState(db, roomId).set({ configAt: now.toISOString() }, { merge: true });
    }
  }
  const exp = Math.floor(now.getTime() / 1000) + LIVE_TOKEN_TTL_S;
  const token = await signLiveToken(liveRoomsSecret(), { r: roomId, u: uid, role: roomRole(r, uid), n: String(who.name ?? ""), a: String(who.avatar ?? ""), mod: can(role, "remove_post"), exp });
  return { url: liveRoomsUrl(), token, exp };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

// A batch from the worker (POST /api/community/rooms/edge). The signature is checked over the exact body. Anything for a room that is
// gone or not on the worker is accepted and ignored, so the worker doesn't keep retrying it.
export async function ingestLive(db: Firestore, raw: string, sig: string | null, now = new Date()): Promise<{ ok: true; wrote: number; removed: number; counted: boolean; ignored?: string }> {
  if (!liveRoomsSecret() || !(await verifyBody(liveRoomsSecret(), raw, sig, now.getTime()))) throw new CommunityError(401, "Bad signature.");
  let b: LiveBatch;
  try { b = JSON.parse(raw) as LiveBatch; } catch { throw new CommunityError(400, "Bad body."); }
  const roomId = str(b?.roomId, 80);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(roomId)) throw new CommunityError(400, "Bad room.");
  const ref = db.doc(`communityRooms/${roomId}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r || !r.edge) return { ok: true, wrote: 0, removed: 0, counted: false, ignored: "not a live-rooms room" };
  const live = r.status === "live";
  let wrote = 0, removed = 0, counted = false;
  const w = db.batch();
  // The chat's record: only while the room is on (the chat goes with the room when it ends, as before).
  if (live) {
    for (const m of (Array.isArray(b.chat) ? b.chat : []).slice(0, 100)) {
      const text = cleanLiveText(m?.text);
      if (!isLiveChatId(m?.id) || !str(m.from, 128) || !text) continue;
      w.set(ref.collection("chat").doc(m.id), { from: str(m.from, 128), name: str(m.name, 80), avatar: str(m.avatar, 500), text, at: str(m.at, 40) || now.toISOString() } satisfies RoomChat);
      wrote++;
    }
    for (const mid of (Array.isArray(b.removed) ? b.removed : []).slice(0, 200)) if (isLiveChatId(mid)) { w.delete(ref.collection("chat").doc(mid)); removed++; }
  }
  const banned = (Array.isArray(b.banned) ? b.banned : []).map((u) => str(u, 128)).filter((u) => u && u !== r.hostUid).slice(0, 200);
  if (banned.length) w.set(edgeState(db, roomId), { banned: Object.fromEntries(banned.map((u) => [u, now.toISOString()])) }, { merge: true });
  const peak = typeof b.peak === "number" && Number.isFinite(b.peak) ? Math.max(0, Math.floor(b.peak)) : 0;
  if (live && typeof b.count === "number" && Number.isFinite(b.count) && b.count >= 0) {
    const listening = Math.floor(b.count);
    const settings = await getRoomSettings(db);
    const stage = stageOf(r, now.getTime()).length;
    w.update(ref, { listening, chatSlow: chatSlowFor(listening, settings), peak: Math.max(r.peak ?? 1, stage + listening, peak), edgeAt: now.toISOString(), countedAt: now.toISOString() });
    counted = true;
  } else if (peak > (r.peak ?? 0)) {
    // The room's final peak (sent as it ends) counts even after the room doc says ended.
    w.update(ref, { peak });
  }
  if (b.final) w.set(edgeState(db, roomId), { finalPeak: peak }, { merge: true });
  await w.commit();
  return { ok: true, wrote, removed, counted };
}
