import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { can } from "./community";
import { CommunityError, activeRole, memberOf, readCommunity, type Member } from "./community-server";
import {
  ROOM_CHAT_MAX, ROOM_GONE_MS, ROOM_PEOPLE_PAGE, ROOM_SPEAKERS_MAX, canPull, canPush, chatSlowFor, chatWait, chooseRoomMode, cleanRoomOverrides, cleanRoomTitle, countDue, headcount,
  isFresh, listenerCap, listenerPresent, edgeFresh, presentIn, roomFigures, roomFullText, roomIsFull, roomRole, roomSettings,
  ROOM_MODS_MAX, COMMUNITY_MOD_PERMS, cleanPerms, inviteFor, isMemberLive, isMicMuted, isRoomMod, isStageMode, mayActOn, permsOf, requestsOpen, roomCan, runsStage, stageModeOf,
  type ModLogEntry, type ModPerm, type RoomPin, type RoomChat, type RoomDoc, type RoomFigures, type RoomInvite, type RoomMode, type RoomModInfo, type RoomPersonDoc, type RoomRelayRecord, type RoomSettings, type StageMode,
} from "./rooms";
import { mayReach } from "./young";
import { RelayError, cleanSdp, relayClient, relayConfigured, type RelayClient } from "./rooms-relay-server";
import { recordingPlan, startRoomRecording, stopRoomRecording, type RecordingDeps } from "./live-recording-server";
import { hasConsented } from "./live-recording";
import { isSongId } from "./songs";
import { edgeCount, edgeState, liveConfigFor, liveRoomsOn, readEdgeState, tellLiveRoom } from "./live-rooms-edge";
import type { LiveHand } from "./live-rooms";
import { CHALLENGE_POSTER, POSTER_FOLDER, canPullVideo, canVideo, type HostLive, type PosterSource } from "./rooms-live";
import { closeLive, enforceVideoBudget, hostLive, markVideoOff, markVideoOn, noteListenerSample, stopVideo, videoBudgetLeft } from "./rooms-live-server";
import { r2PublicUrl } from "./r2";
import { liveSettingsWithPass, staffListenerCap } from "./staff-pass";
import { hasStaffPass, roomOnPass } from "./staff-pass-server";
import { liveEntrance } from "./fans-server";
import { holdsLiveTicket, markLiveEnded } from "./live-door-server";
import type { LiveRecordChoice } from "./live-tickets";

// Audio rooms (lib/rooms.ts). The server opens, joins, keeps and closes them and decides who is on stage; in a phone-to-phone room the
// phones connect through communityRooms/{id}/links, and in a relay room through Cloudflare, with every step passing through relayStep
// below. Only active members of the community come in; moderators and up host.

// ── Settings (Admin → Limits → Audio rooms): serverConfig/rooms, server-only, through a 30-second cache like the plan limits ──
const TTL_MS = 30_000;
let settingsCache: { at: number; data: RoomSettings } | null = null;
export async function getRoomSettings(db: Firestore, now = Date.now()): Promise<RoomSettings> {
  if (settingsCache && now - settingsCache.at < TTL_MS) return settingsCache.data;
  const data = roomSettings(cleanRoomOverrides((await db.doc("serverConfig/rooms").get()).data()?.overrides));
  settingsCache = { at: now, data };
  return data;
}
export async function saveRoomSettings(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<RoomSettings> {
  const overrides = cleanRoomOverrides(input);
  await db.doc("serverConfig/rooms").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  settingsCache = { at: now.getTime(), data: roomSettings(overrides) };
  // Rooms on the live-rooms worker hold slow mode at the edge: they get the new settings now.
  if (liveRoomsOn()) {
    const live = await db.collection("communityRooms").where("status", "==", "live").where("edge", "==", true).limit(100).get().catch(() => null);
    await Promise.all((live?.docs ?? []).map((d) => tellLiveRoom(d.id, { op: "config", config: liveConfigFor(d.id, String(d.get("hostUid")), settingsCache!.data, stageModeOf(d.data() as RoomDoc)) })));
  }
  return settingsCache.data;
}
export const resetRoomSettingsCache = () => { settingsCache = null; };
// What a room opened now holds, for the help, the public pages and the Start a room form.
export async function liveRoomFigures(db: Firestore): Promise<RoomFigures> {
  return roomFigures(await getRoomSettings(db).catch(() => roomSettings()), relayConfigured(), liveRoomsOn());
}

// The relay's last trouble, for /status (lib/status.ts): serverConfig/roomsRelay, server-only. Never holds the token.
async function noteRelay(db: Firestore, why: string | null, now = new Date()) {
  await db.doc("serverConfig/roomsRelay").set(why ? { ok: false, why, at: now.toISOString() } : { ok: true, at: now.toISOString() }, { merge: true }).catch(() => {});
}
export type RoomDeps = { relay: () => RelayClient; recording?: RecordingDeps };
const defaultDeps: RoomDeps = { relay: () => relayClient() };

// The staff test pass (lib/staff-pass.ts): a room opened under it has no video-minutes budget while the pass stays on. Everything else in
// the settings (Live mode's switch, the video quality, the prompts' timings) is unchanged.
async function liveSettingsFor(db: Firestore, r: Pick<RoomDoc, "staffPass">, now: Date, s?: RoomSettings): Promise<{ s: RoomSettings; pass: boolean }> {
  const base = s ?? (await getRoomSettings(db));
  const pass = await roomOnPass(db, r, now);
  return { s: liveSettingsWithPass(base, pass), pass };
}
// The host's minutes and prompt, marked when the room is on the pass (their screen says so instead of counting down).
async function hostLiveFor(db: Firestore, roomId: string, r: Pick<RoomDoc, "staffPass">, relay: () => RelayClient, now: Date, s?: RoomSettings): Promise<HostLive> {
  const live = await liveSettingsFor(db, r, now, s);
  const h = await hostLive(db, roomId, live.s, relay, now);
  return live.pass ? { ...h, staffPass: true } : h;
}


async function person(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) throw new CommunityError(403, "Your account can't join rooms right now.");
  return { name: String(u.displayName ?? "A member"), avatar: String(u.avatar ?? "") };
}
async function roleIn(db: Firestore, cid: string, uid: string) {
  return activeRole(await memberOf(db, cid, uid));
}
// Who may come into a room: a community live, the community's active members; a member's own paid live (lib/live-tickets.ts), the host,
// the moderators the host named and ticket holders (the door: holdsLiveTicket), nobody else.
async function mayEnter(db: Firestore, r: RoomDoc, uid: string): Promise<boolean> {
  if (r.paid) return uid === r.hostUid || !!r.mods?.[uid] || (await holdsLiveTicket(db, r.paid.eventId, uid));
  return !!r.cid && !!(await roleIn(db, r.cid, uid));
}
export const NOT_IN_TEXT = (r: Pick<RoomDoc, "paid">) => (r.paid ? "This live is for ticket holders. Get a ticket in the lobby." : "Rooms are for the community's members.");
export { mayEnter as mayEnterRoom };
async function roomOf(db: Firestore, id: unknown) {
  const ref = db.doc(`communityRooms/${String(id ?? "")}`);
  const r = (await ref.get()).data() as RoomDoc | undefined;
  if (!r) throw new CommunityError(404, "That room wasn't found.");
  return { ref, r };
}

// ── Relay rooms: listeners live in people/{uid}, and the room doc carries their count (lib/rooms.ts, "Who is here, at scale") ──
const peopleOf = (ref: FirebaseFirestore.DocumentReference) => ref.collection("people");
async function activeListeners(ref: FirebaseFirestore.DocumentReference, now: Date): Promise<number> {
  return (await peopleOf(ref).where("seen", ">=", new Date(now.getTime() - ROOM_GONE_MS).toISOString()).count().get()).data().count;
}
// A listener here now in a relay room (their people doc, heard from recently; on the live-rooms worker, connected to it: lib/rooms.ts
// listenerPresent).
async function listenerHere(ref: FirebaseFirestore.DocumentReference, r: RoomDoc, uid: string, now: Date): Promise<RoomPersonDoc | null> {
  const p = (await peopleOf(ref).doc(uid).get()).data() as RoomPersonDoc | undefined;
  return p && listenerPresent(p, r, now.getTime()) ? p : null;
}
// Whether someone is in the room: the stage (and everyone phone to phone) in `joined`; relay listeners in people/.
async function isHere(ref: FirebaseFirestore.DocumentReference, r: RoomDoc, uid: string, now: Date): Promise<boolean> {
  return presentIn(r, now.getTime()).includes(uid) || (r.mode === "relay" && !!(await listenerHere(ref, r, uid, now)));
}
// Re-counts the listeners onto the room doc when the last count is older than ROOM_COUNT_EVERY_MS. The first server to see it due claims
// the window in a transaction (countedAt), so a busy room gets one recount per window however many beats arrive. force: count now.
export async function recount(db: Firestore, roomId: string, now = new Date(), force = false): Promise<number | null> {
  const ref = db.doc(`communityRooms/${roomId}`);
  const claimed = await db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc | undefined;
    // On the live-rooms worker the count comes from the room's connected sockets (lib/live-rooms-server.ts ingestLive), unless the
    // worker has stopped reporting.
    if (!r || r.status !== "live" || r.mode !== "relay" || (!force && (!countDue(r, now.getTime()) || edgeFresh(r, now.getTime())))) return false;
    t.update(ref, { countedAt: now.toISOString() });
    return true;
  });
  if (!claimed) return null;
  const listening = await activeListeners(ref, now);
  const settings = await getRoomSettings(db);
  const r = (await ref.get()).data() as RoomDoc;
  await ref.update({ listening, chatSlow: chatSlowFor(listening, settings), peak: Math.max(r.peak ?? 1, headcount({ ...r, listening }, now.getTime())) });
  // Live mode: a sample for the host's drop prompt (lib/rooms-live.ts), at most one per count window like the count itself.
  await noteListenerSample(db, roomId, listening, settings, now).catch(() => {});
  return listening;
}

