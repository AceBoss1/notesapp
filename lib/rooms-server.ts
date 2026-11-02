import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { can } from "./community";
import { CommunityError, activeRole, memberOf, readCommunity } from "./community-server";
import {
  ROOM_CHAT_MAX, ROOM_GONE_MS, ROOM_PEOPLE_PAGE, ROOM_SPEAKERS_MAX, canPull, canPush, chatSlowFor, chatWait, chooseRoomMode, cleanRoomOverrides, cleanRoomTitle, countDue, headcount,
  isFresh, listenerCap, presentIn, roomFigures, roomFullText, roomIsFull, roomRole, roomSettings,
  type RoomChat, type RoomDoc, type RoomFigures, type RoomMode, type RoomPersonDoc, type RoomRelayRecord, type RoomSettings,
} from "./rooms";
import { RelayError, cleanSdp, relayClient, relayConfigured, type RelayClient } from "./rooms-relay-server";
import { liveConfigFor, liveRoomsOn, tellLiveRoom } from "./live-rooms-edge";
import { edgeFresh } from "./live-rooms";

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
    await Promise.all((live?.docs ?? []).map((d) => tellLiveRoom(d.id, { op: "config", config: liveConfigFor(d.id, String(d.get("hostUid")), settingsCache!.data) })));
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
export type RoomDeps = { relay: () => RelayClient };
const defaultDeps: RoomDeps = { relay: () => relayClient() };


async function person(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) throw new CommunityError(403, "Your account can't join rooms right now.");
  return { name: String(u.displayName ?? "A member"), avatar: String(u.avatar ?? "") };
}
async function roleIn(db: Firestore, cid: string, uid: string) {
  return activeRole(await memberOf(db, cid, uid));
}
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
// A listener here now in a relay room (their people doc, heard from recently).
async function listenerHere(ref: FirebaseFirestore.DocumentReference, uid: string, now: Date): Promise<RoomPersonDoc | null> {
  const p = (await peopleOf(ref).doc(uid).get()).data() as RoomPersonDoc | undefined;
  return p && isFresh(p, now.getTime()) ? p : null;
}
// Whether someone is in the room: the stage (and everyone phone to phone) in `joined`; relay listeners in people/.
async function isHere(ref: FirebaseFirestore.DocumentReference, r: RoomDoc, uid: string, now: Date): Promise<boolean> {
  return presentIn(r, now.getTime()).includes(uid) || (r.mode === "relay" && !!(await listenerHere(ref, uid, now)));
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
  return listening;
}

// The live rooms of a community, for its members (the Rooms card on its Home).
export async function liveRooms(db: Firestore, uid: string, cid: string, now = new Date()): Promise<(Pick<RoomDoc, "title" | "hostName" | "hostUid" | "speakers" | "mode"> & { id: string; listening: number; faces: { name: string; avatar: string }[] })[]> {
  if (!(await roleIn(db, cid, uid))) return [];
  const snap = await db.collection("communityRooms").where("cid", "==", cid).where("status", "==", "live").limit(10).get();
  return snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id })).filter((r) => presentIn(r, now.getTime()).includes(r.hostUid)).map((r) => ({
    id: r.id, title: r.title, hostName: r.hostName, hostUid: r.hostUid, speakers: r.speakers, mode: r.mode ?? "p2p",
    listening: headcount(r, now.getTime()), faces: presentIn(r, now.getTime()).slice(0, 6).map((u) => ({ name: r.joined[u].name, avatar: r.joined[u].avatar })),
  }));
}

