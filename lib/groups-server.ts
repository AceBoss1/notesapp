import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";
import { GROUP_MEMBERS_MAX, GROUP_TITLE_MAX, MESSAGE_MAX, attachmentLabel, newGroupId, type GroupInfo, type GroupScope } from "./messages-rules";
import { MessageError, claimAttachments, groupInfoOf, quoteOf, type FileDeps, type Notify, type SendInput } from "./messages-server";
import { notifyBell } from "./email";
import { getAdminApp, getAdminDb } from "./firebase-admin";
import { sendPush, type PushPayload } from "./push-server";
import { stickerById } from "./stickers";

// Group chats. A group is a `conversations` document with kind "group": a title, its members (`participants`, so the same live listeners and
// security rules as direct messages apply), its admins and a scope. Clients never write; every change goes through here.
//   public: any member's group. You can only add people you follow or who follow you, who haven't blocked you.
//   team:   a staff room or meeting, created from the team hub; only people with the admin claim can be in it.

export type GroupDeps = {
  isAdmin: (uid: string) => Promise<boolean>; // does this account carry the admin claim (injected so it can be tested)
  push: (uid: string, payload: PushPayload) => Promise<number>;
};
const defaultDeps = (): GroupDeps => ({
  isAdmin: async (uid) => (await getAuth(getAdminApp()).getUser(uid).catch(() => null))?.customClaims?.admin === true,
  push: async (uid, payload) => sendPush(getAdminDb(), uid, payload),
});

const cleanTitle = (t: unknown) => {
  const title = String(t ?? "").trim().replace(/\s+/g, " ").slice(0, GROUP_TITLE_MAX);
  if (!title) throw new MessageError(400, "Give the group a name.");
  return title;
};

// Who may be added by this person (public groups): exists, not suspended, hasn't blocked them, and the two are connected by a follow.
async function checkAddable(db: Firestore, adder: { uid: string; username: string }, uids: string[]) {
  const docs = uids.length ? await db.getAll(...uids.map((u) => db.doc(`users/${u}`))) : [];
  for (const d of docs) {
    const u = d.data();
    if (!d.exists || u?.suspended === true) throw new MessageError(404, "One of those members wasn't found.");
    const [blocked, theyFollow, iFollow] = await Promise.all([
      db.doc(`dmBlocks/${d.id}_${adder.uid}`).get(),
      db.doc(`follows/${d.id}_${adder.username}`).get(),
      db.doc(`follows/${adder.uid}_${String(u?.username ?? "-")}`).get(),
    ]);
    if (blocked.exists) throw new MessageError(404, "One of those members wasn't found.");
    if (!theyFollow.exists && !iFollow.exists) throw new MessageError(403, `You can add people you follow or who follow you. ${u?.displayName ?? "That member"} is neither.`);
  }
}

async function userOf(db: Firestore, uid: string) {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u) throw new MessageError(404, "Your account wasn't found.");
  if (u.suspended === true) throw new MessageError(403, "Your account can't do that right now.");
  return { uid, username: String(u.username ?? ""), displayName: String(u.displayName ?? "A member") };
}

export async function createGroup(
  db: Firestore, creatorUid: string, input: { title: unknown; memberUids: unknown; scope?: GroupScope; meetingId?: string; id?: string },
  now = new Date(), deps: GroupDeps = defaultDeps(),
): Promise<{ id: string }> {
  const scope: GroupScope = input.scope === "team" ? "team" : "public";
  const title = cleanTitle(input.title);
  const me = await userOf(db, creatorUid);
  const members = Array.from(new Set((Array.isArray(input.memberUids) ? input.memberUids : []).map(String).filter((u) => u && u !== creatorUid)));
  if (members.length + 1 > GROUP_MEMBERS_MAX) throw new MessageError(413, `A group can have up to ${GROUP_MEMBERS_MAX} members.`);
  if (scope === "team") {
    for (const u of [creatorUid, ...members]) if (!(await deps.isAdmin(u))) throw new MessageError(403, "Team rooms are for the team only.");
  } else {
    if (!members.length) throw new MessageError(400, "Add at least one person.");
    await checkAddable(db, me, members);
  }
  const id = input.id ?? newGroupId(randomBytes(8).toString("hex"));
  const createdAt = now.toISOString();
  const everyone = [creatorUid, ...members];
  await db.doc(`conversations/${id}`).set({
    kind: "group", scope, title, participants: everyone, adminUids: [creatorUid], createdBy: creatorUid, createdAt, lastMessageAt: createdAt,
    unread: Object.fromEntries(everyone.map((u) => [u, 0])),
    ...(input.meetingId ? { meetingId: input.meetingId } : {}),
  });
  return { id };
}