// The live rooms of a community, for its members (the Rooms card on its Home).
export async function liveRooms(db: Firestore, uid: string, cid: string, now = new Date()): Promise<(Pick<RoomDoc, "title" | "hostName" | "hostUid" | "speakers" | "mode"> & { id: string; listening: number; recorded: boolean; faces: { name: string; avatar: string }[] })[]> {
  if (!(await roleIn(db, cid, uid))) return [];
  const snap = await db.collection("communityRooms").where("cid", "==", cid).where("status", "==", "live").limit(10).get();
  return snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id })).filter((r) => presentIn(r, now.getTime()).includes(r.hostUid)).map((r) => ({
    id: r.id, title: r.title, hostName: r.hostName, hostUid: r.hostUid, speakers: r.speakers, mode: r.mode ?? "p2p",
    listening: headcount(r, now.getTime()), recorded: r.recording?.on === true, faces: presentIn(r, now.getTime()).slice(0, 6).map((u) => ({ name: r.joined[u].name, avatar: r.joined[u].avatar })),
  }));
}

// A new room uses the relay when its keys are set and the switch is on (lib/rooms.ts chooseRoomMode). Cloudflare is asked for a session
// first; if it doesn't answer, the room opens phone to phone with a note to the host, and /status shows why.
// record: the host's recording switch (lib/live-recording.ts); the room records only on the relay, with the recorder set up.
// stageMode and mods (lib/rooms.ts "Stage seats"): how people come up, and the moderators for this live (checked like setRoomMods).
export async function startRoom(db: Firestore, uid: string, cid: unknown, title: unknown, now = new Date(), deps: RoomDeps = defaultDeps, poster?: { source?: unknown; url?: unknown }, opts: { record?: unknown; stageMode?: unknown; mods?: unknown } = {}): Promise<{ id: string; mode: RoomMode; note?: string; recording?: boolean }> {
  const c = await readCommunity(db, String(cid ?? "")).catch(() => null);
  if (!c) throw new CommunityError(404, "That community wasn't found.");
  if (!can(await roleIn(db, c.id, uid), "rooms")) throw new CommunityError(403, "Admins and moderators start audio rooms.");
  const t = cleanRoomTitle(title);
  if (t.length < 3) throw new CommunityError(400, "Give the room a name, like Sunday Q&A.");
  // Chosen with the room (optional): checked like a later change (setPoster). A bad one is refused before the room opens.
  const posterUrl = poster?.source ? await posterFor(db, uid, poster.source, poster.url) : "";
  return openRoom(db, uid, { cid: c.id, communityName: c.name }, t, posterUrl, now, deps, opts);
}

// A member's own paid live (lib/live-tickets-server.ts startPaidLive): the same room, hosted by the member with no community. The
// recording follows the host's choice when they scheduled it (off, safety only, or replay); moderators are anyone the host names.
export async function startMemberLive(db: Firestore, uid: string, live: { eventId: string; title: string; poster: string; record: LiveRecordChoice }, now = new Date(), deps: RoomDeps = defaultDeps, opts: { stageMode?: unknown; mods?: unknown } = {}): Promise<{ id: string; mode: RoomMode; note?: string; recording?: boolean }> {
  return openRoom(db, uid, { cid: "", communityName: "", paid: { eventId: live.eventId, record: live.record } }, cleanRoomTitle(live.title), live.poster, now, deps, { ...opts, record: live.record !== "off" });
}

async function openRoom(db: Firestore, uid: string, base: Pick<RoomDoc, "cid" | "communityName" | "paid">, t: string, posterUrl: string, now: Date, deps: RoomDeps, opts: { record?: unknown; stageMode?: unknown; mods?: unknown }): Promise<{ id: string; mode: RoomMode; note?: string; recording?: boolean }> {
  // One live room per host: an old one they left open is closed first.
  const mine = await db.collection("communityRooms").where("hostUid", "==", uid).where("status", "==", "live").limit(5).get();
  for (const d of mine.docs) await endRoom(db, d.id, now, deps);
  const me = await person(db, uid);
  const stageMode: StageMode = isStageMode(opts.stageMode) ? opts.stageMode : "approve";
  const mods = await resolveMods(db, base.cid, uid, opts.mods);
  const host = await hostExtras(db, uid);
  const id = `${now.getTime()}_${randomBytes(5).toString("hex")}`;
  const at = now.toISOString();
  const settings = await getRoomSettings(db);
  // A #NotesApp team member on the staff test pass (lib/staff-pass.ts): the room skips the listener cap and the video budget while it's on.
  const staffPass = await hasStaffPass(db, uid, now);
  let mode = chooseRoomMode(settings, relayConfigured()), note: string | undefined;
  if (mode === "relay") {
    try { await deps.relay().newSession(); await noteRelay(db, null, now); }
    catch (e) {
      const why = e instanceof RelayError ? e.why : "could not reach Cloudflare";
      console.warn("[rooms] relay unavailable at room start:", why);
      await noteRelay(db, why, now);
      mode = "p2p";
      note = `The relay isn't answering right now, so this room runs phone to phone: up to ${(staffPass ? staffListenerCap("p2p") : listenerCap("p2p", settings)).toLocaleString("en-GB")} listeners.`;
    }
  }
  const rec = await recordingPlan(db, uid, opts.record, mode === "relay", staffPass);
  if (rec.note) note = note ? `${note} ${rec.note}` : rec.note;
  const r: RoomDoc = {
    ...(rec.state ? { recording: rec.state, consent: { [uid]: at } } : {}),
    cid: base.cid, communityName: base.communityName, ...(base.paid ? { paid: base.paid } : {}), title: t, hostUid: uid, hostName: me.name, speakers: [], hands: {}, joined: { [uid]: { ...me, at, seen: at } }, status: "live", mode, createdAt: at, peak: 1,
    stageMode, mods, invites: {}, micMuted: {},
    ...(mode === "relay" ? { published: {}, listening: 0, countedAt: at, chatSlow: 0, handInfo: {}, videoOn: {}, stageVideo: false, ...(liveRoomsOn() ? { edge: true } : {}) } : {}), ...(note ? { note } : {}),
    ...(posterUrl ? { poster: posterUrl } : {}), ...host, ...(staffPass ? { staffPass: true } : {}),
  };
  await db.doc(`communityRooms/${id}`).set(r);
  // The live-rooms worker: the room's settings and where to send its chat's record (the room still works through Firestore if this fails).
  if (r.edge) await tellLiveRoom(id, { op: "config", config: { ...liveConfigFor(id, uid, settings, stageMode), mods: modPermsMap(mods) } });
  if (rec.state) await startRoomRecording(db, id, now, deps.recording).catch((e) => console.error("[rooms] recording didn't start", e));
  return { id, mode, ...(note ? { note } : {}), ...(rec.state ? { recording: true } : {}) };
}

