import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MESSAGE_MAX, conversationId, type MomentRef, type ThreadMessage } from "./messages-rules";
import { isMomentExpired } from "./moments-rules";
import { notifyBell, sendEmail } from "./email";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { sendPush, type PushPayload } from "./push-server";
import { effectiveTier } from "./users";
import { getTierConfig } from "./tiers";

export type Notify = (note: { uid: string; type: "message" | "moment"; linkHref: string; message: string }) => Promise<void>;

// Server side of direct messages. Clients never write messages: every send goes through here so the checks
// (not yourself, recipient exists, neither suspended, not blocked, length) can't be skipped.
export class MessageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// What happens besides the bell when a burst of messages starts. Injected so it can be tested.
export type Alerts = {
  email: (toUid: string, mail: { subject: string; text: string; label: string; url: string }) => Promise<void>;
  push: (toUid: string, payload: PushPayload) => Promise<number>;
};
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "");
const EMAIL_EVERY_MS = 3_600_000; // at most one message email an hour per member (all conversations together)

export type SendInput = { text: string; moment?: MomentRef };

export async function sendMessage(db: Firestore, fromUid: string, toUid: string, input: SendInput, now = new Date(), notify: Notify = notifyBell, alerts?: Alerts): Promise<{ conversationId: string; messageId: string }> {
  const text = String(input.text ?? "").trim();
  if (!text) throw new MessageError(400, "Write a message first.");
  if (text.length > MESSAGE_MAX) throw new MessageError(413, `Messages can be up to ${MESSAGE_MAX} characters.`);
  if (!toUid || toUid === fromUid) throw new MessageError(400, "Pick someone else to message.");

  const [from, to, blocked, iBlocked] = await Promise.all([
    db.doc(`users/${fromUid}`).get(),
    db.doc(`users/${toUid}`).get(),
    db.doc(`dmBlocks/${toUid}_${fromUid}`).get(), // recipient has blocked sender
    db.doc(`dmBlocks/${fromUid}_${toUid}`).get(), // sender has blocked recipient
  ]);
  if (!to.exists) throw new MessageError(404, "That member wasn't found.");
  if (from.data()?.suspended === true) throw new MessageError(403, "Your account can't send messages right now.");
  if (to.data()?.suspended === true) throw new MessageError(404, "That member wasn't found.");
  // Same message as a missing account, so a block doesn't tell the sender they were blocked.
  if (blocked.exists) throw new MessageError(404, "That member wasn't found.");
  if (iBlocked.exists) throw new MessageError(403, "You've blocked this member. Unblock them to send a message.");

  const cid = conversationId(fromUid, toUid);
  const messageId = `${String(now.getTime()).padStart(13, "0")}_${randomBytes(4).toString("hex")}`;
  const convRef = db.doc(`conversations/${cid}`);
  const msgRef = convRef.collection("messages").doc(messageId);
  const createdAt = now.toISOString();

  let prevUnread = 0; // what the recipient hadn't read before this message
  await db.runTransaction(async (t) => {
    const conv = await t.get(convRef);
    prevUnread = (conv.data()?.unread?.[toUid] as number | undefined) ?? 0;
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
  // One bell, one push and (at most hourly, unless switched off) one email per burst: nothing new while the last message is still
  // unread. None of them carries what was written, only who it's from.
  if (prevUnread === 0) {
    const name = String(from.data()?.displayName ?? "A member");
    const what = input.moment ? `${name} replied to your moment` : `New message from ${name}`;
    await notify({ uid: toUid, type: input.moment ? "moment" : "message", linkHref: `/messages/${cid}`, message: what }).catch(() => {});
    const a = alerts ?? defaultAlerts();
    await a.push(toUid, { title: input.moment ? "Reply to your moment" : "New message", body: `${name}`, url: `/messages/${cid}` }).catch(() => 0);
    // Email is off unless the member switched it on, and only Business and Enterprise can: it uses our sending quota. At most one an hour.
    const prefs = (await db.doc(`userPrefs/${toUid}`).get()).data();
    const last = prefs?.lastMessageEmailAt as string | undefined;
    if (prefs?.emailMessages === true && (!last || now.getTime() - new Date(last).getTime() >= EMAIL_EVERY_MS) && (await emailsAllowed(db, toUid))) {
      await db.doc(`userPrefs/${toUid}`).set({ lastMessageEmailAt: now.toISOString() }, { merge: true }).catch(() => {});
      await a.email(toUid, {
        subject: what, label: "Open your messages", url: `${siteUrl()}/messages/${cid}`,
        text: `${what} on #NotesApp. Open your messages to read it and reply.\n\nYou can turn these emails off in your Messages settings.`,
      }).catch(() => {});
    }
  }
  return { conversationId: cid, messageId };
}

const defaultAlerts = (): Alerts => ({
  email: async (toUid, m) => {
    const to = await getUserEmail(toUid);
    if (to) await sendEmail({ to, subject: m.subject, text: m.text, action: { label: m.label, url: m.url } });
  },
  push: async (toUid, payload) => sendPush(getAdminDb(), toUid, payload), // async: a missing config rejects instead of throwing here
});

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

// Total unread across conversations (the number beside "Messages" in the menu).
export async function unreadTotal(db: Firestore, uid: string): Promise<number> {
  return (await listConversations(db, uid)).reduce((n, c) => n + c.unread, 0);
}

export async function myBlocks(db: Firestore, uid: string): Promise<string[]> {
  const snap = await db.collection("dmBlocks").where("blocker", "==", uid).get();
  return snap.docs.map((d) => d.data().blocked as string);
}

// Blocking: they can't message you or see your moments, and you won't see theirs or be able to message them until you unblock.
export async function setBlock(db: Firestore, uid: string, otherUid: string, block: boolean, now = new Date()): Promise<void> {
  if (!otherUid || otherUid === uid) throw new MessageError(400, "Pick someone else.");
  const ref = db.doc(`dmBlocks/${uid}_${otherUid}`);
  if (block) await ref.set({ blocker: uid, blocked: otherUid, at: now.toISOString() });
  else await ref.delete();
}

export async function markRead(db: Firestore, uid: string, cid: string): Promise<void> {
  const ref = db.doc(`conversations/${cid}`);
  const c = (await ref.get()).data();
  if (!c || !(c.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
  await ref.update({ [`unread.${uid}`]: 0 });
}

// Whether this member's plan includes email for new messages (Business and Enterprise). Read at send time, so a plan that lapses stops them.
export async function emailsAllowed(db: Firestore, uid: string): Promise<boolean> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u || u.suspended === true) return false;
  return getTierConfig(effectiveTier({ username: u.username ?? "", role: u.role ?? "reader", accountTier: u.accountTier ?? "standard" })).messageEmails === true;
}

export type MessagePrefs = { emailMessages: boolean; emailAllowed: boolean };
export async function getPrefs(db: Firestore, uid: string): Promise<MessagePrefs> {
  const emailAllowed = await emailsAllowed(db, uid);
  // Off unless switched on, and never on for a plan that doesn't include it.
  return { emailMessages: emailAllowed && (await db.doc(`userPrefs/${uid}`).get()).data()?.emailMessages === true, emailAllowed };
}
export async function setPrefs(db: Firestore, uid: string, prefs: { emailMessages?: unknown }): Promise<void> {
  if (typeof prefs.emailMessages !== "boolean") return;
  if (prefs.emailMessages && !(await emailsAllowed(db, uid))) throw new MessageError(403, "Email for new messages comes with the Business and Enterprise plans.");
  await db.doc(`userPrefs/${uid}`).set({ uid, emailMessages: prefs.emailMessages }, { merge: true });
}
