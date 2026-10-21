import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { can } from "./community";
import { CommunityError, activeRole, memberOf, readCommunity } from "./community-server";
import { ROOM_SPEAKERS_MAX, ROOM_LISTENERS_MAX_P2P, cleanRoomTitle, presentIn, roomIsFull, type RoomDoc } from "./rooms";

// Audio rooms (lib/rooms.ts). The server opens, joins, keeps and closes them and decides who is on stage; the phones connect through
// communityRooms/{id}/links. Only active members of the community come in; moderators and up host.


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

// The live rooms of a community, for its members (the Rooms card on its Home).
export async function liveRooms(db: Firestore, uid: string, cid: string, now = new Date()): Promise<(Pick<RoomDoc, "title" | "hostName" | "hostUid" | "speakers"> & { id: string; listening: number; faces: { name: string; avatar: string }[] })[]> {
  if (!(await roleIn(db, cid, uid))) return [];
  const snap = await db.collection("communityRooms").where("cid", "==", cid).where("status", "==", "live").limit(10).get();
  return snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id })).filter((r) => presentIn(r, now.getTime()).includes(r.hostUid)).map((r) => ({
    id: r.id, title: r.title, hostName: r.hostName, hostUid: r.hostUid, speakers: r.speakers,
    listening: presentIn(r, now.getTime()).length, faces: presentIn(r, now.getTime()).slice(0, 6).map((u) => ({ name: r.joined[u].name, avatar: r.joined[u].avatar })),
  }));
}

export async function startRoom(db: Firestore, uid: string, cid: unknown, title: unknown, now = new Date()): Promise<{ id: string }> {
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
  const r: RoomDoc = { cid: c.id, communityName: c.name, title: t, hostUid: uid, hostName: me.name, speakers: [], hands: {}, joined: { [uid]: { ...me, at, seen: at } }, status: "live", mode: "p2p", createdAt: at, peak: 1 };
  await db.doc(`communityRooms/${id}`).set(r);
  return { id };
}

export async function joinRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ok: true }> {
  const { ref, r } = await roomOf(db, id);
  if (!(await roleIn(db, r.cid, uid))) throw new CommunityError(403, "Rooms are for the community's members.");
  const me = await person(db, uid);
  return db.runTransaction(async (t) => {
    const cur = (await t.get(ref)).data() as RoomDoc;
    if (cur.status !== "live" || !presentIn(cur, now.getTime()).includes(cur.hostUid)) throw new CommunityError(410, "The room has ended.");
    if (!cur.joined[uid] && roomIsFull(cur, now.getTime())) throw new CommunityError(409, `The room is full: ${ROOM_LISTENERS_MAX_P2P} people can listen at a time for now.`);
    const at = now.toISOString();
    t.update(ref, { [`joined.${uid}`]: { ...me, at, seen: at }, peak: Math.max(cur.peak ?? 1, presentIn(cur, now.getTime()).length + 1) });
    return { ok: true as const };
  });
}

export async function beatRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ live: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live" || !r.joined?.[uid]) return { live: false };
  // The host gone quiet for a minute (their app closed): the room ends.
  if (uid !== r.hostUid && !presentIn(r, now.getTime()).includes(r.hostUid)) { await endRoom(db, ref.id, now); return { live: false }; }
  await ref.update({ [`joined.${uid}.seen`]: now.toISOString() });
  return { live: true };
}

// Leaving: off the stage and out; the host leaving ends the room.
export async function leaveRoom(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ended: boolean }> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live") return { ended: true };
  if (uid === r.hostUid) { await endRoom(db, ref.id, now); return { ended: true }; }
  await ref.update({ [`joined.${uid}`]: FieldValue.delete(), [`hands.${uid}`]: FieldValue.delete(), speakers: FieldValue.arrayRemove(uid) });
  return { ended: false };
}

export async function raiseHand(db: Firestore, uid: string, id: unknown, up: unknown, now = new Date()): Promise<void> {
  const { ref, r } = await roomOf(db, id);
  if (r.status !== "live" || !r.joined?.[uid]) throw new CommunityError(409, "Join the room first.");
  await ref.update({ [`hands.${uid}`]: up === false ? FieldValue.delete() : now.toISOString() });
}

// The host brings someone on stage (up to ROOM_SPEAKERS_MAX at a time) or sends them back to listening; a speaker can step down themselves.
export async function setSpeaker(db: Firestore, uid: string, id: unknown, who: unknown, on: unknown, now = new Date()): Promise<{ speakers: string[] }> {
  const { ref } = await roomOf(db, id);
  const target = String(who ?? "");
  return db.runTransaction(async (t) => {
    const r = (await t.get(ref)).data() as RoomDoc;
    if (r.status !== "live") throw new CommunityError(410, "The room has ended.");
    const host = uid === r.hostUid;
    if (!host && !(target === uid && on === false)) throw new CommunityError(403, "Only the host chooses who speaks.");
    if (target === r.hostUid) throw new CommunityError(400, "The host is always on stage.");
    let speakers = r.speakers.filter((u) => u !== target);
    if (on !== false) {
      if (!presentIn(r, now.getTime()).includes(target)) throw new CommunityError(409, "They've left the room.");
      if (speakers.length >= ROOM_SPEAKERS_MAX) throw new CommunityError(409, `Up to ${ROOM_SPEAKERS_MAX} people can speak at a time besides you. Move someone back to listening first.`);
      speakers = [...speakers, target];
    }
    t.update(ref, { speakers, [`hands.${target}`]: FieldValue.delete() });
    return { speakers };
  });
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
    t.update(ref, { status: "ended", endedAt: now.toISOString(), joined: {}, hands: {}, speakers: [] });
    return true;
  });
  if (!ended) return;
  const links = await db.collection(`communityRooms/${id}/links`).limit(300).get();
  for (const l of links.docs) {
    for (const sub of ["fromCandidates", "toCandidates"]) {
      const snap = await l.ref.collection(sub).limit(400).get();
      if (!snap.empty) { const b = db.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
    }
    await l.ref.delete();
  }
}