// Joining: the listener cap is the room's mode's setting, read now (lib/rooms.ts listenerCap); someone already in (a reload) always gets back in.
// The staff test pass (lib/staff-pass.ts): a team member on it, or anyone joining a room opened under it, meets only the hard ceiling.
export async function joinRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ok: true; mode: RoomMode; cap: number }> {
  const { ref, r } = await roomOf(db, id);
  if (!(await mayEnter(db, r, uid))) throw new CommunityError(403, NOT_IN_TEXT(r));
  // Removed from this live by the host or a moderator (banFromLive, or on the live-rooms worker): kept out until it ends.
  if (uid !== r.hostUid && (await readEdgeState(db, ref.id)).banned?.[uid]) throw new CommunityError(403, "You've been removed from this room.");
  const me = await person(db, uid);
  const settings = await getRoomSettings(db);
  const passCap = (await roomOnPass(db, r, now)) || (await hasStaffPass(db, uid, now));
  const capFor = (m: RoomMode) => (passCap ? staffListenerCap(m) : listenerCap(m, settings));
  if (r.mode === "relay") {
    // On the relay a listener's presence is their own people doc, so joining never writes the room doc (except to refresh the count).
    if (r.status !== "live" || !presentIn(r, now.getTime()).includes(r.hostUid)) throw new CommunityError(410, "The room has ended.");
    const cap = capFor("relay");
    const at = now.toISOString();
    if (r.joined[uid]) { await ref.update({ [`joined.${uid}.seen`]: at }); return { ok: true, mode: "relay", cap }; } // the stage, reloading
    const pref = peopleOf(ref).doc(uid);
    const before = (await pref.get()).data() as RoomPersonDoc | undefined;
    // The cap counts the people docs now (a count costs one read per thousand). Two joining in the same instant may both get the last
    // seat: a room can go one or two over its cap, never more.
    // On the live-rooms worker its count of connected listeners is the count (listeners there don't heartbeat, so people/ holds only
    // those who joined in the last minute, still connecting: whichever is higher).
    const edgeN = r.edge ? edgeCount(await readEdgeState(db, ref.id), now.getTime()) : null;
    if (!listenerPresent(before, r, now.getTime()) && Math.max(await activeListeners(ref, now), edgeN ?? 0) >= cap) throw new CommunityError(409, roomFullText(cap));
    const arriving = !listenerPresent(before, r, now.getTime());
    await pref.set({ ...me, at: before?.at ?? at, seen: at, ...(before?.chatAt ? { chatAt: before.chatAt } : {}), ...(before?.edgeIn ? { edgeIn: true } : {}) } satisfies RoomPersonDoc);
    await recount(db, ref.id, now).catch(() => null);
    if (arriving) await announceEntrance(db, ref, r.hostUid, uid, "in", now);
    return { ok: true, mode: "relay", cap };
  }
  const res = await db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as RoomDoc;
    if (cur.status !== "live" || !presentIn(cur, now.getTime()).includes(cur.hostUid)) throw new CommunityError(410, "The room has ended.");
    const mode: RoomMode = "p2p";
    const cap = capFor(mode);
    if (!cur.joined[uid] && roomIsFull(cur, cap, now.getTime())) throw new CommunityError(409, roomFullText(cap));
    const at = now.toISOString();
    t.update(ref, { [`joined.${uid}`]: { ...me, at, seen: at }, peak: Math.max(cur.peak ?? 1, presentIn(cur, now.getTime()).length + 1) });
    return { ok: true as const, mode, cap, arriving: !cur.joined[uid] };
  });
  if (res.arriving) await announceEntrance(db, ref, r.hostUid, uid, "in", now);
  return { ok: true, mode: res.mode, cap: res.cap };
}

// A top-three fan of the host arriving or leaving (lib/fans.ts live entrances): the room doc's `entrance` field, which everyone in the room
// already reads, plays the vehicle and the banner on every screen. Only the latest is kept. Never blocks joining or leaving.
async function announceEntrance(db: Firestore, ref: FirebaseFirestore.DocumentReference, hostUid: string, uid: string, way: "in" | "out", now: Date) {
  const e = await liveEntrance(db, hostUid, uid, way, now).catch(() => null);
  if (e) await ref.update({ entrance: e }).catch(() => {});
}

export async function beatRoom(db: Firestore, uid: string, id: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ live: boolean; host?: HostLive; hands?: Record<string, LiveHand> }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { live: false };
  const pref = peopleOf(ref).doc(uid);
  const listener = r.mode === "relay" && !r.joined?.[uid] ? ((await pref.get()).data() as RoomPersonDoc | undefined) : undefined;
  if (!r.joined?.[uid] && !listener) return { live: false };
  // The host gone quiet for a minute (their app closed): the room ends.
  if (uid !== r.hostUid && !presentIn(r, now.getTime()).includes(r.hostUid)) { await endRoom(db, ref.id, now); return { live: false }; }
  // A relay listener beats into their own people doc; the stage (and everyone phone to phone) into the room doc. On the live-rooms
  // worker a connected listener's presence is the worker's (edgeIn): no write at all (their app doesn't beat while connected anyway).
  // The host and the live's moderators also get the raised hands the worker reported (requests for a seat: lib/rooms.ts "Stage seats").
  const modHands = async (): Promise<{ hands?: Record<string, LiveHand> }> => {
    if (r.mode !== "relay" || !r.edge || !isRoomMod(r, uid)) return {};
    const hands = (await readEdgeState(db, ref.id)).hands;
    return hands && Object.keys(hands).length ? { hands } : {};
  };
  if (listener && listenerPresent({ ...listener, seen: "" }, r, now.getTime())) return { live: true, ...(await modHands()) };
  if (listener) await pref.update({ seen: now.toISOString() });
  else await ref.update({ [`joined.${uid}.seen`]: now.toISOString() });
  if (r.mode === "relay" && countDue(r, now.getTime())) await recount(db, ref.id, now).catch(() => null);
  // Live mode: the host's beat brings their minutes and prompts (and enforces the budget); a speaker sending video enforces it too.
  // Listeners' beats never touch it, so a big room costs nothing more.
  // On the live-rooms worker the host also gets the raised hands it reported (so they still show if the host's socket is down).
  if (r.mode === "relay" && uid === r.hostUid) {
    const hands = r.edge ? (await readEdgeState(db, ref.id)).hands : undefined;
    return { live: true, host: await hostLiveFor(db, ref.id, r, deps.relay, now), ...(hands && Object.keys(hands).length ? { hands } : {}) };
  }
  if (r.mode === "relay" && r.videoOn?.[uid]) await enforceVideoBudget(db, ref.id, (await liveSettingsFor(db, r, now)).s, deps.relay, now).catch(() => null);
  return { live: true, ...(await modHands()) };
}

// Leaving: off the stage and out; the host leaving ends the room.
export async function leaveRoom(db: Firestore, uid: string, id: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ ended: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { ended: true };
  if (uid === r.hostUid) { await endRoom(db, ref.id, now, deps); return { ended: true }; }
  const onStage = !!r.joined?.[uid] || !!r.hands?.[uid];
  if (r.mode !== "relay" || onStage) {
    await ref.update({ [`joined.${uid}`]: FieldValue.delete(), [`hands.${uid}`]: FieldValue.delete(), speakers: FieldValue.arrayRemove(uid), ...(r.mode === "relay" ? { [`published.${uid}`]: FieldValue.delete(), [`handInfo.${uid}`]: FieldValue.delete() } : {}), ...clearStageMarks(r, uid) });
  } else if (r.invites?.[uid]) {
    await ref.update(clearStageMarks(r, uid));
  }
  if (r.mode === "relay") {
    await stopPush(db, ref.id, uid, deps).catch(() => {});
    await stopVideo(db, ref.id, uid, deps.relay, now).catch(() => {});
    await ref.collection("relay").doc(uid).delete().catch(() => {});
    await peopleOf(ref).doc(uid).delete().catch(() => {});
    await recount(db, ref.id, now).catch(() => null);
  }
  await announceEntrance(db, ref, r.hostUid, uid, "out", now);
  return { ended: false };
}

// ── The stage (lib/rooms.ts "Stage seats"): requests, open seats, invitations, moderators, and turning a speaker's microphone off ──
const SOLO_TEXT = "The host is keeping the stage to themselves right now.";
// Off the stage or out of the room: their invitation and their microphone mark go too.
const clearStageMarks = (r: Pick<RoomDoc, "invites" | "micMuted">, uid: string): Record<string, unknown> => ({
  ...(r.invites?.[uid] ? { [`invites.${uid}`]: FieldValue.delete() } : {}), ...(r.micMuted?.[uid] ? { [`micMuted.${uid}`]: FieldValue.delete() } : {}),
});
// Permissions (lib/rooms.ts MOD_PERMS): the host holds all; a moderator named for this live holds the ones the host ticked. Refused with
// a plain message otherwise, and never against the host or a moderator who holds as much (mayActOn).
const NO_PERM: Record<ModPerm, string> = {
  approve: "Only the host or a moderator allowed to approve requests can do that.", invite: "Only the host or a moderator allowed to invite people can do that.",
  down: "Only the host or a moderator allowed to bring speakers down can do that.", mic: "Only the host or a moderator allowed to turn microphones off can do that.",
  camera: "Only the host or a moderator allowed to turn cameras off can do that.", chatRemove: "Only the host or a moderator can remove messages.",
  chatMute: "Only the host or a moderator can mute people in the chat.", ban: "Only the host or a moderator allowed to remove people can do that.",
  mode: "Only the host changes the stage mode.", slow: "Only the host sets slow mode.", pin: "Only the host or a moderator allowed to pin can do that.",
  poster: "Only the host chooses the poster.", video: "Only the host decides who can use video.", consent: "Only the host or a moderator allowed to manage the recording prompts can do that.",
  end: "Only the host or an admin can end the room.",
};
function need(r: RoomDoc, uid: string, perm: ModPerm, extra: readonly ModPerm[] = []) {
  if (!roomCan(r, uid, perm) && !extra.includes(perm)) throw new CommunityError(403, NO_PERM[perm]);
}
function onlyOver(r: RoomDoc, uid: string, target: string, extra: readonly ModPerm[] = []) {
  if (target === r.hostUid) throw new CommunityError(403, "Nobody can do that to the host.");
  if (!mayActOn(r, uid, target, [...new Set([...permsOf(r, uid), ...extra])])) throw new CommunityError(403, "They're a moderator with as much say as you: only the host can do that.");
}
// Every moderator action goes in the room's log (communityRooms/{id}/modLog, server-only; the host reads it with "modlog"). The host's
// own actions aren't logged. Never blocks the action.
async function logMod(db: Firestore, roomId: string, r: RoomDoc, uid: string, action: string, target?: string, communityMod = false): Promise<void> {
  if (uid === r.hostUid || (!isRoomMod(r, uid) && !communityMod)) return;
  const byName = r.mods?.[uid]?.name ?? r.joined?.[uid]?.name ?? String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "A moderator");
  const targetName = target ? r.joined?.[target]?.name ?? r.mods?.[target]?.name ?? r.handInfo?.[target]?.name ?? r.invites?.[target]?.name ?? "" : "";
  const e: ModLogEntry = { by: uid, byName, action, ...(target ? { target, ...(targetName ? { targetName } : {}) } : {}), at: new Date().toISOString() };
  await db.collection(`communityRooms/${roomId}/modLog`).add(e).catch(() => {});
}
export async function roomModLog(db: Firestore, uid: string, id: unknown): Promise<{ log: ModLogEntry[] }> {
  const { ref, r } = await roomOf(db, id);
  if (uid !== r.hostUid) throw new CommunityError(403, "Only the host reads the moderators' log.");
  const snap = await ref.collection("modLog").orderBy("at", "desc").limit(100).get();
  return { log: snap.docs.map((d) => d.data() as ModLogEntry) };
}
// A community moderator (not named for this live) keeps the chat powers they had (COMMUNITY_MOD_PERMS).
async function communityModPerms(db: Firestore, r: RoomDoc, uid: string): Promise<readonly ModPerm[]> {
  // A member's own live (a paid live): the community's moderators get nothing; only the moderators the host names (owner, 5 Nov 2026).
  if (isMemberLive(r)) return [];
  return !isRoomMod(r, uid) && uid !== r.hostUid && can(await roleIn(db, r.cid, uid), "remove_post") ? COMMUNITY_MOD_PERMS : [];
}

