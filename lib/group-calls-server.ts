import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MessageError } from "./messages-server";
import { sendPush, type PushPayload } from "./push-server";
import { isCallKind } from "./calls";
import { GROUP_CALL_MAX, groupCallText, isFull, present, type GroupCallDoc } from "./group-calls";

// Group calls (lib/group-calls.ts). The server starts, joins, keeps and ends them; the devices connect to each other through
// groupCalls/{id}/links, which the security rules let only the two people of each connection read and write.

export type GroupCallDeps = { push: (uid: string, p: PushPayload) => Promise<number> };
const defaultDeps = (db: Firestore): GroupCallDeps => ({ push: (uid, p) => sendPush(db, uid, p) });

async function personOf(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) throw new MessageError(403, "Your account can't make calls right now.");
  return { name: String(u.displayName ?? "A member"), avatar: String(u.avatar ?? "") };
}

// Starts a call in a group chat (or, if one is already going there, joins it). Every other member is rung.
export async function startGroupCall(db: Firestore, uid: string, cid: unknown, kind: unknown, now = new Date(), deps: GroupCallDeps = defaultDeps(db)): Promise<{ id: string; joined: boolean }> {
  if (!isCallKind(kind)) throw new MessageError(400, "Choose a voice or video call.");
  const convRef = db.doc(`conversations/${String(cid ?? "")}`);
  const conv = (await convRef.get()).data();
  if (!conv || conv.kind !== "group" || !(conv.participants as string[]).includes(uid)) throw new MessageError(404, "That group wasn't found.");
  const me = await personOf(db, uid);
  // One call per group at a time: a live one is joined instead (one nobody is still in is closed first).
  const live = conv.liveCall as { id: string } | undefined;
  if (live?.id) {
    const c = (await db.doc(`groupCalls/${live.id}`).get()).data() as GroupCallDoc | undefined;
    if (c?.status === "live" && present(c, now.getTime()).length) return { id: live.id, joined: (await joinGroupCall(db, uid, live.id, now)).ok };
    if (c?.status === "live") await endGroupCall(db, live.id, now);
  }
  const id = `${now.getTime()}_${randomBytes(5).toString("hex")}`;
  const at = now.toISOString();
  const title = String(conv.title ?? "Group");
  const doc: GroupCallDoc = {
    cid: convRef.id, kind, title, startedBy: uid, startedByName: me.name, memberUids: [...(conv.participants as string[])],
    joined: { [uid]: { ...me, at, seen: at } }, status: "live", createdAt: at, peak: 1,
  };
  await db.doc(`groupCalls/${id}`).set(doc);
  await convRef.set({ liveCall: { id, kind } }, { merge: true });
  const others = doc.memberUids.filter((u) => u !== uid);
  await Promise.all(others.map((u) => deps.push(u, { title: `Group ${kind === "video" ? "video" : "voice"} call`, body: `${me.name} started a call in ${title}`, url: `/messages/${convRef.id}?join=${id}`, ttl: 45, urgency: "high" }).catch(() => 0)));
  return { id, joined: true };
}

// Joins a live call: only the group's members, and only while there's room (6 talking, 4 on video).
export async function joinGroupCall(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ok: true; others: string[] }> {
  const ref = db.doc(`groupCalls/${String(id ?? "")}`);
  const me = await personOf(db, uid);
  return db.runTransaction(async (t) => {
    const c = (await t.get(ref)).data() as GroupCallDoc | undefined;
    if (!c || !c.memberUids.includes(uid)) throw new MessageError(404, "That call wasn't found.");
    if (c.status !== "live" || !present(c, now.getTime()).length) throw new MessageError(410, "The call has ended.");
    const here = present(c, now.getTime()).filter((u) => u !== uid);
    if (isFull({ kind: c.kind, joined: Object.fromEntries(here.map((u) => [u, c.joined[u]])) }, now.getTime()))
      throw new MessageError(409, `The call is full: ${GROUP_CALL_MAX[c.kind]} people can be on a group ${c.kind === "video" ? "video" : "voice"} call.`);
    const at = now.toISOString();
    // People who left without saying so (their app closed) are dropped as someone joins.
    const gone = Object.keys(c.joined).filter((u) => u !== uid && !here.includes(u));
    t.update(ref, { [`joined.${uid}`]: { ...me, at, seen: at }, peak: Math.max(c.peak ?? 1, here.length + 1), ...Object.fromEntries(gone.map((u) => [`joined.${u}`, FieldValue.delete()])) });
    return { ok: true as const, others: here };
  });
}

