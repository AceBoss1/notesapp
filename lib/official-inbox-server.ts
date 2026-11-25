import type { Firestore } from "firebase-admin/firestore";
import { MessageError, sendSystemMessage, stampRead, type Alerts, type Notify } from "./messages-server";
import { attachmentLabel, type MessageAttachment } from "./messages-rules";
import { OFFICIAL_UID } from "./official-account";

// Admin → #NotesApp inbox (app/(main)/admin/official-inbox, /api/admin/official-inbox): the conversations of #NotesApp's official
// account, @na-notesapp (NA_UID). Owner, 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp", so
// tournament winners are told from it (lib/official-messages-server.ts) and reply to it to confirm their details. The account has no
// login, so this is where those replies are read and answered, by Customer care and super admins (lib/admin-access.ts
// OFFICIAL_INBOX_DEPTS).
//
// Answers go out as @na-notesapp through sendSystemMessage. Who on the team wrote each one is kept in officialReplies/{messageId}
// (server-only in firestore.rules), not on the message: members read their own messages straight from Firestore, and the stamp is
// for the team alone.

export type InboxRow = {
  id: string; memberUid: string; member: { username: string; displayName: string; avatar: string };
  lastText: string; lastAt: string; lastFromMember: boolean; unread: number;
};
export type InboxMessage = {
  id: string; fromOfficial: boolean; text: string; createdAt: string; readAt?: string; sticker?: string; files?: string;
  removed?: boolean; sentByAdmin?: { uid: string; name: string };
};

const memberOf = (participants: string[]) => participants.find((p) => p !== OFFICIAL_UID) ?? "";
const nameOf = (u: FirebaseFirestore.DocumentData | undefined) => ({ username: String(u?.username ?? ""), displayName: String(u?.displayName ?? "") || "Member", avatar: String(u?.avatar ?? "") });

async function officialConversation(db: Firestore, cid: unknown) {
  const id = String(cid ?? "");
  if (!/^[\w-]{1,200}$/.test(id)) throw new MessageError(400, "Which conversation?");
  const ref = db.doc(`conversations/${id}`);
  const conv = (await ref.get()).data();
  if (!conv || conv.kind === "group" || !(conv.participants as string[]).includes(OFFICIAL_UID)) throw new MessageError(404, "That conversation isn't in #NotesApp's inbox.");
  return { id, ref, conv, memberUid: memberOf(conv.participants as string[]) };
}

/** Newest first, with how many are unread for the team. Uses the participants + lastMessageAt index (firestore.indexes.json); until
 *  that index is built it falls back to the newest of up to 500 conversations sorted here, so the inbox works on the day it ships. */
export async function officialInbox(db: Firestore, max = 200): Promise<{ rows: InboxRow[]; unread: number }> {
  const col = db.collection("conversations");
  const docs = await col.where("participants", "array-contains", OFFICIAL_UID).orderBy("lastMessageAt", "desc").limit(max).get()
    .then((s) => s.docs)
    .catch(async (e: { code?: number }) => {
      if (e?.code !== 9) throw e; // FAILED_PRECONDITION: the index isn't built yet
      return (await col.where("participants", "array-contains", OFFICIAL_UID).limit(500).get()).docs;
    });
  const convs = docs.map((d) => ({ id: d.id, c: d.data() })).filter(({ c }) => c.kind !== "group");
  const uids = Array.from(new Set(convs.map(({ c }) => memberOf(c.participants as string[])).filter(Boolean)));
  const users = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
  const byUid = new Map(users.map((u) => [u.id, u.data()]));
  const rows = convs.map(({ id, c }) => {
    const memberUid = memberOf(c.participants as string[]);
    return {
      id, memberUid, member: nameOf(byUid.get(memberUid)),
      lastText: String(c.lastMessage?.text ?? ""), lastAt: String(c.lastMessageAt ?? c.createdAt ?? ""),
      lastFromMember: !!c.lastMessage?.from && c.lastMessage.from !== OFFICIAL_UID, unread: (c.unread?.[OFFICIAL_UID] as number | undefined) ?? 0,
    };
  }).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, max);
  return { rows, unread: rows.reduce((n, r) => n + r.unread, 0) };
}