// Bans keep people off the stage: removed from this room (on the live-rooms worker: edge/state banned), or no longer an active member of
// the community (banned or removed there since they came in).
async function stageBarred(db: Firestore, r: RoomDoc, roomId: string, uid: string): Promise<string> {
  if (!(await mayEnter(db, r, uid))) return r.paid ? "They don't hold a ticket to this live." : "They're no longer a member of this community.";
  if ((await readEdgeState(db, roomId)).banned?.[uid]) return "They've been removed from this room.";
  return "";
}
const isTeen = async (db: Firestore, uid: string) => (await db.doc(`users/${uid}`).get()).data()?.teen === true;
// A request for a seat waiting: the room doc's hands (phone to phone, the Firestore path) or the hands the worker reported.
async function hasRequest(db: Firestore, r: RoomDoc, roomId: string, uid: string): Promise<boolean> {
  return !!r.hands?.[uid] || (!!r.edge && !!(await readEdgeState(db, roomId)).hands?.[uid]);
}

// A listener asks for a seat (the raised hand and the + in Approve mode are the same request); never in Solo mode.
export async function raiseHand(db: Firestore, uid: string, id: unknown, up: unknown, now = new Date()): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  const raising = up !== false;
  if (raising && r.status === "live" && !requestsOpen(r)) throw new CommunityError(409, SOLO_TEXT);
  const at = now.toISOString();
  const barred = async () => { if (raising) { const why = await stageBarred(db, r, ref.id, uid); if (why) throw new CommunityError(403, why.replace("They've", "You've").replace("They're", "You're")); } };
  if (r.mode === "relay") {
    // A relay listener isn't in `joined`, so the hand carries their name and picture for the host.
    const p = r.status === "live" ? await listenerHere(ref, r, uid, now) : null;
    if (!p) throw new CommunityError(409, "Join the room first.");
    await barred();
    await ref.update(!raising ? { [`hands.${uid}`]: FieldValue.delete(), [`handInfo.${uid}`]: FieldValue.delete() } : { [`hands.${uid}`]: at, [`handInfo.${uid}`]: { name: p.name, avatar: p.avatar } });
    // On the live-rooms worker the host and moderators see hands over the socket: it hears of this one too.
    if (r.edge) await tellLiveRoom(ref.id, { op: "hand", uid, up: raising, ...(raising ? { name: p.name, avatar: p.avatar, at } : {}) });
    return;
  }
  if (r.status !== "live" || !r.joined?.[uid]) throw new CommunityError(409, "Join the room first.");
  await barred();
  await ref.update({ [`hands.${uid}`]: raising ? at : FieldValue.delete() });
}

type StageMove = { speakers: string[]; invited?: true; requested?: true };
// Onto the stage or off it, in one transaction: the seat count, presence, the relay's listener doc and the room doc move together.
// why: "approve" (a request, by the host or a moderator), "seat" (an open seat, by the listener: Open mode only), "invite" (an accepted
// invitation), "down" (off the stage).
async function moveStage(db: Firestore, ref: FirebaseFirestore.DocumentReference, target: string, why: "approve" | "seat" | "invite" | "down", now: Date, deps: RoomDeps): Promise<StageMove> {
  const pref = peopleOf(ref).doc(target || "x");
  const on = why !== "down";
  const x = await db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc;
    const relay = r.mode === "relay";
    const listener = relay ? ((await t.get(pref)).data() as RoomPersonDoc | undefined) : undefined;
    if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
    if (target === r.hostUid) throw new CommunityError(400, "The host is always on stage.");
    if (why === "seat" && stageModeOf(r) !== "open") throw new CommunityError(409, stageModeOf(r) === "solo" ? SOLO_TEXT : "Ask for a seat: the host lets people up now.");
    if (why === "invite" && !inviteFor(r, target, now.getTime())) throw new CommunityError(409, "That invitation has lapsed. Ask for a seat instead.");
    let speakers = r.speakers.filter((u) => u !== target);
    const at = now.toISOString();
    const moves: Record<string, unknown> = {};
    if (on) {
      if (r.speakers.includes(target)) return { speakers: r.speakers, relay, edge: false, error: "", same: true };
      const here = presentIn(r, now.getTime()).includes(target) || (relay && listenerPresent(listener, r, now.getTime()));
      if (!here) {
        if (relay) t.update(ref, { [`hands.${target}`]: FieldValue.delete(), [`handInfo.${target}`]: FieldValue.delete(), ...clearStageMarks(r, target) }); // a stale hand goes
        return { error: why === "seat" || why === "invite" ? "Join the room first." : "They've left the room.", speakers: r.speakers, relay, edge: false, same: false };
      }
      if (speakers.length >= ROOM_SPEAKERS_MAX) throw new CommunityError(409, why === "seat" || why === "invite" ? "Every seat on stage is taken. Ask for a seat, and the host can make room." : `Up to ${ROOM_SPEAKERS_MAX} people can speak at a time besides the host. Move someone back to listening first.`);
      speakers = [...speakers, target];
      // Relay: up from the listeners onto the stage (the room doc), out of people/.
      if (relay && !r.joined[target] && listener) { moves[`joined.${target}`] = { name: listener.name, avatar: listener.avatar, at: listener.at, seen: at }; t.delete(pref); }
    } else if (relay && r.joined[target]) {
      // Relay: back to the listeners: off the room doc, into people/.
      const j = r.joined[target];
      moves[`joined.${target}`] = FieldValue.delete();
      t.set(pref, { name: j.name, avatar: j.avatar, at: j.at, seen: at, ...(r.edge ? { edgeIn: true } : {}) } satisfies RoomPersonDoc);
    }
    // Off the stage on the relay: they stop being pulled at once, and their microphone is cut at Cloudflare (below).
    t.update(ref, { speakers, [`hands.${target}`]: FieldValue.delete(), ...(relay ? { [`handInfo.${target}`]: FieldValue.delete() } : {}), ...moves, ...clearStageMarks(r, target), ...(!on && relay ? { [`published.${target}`]: FieldValue.delete() } : {}) });
    return { speakers, relay, error: "", edge: !!r.edge, same: false, invited: !!r.invites?.[target] };
  });
  if (x.error) throw new CommunityError(409, x.error);
  if (x.same) return { speakers: x.speakers };
  if (!on && x.relay) { await stopPush(db, ref.id, target, deps).catch(() => {}); await stopVideo(db, ref.id, target, deps.relay, now).catch(() => {}); }
  // The live-rooms worker learns the stage from us, never from a browser.
  if (x.edge) {
    await tellLiveRoom(ref.id, { op: "role", uid: target, role: on ? "speaker" : "listener" });
    if ("invited" in x && x.invited) await tellLiveRoom(ref.id, { op: "invite", uid: target, on: false });
    await edgeState(db, ref.id).set({ hands: { [target]: FieldValue.delete() } }, { merge: true }).catch(() => {});
  }
  return { speakers: x.speakers };
}