async function groupOf(db: Firestore, cid: string, uid: string) {
  const ref = db.doc(`conversations/${cid}`);
  const c = (await ref.get()).data();
  if (!c || c.kind !== "group" || !(c.participants as string[]).includes(uid)) throw new MessageError(404, "That group wasn't found.");
  return { ref, c, info: groupInfoOf(c) };
}
const requireAdmin = (info: GroupInfo, uid: string) => {
  if (!info.adminUids.includes(uid)) throw new MessageError(403, "Only a group admin can do that.");
};

export async function sendGroupMessage(
  db: Firestore, fromUid: string, cid: string, input: SendInput, now = new Date(), notify: Notify = notifyBell,
  deps: GroupDeps = defaultDeps(), files?: FileDeps,
): Promise<{ conversationId: string; messageId: string }> {
  const text = String(input.text ?? "").trim();
  const ids = Array.isArray(input.attachmentIds) ? input.attachmentIds.map(String) : [];
  const sticker = input.sticker ? String(input.sticker) : "";
  if (sticker && !stickerById(sticker)) throw new MessageError(400, "That sticker isn't available.");
  if (!text && !ids.length && !sticker) throw new MessageError(400, "Write a message first.");
  if (text.length > MESSAGE_MAX) throw new MessageError(413, `Messages can be up to ${MESSAGE_MAX} characters.`);
  const me = await userOf(db, fromUid);
  const { ref, c, info } = await groupOf(db, cid, fromUid);

  const attachments = ids.length ? await claimAttachments(db, fromUid, ids, files) : [];
  const preview = (text || (attachments.length ? attachmentLabel(attachments) : "🖼 Sticker")).slice(0, 120);
  const replyTo = input.replyToId ? await quoteOf(db, cid, String(input.replyToId)) : undefined;
  const messageId = `${String(now.getTime()).padStart(13, "0")}_${randomBytes(4).toString("hex")}`;
  const createdAt = now.toISOString();
  const others = (c.participants as string[]).filter((u) => u !== fromUid);

  const wasQuiet: string[] = []; // members with nothing unread before this message: they get the bell and push
  await db.runTransaction(async (t) => {
    const fresh = (await t.get(ref)).data();
    if (!fresh || !(fresh.participants as string[]).includes(fromUid)) throw new MessageError(404, "That group wasn't found.");
    for (const u of fresh.participants as string[]) if (u !== fromUid && ((fresh.unread?.[u] as number | undefined) ?? 0) === 0) wasQuiet.push(u);
    t.set(ref.collection("messages").doc(messageId), { from: fromUid, text, createdAt, ...(attachments.length ? { attachments } : {}), ...(sticker ? { sticker } : {}), ...(replyTo ? { replyTo } : {}) });
    const patch: Record<string, unknown> = { lastMessage: { from: fromUid, fromName: me.displayName, text: preview, at: createdAt }, lastMessageAt: createdAt, [`unread.${fromUid}`]: 0 };
    for (const u of others) patch[`unread.${u}`] = FieldValue.increment(1);
    t.update(ref, patch);
  });
  for (const id of ids) await db.doc(`messageUploads/${id}`).update({ used: true }).catch(() => {});
  // One bell and one push per member when a burst starts, never carrying what was written.
  await Promise.all(wasQuiet.map(async (u) => {
    await notify({ uid: u, type: "message", linkHref: `/messages/${cid}`, message: `${me.displayName} in ${info.title}` }).catch(() => {});
    await deps.push(u, { title: info.title, body: me.displayName, url: `/messages/${cid}` }).catch(() => 0);
  }));
  return { conversationId: cid, messageId };
}

export type MemberInfo = { uid: string; username: string; displayName: string; avatar: string; admin: boolean };
export async function groupMembers(db: Firestore, info: GroupInfo): Promise<MemberInfo[]> {
  const docs = await db.getAll(...info.memberUids.map((u) => db.doc(`users/${u}`)));
  return docs.map((d) => ({ uid: d.id, username: d.data()?.username ?? "", displayName: d.data()?.displayName ?? "Member", avatar: d.data()?.avatar ?? "", admin: info.adminUids.includes(d.id) }));
}

