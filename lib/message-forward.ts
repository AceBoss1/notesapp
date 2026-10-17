import type { Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { MessageError, sendMessage, type FileDeps, type Notify } from "./messages-server";
import { sendGroupMessage } from "./groups-server";
import { stripFormat } from "./message-format";
import { safeFileName } from "./private-files";
import { notifyBell } from "./email";
export { dropKept } from "./message-kept";

// Forwarding and keeping messages. Server-only, like every other write in Messages.
//   Forward: a message goes on to up to FORWARD_MAX of your chats, through the normal send (so blocks, locked groups, plan limits and
//   notifications all apply), marked "Forwarded". Each copy gets its own copy of any files.
//   Keep: your own private copy of a message (keptMessages/{uid}_{messageId}), shown under Saved → From chats. If the sender deletes the
//   message, the kept copy goes too, so keeping never gets round the delete.
export const FORWARD_MAX = 5;
export type ForwardDeps = FileDeps & { copy: (from: string, to: string) => Promise<void> };

async function source(db: Firestore, uid: string, cid: string, messageId: string) {
  if (!messageId || messageId.includes("/") || !cid || cid.includes("/")) throw new MessageError(400, "Choose a message.");
  const conv = (await db.doc(`conversations/${cid}`).get()).data();
  if (!conv || !(conv.participants as string[]).includes(uid)) throw new MessageError(404, "That conversation wasn't found.");
  const m = (await db.doc(`conversations/${cid}/messages/${messageId}`).get()).data();
  if (!m || m.deleted || m.removed || m.call) throw new MessageError(404, "That message wasn't found.");
  return { conv, m };
}

export async function forwardMessage(
  db: Firestore, uid: string, cid: string, messageId: string, targets: unknown, files?: ForwardDeps, now = new Date(), notify: Notify = notifyBell,
): Promise<{ sent: string[]; failed: { id: string; error: string }[] }> {
  const list = Array.isArray(targets) ? Array.from(new Set(targets.map(String).filter((t) => t && !t.includes("/")))) : [];
  if (!list.length) throw new MessageError(400, "Choose who to forward it to.");
  if (list.length > FORWARD_MAX) throw new MessageError(400, `You can forward to up to ${FORWARD_MAX} chats at once.`);
  const { m } = await source(db, uid, cid, messageId);
  const attachments = (m.attachments as { key: string; name: string; size: number; type: string; kind: string; durationSec?: number }[] | undefined) ?? [];
  if (attachments.length && !files) throw new MessageError(503, "Files can't be forwarded right now.");
  const sent: string[] = [], failed: { id: string; error: string }[] = [];
  for (const target of list) {
    try {
      const conv = (await db.doc(`conversations/${target}`).get()).data();
      if (!conv || !(conv.participants as string[]).includes(uid)) throw new MessageError(404, "That chat wasn't found.");
      // Fresh copies of the files for this chat, registered as your uploads so the send checks them like any other.
      const attachmentIds: string[] = [];
      for (const a of attachments) {
        const id = randomBytes(8).toString("hex");
        const key = `messages/${uid}/${id}-${safeFileName(a.name)}`;
        await files!.copy(a.key, key);
        await db.doc(`messageUploads/${id}`).set({ uid, key, name: a.name, size: a.size, type: a.type, kind: a.kind, ...(a.durationSec ? { durationSec: a.durationSec } : {}), used: false, createdAt: now.toISOString() });
        attachmentIds.push(id);
      }
      const input = { text: String(m.text ?? ""), attachmentIds, ...(m.sticker ? { sticker: String(m.sticker) } : {}), forwarded: true };
      if (conv.kind === "group") await sendGroupMessage(db, uid, target, input, now, notify, undefined, files);
      else await sendMessage(db, uid, (conv.participants as string[]).find((p) => p !== uid) ?? uid, input, now, notify, { email: async () => {}, push: async () => 0 }, files);
      sent.push(target);
    } catch (e) {
      failed.push({ id: target, error: e instanceof Error ? e.message : "Couldn't send it there." });
    }
  }
  return { sent, failed };
}

export type KeptMessage = {
  uid: string; cid: string; messageId: string; from: string; fromName: string; chatTitle: string;
  text: string; files: string[]; sticker?: string; sentAt: string; keptAt: string;
};
export const keptId = (uid: string, messageId: string) => `${uid}_${messageId}`;

export async function keepMessage(db: Firestore, uid: string, cid: string, messageId: string, keep: boolean, now = new Date()): Promise<{ kept: boolean }> {
  const ref = db.doc(`keptMessages/${keptId(uid, messageId)}`);
  if (!keep) { await ref.delete(); return { kept: false }; }
  const { conv, m } = await source(db, uid, cid, messageId);
  const from = String(m.from);
  const [fromUser, other] = await Promise.all([
    db.doc(`users/${from}`).get(),
    conv.kind === "group" ? null : db.doc(`users/${(conv.participants as string[]).find((p) => p !== uid) ?? uid}`).get(),
  ]);
  const kept: KeptMessage = {
    uid, cid, messageId, from, fromName: String(fromUser.data()?.displayName ?? "Member"),
    chatTitle: conv.kind === "group" ? String(conv.title ?? "Group") : String(other?.data()?.displayName ?? "Member"),
    text: stripFormat(String(m.text ?? "")).slice(0, 2000), files: ((m.attachments as { name: string }[] | undefined) ?? []).map((a) => a.name),
    ...(m.sticker ? { sticker: String(m.sticker) } : {}), sentAt: String(m.createdAt), keptAt: now.toISOString(),
  };
  await ref.set(kept);
  return { kept: true };
}
