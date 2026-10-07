import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MESSAGE_MAX, attachmentLabel, attachmentTypeOf, conversationId, type MessageAttachment, type MomentRef, type ThreadMessage } from "./messages-rules";
import { isMomentExpired } from "./moments-rules";
import { notifyBell, sendEmail } from "./email";
import { getAdminDb, getUserEmail } from "./firebase-admin";
import { sendPush, type PushPayload } from "./push-server";
import { effectiveTier } from "./users";
import { getTierConfig } from "./tiers";
import { limit } from "./limits-server";
import { safeFileName } from "./private-files";

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

export type SendInput = { text: string; moment?: MomentRef; attachmentIds?: string[] };
// How the server checks an uploaded file really arrived (a HEAD on the private bucket); injected so it can be tested.
export type FileDeps = { head: (key: string) => Promise<{ size: number } | null> };

const tierOf = async (db: Firestore, uid: string) => {
  const u = (await db.doc(`users/${uid}`).get()).data();
  return effectiveTier({ username: u?.username ?? "", role: u?.role ?? "reader", accountTier: u?.accountTier ?? "standard" });
};

// What this member may attach, by plan (admins set the numbers in /admin/limits).
export async function attachmentLimits(db: Firestore, uid: string): Promise<{ maxBytes: number; maxCount: number }> {
  const tier = await tierOf(db, uid);
  return { maxBytes: (await limit(db, "messageAttachmentMB", tier)) * 1024 * 1024, maxCount: await limit(db, "messageAttachmentsPerMessage", tier) };
}

// Step one of attaching a file: checks the type and size against the plan and returns a short-lived upload link. Nothing is attached
// until the message is sent with the returned id; a file never used is cleaned up by sweepMessageUploads.
export async function startMessageAttachment(
  db: Firestore, uid: string, input: { name: unknown; size: unknown; contentType?: unknown },
  presign: (key: string, contentType: string, size: number) => Promise<string>, now = new Date(),
): Promise<{ id: string; uploadUrl: string; contentType: string }> {
  const name = String(input.name ?? "").trim().slice(0, 200);
  const size = Number(input.size);
  const what = attachmentTypeOf(name);
  if (!what) throw new MessageError(400, "That kind of file can't be sent. Pictures, videos, PDFs, Office files, text and zip files can.");
  if (!Number.isInteger(size) || size <= 0) throw new MessageError(400, "That file looks empty.");
  const { maxBytes } = await attachmentLimits(db, uid);
  if (size > maxBytes) throw new MessageError(413, `Files can be up to ${Math.floor(maxBytes / 1048576)} MB on your plan.`);
  const id = randomBytes(8).toString("hex");
  const key = `messages/${uid}/${id}-${safeFileName(name)}`;
  await db.doc(`messageUploads/${id}`).set({ uid, key, name, size, type: what.type, kind: what.kind, used: false, createdAt: now.toISOString() });
  return { id, uploadUrl: await presign(key, what.type, size), contentType: what.type };
}

async function claimAttachments(db: Firestore, uid: string, ids: string[], files: FileDeps | undefined): Promise<MessageAttachment[]> {
  const { maxCount, maxBytes } = await attachmentLimits(db, uid);
  if (ids.length > maxCount) throw new MessageError(413, `You can send ${maxCount} file${maxCount === 1 ? "" : "s"} in one message on your plan.`);
  if (!files) throw new MessageError(503, "Sending files isn't set up yet.");
  const out: MessageAttachment[] = [];
  for (const id of ids) {
    const up = (await db.doc(`messageUploads/${id}`).get()).data();
    if (!up || up.uid !== uid) throw new MessageError(400, "One of the files wasn't found. Attach it again.");
    if (up.used) throw new MessageError(400, "One of the files was already sent.");
    const head = await files.head(up.key);
    if (!head || head.size !== up.size || head.size > maxBytes) throw new MessageError(400, "A file didn't upload properly. Attach it again.");
    out.push({ key: up.key, name: up.name, size: up.size, type: up.type, kind: up.kind });
  }
  return out;
}

// Removes files that were uploaded but never sent (or whose message never went out), after a day.
export async function sweepMessageUploads(db: Firestore, remove: (key: string) => Promise<void>, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const snap = await db.collection("messageUploads").where("createdAt", "<", cutoff).limit(200).get();
  let n = 0;
  for (const d of snap.docs) {
    if (d.data().used !== true) { await remove(String(d.data().key)).catch(() => {}); n++; }
    await d.ref.delete();
  }
  return n;
}

export async function sendMessage(db: Firestore, fromUid: string, toUid: string, input: SendInput, now = new Date(), notify: Notify = notifyBell, alerts?: Alerts, files?: FileDeps): Promise<{ conversationId: string; messageId: string }> {
  const text = String(input.text ?? "").trim();
  const ids = Array.isArray(input.attachmentIds) ? input.attachmentIds.map(String) : [];
  if (!text && !ids.length) throw new MessageError(400, "Write a message first.");
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

  const attachments = ids.length ? await claimAttachments(db, fromUid, ids, files) : [];
  const preview = (text || attachmentLabel(attachments)).slice(0, 120);
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
    t.set(msgRef, { from: fromUid, text, createdAt, ...(attachments.length ? { attachments } : {}), ...(input.moment ? { momentRef: input.moment } : {}) });
    t.update(convRef, {
      lastMessage: { from: fromUid, text: preview, at: createdAt, ...(input.moment ? { moment: true } : {}) },
      lastMessageAt: createdAt,
      [`unread.${toUid}`]: FieldValue.increment(1),
      [`unread.${fromUid}`]: 0,
    });
  });
  for (const id of ids) await db.doc(`messageUploads/${id}`).update({ used: true }).catch(() => {});
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
      id: d.id, from: m.from, text: m.text, createdAt: m.createdAt, ...(m.readAt ? { readAt: m.readAt } : {}),
      ...(m.attachments ? { attachments: (m.attachments as MessageAttachment[]).map(({ key: _k, ...info }) => info) } : {}),
      // Only whether it has expired — never the moment's content.
      ...(ref ? { moment: { momentId: ref.momentId, expired: isMomentExpired(ref.expiresAt, now) } } : {}),
    };
  });
  await stampRead(db, convRef, uid, now).catch(() => {});
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

export async function markRead(db: Firestore, uid: string, cid: string, now = new Date()): Promise<void> {
  const ref = db.doc(`conversations/${cid}`);
  const c = (await ref.get()).data();
  if (!c || !(c.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
  await stampRead(db, ref, uid, now);
}

// Reading a conversation: clears your unread count and stamps `readAt` on what the other person sent that you hadn't opened yet, so
// they see the double tick and the time. `readMarker.<uid>` remembers the newest message already stamped, so each message gets its
// time exactly once (opening the conversation again later doesn't move it).
async function stampRead(db: Firestore, ref: ReturnType<Firestore["doc"]>, uid: string, now: Date): Promise<void> {
  const marker = ((await ref.get()).data()?.readMarker?.[uid] as string | undefined) ?? "";
  const snap = await ref.collection("messages").where("createdAt", ">", marker).orderBy("createdAt").limit(500).get();
  const batch = db.batch();
  for (const d of snap.docs) if (d.data().from !== uid && !d.data().readAt) batch.update(d.ref, { readAt: now.toISOString() });
  const newest = snap.empty ? marker : String(snap.docs[snap.docs.length - 1].data().createdAt);
  batch.update(ref, { [`unread.${uid}`]: 0, [`readMarker.${uid}`]: newest });
  await batch.commit();
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