// A new room uses the relay when its keys are set and the switch is on (lib/rooms.ts chooseRoomMode). Cloudflare is asked for a session
// first; if it doesn't answer, the room opens phone to phone with a note to the host, and /status shows why.
export async function startRoom(db: Firestore, uid: string, cid: unknown, title: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ id: string; mode: RoomMode; note?: string }> {
  const c = await readCommunity(db, String(cid ?? "")).catch(() => null);
  if (!c) throw new CommunityError(404, "That community wasn't found.");
  if (!can(await roleIn(db, c.id, uid), "rooms")) throw new CommunityError(403, "Admins and moderators start audio rooms.");
  const t = cleanRoomTitle(title);
  if (t.length < 3) throw new CommunityError(400, "Give the room a name, like Sunday Q&A.");
  // One live room per host: an old one they left open is closed first.
  const mine = await db.collection("communityRooms").where("hostUid", "==", uid).where("status", "==", "live").limit(5).get();
  for (const d of mine.docs) await endRoom(db, d.id, now);
  const me = await person(db, uid);
  const id = `${now.getTime()}_${randomBytes(5).toString("hex")}`;
  const at = now.toISOString();
  const settings = await getRoomSettings(db);
  let mode = chooseRoomMode(settings, relayConfigured()), note: string | undefined;
  if (mode === "relay") {
    try { await deps.relay().newSession(); await noteRelay(db, null, now); }
    catch (e) {
      const why = e instanceof RelayError ? e.why : "could not reach Cloudflare";
      console.warn("[rooms] relay unavailable at room start:", why);
      await noteRelay(db, why, now);
      mode = "p2p";
      note = `The relay isn't answering right now, so this room runs phone to phone: up to ${listenerCap("p2p", settings).toLocaleString("en-GB")} listeners.`;
    }
  }
  const r: RoomDoc = {
    cid: c.id, communityName: c.name, title: t, hostUid: uid, hostName: me.name, speakers: [], hands: {}, joined: { [uid]: { ...me, at, seen: at } }, status: "live", mode, createdAt: at, peak: 1,
    ...(mode === "relay" ? { published: {}, listening: 0, countedAt: at, chatSlow: 0, handInfo: {}, ...(liveRoomsOn() ? { edge: true } : {}) } : {}), ...(note ? { note } : {}),
  };
  await db.doc(`communityRooms/${id}`).set(r);
  // The live-rooms worker: the room's settings and where to send its chat's record (the room still works through Firestore if this fails).
  if (r.edge) await tellLiveRoom(id, { op: "config", config: liveConfigFor(id, uid, settings) });
  return { id, mode, ...(note ? { note } : {}) };
}

// Joining: the listener cap is the room's mode's setting, read now (lib/rooms.ts listenerCap); someone already in (a reload) always gets back in.
export async function joinRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ok: true; mode: RoomMode; cap: number }> {
  const { ref, r } = await roomOf(db, id);
  if (!(await roleIn(db, r.cid, uid))) throw new CommunityError(403, "Rooms are for the community's members.");
  const me = await person(db, uid);
  const settings = await getRoomSettings(db);
  if (r.mode === "relay") {
    // On the relay a listener's presence is their own people doc, so joining never writes the room doc (except to refresh the count).
    if (r.status !== "live" || !presentIn(r, now.getTime()).includes(r.hostUid)) throw new CommunityError(410, "The room has ended.");
    const cap = listenerCap("relay", settings);
    const at = now.toISOString();
    if (r.joined[uid]) { await ref.update({ [`joined.${uid}.seen`]: at }); return { ok: true, mode: "relay", cap }; } // the stage, reloading
    const pref = peopleOf(ref).doc(uid);
    const before = (await pref.get()).data() as RoomPersonDoc | undefined;
    // The cap counts the people docs now (a count costs one read per thousand). Two joining in the same instant may both get the last
    // seat: a room can go one or two over its cap, never more.
    // On the live-rooms worker its count of connected listeners counts too (whichever is higher).
    if (!isFresh(before, now.getTime()) && Math.max(await activeListeners(ref, now), edgeFresh(r, now.getTime()) ? r.listening ?? 0 : 0) >= cap) throw new CommunityError(409, roomFullText(cap));
    await pref.set({ ...me, at: before?.at ?? at, seen: at, ...(before?.chatAt ? { chatAt: before.chatAt } : {}) } satisfies RoomPersonDoc);
    await recount(db, ref.id, now).catch(() => null);
    return { ok: true, mode: "relay", cap };
  }
  return db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as RoomDoc;
    if (cur.status !== "live" || !presentIn(cur, now.getTime()).includes(cur.hostUid)) throw new CommunityError(410, "The room has ended.");
    const mode: RoomMode = "p2p";
    const cap = listenerCap(mode, settings);
    if (!cur.joined[uid] && roomIsFull(cur, cap, now.getTime())) throw new CommunityError(409, roomFullText(cap));
    const at = now.toISOString();
    t.update(ref, { [`joined.${uid}`]: { ...me, at, seen: at }, peak: Math.max(cur.peak ?? 1, presentIn(cur, now.getTime()).length + 1) });
    return { ok: true as const, mode, cap };
  });
}

export async function beatRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ live: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { live: false };
  const pref = peopleOf(ref).doc(uid);
  const listener = r.mode === "relay" && !r.joined?.[uid] ? ((await pref.get()).data() as RoomPersonDoc | undefined) : undefined;
  if (!r.joined?.[uid] && !listener) return { live: false };
  // The host gone quiet for a minute (their app closed): the room ends.
  if (uid !== r.hostUid && !presentIn(r, now.getTime()).includes(r.hostUid)) { await endRoom(db, ref.id, now); return { live: false }; }
  // A relay listener beats into their own people doc; the stage (and everyone phone to phone) into the room doc.
  if (listener) await pref.update({ seen: now.toISOString() });
  else await ref.update({ [`joined.${uid}.seen`]: now.toISOString() });
  if (r.mode === "relay" && countDue(r, now.getTime())) await recount(db, ref.id, now).catch(() => null);
  return { live: true };
}