// The host or a moderator brings someone up, or sends a speaker back to listening; a speaker can step down themselves. Bringing up
// someone who asked (a raised hand) puts them on stage; anyone else is invited, and comes up only when they accept (inviteToStage).
export async function setSpeaker(db: Firestore, uid: string, id: unknown, who: unknown, on: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<StageMove> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (on === false) {
    if (target === uid) return moveStage(db, ref, target, "down", now, deps);
    if (!runsStage(r, uid)) throw new CommunityError(403, "Only the host or a moderator chooses who speaks.");
    if (target === r.hostUid) throw new CommunityError(400, "The host is always on stage.");
    // Bringing down: the "down" permission; or, in a recorded room, a speaker who hasn't agreed to the recording (the "consent" one).
    const unconsented = !!r.recording?.on && r.speakers.includes(target) && !r.consent?.[target];
    if (!roomCan(r, uid, "down") && !(unconsented && roomCan(r, uid, "consent"))) need(r, uid, "down");
    onlyOver(r, uid, target);
    const out = await moveStage(db, ref, target, "down", now, deps);
    await logMod(db, ref.id, r, uid, "bring down", target);
    return out;
  }
  if (!runsStage(r, uid)) throw new CommunityError(403, "Only the host or a moderator chooses who speaks.");
  if (target === r.hostUid) throw new CommunityError(400, "The host is always on stage.");
  if (r.speakers.includes(target)) return { speakers: r.speakers };
  if (!(await hasRequest(db, r, ref.id, target))) return inviteToStage(db, uid, ref.id, target, now);
  need(r, uid, "approve");
  const why = await stageBarred(db, r, ref.id, target);
  if (why) throw new CommunityError(403, why);
  const out = await moveStage(db, ref, target, "approve", now, deps);
  await logMod(db, ref.id, r, uid, "approve request", target);
  return out;
}

// Declining a request: the host or a moderator lowers someone's hand (the listener can lower their own through raiseHand).
export async function declineRequest(db: Firestore, uid: string, id: unknown, who: unknown): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  need(r, uid, "approve");
  if (!target || target.includes(".") || target.includes("/")) throw new CommunityError(400, "Choose someone.");
  await logMod(db, ref.id, r, uid, "decline request", target);
  await ref.update({ [`hands.${target}`]: FieldValue.delete(), ...(r.mode === "relay" ? { [`handInfo.${target}`]: FieldValue.delete() } : {}) });
  if (r.edge) {
    await tellLiveRoom(ref.id, { op: "hand", uid: target, up: false });
    await edgeState(db, ref.id).set({ hands: { [target]: FieldValue.delete() } }, { merge: true }).catch(() => {});
  }
  return { ok: true };
}

// A listener taps + on an empty seat: in Open mode they're on stage at once (a member in teen mode asks instead); in Approve mode it's
// a request; in Solo mode there is no +.
export async function takeSeat(db: Firestore, uid: string, id: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<StageMove> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  const mode = stageModeOf(r);
  if (mode === "solo") throw new CommunityError(409, SOLO_TEXT);
  if (roomRole(r, uid) !== "listener") return { speakers: r.speakers };
  const why = await stageBarred(db, r, ref.id, uid);
  if (why) throw new CommunityError(403, why.replace("They've", "You've").replace("They're", "You're"));
  if (mode === "approve" || (await isTeen(db, uid))) { await raiseHand(db, uid, ref.id, true, now); return { speakers: r.speakers, requested: true }; }
  return moveStage(db, ref, uid, "seat", now, deps);
}

// The host or a moderator invites someone in the room up; the invitation waits ROOM_INVITE_MS for their answer. Teen mode (lib/young.ts
// mayReach): a member in teen mode is invited only by someone they follow; otherwise they can still ask for a seat themselves.
export async function inviteToStage(db: Firestore, uid: string, id: unknown, who: unknown, now = new Date()): Promise<StageMove> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "invite");
  if (!target || target === uid || target === r.hostUid || target.includes(".") || target.includes("/")) throw new CommunityError(400, "Choose someone listening.");
  if (r.speakers.includes(target)) return { speakers: r.speakers };
  const person = presentIn(r, now.getTime()).includes(target) ? r.joined[target] : r.mode === "relay" ? await listenerHere(ref, r, target, now) : null;
  if (!person) throw new CommunityError(409, "They've left the room.");
  const barred = await stageBarred(db, r, ref.id, target);
  if (barred) throw new CommunityError(403, barred);
  const [them, me] = await Promise.all([db.doc(`users/${target}`).get(), db.doc(`users/${uid}`).get()]);
  const myUsername = String(me.data()?.username ?? "");
  const follows = myUsername ? (await db.doc(`follows/${target}_${myUsername}`).get()).exists : false;
  if (!mayReach({ target: them.data() as Record<string, unknown> | undefined, self: false, targetFollowsThem: follows })) {
    throw new CommunityError(403, "They're in teen mode and don't follow you, so they can't be invited by you. They can ask for a seat themselves.");
  }
  const byName = r.joined[uid]?.name ?? String(me.data()?.displayName ?? "A moderator");
  const invite: RoomInvite = { at: now.toISOString(), by: uid, byName, name: person.name, avatar: person.avatar };
  await ref.update({ [`invites.${target}`]: invite });
  if (r.edge) await tellLiveRoom(ref.id, { op: "invite", uid: target, on: true, by: byName });
  await logMod(db, ref.id, { ...r, invites: { ...r.invites, [target]: invite } }, uid, "invite on stage", target);
  return { speakers: r.speakers, invited: true };
}

// The invited person answers: yes puts them on stage (if a seat is free and the invitation hasn't lapsed), no lets it go.
export async function answerInvite(db: Firestore, uid: string, id: unknown, yes: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<StageMove> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (yes !== true) {
    if (r.invites?.[uid]) await ref.update({ [`invites.${uid}`]: FieldValue.delete() });
    if (r.edge) await tellLiveRoom(ref.id, { op: "invite", uid, on: false });
    return { speakers: r.speakers };
  }
  if (!inviteFor(r, uid, now.getTime())) throw new CommunityError(409, "That invitation has lapsed. Ask for a seat instead.");
  const why = await stageBarred(db, r, ref.id, uid);
  if (why) throw new CommunityError(403, why.replace("They've", "You've").replace("They're", "You're"));
  return moveStage(db, ref, uid, "invite", now, deps);
}

// The host or a moderator turns a speaker's microphone off (or back on). Enforced by the server: on the relay their microphone is cut
// at Cloudflare and unmarked, so nobody pulls it, and canPush refuses it until they're turned back on; phone to phone, the room doc
// tells every phone (theirs can't unmute, and the host's mix and the other speakers' phones leave their sound out).
export async function muteSpeaker(db: Firestore, uid: string, id: unknown, who: unknown, on: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ muted: boolean }> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (target === r.hostUid) throw new CommunityError(403, "Nobody can turn the host's microphone off.");
  need(r, uid, "mic");
  onlyOver(r, uid, target);
  const muted = on !== false;
  if (muted && !r.speakers.includes(target)) throw new CommunityError(409, "They're not on stage.");
  if (muted === isMicMuted(r, target)) return { muted };
  await ref.update(muted ? { [`micMuted.${target}`]: now.toISOString(), ...(r.mode === "relay" ? { [`published.${target}`]: FieldValue.delete() } : {}) } : { [`micMuted.${target}`]: FieldValue.delete() });
  if (muted && r.mode === "relay") await stopPush(db, ref.id, target, deps).catch(() => {});
  if (r.edge) await tellLiveRoom(ref.id, { op: "mic", uid: target, on: muted });
  await logMod(db, ref.id, r, uid, muted ? "microphone off" : "microphone on", target);
  return { muted };
}

// Only the host changes the stage mode. Solo takes every waiting request down (invitations already sent stay).
export async function setStageMode(db: Firestore, uid: string, id: unknown, mode: unknown): Promise<{ stageMode: StageMode }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "mode");
  if (!isStageMode(mode)) throw new CommunityError(400, "Choose Solo, Approve or Open.");
  await logMod(db, ref.id, r, uid, `stage mode: ${mode}`);
  await ref.update({ stageMode: mode, ...(mode === "solo" ? { hands: {}, ...(r.mode === "relay" ? { handInfo: {} } : {}) } : {}) });
  if (r.edge) {
    await tellLiveRoom(ref.id, { op: "stagemode", mode });
    if (mode === "solo") await edgeState(db, ref.id).update({ hands: {} }).catch(() => {});
  }
  return { stageMode: mode };
}

