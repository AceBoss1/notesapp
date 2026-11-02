import { FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { can } from "./community";
import { CommunityError, activeRole, memberOf } from "./community-server";
import { LIVE_TOKEN_TTL_S, signLiveToken, verifyBody } from "./live-token";
import { cleanLiveText, isLiveChatId, type LiveBatch, type LiveSession } from "./live-rooms";
import { edgeState, liveConfigFor, liveRoomsOn, liveRoomsSecret, liveRoomsUrl, tellLiveRoom, type EdgeState } from "./live-rooms-edge";
import { EDGE_DOC_COUNT_MS, chatSlowFor, listenerPresent, presentIn, roomRole, stageOf, type RoomChat, type RoomDoc, type RoomPersonDoc } from "./rooms";
import { getRoomSettings } from "./rooms-server";
import { noteListenerSample } from "./rooms-live-server";

// The live-rooms worker, our server's half (lib/live-rooms.ts explains the design). Firestore stays the source of truth for who may be
// in a room and who is on stage: a token is minted only for someone the room already let in (joinRoom holds the cap), with the role the
// room doc gives them now; stage moves and the room's end are pushed to the worker by lib/rooms-server.ts. The worker sends back, signed:
// the chat in batches (written to communityRooms/{id}/chat for the record and for anyone on the Firestore fallback), removals, bans for
// the room, raised hands and the exact count (communityRooms/{id}/edge/state, server-only; the count also onto the room doc at most every
// EDGE_DOC_COUNT_MS, since everyone in the room reads that doc), and each person's connected time (communityRooms/{id}/listenTime/{uid},
// server-only: one doc per person, written when they come and go, never per heartbeat). Listeners in these rooms don't heartbeat: the
// worker's join/leave reports mark their people/ doc (edgeIn), which is what "here" means for them (lib/rooms.ts listenerPresent).

const CONFIG_EVERY_MS = 10 * 60_000; // the room's settings are sent again with a token at most this often (a worker restarted, say)
// The per-person summary of connected time, for the challenge's counted listeners (server-only).
export type ListenTime = { ms: number; sessions: number; open: boolean; openAt: number | null; first: number; last: number; role: string };

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
    if (listenerPresent(p, r, now.getTime())) who = p!;
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
export async function ingestLive(db: Firestore, raw: string, sig: string | null, now = new Date()): Promise<{ ok: true; wrote: number; removed: number; counted: boolean; sessions?: number; ignored?: string }> {
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
  const w = new Writes(db);
  // The chat's record: only while the room is on (the chat goes with the room when it ends, as before).
  if (live) {
    for (const m of (Array.isArray(b.chat) ? b.chat : []).slice(0, 100)) {
      const text = cleanLiveText(m?.text);
      if (!isLiveChatId(m?.id) || !str(m.from, 128) || !text) continue;
      w.b().set(ref.collection("chat").doc(m.id), { from: str(m.from, 128), name: str(m.name, 80), avatar: str(m.avatar, 500), text, at: str(m.at, 40) || now.toISOString() } satisfies RoomChat);
      wrote++;
    }
    for (const mid of (Array.isArray(b.removed) ? b.removed : []).slice(0, 200)) if (isLiveChatId(mid)) { w.b().delete(ref.collection("chat").doc(mid)); removed++; }
  }
  const st: Record<string, unknown> = {};
  const banned = (Array.isArray(b.banned) ? b.banned : []).map((u) => str(u, 128)).filter((u) => u && u !== r.hostUid).slice(0, 200);
  if (banned.length) st.banned = Object.fromEntries(banned.map((u) => [u, now.toISOString()]));
  // Raised hands: kept here so the host still sees them if the sockets fail (lib/rooms-server.ts beatRoom passes them to the host).
  if (live && b.hands && typeof b.hands === "object") {
    const hands: Record<string, unknown> = {};
    for (const [u, h] of Object.entries(b.hands).slice(0, 500)) {
      if (!u || u.length > 128 || u.includes(".")) continue;
      hands[u] = h ? { name: str(h.name, 80), avatar: str(h.avatar, 500), at: str(h.at, 40) || now.toISOString() } : FieldValue.delete();
    }
    if (Object.keys(hands).length) st.hands = hands;
  }
  const peak = typeof b.peak === "number" && Number.isFinite(b.peak) ? Math.max(0, Math.floor(b.peak)) : 0;
  if (live && typeof b.count === "number" && Number.isFinite(b.count) && b.count >= 0) {
    const listening = Math.floor(b.count);
    const settings = await getRoomSettings(db);
    st.count = listening; st.countAt = now.toISOString();
    // The room doc (read by everyone in the room) only every EDGE_DOC_COUNT_MS; the exact count is in edge/state for the cap.
    if (!r.edgeAt || now.getTime() - Date.parse(r.edgeAt) >= EDGE_DOC_COUNT_MS) {
      const stage = stageOf(r, now.getTime()).length;
      w.b().update(ref, { listening, chatSlow: chatSlowFor(listening, settings), peak: Math.max(r.peak ?? 1, stage + listening, peak), edgeAt: now.toISOString(), countedAt: now.toISOString() });
    }
    // Live mode's drop prompt keeps its samples (lib/rooms-live-server.ts; at most one per count window).
    await noteListenerSample(db, roomId, listening, settings, now).catch(() => {});
    counted = true;
  } else if (peak > (r.peak ?? 0)) {
    // The room's final peak (sent as it ends) counts even after the room doc says ended.
    w.b().update(ref, { peak });
  }
  if (b.final) st.finalPeak = peak;
  if (Object.keys(st).length) w.b().set(edgeState(db, roomId), st, { merge: true });
  const sessions = await applySessions(db, ref, w, Array.isArray(b.sessions) ? b.sessions.slice(0, 1000) : [], live);
  await w.commit();
  // The room ended: anyone still marked as connected is closed at the end.
  if (b.final) await closeOpenSessions(db, ref, Date.parse(r.endedAt ?? "") || now.getTime());
  return { ok: true, wrote, removed, counted, sessions };
}

// Firestore batches hold 500 writes: a new one every 400.
class Writes {
  private list: WriteBatch[] = []; private n = 0;
  constructor(private db: Firestore) {}
  b(): WriteBatch { if (!this.list.length || this.n >= 400) { this.list.push(this.db.batch()); this.n = 0; } this.n++; return this.list[this.list.length - 1]; }
  async commit() { for (const x of this.list) await x.commit(); }
}

// Sessions: each person's connected time adds up in listenTime/{uid}; a listener's people/ doc says whether they're connected (edgeIn).
async function applySessions(db: Firestore, ref: FirebaseFirestore.DocumentReference, w: Writes, events: LiveSession[], live: boolean): Promise<number> {
  const ok = events.filter((e) => e && typeof e.u === "string" && e.u && e.u.length <= 128 && !e.u.includes("/") && (e.e === "in" || e.e === "out") && Number.isFinite(e.at));
  if (!ok.length) return 0;
  const uids = [...new Set(ok.map((e) => e.u))];
  const timeRefs = uids.map((u) => ref.collection("listenTime").doc(u)), peopleRefs = uids.map((u) => ref.collection("people").doc(u));
  const [times, people] = await Promise.all([db.getAll(...timeRefs), live ? db.getAll(...peopleRefs) : Promise.resolve([])]);
  uids.forEach((u, i) => {
    const cur = (times[i].data() as ListenTime | undefined) ?? { ms: 0, sessions: 0, open: false, openAt: null, first: 0, last: 0, role: "listener" };
    let lastIn: boolean | null = null;
    for (const e of ok.filter((x) => x.u === u).sort((a, b) => a.at - b.at)) {
      if (e.e === "in") { if (!cur.open) { cur.open = true; cur.openAt = e.at; cur.sessions += 1; cur.first ||= e.at; } if (e.role !== "listener") cur.role = e.role; lastIn = true; }
      else { if (cur.open && cur.openAt !== null) cur.ms += Math.max(0, e.at - cur.openAt); cur.open = false; cur.openAt = null; cur.last = e.at; lastIn = false; }
    }
    w.b().set(timeRefs[i], cur);
    const p = people[i]?.data() as RoomPersonDoc | undefined;
    if (p && lastIn !== null && p.edgeIn !== lastIn) w.b().update(peopleRefs[i], { edgeIn: lastIn });
  });
  return ok.length;
}
async function closeOpenSessions(db: Firestore, ref: FirebaseFirestore.DocumentReference, at: number) {
  for (let more = true; more;) {
    const snap = await ref.collection("listenTime").where("open", "==", true).limit(400).get();
    if (snap.empty) return;
    const b = db.batch();
    for (const d of snap.docs) { const t = d.data() as ListenTime; b.set(d.ref, { ...t, ms: t.ms + Math.max(0, at - (t.openAt ?? at)), open: false, openAt: null, last: at }); }
    await b.commit();
    more = snap.size === 400;
  }
}