export async function renameGroup(db: Firestore, uid: string, cid: string, title: unknown): Promise<void> {
  const { ref, info } = await groupOf(db, cid, uid);
  requireAdmin(info, uid);
  if (info.scope === "team" && info.meetingId) throw new MessageError(400, "A meeting takes its name from the team hub.");
  await ref.update({ title: cleanTitle(title) });
}

export async function addGroupMembers(db: Firestore, uid: string, cid: string, newUids: unknown): Promise<void> {
  const { ref, info } = await groupOf(db, cid, uid);
  requireAdmin(info, uid);
  if (info.scope === "team") throw new MessageError(400, "The team room is kept in step with the team automatically.");
  const add = Array.from(new Set((Array.isArray(newUids) ? newUids : []).map(String).filter((u) => u && !info.memberUids.includes(u))));
  if (!add.length) return;
  if (info.memberUids.length + add.length > GROUP_MEMBERS_MAX) throw new MessageError(413, `A group can have up to ${GROUP_MEMBERS_MAX} members.`);
  await checkAddable(db, await userOf(db, uid), add);
  await ref.update({ participants: FieldValue.arrayUnion(...add), ...Object.fromEntries(add.map((u) => [`unread.${u}`, 0])) });
}

// An admin removes someone, or anyone leaves. A group always keeps an admin (the longest-standing member takes over), and an empty group is deleted.
export async function removeGroupMember(db: Firestore, uid: string, cid: string, targetUid: string): Promise<void> {
  const { ref, info } = await groupOf(db, cid, uid);
  if (info.scope === "team") throw new MessageError(400, "The team room is kept in step with the team automatically.");
  if (targetUid !== uid) requireAdmin(info, uid);
  if (!info.memberUids.includes(targetUid)) return;
  const left = info.memberUids.filter((u) => u !== targetUid);
  if (!left.length) { await ref.delete(); return; }
  let admins = info.adminUids.filter((u) => u !== targetUid);
  if (!admins.length) admins = [left[0]];
  await ref.update({ participants: left, adminUids: admins, [`unread.${targetUid}`]: FieldValue.delete(), [`readMarker.${targetUid}`]: FieldValue.delete() });
}

export async function setGroupAdmin(db: Firestore, uid: string, cid: string, targetUid: string, admin: boolean): Promise<void> {
  const { ref, info } = await groupOf(db, cid, uid);
  requireAdmin(info, uid);
  if (!info.memberUids.includes(targetUid)) throw new MessageError(404, "That member isn't in the group.");
  if (!admin && info.adminUids.length <= 1) throw new MessageError(400, "A group needs at least one admin.");
  await ref.update({ adminUids: admin ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid) });
}

// Team rooms: the standing "Team room" (everyone with the admin claim) and one room per meeting. Kept in step with who is on the team.
export const TEAM_ROOM_ID = "team_room";
export async function syncTeamRoom(db: Firestore, ownerUid: string, teamUids: string[], now = new Date(), deps: GroupDeps = defaultDeps()): Promise<string> {
  const ref = db.doc(`conversations/${TEAM_ROOM_ID}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await createGroup(db, ownerUid, { title: "Team room", memberUids: teamUids, scope: "team", id: TEAM_ROOM_ID }, now, deps);
    return TEAM_ROOM_ID;
  }
  await syncMembers(db, TEAM_ROOM_ID, teamUids);
  return TEAM_ROOM_ID;
}

// Makes a team conversation's members exactly the team (new admins come in with nothing unread; people who lost access go out).
export async function syncMembers(db: Firestore, cid: string, teamUids: string[]): Promise<void> {
  const ref = db.doc(`conversations/${cid}`);
  const c = (await ref.get()).data();
  if (!c) return;
  const current = c.participants as string[];
  const adds = teamUids.filter((u) => !current.includes(u));
  const gone = current.filter((u) => !teamUids.includes(u));
  if (!adds.length && !gone.length) return;
  const admins = ((c.adminUids as string[] | undefined) ?? []).filter((u) => !gone.includes(u));
  await ref.update({
    participants: teamUids,
    adminUids: admins.length ? admins : teamUids.slice(0, 1),
    ...Object.fromEntries(adds.map((u) => [`unread.${u}`, 0])),
    ...Object.fromEntries(gone.flatMap((u) => [[`unread.${u}`, FieldValue.delete()], [`readMarker.${u}`, FieldValue.delete()]])),
  });
}
