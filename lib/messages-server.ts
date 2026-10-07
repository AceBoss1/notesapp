import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MESSAGE_MAX, conversationId, type MomentRef, type ThreadMessage } from "./messages-rules";
import { isMomentExpired } from "./moments-rules";

// Server side of direct messages. Clients never write messages: every send goes through here so the checks
// (not yourself, recipient exists, neither suspended, not blocked, length) can't be skipped.
export class MessageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type SendInput = { text: string; moment?: MomentRef };

export async function sendMessage(db: Firestore, fromUid: string, toUid: string, input: SendInput, now = new Date()): Promise<{ conversationId: string; messageId: string }> {
  const text = String(input.text ?? "").trim();
  if (!text) throw new MessageError(400, "Write a message first.");
  if (text.length > MESSAGE_MAX) throw new MessageError(413, `Messages can be up to ${MESSAGE_MAX} characters.`);
  if (!toUid || toUid === fromUid) throw new MessageError(400, "Pick someone else to message.");

  const [from, to, blocked] = await Promise.all([
    db.doc(`users/${fromUid}`).get(),
    db.doc(`users/${toUid}`).get(),
    db.doc(`dmBlocks/${toUid}_${fromUid}`).get(), // recipient has blocked sender
  ]);
  if (!to.exists) throw new MessageError(404, "That member wasn't found.");
  if (from.data()?.suspended === true) throw new MessageError(403, "Your account can't send messages right now.");
  if (to.data()?.suspended === true) throw new MessageError(404, "That member wasn't found.");
  // Same message as a missing account, so a block doesn't tell the sender they were blocked.
  if (blocked.exists) throw new MessageError(404, "That member wasn't found.");

  const cid = conversationId(fromUid, toUid);
  const messageId = `${String(now.getTime()).padStart(13, "0")}_${randomBytes(4).toString("hex")}`;
  const convRef = db.doc(`conversations/${cid}`);
  const msgRef = convRef.collection("messages").doc(messageId);
  const createdAt = now.toISOString();

  await db.runTransaction(async (t) => {
    const conv = await t.get(convRef);
    if (!conv.exists) {
      t.set(convRef, { participants: [fromUid, toUid].sort(), createdAt, unread: { [fromUid]: 0, [toUid]: 0 } });
    }
    t.set(msgRef, { from: fromUid, text, createdAt, ...(input.moment ? { momentRef: input.moment } : {}) });
    t.update(convRef, {
      lastMessage: { from: fromUid, text: text.slice(0, 120), at: createdAt, ...(input.moment ? { moment: true } : {}) },
      lastMessageAt: createdAt,
      [`unread.${toUid}`]: FieldValue.increment(1),
      [`unread.${fromUid}`]: 0,
    });
  });
  return { conversationId: cid, messageId };
}

export type ConversationRow = { id: string; withUid: string; lastText: string; lastAt: string; lastFromMe: boolean; unread: number; moment: boolean };

export async function listConversations(db: Firestore, uid: string): Promise<ConversationRow[]> {
  // array-contains only (no orderBy) so no composite index is needed; sorted here.
  const snap = await db.collection("conversations").where("participants", "array-contains", uid).limit(100).get();
  return snap.docs
    .map((d) => {
      const c = d.data();
      const withUid = (c.participants as string[]).find((p) => p !== uid) ?? uid;
      return {
        id: d.id, withUid,
        lastText: c.lastMessage?.text ?? "", lastAt: c.lastMessageAt ?? c.createdAt ?? "",
        lastFromMe: c.lastMessage?.from === uid, unread: (c.unread?.[uid] as number | undefined) ?? 0, moment: c.lastMessage?.moment === true,
      };
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

export async function getThread(db: Firestore, uid: string, cid: string, now = new Date(), limit = 100): Promise<{ withUid: string; messages: ThreadMessage[] }> {
  const convRef = db.doc(`conversations/${cid}`);
  const conv = (await convRef.get()).data();
  if (!conv || !(conv.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
  const snap = await convRef.collection("messages").orderBy("createdAt", "desc").limit(limit).get();
  const messages: ThreadMessage[] = snap.docs.reverse().map((d) => {
    const m = d.data();
    const ref = m.momentRef as MomentRef | undefined;
    return {
      id: d.id, from: m.from, text: m.text, createdAt: m.createdAt,
      // Only whether it has expired — never the moment's content.
      ...(ref ? { moment: { momentId: ref.momentId, expired: isMomentExpired(ref.expiresAt, now) } } : {}),
    };
  });
  await convRef.update({ [`unread.${uid}`]: 0 }).catch(() => {});
  return { withUid: (conv.participants as string[]).find((p) => p !== uid) ?? uid, messages };
}