// The moderators for this live: uids or @usernames, each an active member of the community (the host isn't one: they run the room).
async function resolveMods(db: Firestore, cid: string, hostUid: string, input: unknown): Promise<Record<string, RoomModInfo>> {
  // Each entry: a uid or @username (the Basic permissions), or { who, perms } with the permissions the host ticked.
  const entries = (Array.isArray(input) ? input : []).map((v) => (v && typeof v === "object" ? { raw: String((v as { who?: unknown }).who ?? "").trim(), perms: cleanPerms((v as { perms?: unknown }).perms) } : { raw: String(v ?? "").trim(), perms: cleanPerms(undefined) })).filter((e) => e.raw);
  const list = [...new Map(entries.map((e) => [e.raw, e])).values()];
  if (list.length > ROOM_MODS_MAX) throw new CommunityError(400, `Up to ${ROOM_MODS_MAX} moderators for a live.`);
  const out: Record<string, RoomModInfo> = {};
  // A member's own live (no community): anyone on #NotesApp the host names, by uid or @username, whose account is in good standing.
  if (!cid) {
    for (const { raw, perms } of list) {
      const handle = raw.replace(/^@/, "").toLowerCase();
      let u: { id: string; data: FirebaseFirestore.DocumentData } | null = null;
      if (!raw.startsWith("@") && /^[A-Za-z0-9_-]{1,128}$/.test(raw)) { const d = await db.doc(`users/${raw}`).get(); if (d.exists) u = { id: d.id, data: d.data()! }; }
      if (!u && /^[a-z0-9_.]{1,40}$/.test(handle)) {
        const snap = await db.collection("users").where("username", "==", handle).limit(1).get();
        if (!snap.empty) u = { id: snap.docs[0].id, data: snap.docs[0].data() };
      }
      if (!u || u.data.suspended === true) throw new CommunityError(400, `${raw.startsWith("@") ? raw : `@${handle}`} wasn't found.`);
      if (u.id === hostUid) continue;
      out[u.id] = { name: String(u.data.displayName || u.data.username || "A member"), avatar: String(u.data.avatar ?? ""), perms };
    }
    return out;
  }
  for (const { raw, perms } of list) {
    const handle = raw.replace(/^@/, "").toLowerCase();
    let m: Member | null = raw.startsWith("@") || !/^[A-Za-z0-9_-]{1,128}$/.test(raw) ? null : await memberOf(db, cid, raw);
    if (!m && /^[a-z0-9_.]{1,40}$/.test(handle)) {
      const snap = await db.collection("communityMembers").where("cid", "==", cid).where("username", "==", handle).limit(1).get();
      m = snap.empty ? null : (snap.docs[0].data() as Member);
    }
    if (!m || !activeRole(m)) throw new CommunityError(400, `${raw.startsWith("@") ? raw : `@${handle}`} isn't a member of this community.`);
    if (m.uid === hostUid) continue;
    out[m.uid] = { name: String(m.displayName || m.username || "A member"), avatar: String(m.avatar ?? ""), perms };
  }
  return out;
}
export async function setRoomMods(db: Firestore, uid: string, id: unknown, mods: unknown): Promise<{ mods: Record<string, RoomModInfo> }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (uid !== r.hostUid) throw new CommunityError(403, "Only the host chooses the moderators.");
  const next = await resolveMods(db, r.cid, r.hostUid, mods);
  await ref.update({ mods: next });
  if (r.edge) await tellLiveRoom(ref.id, { op: "mods", mods: modPermsMap(next) });
  return { mods: next };
}
export const modPermsMap = (mods: Record<string, RoomModInfo> | undefined): Record<string, ModPerm[]> =>
  Object.fromEntries(Object.entries(mods ?? {}).map(([u, m]) => [u, cleanPerms(m.perms)]));

// A moderator with the "camera" permission (or the host) turns a speaker's camera off; the speaker can turn it on again if allowed.
export async function cameraOff(db: Firestore, uid: string, id: unknown, who: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "camera");
  onlyOver(r, uid, target);
  if (r.videoOn?.[target]) await stopVideo(db, ref.id, target, deps.relay, now);
  await logMod(db, ref.id, r, uid, "camera off", target);
  return { ok: true };
}

// Removing someone from this live (the "ban" permission; the community's own moderators keep it): off the stage and out of the room,
// kept out until the live ends (edge/state banned, which joinRoom, the stage and the live-rooms worker all check).
export async function banFromLive(db: Firestore, uid: string, id: unknown, who: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (!target || target.includes(".") || target.includes("/")) throw new CommunityError(400, "Choose someone.");
  const extra = await communityModPerms(db, r, uid);
  need(r, uid, "ban", extra);
  onlyOver(r, uid, target, extra);
  await edgeState(db, ref.id).set({ banned: { [target]: now.toISOString() } }, { merge: true });
  if (r.edge) await tellLiveRoom(ref.id, { op: "ban", uid: target });
  await leaveRoom(db, target, ref.id, now, deps);
  await logMod(db, ref.id, r, uid, "remove from the live", target, extra.length > 0);
  return { ok: true };
}

// The pinned message or announcement at the top of the chat ("pin"); empty text takes it down.
export async function pinMessage(db: Firestore, uid: string, id: unknown, text: unknown, now = new Date()): Promise<{ pinned: RoomPin | null }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "pin");
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, ROOM_CHAT_MAX);
  const byName = uid === r.hostUid ? r.hostName : r.mods?.[uid]?.name ?? "A moderator";
  const pinned: RoomPin | null = t ? { text: t, by: uid, byName, at: now.toISOString() } : null;
  await ref.update({ pinned });
  await logMod(db, ref.id, r, uid, t ? "pin a message" : "unpin");
  return { pinned };
}

// A reminder to a speaker who hasn't agreed to the recording yet ("consent"): their prompt comes back to the front of their screen.
export async function askConsent(db: Firestore, uid: string, id: unknown, who: unknown, now = new Date()): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  const target = String(who ?? "");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "consent");
  if (!r.recording?.on) throw new CommunityError(409, "This live isn't recorded.");
  if (!r.speakers.includes(target) || r.consent?.[target]) throw new CommunityError(409, "They're not waiting to agree.");
  await ref.update({ [`consentAsk.${target}`]: now.toISOString() });
  await logMod(db, ref.id, r, uid, "recording reminder", target);
  return { ok: true };
}

// The Start a room form: the community's moderators and admins (and owner) to pick from, for someone who may host.
export async function roomStaff(db: Firestore, uid: string, cid: string): Promise<{ uid: string; username: string; name: string; avatar: string; role: string }[]> {
  if (!cid || !can(await roleIn(db, cid, uid), "rooms")) return [];
  const snap = await db.collection("communityMembers").where("cid", "==", cid).where("status", "==", "active").where("role", "in", ["owner", "admin", "moderator"]).limit(50).get();
  return snap.docs.map((d) => d.data() as { uid: string; username?: string; displayName?: string; avatar?: string; role: string }).filter((m) => m.uid !== uid)
    .map((m) => ({ uid: m.uid, username: String(m.username ?? ""), name: String(m.displayName || m.username || "A member"), avatar: String(m.avatar ?? ""), role: m.role }));
}

// Relay rooms: who is listening, a page at a time (the screen shows the count; "People here" opens this). For anyone in the room.
export async function roomPeople(db: Firestore, uid: string, id: unknown, after: unknown, now = new Date()): Promise<{ people: { uid: string; name: string; avatar: string; hand: boolean }[]; next: string | null }> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "This room runs phone to phone.");
  if (r.status !== "live" || !(await isHere(ref, r, uid, now))) throw new CommunityError(409, "Join the room first.");
  let q = peopleOf(ref).orderBy("at").limit(ROOM_PEOPLE_PAGE);
  if (typeof after === "string" && after) q = q.startAfter(after);
  const snap = await q.get();
  const page = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as RoomPersonDoc) }));
  return {
    people: page.filter((p) => listenerPresent(p, r, now.getTime())).map((p) => ({ uid: p.uid, name: p.name, avatar: p.avatar, hand: !!r.hands?.[p.uid] })),
    next: snap.size === ROOM_PEOPLE_PAGE ? page[page.length - 1].at : null,
  };
}

// Relay rooms: the chat goes through the server (firestore.rules refuses a browser's own chat write there), so slow mode holds: above the
// chatSlowAbove setting, each listener waits chatSlowSeconds between messages; the host and speakers never wait.
export async function sendRoomChat(db: Firestore, uid: string, id: unknown, text: unknown, now = new Date()): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "This room runs phone to phone.");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  const t = String(text ?? "").trim().slice(0, ROOM_CHAT_MAX);
  if (!t) throw new CommunityError(400, "Write something first.");
  const at = now.toISOString();
  const stage = presentIn(r, now.getTime()).includes(uid) && roomRole(r, uid) !== "listener";
  const msg = ref.collection("chat").doc(`${String(now.getTime()).padStart(13, "0")}_${randomBytes(3).toString("hex")}`);
  // On the live-rooms worker (someone whose socket is down): also broadcast to the sockets, which don't read Firestore.
  const edge = (m: RoomChat) => (r.edge ? tellLiveRoom(ref.id, { op: "chat", m: { ...m, id: msg.id } }).then(() => undefined) : Promise.resolve());
  if (stage) {
    const m: RoomChat = { from: uid, name: r.joined[uid].name, avatar: r.joined[uid].avatar, text: t, at };
    await msg.set(m);
    await edge(m);
    return { ok: true };
  }
  let sent: RoomChat | null = null;
  const pref = peopleOf(ref).doc(uid);
  await db.runTransaction(async (tx) => {
    const p = (await tx.get(pref)).data() as RoomPersonDoc | undefined;
    if (!isFresh(p, now.getTime())) throw new CommunityError(409, "Join the room first.");
    const wait = chatWait(p!.chatAt, r.chatSlow ?? 0, now.getTime());
    if (wait > 0) throw new CommunityError(429, `Slow mode is on in this big room: you can send again in ${wait} second${wait === 1 ? "" : "s"}.`);
    sent = { from: uid, name: p!.name, avatar: p!.avatar, text: t, at };
    tx.set(msg, sent);
    tx.update(pref, { chatAt: at });
  });
  if (sent) await edge(sent);
  return { ok: true };
}

