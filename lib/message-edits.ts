import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MESSAGE_MAX, emojiAsText, isReaction } from "./messages-rules";
import { MessageError, mutedAmong } from "./messages-server";
import { dropKept } from "./message-kept";
import { notifyBell } from "./email";

// Pins, edits and deletes in Messages. Server-only: clients never write messages.
//   Pinned messages: up to 3 per conversation, the same for everyone in it (any member of a one-to-one chat; admins in a group).
//   Pinned chats: up to 3 per member, at the top of their own inbox (chatPins/{uid}.list, which only they can read).
//   Editing or deleting your own message: straight away while nobody has read it. Once it has been read, everyone who read it must
//   agree: a request (messageRequests/{id}) waits for them, and is wiped after 30 days if they never answer.
export const PIN_MAX = 3;
export const CONSENT_DAYS = 30;
export const DELETED_TEXT = "This message was deleted";

type Conv = FirebaseFirestore.DocumentData;
async function conversation(db: Firestore, uid: string, cid: string): Promise<Conv> {
  const c = (await db.doc(`conversations/${cid}`).get()).data();
  if (!c || !(c.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
  return c;
}
const isGroup = (c: Conv) => c.kind === "group";

// ---- pinned messages ----
export async function pinMessage(db: Firestore, uid: string, cid: string, messageId: string, pin: boolean, now = new Date()): Promise<{ pinned: { id: string; by: string; at: string }[] }> {
  if (!messageId || messageId.includes("/")) throw new MessageError(400, "Choose a message.");
  const ref = db.doc(`conversations/${cid}`);
  return db.runTransaction(async (t) => {
    const c = (await t.get(ref)).data();
    if (!c || !(c.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
    if (isGroup(c) && !((c.adminUids as string[] | undefined) ?? []).includes(uid)) throw new MessageError(403, "Only group admins can pin messages.");
    const m = (await t.get(ref.collection("messages").doc(messageId))).data();
    if (!m || m.removed || m.deleted) throw new MessageError(404, "That message wasn't found.");
    let pinned = ((c.pinned as { id: string; by: string; at: string }[] | undefined) ?? []).filter((p) => p.id !== messageId);
    if (pin) {
      if (pinned.length >= PIN_MAX) throw new MessageError(409, `You can pin up to ${PIN_MAX} messages. Unpin one first.`);
      pinned = [...pinned, { id: messageId, by: uid, at: now.toISOString() }];
    }
    t.update(ref, { pinned });
    return { pinned };
  });
}

// ---- reactions ----
// One reaction per person per message (choosing another replaces it; "" takes it off). Not on deleted, removed or call lines, and not in a
// one-to-one chat where either person has blocked the other. The sender gets a bell for a new reaction (unless they muted the chat).
export async function reactToMessage(db: Firestore, uid: string, cid: string, messageId: string, emoji: unknown, notify = notifyBell): Promise<{ reaction: string }> {
  if (!messageId || messageId.includes("/")) throw new MessageError(400, "Choose a message.");
  if (emoji !== "" && !isReaction(emoji)) throw new MessageError(400, "React with one emoji.");
  const c = await conversation(db, uid, cid);
  if (!isGroup(c)) {
    const other = (c.participants as string[]).find((p) => p !== uid) ?? uid;
    const [a, b] = await db.getAll(db.doc(`dmBlocks/${uid}_${other}`), db.doc(`dmBlocks/${other}_${uid}`));
    if (a.exists || b.exists) throw new MessageError(403, "You can't react in this conversation.");
  }
  const ref = db.doc(`conversations/${cid}/messages/${messageId}`);
  const m = (await ref.get()).data();
  if (!m || m.removed || m.deleted || m.call) throw new MessageError(404, "That message wasn't found.");
  const before = (m.reactions as Record<string, string> | undefined)?.[uid] ?? "";
  if (before === emoji) return { reaction: before };
  await ref.update({ [`reactions.${uid}`]: emoji ? emoji : FieldValue.delete() });
  if (emoji && m.from !== uid && !(await mutedAmong(db, [m.from], cid)).has(m.from)) {
    const name = String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "Someone");
    const what = String(m.text ?? "").trim();
    await notify({ uid: m.from, type: "message", linkHref: `/messages/${cid}`, message: `${name} reacted ${emojiAsText(String(emoji))} to your message${what ? `: “${what.slice(0, 60)}${what.length > 60 ? "…" : ""}”` : ""}` }).catch(() => {});
  }
  return { reaction: String(emoji) };
}

// ---- deleting for yourself ----
// Any message, yours or theirs, can leave your own view of the chat: chatHidden/{uid}/chats/{cid}.ids, which only you can read.
// Everyone else still sees it (deleting your own for everyone is changeMessage's "delete").
export const HIDE_MAX = 100;
export async function hideMessages(db: Firestore, uid: string, cid: string, ids: unknown): Promise<{ hidden: number }> {
  const list = Array.isArray(ids) ? Array.from(new Set(ids.map(String))).filter((x) => x && !x.includes("/")) : [];
  if (!list.length) throw new MessageError(400, "Choose the messages to delete.");
  if (list.length > HIDE_MAX) throw new MessageError(400, `Delete up to ${HIDE_MAX} messages at a time.`);
  await conversation(db, uid, cid);
  await db.doc(`chatHidden/${uid}/chats/${cid}`).set({ ids: FieldValue.arrayUnion(...list) }, { merge: true });
  return { hidden: list.length };
}

// ---- pinned chats ----
export async function pinChat(db: Firestore, uid: string, cid: string, pin: boolean): Promise<{ pinnedChats: string[] }> {
  await conversation(db, uid, cid);
  const ref = db.doc(`chatPins/${uid}`);
  return db.runTransaction(async (t) => {
    let list = (((await t.get(ref)).data()?.list as string[] | undefined) ?? []).filter((x) => x !== cid);
    if (pin) {
      if (list.length >= PIN_MAX) throw new MessageError(409, `You can pin up to ${PIN_MAX} chats. Unpin one first.`);
      list = [...list, cid];
    }
    t.set(ref, { uid, list });
    return { pinnedChats: list };
  });
}

// ---- edits and deletes ----
// Who has read a message: in a one-to-one chat the other person, once it has a read time; in a group, every member whose read marker
// has reached it.
function readersOf(c: Conv, m: FirebaseFirestore.DocumentData): string[] {
  if (!isGroup(c)) return m.readAt ? (c.participants as string[]).filter((p) => p !== m.from) : [];
  const marks = (c.readMarker as Record<string, string> | undefined) ?? {};
  return (c.participants as string[]).filter((p) => p !== m.from && (marks[p] ?? "") >= String(m.createdAt));
}

export type EditResult = { done: true } | { done: false; requestId: string; waitingFor: number };

async function apply(db: Firestore, cid: string, messageId: string, kind: "edit" | "delete", text: string, deleteFile: (key: string) => Promise<void>, now: Date) {
  const convRef = db.doc(`conversations/${cid}`);
  const ref = convRef.collection("messages").doc(messageId);
  const m = (await ref.get()).data();
  if (!m) return;
  const at = now.toISOString();
  if (kind === "edit") await ref.update({ text, editedAt: at, pendingRequest: FieldValue.delete() });
  else {
    for (const f of (m.attachments as { key: string }[] | undefined) ?? []) await deleteFile(String(f.key)).catch(() => {});
    await ref.update({ text: "", deleted: { at }, attachments: FieldValue.delete(), sticker: FieldValue.delete(), momentRef: FieldValue.delete(), pendingRequest: FieldValue.delete(), reactions: FieldValue.delete() });
    await dropKept(db, messageId).catch(() => {}); // kept copies go with it
    const quotes = await convRef.collection("messages").where("replyTo.id", "==", messageId).get();
    for (const q of quotes.docs) await q.ref.update({ "replyTo.text": DELETED_TEXT }).catch(() => {});
  }
  const c = (await convRef.get()).data();
  if (c?.lastMessage && c.lastMessage.at === m.createdAt && c.lastMessage.from === m.from) await convRef.update({ "lastMessage.text": kind === "edit" ? text.slice(0, 120) : `🗑 ${DELETED_TEXT}` });
  // Unpinned when deleted.
  if (kind === "delete" && (c?.pinned as { id: string }[] | undefined)?.some((p) => p.id === messageId)) await convRef.update({ pinned: (c!.pinned as { id: string }[]).filter((p) => p.id !== messageId) });
}

export async function changeMessage(
  db: Firestore, uid: string, cid: string, messageId: string, kind: "edit" | "delete", newText: unknown,
  deleteFile: (key: string) => Promise<void> = async () => {}, now = new Date(), notify = notifyBell,
): Promise<EditResult> {
  if (!messageId || messageId.includes("/")) throw new MessageError(400, "Choose a message.");
  const c = await conversation(db, uid, cid);
  const ref = db.doc(`conversations/${cid}/messages/${messageId}`);
  const m = (await ref.get()).data();
  if (!m) throw new MessageError(404, "That message wasn't found.");
  if (m.from !== uid) throw new MessageError(403, "You can only change your own messages.");
  if (m.removed || m.deleted || m.call) throw new MessageError(409, "That message can't be changed.");
  if (m.pendingRequest) throw new MessageError(409, "There's already a request waiting for this message.");
  const text = kind === "edit" ? String(newText ?? "").trim() : "";
  if (kind === "edit") {
    if (!text) throw new MessageError(400, "Write something, or delete the message instead.");
    if (text.length > MESSAGE_MAX) throw new MessageError(413, `Messages can be up to ${MESSAGE_MAX} characters.`);
    if (!m.text && !m.attachments) throw new MessageError(409, "Only written messages can be edited.");
    if (text === m.text) return { done: true };
  }
  const readers = readersOf(c, m);
  if (!readers.length) { await apply(db, cid, messageId, kind, text, deleteFile, now); return { done: true }; }
  // Read already: everyone who read it has to agree.
  const requestId = randomBytes(8).toString("hex");
  const expiresAt = new Date(now.getTime() + CONSENT_DAYS * 86_400_000).toISOString();
  await db.doc(`messageRequests/${requestId}`).set({ cid, messageId, from: uid, kind, ...(kind === "edit" ? { text } : {}), readers, approved: [], createdAt: now.toISOString(), expiresAt });
  await ref.update({ pendingRequest: { id: requestId, kind, ...(kind === "edit" ? { text } : {}), readers, approved: [], expiresAt } });
  const name = String((await db.doc(`users/${uid}`).get()).data()?.displayName ?? "A member");
  for (const r of readers) await notify({ uid: r, type: "message", linkHref: `/messages/${cid}#m-${messageId}`, message: `${name} asks to ${kind} a message you read` }).catch(() => {});
  return { done: false, requestId, waitingFor: readers.length };
}

// A reader answers. One "no" refuses it; it goes through when everyone who read the message has said yes. The sender can withdraw it.
export async function answerRequest(db: Firestore, uid: string, requestId: string, answer: "allow" | "decline" | "withdraw", deleteFile: (key: string) => Promise<void> = async () => {}, now = new Date()): Promise<{ status: "applied" | "declined" | "waiting" | "withdrawn" }> {
  if (!requestId || requestId.includes("/")) throw new MessageError(400, "Choose a request.");
  const rRef = db.doc(`messageRequests/${requestId}`);
  const r = (await rRef.get()).data();
  if (!r || String(r.expiresAt) < now.toISOString()) throw new MessageError(404, "That request has ended.");
  const mRef = db.doc(`conversations/${r.cid}/messages/${r.messageId}`);
  if (answer === "withdraw") {
    if (r.from !== uid) throw new MessageError(403, "Only the sender can withdraw it.");
    await mRef.update({ pendingRequest: FieldValue.delete() }).catch(() => {}); await rRef.delete();
    return { status: "withdrawn" };
  }
  if (!(r.readers as string[]).includes(uid)) throw new MessageError(403, "This request isn't for you.");
  if (answer === "decline") {
    await mRef.update({ pendingRequest: FieldValue.delete() }).catch(() => {}); await rRef.delete();
    await notifyBell({ uid: r.from, type: "message", linkHref: `/messages/${r.cid}`, message: `Your request to ${r.kind} a message was declined` }).catch(() => {});
    return { status: "declined" };
  }
  const approved = Array.from(new Set([...(r.approved as string[]), uid]));
  if ((r.readers as string[]).every((x) => approved.includes(x))) {
    await rRef.delete();
    await apply(db, String(r.cid), String(r.messageId), r.kind, String(r.text ?? ""), deleteFile, now);
    return { status: "applied" };
  }
  await rRef.update({ approved });
  await mRef.update({ "pendingRequest.approved": approved }).catch(() => {});
  return { status: "waiting" };
}

// Requests nobody answered are wiped after 30 days, like drafts (journal drafts are not affected).
export async function sweepMessageRequests(db: Firestore, now = new Date()): Promise<number> {
  const snap = await db.collection("messageRequests").where("expiresAt", "<", now.toISOString()).limit(300).get();
  for (const d of snap.docs) {
    const r = d.data();
    await db.doc(`conversations/${r.cid}/messages/${r.messageId}`).update({ pendingRequest: FieldValue.delete() }).catch(() => {});
    await d.ref.delete();
  }
  return snap.size;
}