// "Still here" every 20 seconds while in the call.
export async function beatGroupCall(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ live: boolean }> {
  const ref = db.doc(`groupCalls/${String(id ?? "")}`);
  const c = (await ref.get()).data() as GroupCallDoc | undefined;
  if (!c || c.status !== "live" || !c.joined?.[uid]) return { live: false };
  await ref.update({ [`joined.${uid}.seen`]: now.toISOString() });
  return { live: true };
}

// Leaving; the last one out ends the call.
export async function leaveGroupCall(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<{ ended: boolean }> {
  const ref = db.doc(`groupCalls/${String(id ?? "")}`);
  const left = await db.runTransaction(async (t) => {
    const c = (await t.get(ref)).data() as GroupCallDoc | undefined;
    if (!c || !c.memberUids.includes(uid)) throw new MessageError(404, "That call wasn't found.");
    if (c.status !== "live") return { last: false };
    if (c.joined?.[uid]) t.update(ref, { [`joined.${uid}`]: FieldValue.delete() });
    return { last: present(c, now.getTime()).filter((u) => u !== uid).length === 0 };
  });
  if (left.last) await endGroupCall(db, ref.id, now);
  return { ended: left.last };
}

// Ends a call once: the line in the group chat ("Group voice call · 12:03 · 4 people") and the connection details are cleared.
export async function endGroupCall(db: Firestore, id: string, now = new Date()): Promise<void> {
  const ref = db.doc(`groupCalls/${id}`);
  const c = await db.runTransaction(async (t) => {
    const c = (await t.get(ref)).data() as GroupCallDoc | undefined;
    if (!c || c.status !== "live") return null;
    const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(c.createdAt)) / 1000));
    t.update(ref, { status: "ended", endedAt: now.toISOString(), seconds, joined: {} });
    return { ...c, seconds };
  });
  if (!c) return;
  const convRef = db.doc(`conversations/${c.cid}`);
  const at = now.toISOString();
  const messageId = `${String(now.getTime()).padStart(13, "0")}_${randomBytes(4).toString("hex")}`;
  const peak = c.peak ?? 1;
  await db.runTransaction(async (t) => {
    const conv = (await t.get(convRef)).data();
    if (!conv) return;
    t.set(convRef.collection("messages").doc(messageId), { from: c.startedBy, text: "", call: { kind: c.kind, outcome: "ended", seconds: c.seconds, group: true, peak }, createdAt: at });
    t.set(convRef, { lastMessage: { from: c.startedBy, text: `📞 ${groupCallText(c.kind, c.seconds, peak)}`, at }, lastMessageAt: at, ...((conv.liveCall as { id?: string } | undefined)?.id === id ? { liveCall: FieldValue.delete() } : {}) }, { merge: true });
  });
  await clearLinks(db, id).catch(() => {});
}

async function clearLinks(db: Firestore, id: string) {
  const links = await db.collection(`groupCalls/${id}/links`).limit(200).get();
  for (const l of links.docs) {
    for (const sub of ["fromCandidates", "toCandidates"]) {
      const snap = await l.ref.collection(sub).limit(400).get();
      if (snap.empty) continue;
      const b = db.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit();
    }
    await l.ref.delete();
  }
}