// Taking a chat message down: the host, or a moderator and up of the community.
// A moderator named for the live needs "chatRemove", and can't take down the host's message or one from a moderator with as much say.
export async function removeChat(db: Firestore, uid: string, id: unknown, messageId: unknown): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  const extra = await communityModPerms(db, r, uid);
  need(r, uid, "chatRemove", extra);
  const mref = ref.collection("chat").doc(String(messageId ?? "x").replace(/\//g, "") || "x");
  const from = String((await mref.get()).data()?.from ?? "");
  if (from && from !== uid) onlyOver(r, uid, from, extra);
  await mref.delete();
  await logMod(db, ref.id, r, uid, "remove a chat message", from || undefined, extra.length > 0);
  if (r.edge) await tellLiveRoom(ref.id, { op: "unchat", id: String(messageId ?? "") });
}

// Ending: the host, or an admin of the community. The connection details are cleared.
export async function closeRoom(db: Firestore, uid: string, id: unknown, now = new Date(), deps: Pick<RoomDeps, "recording"> = {}): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  if (uid !== r.hostUid && !roomCan(r, uid, "end") && (isMemberLive(r) || !can(await roleIn(db, r.cid, uid), "settings"))) throw new CommunityError(403, "Only the host or an admin can end the room.");
  await logMod(db, ref.id, r, uid, "end the live");
  await endRoom(db, ref.id, now, deps);
}
export async function endRoom(db: Firestore, id: string, now = new Date(), deps: Pick<RoomDeps, "recording"> = {}): Promise<void> {
  const ref = db.doc(`communityRooms/${id}`);
  const videoUsedMs = await closeLive(db, id, now).catch(() => 0); // Live mode: the video minutes this live used, kept for replays (2c)
  const ended = await db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc | undefined;
    if (!r || r.status !== "live") return null;
    t.update(ref, { status: "ended", endedAt: now.toISOString(), joined: {}, hands: {}, speakers: [], invites: {}, micMuted: {}, ...(r.mode === "relay" ? { published: {}, handInfo: {}, listening: 0, videoOn: {}, videoUsedMs } : {}) });
    return r;
  });
  if (!ended) return;
  // A paid live: the live is over (it can be reopened for a short while) and the ticket money's hold runs from now (lib/live-door-server.ts).
  if (ended.paid) await markLiveEnded(db, ended.paid.eventId, now).catch((e) => console.error("[rooms] paid live end", e));
  // The worker tells everyone, closes the sockets and sends its last batch and the room's peak.
  if (ended.edge) await tellLiveRoom(id, { op: "end" });
  // A recorded room: the recorder stops and sends what's left; the 30-day keep timer starts (lib/live-recording-server.ts).
  if (ended.recording?.on) await stopRoomRecording(db, ended, now, deps.recording).catch((e) => console.error("[rooms] recording didn't stop", e));
  for (let more = true; more;) {
    const chat = await db.collection(`communityRooms/${id}/chat`).limit(400).get();
    if (!chat.empty) { const b = db.batch(); chat.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
    more = chat.size === 400;
  }
  // Relay rooms: the Cloudflare session records and the listeners go (the sessions themselves close when the browsers do).
  for (const sub of ["relay", "people", "live"]) {
    for (let more = true; more;) {
      const snap = await db.collection(`communityRooms/${id}/${sub}`).limit(400).get();
      if (!snap.empty) { const b = db.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
      more = snap.size === 400;
    }
  }
  const links = await db.collection(`communityRooms/${id}/links`).limit(300).get();
  for (const l of links.docs) {
    for (const sub of ["fromCandidates", "toCandidates"]) {
      const snap = await l.ref.collection(sub).limit(400).get();
      if (!snap.empty) { const b = db.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
    }
    await l.ref.delete();
  }
}

// ── The relay (rooms with mode "relay"): every step a browser takes with Cloudflare passes through here ──
// One Cloudflare session per person per page load (one RTCPeerConnection): the browser says fresh on its first step, and a new session is
// opened for it. Steps:
//   push  { offer, mid }  → { answer }          host and speakers only: their microphone goes up once; the room's `published` marks it
//   unpush                                      stop sending (stepping down); the server also does this when the host moves them off stage
//   pull  { uids }        → { offer?, renegotiate, tracks: [{ uid, mid }] }   anyone in the room, from stage members who are sending
//   answer { answer }                           the browser's answer to Cloudflare's offer after a pull
//   close { mids }                              stop receiving those tracks (someone left the stage)
// Live mode (lib/rooms-live.ts):
//   video { offer, mid } → { answer, host? }    the host (and speakers when allowed): their camera goes up as a second track on the same
//                                               session; refused when Live mode is off or this live's video minutes are used up
//   unvideo              → { ok, host? }        camera off, back to sound only (no reconnecting); its minutes stop counting
//   pull { uids, video: true }                  receive cameras instead of microphones (a viewer on Audio only never asks)
export type RelayStepResult = { answer?: { type: string; sdp: string }; offer?: { type: string; sdp: string } | null; renegotiate?: boolean; tracks?: { uid: string; mid: string; kind?: "audio" | "video" }[]; ok?: true; host?: HostLive };

export async function relayStep(db: Firestore, uid: string, id: unknown, body: Record<string, unknown>, now = new Date(), deps: RoomDeps = defaultDeps): Promise<RelayStepResult> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "This room runs phone to phone.");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  const listener = presentIn(r, now.getTime()).includes(uid) ? null : await listenerHere(ref, r, uid, now);
  if (!presentIn(r, now.getTime()).includes(uid) && !listener) throw new CommunityError(409, "Join the room first.");
  const mineRef = ref.collection("relay").doc(uid);
  const relay = deps.relay();
  const fresh = body.fresh === true;
  const at = now.toISOString();
  const session = async (): Promise<string> => {
    const cur = (await mineRef.get()).data() as RoomRelayRecord | undefined;
    if (cur?.sessionId && !fresh) return cur.sessionId;
    const sessionId = await relay.newSession();
    await mineRef.set({ sessionId, at, push: null } satisfies RoomRelayRecord);
    return sessionId;
  };
  try {
    switch (body.op) {
      case "push": {
        if (isMicMuted(r, uid) && roomRole(r, uid) !== "listener") throw new CommunityError(403, "The host or a moderator has turned your microphone off for now.");
        if (!canPush(r, uid, now.getTime())) throw new CommunityError(403, "Only the host and speakers on stage can turn on a microphone.");
        const offer = cleanSdp(body.offer, "offer");
        const mid = String(body.mid ?? "").slice(0, 32);
        if (!offer || !mid) throw new CommunityError(400, "The microphone's offer is missing.");
        const sessionId = await session();
        const trackName = `${uid.slice(0, 40)}-mic-${now.getTime().toString(36)}`;
        const res = await relay.push(sessionId, offer, [{ mid, trackName }]);
        await mineRef.set({ push: { trackName, mid } }, { merge: true });
        // Marked as sending only if they are still on stage (the host may have moved them meanwhile).
        const stillOn = await db.runTransaction(async (t) => {
          const cur = (await t.get(ref)).data() as RoomDoc;
          if (!canPush(cur, uid, now.getTime())) return false;
          t.update(ref, { [`published.${uid}`]: at });
          return true;
        });
        if (!stillOn) { await stopPush(db, ref.id, uid, deps).catch(() => {}); throw new CommunityError(403, "You're back with the listeners."); }
        await noteRelay(db, null, now);
        return { answer: res.answer };
      }
      case "unpush": {
        await ref.update({ [`published.${uid}`]: FieldValue.delete() });
        await stopPush(db, ref.id, uid, deps);
        return { ok: true };
      }
      case "pull": {
        const video = body.video === true;
        const want = (Array.isArray(body.uids) ? body.uids : []).map(String).slice(0, ROOM_SPEAKERS_MAX + 1);
        const allowed = want.filter((u) => (video ? canPullVideo(r, uid, u, now.getTime(), !!listener) : canPull(r, uid, u, now.getTime(), !!listener)));
        const none = video ? "Nobody on stage has video on right now." : "Nobody on stage is sending sound right now.";
        if (!allowed.length) throw new CommunityError(409, none);
        const records = await db.getAll(...allowed.map((u) => ref.collection("relay").doc(u)));
        const from = records.flatMap((d, i) => {
          const rec = d.data() as RoomRelayRecord | undefined;
          const track = video ? rec?.video?.trackName : rec?.push?.trackName;
          return rec?.sessionId && track ? [{ uid: allowed[i], sessionId: rec.sessionId, trackName: track }] : [];
        });
        if (!from.length) throw new CommunityError(409, none);
        const sessionId = await session();
        const res = await relay.pull(sessionId, from.map((f) => ({ sessionId: f.sessionId, trackName: f.trackName })));
        const tracks = res.tracks.flatMap((t) => {
          const f = from.find((x) => x.trackName === t.trackName);
          return f && t.mid && !t.errorCode ? [{ uid: f.uid, mid: t.mid, ...(video ? { kind: "video" as const } : {}) }] : [];
        });
        return { offer: res.offer, renegotiate: res.renegotiate, tracks };
      }
      case "video": {
        const settings = await getRoomSettings(db);
        // A recorded room: a speaker's camera, like their microphone, waits for their agreement (lib/live-recording.ts).
        if (!hasConsented(r, uid)) throw new CommunityError(403, "Agree to speak on the record first.");
        if (!canVideo(r, uid, settings, now.getTime())) throw new CommunityError(403, settings.videoOn > 0 ? "Only the host, and speakers when the host allows it, can turn video on." : "Video is switched off for audio rooms right now.");
        const offer = cleanSdp(body.offer, "offer");
        const mid = String(body.mid ?? "").slice(0, 32);
        if (!offer || !mid) throw new CommunityError(400, "The camera's offer is missing.");
        // The budget is checked before Cloudflare hears of it, and again (atomically) when the camera is marked up below.
        const budget = (await liveSettingsFor(db, r, now, settings)).s; // no budget on the staff test pass
        await videoBudgetLeft(db, ref.id, uid, budget, now);
        const sessionId = await session();
        const trackName = `${uid.slice(0, 40)}-cam-${now.getTime().toString(36)}`;
        const res = await relay.push(sessionId, offer, [{ mid, trackName }]);
        await mineRef.set({ video: { trackName, mid } }, { merge: true });
        try { await markVideoOn(db, ref.id, uid, budget, now); }
        catch (e) { await stopVideo(db, ref.id, uid, deps.relay, now).catch(() => {}); throw e; }
        await noteRelay(db, null, now);
        return { answer: res.answer, ...(uid === r.hostUid ? { host: await hostLiveFor(db, ref.id, r, deps.relay, now, settings) } : {}) };
      }
      case "unvideo": {
        await stopVideo(db, ref.id, uid, deps.relay, now);
        return { ok: true, ...(uid === r.hostUid ? { host: await hostLiveFor(db, ref.id, r, deps.relay, now) } : {}) };
      }
      case "answer": {
        const answer = cleanSdp(body.answer, "answer");
        if (!answer) throw new CommunityError(400, "The answer is missing.");
        const cur = (await mineRef.get()).data() as RoomRelayRecord | undefined;
        if (!cur?.sessionId) throw new CommunityError(409, "Join the room again.");
        await relay.renegotiate(cur.sessionId, answer);
        return { ok: true };
      }
      case "close": {
        const mids = (Array.isArray(body.mids) ? body.mids : []).map((m) => String(m).slice(0, 32)).filter(Boolean).slice(0, 20);
        const cur = (await mineRef.get()).data() as RoomRelayRecord | undefined;
        if (!cur?.sessionId || !mids.length) return { ok: true };
        await relay.close(cur.sessionId, mids);
        if (cur.push && mids.includes(cur.push.mid)) { await mineRef.set({ push: null }, { merge: true }); await ref.update({ [`published.${uid}`]: FieldValue.delete() }); }
        if (cur.video && mids.includes(cur.video.mid)) { await mineRef.set({ video: null }, { merge: true }); await markVideoOff(db, ref.id, [uid], now); }
        return { ok: true };
      }
      default: throw new CommunityError(400, "Unknown relay step.");
    }
  } catch (e) {
    if (e instanceof RelayError) {
      console.warn("[rooms] relay step failed:", body.op, e.why);
      await noteRelay(db, e.why, now);
      throw new CommunityError(502, "The relay didn't answer. Leave the room and join again in a moment.");
    }
    throw e;
  }
}