/** One conversation, oldest first, with who on the team wrote each answer. Opening it marks it read for the team (and the member
 *  sees the double tick, as with any reader), unless `markRead` is false. */
export async function officialThread(db: Firestore, cid: unknown, o: { now?: Date; markRead?: boolean; limit?: number } = {}) {
  const { id, ref, memberUid } = await officialConversation(db, cid);
  const [snap, member] = await Promise.all([
    ref.collection("messages").orderBy("createdAt", "desc").limit(o.limit ?? 300).get(),
    memberUid ? db.doc(`users/${memberUid}`).get().then((d) => d.data()) : Promise.resolve(undefined),
  ]);
  const docs = snap.docs.reverse();
  const ours = docs.filter((d) => d.data().from === OFFICIAL_UID);
  const stamps = ours.length ? await db.getAll(...ours.map((d) => db.doc(`officialReplies/${d.id}`))) : [];
  const byMsg = new Map(stamps.filter((s) => s.exists).map((s) => [s.id, String(s.data()?.sentByAdmin ?? "")]));
  const admins = Array.from(new Set(Array.from(byMsg.values()).filter(Boolean)));
  const adminDocs = admins.length ? await db.getAll(...admins.map((u) => db.doc(`users/${u}`))) : [];
  const adminName = new Map(adminDocs.map((d) => [d.id, String(d.data()?.displayName || d.data()?.username || "A team member")]));
  const messages: InboxMessage[] = docs.map((d) => {
    const m = d.data();
    const by = byMsg.get(d.id);
    return {
      id: d.id, fromOfficial: m.from === OFFICIAL_UID, text: m.removed ? "" : String(m.text ?? ""), createdAt: String(m.createdAt ?? ""),
      ...(m.readAt ? { readAt: String(m.readAt) } : {}), ...(m.sticker ? { sticker: String(m.sticker) } : {}),
      ...(m.attachments?.length ? { files: attachmentLabel(m.attachments as MessageAttachment[]) } : {}), ...(m.removed ? { removed: true } : {}),
      ...(by ? { sentByAdmin: { uid: by, name: adminName.get(by) ?? "A team member" } } : {}),
    };
  });
  if (o.markRead !== false) await stampRead(db, ref, OFFICIAL_UID, o.now ?? new Date());
  return { id, memberUid, member: nameOf(member), messages };
}

export async function markOfficialRead(db: Firestore, cid: unknown, now = new Date()): Promise<void> {
  const { ref } = await officialConversation(db, cid);
  await stampRead(db, ref, OFFICIAL_UID, now);
}

/** Answer as @na-notesapp, in words (sendSystemMessage: the member must exist, not be suspended or have blocked the account). The
 *  team member's uid goes on officialReplies/{messageId}, never on the message. The member gets the usual "New message from
 *  NotesApp" bell and push, as for any message. */
export async function replyAsOfficial(db: Firestore, adminUid: string, cid: unknown, text: unknown, o: { now?: Date; notify?: Notify; alerts?: Alerts } = {}) {
  if (!adminUid) throw new MessageError(403, "Sign in again.");
  const now = o.now ?? new Date();
  const { id, ref, memberUid } = await officialConversation(db, cid);
  if (!memberUid) throw new MessageError(404, "That member wasn't found.");
  const sent = await sendSystemMessage(db, OFFICIAL_UID, memberUid, String(text ?? ""), now, o.notify, o.alerts);
  await db.doc(`officialReplies/${sent.messageId}`).set({ cid: id, messageId: sent.messageId, memberUid, sentByAdmin: adminUid, at: now.toISOString() });
  await stampRead(db, ref, OFFICIAL_UID, now).catch(() => {}); // answering means it's been read
  return sent;
}