// Leaving: off the stage and out; the host leaving ends the room.
export async function leaveRoom(db: Firestore, uid: string, id: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ ended: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { ended: true };
  if (uid === r.hostUid) { await endRoom(db, ref.id, now); return { ended: true }; }
  const onStage = !!r.joined?.[uid] || !!r.hands?.[uid];
  if (r.mode !== "relay" || onStage) {
    await ref.update({ [`joined.${uid}`]: FieldValue.delete(), [`hands.${uid}`]: FieldValue.delete(), speakers: FieldValue.arrayRemove(uid), ...(r.mode === "relay" ? { [`published.${uid}`]: FieldValue.delete(), [`handInfo.${uid}`]: FieldValue.delete() } : {}) });
  }
  if (r.mode === "relay") {
    await stopPush(db, ref.id, uid, deps).catch(() => {});
    await ref.collection("relay").doc(uid).delete().catch(() => {});
    await peopleOf(ref).doc(uid).delete().catch(() => {});
    await recount(db, ref.id, now).catch(() => null);
  }
  return { ended: false };
}

export async function raiseHand(db: Firestore, uid: string, id: unknown, up: unknown, now = new Date()): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode === "relay") {
    // A relay listener isn't in `joined`, so the hand carries their name and picture for the host.
    const p = r.status === "live" ? await listenerHere(ref, uid, now) : null;
    if (!p) throw new CommunityError(409, "Join the room first.");
    await ref.update(up === false ? { [`hands.${uid}`]: FieldValue.delete(), [`handInfo.${uid}`]: FieldValue.delete() } : { [`hands.${uid}`]: now.toISOString(), [`handInfo.${uid}`]: { name: p.name, avatar: p.avatar } });
    return;
  }
  if (r.status !== "live" || !r.joined?.[uid]) throw new CommunityError(409, "Join the room first.");
  await ref.update({ [`hands.${uid}`]: up === false ? FieldValue.delete() : now.toISOString() });
}

// The host brings someone on stage (up to ROOM_SPEAKERS_MAX at a time) or sends them back to listening; a speaker can step down themselves.
export async function setSpeaker(db: Firestore, uid: string, id: unknown, who: unknown, on: unknown, now = new Date(), deps: RoomDeps = defaultDeps): Promise<{ speakers: string[] }> {
  const { ref } = await roomOf(db, id);
  const target = String(who ?? "");
  const pref = peopleOf(ref).doc(target || "x");
  return db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc;
    const relay = r.mode === "relay";
    const listener = relay ? ((await t.get(pref)).data() as RoomPersonDoc | undefined) : undefined;
    if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
    const host = uid === r.hostUid;
    if (!host && !(target === uid && on === false)) throw new CommunityError(403, "Only the host chooses who speaks.");
    if (target === r.hostUid) throw new CommunityError(400, "The host is always on stage.");
    let speakers = r.speakers.filter((u) => u !== target);
    const at = now.toISOString();
    const moves: Record<string, unknown> = {};
    if (on !== false) {
      const here = presentIn(r, now.getTime()).includes(target) || (relay && isFresh(listener, now.getTime()));
      if (!here) {
        if (relay) t.update(ref, { [`hands.${target}`]: FieldValue.delete(), [`handInfo.${target}`]: FieldValue.delete() }); // a stale hand goes
        return { error: "They've left the room.", speakers: r.speakers, relay, edge: false };
      }
      if (speakers.length >= ROOM_SPEAKERS_MAX) throw new CommunityError(409, `Up to ${ROOM_SPEAKERS_MAX} people can speak at a time besides you. Move someone back to listening first.`);
      speakers = [...speakers, target];
      // Relay: up from the listeners onto the stage (the room doc), out of people/.
      if (relay && !r.joined[target] && listener) { moves[`joined.${target}`] = { name: listener.name, avatar: listener.avatar, at: listener.at, seen: at }; t.delete(pref); }
    } else if (relay && r.joined[target]) {
      // Relay: back to the listeners: off the room doc, into people/.
      const j = r.joined[target];
      moves[`joined.${target}`] = FieldValue.delete();
      t.set(pref, { name: j.name, avatar: j.avatar, at: j.at, seen: at } satisfies RoomPersonDoc);
    }
    // Off the stage on the relay: they stop being pulled at once, and their microphone is cut at Cloudflare (below).
    t.update(ref, { speakers, [`hands.${target}`]: FieldValue.delete(), ...(relay ? { [`handInfo.${target}`]: FieldValue.delete() } : {}), ...moves, ...(on === false && relay ? { [`published.${target}`]: FieldValue.delete() } : {}) });
    return { speakers, relay, error: "", edge: !!r.edge };
  }).then(async (x) => {
    if (x.error) throw new CommunityError(409, x.error);
    if (on === false && x.relay) await stopPush(db, ref.id, target, deps).catch(() => {});
    // The live-rooms worker learns the stage from us, never from a browser.
    if (x.edge) await tellLiveRoom(ref.id, { op: "role", uid: target, role: on === false ? "listener" : "speaker" });
    return { speakers: x.speakers };
  });
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
    people: page.filter((p) => isFresh(p, now.getTime())).map((p) => ({ uid: p.uid, name: p.name, avatar: p.avatar, hand: !!r.hands?.[p.uid] })),
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
export async function removeChat(db: Firestore, uid: string, id: unknown, messageId: unknown): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  if (uid !== r.hostUid && !can(await roleIn(db, r.cid, uid), "remove_post")) throw new CommunityError(403, "Only the host or a moderator can remove messages.");
  await ref.collection("chat").doc(String(messageId ?? "x")).delete();
  if (r.edge) await tellLiveRoom(ref.id, { op: "unchat", id: String(messageId ?? "") });
}