// Stops someone's microphone at Cloudflare (forced: no SDP exchange needed) and forgets it.
async function stopPush(db: Firestore, roomId: string, uid: string, deps: RoomDeps): Promise<void> {
  const ref = db.doc(`communityRooms/${roomId}/relay/${uid}`);
  const cur = (await ref.get()).data() as RoomRelayRecord | undefined;
  if (!cur?.sessionId || !cur.push?.mid) return;
  await ref.set({ push: null }, { merge: true });
  await deps.relay().close(cur.sessionId, [cur.push.mid]);
}

// ── Live mode (lib/rooms-live.ts): the poster, speakers' video, the host's minutes and prompts ──
// The host's extras on the room: their @username and whether they take paid sessions, so "Book a session" stays in view in the room.
async function hostExtras(db: Firestore, uid: string): Promise<{ hostUsername?: string; hostBooks: boolean }> {
  const [u, ps] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`publisherSettings/${uid}`).get()]);
  const username = String(u.data()?.username ?? "");
  return { ...(username ? { hostUsername: username } : {}), hostBooks: !!username && ps.data()?.session?.enabled === true };
}
// The poster's picture: one the host uploaded (only from their own posters folder in our storage, made WebP by the usual upload), their
// profile picture, or the challenge art; "none" takes it away. Anything else is refused.
export async function posterFor(db: Firestore, uid: string, source: unknown, url: unknown): Promise<string> {
  switch (source as PosterSource) {
    case "none": return "";
    case "challenge": return CHALLENGE_POSTER;
    case "profile": {
      const avatar = String((await db.doc(`users/${uid}`).get()).data()?.avatar ?? "");
      if (!avatar) throw new CommunityError(400, "Add a profile picture first, or upload a poster.");
      return avatar;
    }
    case "upload": {
      let mine = "";
      try { mine = r2PublicUrl(`${POSTER_FOLDER}/${uid}/`); } catch { throw new CommunityError(503, "Uploads aren't set up right now."); }
      const u = String(url ?? "");
      if (!u.startsWith(mine) || u.length > 600 || /[\s"'<>]/.test(u)) throw new CommunityError(400, "Upload the poster from the room first.");
      return u;
    }
    default: throw new CommunityError(400, "Choose a poster: upload one, your profile picture, or the challenge art.");
  }
}
// The host changes the poster during the room (one write to the room doc).
export async function setPoster(db: Firestore, uid: string, id: unknown, source: unknown, url: unknown): Promise<{ poster: string }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "poster");
  // A moderator's upload comes from their own posters folder; "My profile picture" is always the host's.
  const poster = await posterFor(db, source === "profile" ? r.hostUid : uid, source, url);
  await ref.update({ poster: poster || FieldValue.delete() });
  await logMod(db, ref.id, r, uid, "change the poster");
  return { poster };
}
// The host plays a NotesApp Sounds song into the live, or stops it (songId ""): the room shows "Now playing" to everyone. Host only.
export async function setRoomSong(db: Firestore, uid: string, id: unknown, songId: unknown, now = new Date()): Promise<{ song: string }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  if (uid !== r.hostUid) throw new CommunityError(403, "Only the host plays music in a live.");
  if (songId === "" || songId === null || songId === undefined) { if (r.song) await ref.update({ song: FieldValue.delete() }); return { song: "" }; }
  if (!isSongId(songId)) throw new CommunityError(400, "That song isn't in NotesApp Sounds.");
  await ref.update({ song: { id: songId, at: now.toISOString() } });
  return { song: songId };
}
// The host lets speakers turn video on, or not; turning it off takes the speakers' cameras down at once.
export async function setStageVideo(db: Firestore, uid: string, id: unknown, on: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ stageVideo: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "Video needs a room on the relay.");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  need(r, uid, "video");
  const stageVideo = on === true;
  await logMod(db, ref.id, r, uid, stageVideo ? "speakers' video on" : "back to audio");
  if ((r.stageVideo === true) !== stageVideo) await ref.update({ stageVideo });
  if (!stageVideo) for (const u of r.speakers) if (r.videoOn?.[u]) await stopVideo(db, ref.id, u, deps.relay, now).catch(() => {});
  return { stageVideo };
}
// The host's minutes and prompt on demand (the beat brings them too).
export async function roomLiveStatus(db: Firestore, uid: string, id: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<HostLive> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "Video needs a room on the relay.");
  if (uid !== r.hostUid) throw new CommunityError(403, "Only the host sees the video minutes.");
  return hostLiveFor(db, ref.id, r, deps.relay, now);
}
// The sender's limits for a relay room's cameras (sent on join), from the settings.
export async function liveVideoConfig(db: Firestore): Promise<{ on: boolean; kbps: number; fps: number; height: number }> {
  const s = await getRoomSettings(db).catch(() => roomSettings());
  return { on: s.videoOn > 0, kbps: s.videoKbps, fps: s.videoFps, height: s.videoHeight };
}
