import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import type { RoomChat, RoomDoc, RoomEventKind } from "./rooms";
import { tellLiveRoom } from "./live-rooms-edge";

// What happens in a live, as lines in its chat (owner, 7 Nov 2026): "@ada joined", "@ada shared the live", "@ada liked the live",
// "@ada gifted @emmanuel a Jollof Plate", "@ada followed @emmanuel", the grand-gift burst, slow mode. Written by our server with no
// sender (`ev` set), so nobody can fake one; the chat shows them as dividers, like the day lines in Messages. On the live-rooms worker
// they also go to the sockets (the "chat" op, as for a message sent through our server). Slow mode is shown by each screen from the
// room's own slow-mode signal (components/community/AudioRoom.tsx), not written here.

export const JOIN_QUIET_MS = 6_000; // joins closer together than this are grouped into one line
const at = (now: Date) => now.toISOString();

export async function postRoomEvent(db: Firestore, roomId: string, ev: RoomEventKind, text: string, now = new Date(), room?: Pick<RoomDoc, "status" | "edge">): Promise<boolean> {
  const ref = db.doc(`communityRooms/${roomId}`);
  const r = room ?? ((await ref.get()).data() as RoomDoc | undefined);
  if (!r || r.status !== "live") return false;
  const msg = ref.collection("chat").doc(`${String(now.getTime()).padStart(13, "0")}_${randomBytes(3).toString("hex")}`);
  const m: RoomChat = { from: "", name: "", avatar: "", text: text.slice(0, 280), at: at(now), ev };
  await msg.set(m);
  if (r.edge) await tellLiveRoom(roomId, { op: "chat", m: { ...m, id: msg.id } }).catch(() => false);
  return true;
}

// @username for a member (their name when they have none yet).
export async function handleOf(db: Firestore, uid: string): Promise<string> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  return u?.username ? `@${u.username}` : String(u?.displayName || "Someone");
}

// The grouped line for several joins: "@ada joined", "@ada and @tunde joined", "@ada, @tunde and 12 others joined".
export function joinLine(names: string[], extra: number): string {
  const shown = names.slice(0, 2);
  const more = extra + Math.max(0, names.length - 2);
  if (!shown.length) return "";
  if (more > 0) return `${shown.join(", ")} and ${more} other${more === 1 ? "" : "s"} joined`;
  return shown.length === 2 ? `${shown[0]} and ${shown[1]} joined` : `${shown[0]} joined`;
}

// Someone arrived (not the host). Alone in a quiet moment: their line now. In a rush: kept, and written as one grouped line by the next
// flush (the host's heartbeat, every ~20 s, or the next join after a quiet moment). State in communityRooms/{id}/meta/events.
export async function noteJoin(db: Firestore, roomId: string, uid: string, now = new Date()): Promise<void> {
  const ref = db.doc(`communityRooms/${roomId}/meta/events`);
  const name = await handleOf(db, uid);
  const line = await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data() ?? {};
    const pending: string[] = Array.isArray(d.pending) ? d.pending : [];
    const extra = Number(d.extra ?? 0);
    const quiet = now.getTime() - Date.parse(String(d.lastJoinAt ?? 0)) >= JOIN_QUIET_MS;
    if (quiet) {
      t.set(ref, { pending: [], extra: 0, lastJoinAt: at(now) }, { merge: true });
      return joinLine([...pending, name], extra);
    }
    if (pending.length < 2) t.set(ref, { pending: [...pending, name], lastJoinAt: at(now) }, { merge: true });
    else t.set(ref, { extra: FieldValue.increment(1), lastJoinAt: at(now) }, { merge: true });
    return "";
  });
  if (line) await postRoomEvent(db, roomId, "join", line, now);
}

// Writes the grouped joins waiting since the last quiet moment (called from the host's heartbeat).
export async function flushJoins(db: Firestore, roomId: string, now = new Date()): Promise<void> {
  const ref = db.doc(`communityRooms/${roomId}/meta/events`);
  const line = await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data();
    if (!d || !Array.isArray(d.pending) || !d.pending.length) return "";
    if (now.getTime() - Date.parse(String(d.lastJoinAt ?? 0)) < JOIN_QUIET_MS) return "";
    t.set(ref, { pending: [], extra: 0 }, { merge: true });
    return joinLine(d.pending, Number(d.extra ?? 0));
  });
  if (line) await postRoomEvent(db, roomId, "join", line, now);
}

// Like, share and follow: one line per person per live (communityRooms/{id}/meta/events_{kind} holds who already had one). A like also
// counts on the room (likes), which everyone in it sees.
export async function oncePerPerson(db: Firestore, roomId: string, kind: "like" | "share" | "follow", uid: string): Promise<boolean> {
  const ref = db.doc(`communityRooms/${roomId}/marks/${kind}_${uid}`);
  return db.runTransaction(async (t) => {
    if ((await t.get(ref)).exists) return false;
    t.set(ref, { at: new Date().toISOString() });
    if (kind === "like") t.update(db.doc(`communityRooms/${roomId}`), { likes: FieldValue.increment(1) });
    return true;
  });
}