// Ending: the host, or an admin of the community. The connection details are cleared.
export async function closeRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  if (uid !== r.hostUid && !can(await roleIn(db, r.cid, uid), "settings")) throw new CommunityError(403, "Only the host or an admin can end the room.");
  await endRoom(db, ref.id, now);
}
export async function endRoom(db: Firestore, id: string, now = new Date()): Promise<void> {
  const ref = db.doc(`communityRooms/${id}`);
  const ended = await db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc | undefined;
    if (!r || r.status !== "live") return false;
    t.update(ref, { status: "ended", endedAt: now.toISOString(), joined: {}, hands: {}, speakers: [], ...(r.mode === "relay" ? { published: {}, handInfo: {}, listening: 0 } : {}) });
    return r.edge ? "edge" : true;
  });
  if (!ended) return;
  // The worker tells everyone, closes the sockets and sends its last batch and the room's peak.
  if (ended === "edge") await tellLiveRoom(id, { op: "end" });
  for (let more = true; more;) {
    const chat = await db.collection(`communityRooms/${id}/chat`).limit(400).get();
    if (!chat.empty) { const b = db.batch(); chat.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
    more = chat.size === 400;
  }
  // Relay rooms: the Cloudflare session records and the listeners go (the sessions themselves close when the browsers do).
  for (const sub of ["relay", "people"]) {
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
export type RelayStepResult = { answer?: { type: string; sdp: string }; offer?: { type: string; sdp: string } | null; renegotiate?: boolean; tracks?: { uid: string; mid: string }[]; ok?: true };

export async function relayStep(db: Firestore, uid: string, id: unknown, body: Record<string, unknown>, now = new Date(), deps: RoomDeps = defaultDeps): Promise<RelayStepResult> {
  const { ref, r } = await roomOf(db, id);
  if (r.mode !== "relay") throw new CommunityError(409, "This room runs phone to phone.");
  if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
  const listener = presentIn(r, now.getTime()).includes(uid) ? null : await listenerHere(ref, uid, now);
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
        const want = (Array.isArray(body.uids) ? body.uids : []).map(String).slice(0, ROOM_SPEAKERS_MAX + 1);
        const allowed = want.filter((u) => canPull(r, uid, u, now.getTime(), !!listener));
        if (!allowed.length) throw new CommunityError(409, "Nobody on stage is sending sound right now.");
        const records = await db.getAll(...allowed.map((u) => ref.collection("relay").doc(u)));
        const from = records.flatMap((d, i) => {
          const rec = d.data() as RoomRelayRecord | undefined;
          return rec?.sessionId && rec.push?.trackName ? [{ uid: allowed[i], sessionId: rec.sessionId, trackName: rec.push.trackName }] : [];
        });
        if (!from.length) throw new CommunityError(409, "Nobody on stage is sending sound right now.");
        const sessionId = await session();
        const res = await relay.pull(sessionId, from.map((f) => ({ sessionId: f.sessionId, trackName: f.trackName })));
        const tracks = res.tracks.flatMap((t) => {
          const f = from.find((x) => x.trackName === t.trackName);
          return f && t.mid && !t.errorCode ? [{ uid: f.uid, mid: t.mid }] : [];
        });
        return { offer: res.offer, renegotiate: res.renegotiate, tracks };
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
