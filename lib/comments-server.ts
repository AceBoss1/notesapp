import type { Firestore } from "firebase-admin/firestore";
import { NA_NOTESAPP_PROFILE, resolveAuthorUsername } from "./journals-directory";
import { notifyMentions } from "./mentions-server";

// Server-only. Comments on journals and the bells that come with them (comment, reply, like), written by the server so nobody can
// post as someone else or send a fake notification: who wrote it is read from their account, never from what the browser sends.
// firestore.rules lets browsers read comments and notifications, delete their own comments and mark their own bells read, but
// not create either.
export const COMMENT_MAX = 3000;
export class CommentError extends Error { constructor(message: string, public status = 400) { super(message); } }

type Who = { uid: string; username: string; displayName: string; avatar: string };

// The account behind a journal: its author's id when the journal has it, otherwise the founder or channel name it was published
// under (older posts and posts made under a picked identity).
export async function noteAuthorUid(db: Firestore, note: FirebaseFirestore.DocumentData): Promise<string | null> {
  if (typeof note.authorUid === "string" && note.authorUid) return note.authorUid;
  const username = typeof note.authorUsername === "string" && note.authorUsername ? note.authorUsername : resolveAuthorUsername(String(note.author ?? ""));
  if (!username || username === NA_NOTESAPP_PROFILE.username) return null;
  const claim = (await db.doc(`usernames/${username}`).get()).data();
  return claim?.uid ? String(claim.uid) : null;
}

async function bell(db: Firestore, n: { id?: string; recipientUid: string; type: "like" | "comment" | "reply"; message: string; actor: Who; linkHref: string }) {
  const data = { recipientUid: n.recipientUid, type: n.type, message: n.message.slice(0, 280), actorUsername: n.actor.username, actorDisplayName: n.actor.displayName, actorAvatar: n.actor.avatar, linkHref: n.linkHref, read: false, createdAt: new Date().toISOString() };
  // A fixed id (likes) makes it once only: liking, unliking and liking again doesn't send a second bell.
  if (n.id) await db.doc(`notifications/${n.id}`).create(data).catch(() => {});
  else await db.collection("notifications").add(data);
}

async function whoIs(db: Firestore, uid: string): Promise<Who & { suspended: boolean }> {
  const u = (await db.doc(`users/${uid}`).get()).data();
  if (!u?.username) throw new CommentError("Finish setting up your profile first.", 403);
  return { uid, username: String(u.username), displayName: String(u.displayName || u.username), avatar: String(u.avatar ?? ""), suspended: u.suspended === true };
}

// A teen (users.teen, set by teen mode) hears only from people they follow: throws when one of `uids` is a teen who doesn't follow `me`.
export async function teenGate(db: Firestore, me: { uid: string; username: string }, uids: (string | null | undefined)[]): Promise<void> {
  for (const t of Array.from(new Set(uids.filter((u): u is string => !!u && u !== me.uid)))) {
    const u = (await db.doc(`users/${t}`).get()).data();
    if (u?.teen !== true && u?.keepRepliesFollowers !== true) continue; // teen mode, or kept on turning 18
    if (!(await db.doc(`follows/${t}_${me.username}`).get()).exists) throw new CommentError(`Only people ${String(u.displayName || u.username || "they")} follows can reply to them.`, 403);
  }
}

// POST /api/comments. `asBrand`: a moderator posting as @na-notesapp (the comment still records their own uid).
export async function postComment(db: Firestore, uid: string, input: { noteId?: unknown; content?: unknown; parentCommentId?: unknown; asBrand?: unknown }, canModerate: boolean): Promise<{ id: string }> {
  const noteId = typeof input.noteId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.noteId) ? input.noteId : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const parentId = typeof input.parentCommentId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.parentCommentId) ? input.parentCommentId : null;
  if (!noteId) throw new CommentError("Which journal?");
  if (!content) throw new CommentError("Write something first.");
  if (content.length > COMMENT_MAX) throw new CommentError(`A comment can be up to ${COMMENT_MAX} characters.`, 413);
  const me = await whoIs(db, uid);
  if (me.suspended) throw new CommentError("Your account is suspended, so you can't comment.", 403);
  const noteRef = db.doc(`notes/${noteId}`);
  const note = (await noteRef.get()).data();
  if (!note || note.status !== "published") throw new CommentError("That journal wasn't found.", 404);
  const parent = parentId ? (await noteRef.collection("comments").doc(parentId).get()).data() : null;
  if (parentId && !parent) throw new CommentError("That comment was deleted.", 404);

  // Teen mode: only people a teen follows can reply to them, on their journals and under their comments (moderators aside).
  const authorUid = await noteAuthorUid(db, note).catch(() => null);
  const parentUid = parent?.authorUid ? String(parent.authorUid) : null;
  if (!canModerate) await teenGate(db, me, [authorUid, parentUid]);

  const shown: Who = input.asBrand === true && canModerate
    ? { uid, username: NA_NOTESAPP_PROFILE.username, displayName: NA_NOTESAPP_PROFILE.displayName, avatar: NA_NOTESAPP_PROFILE.avatar }
    : me;
  const title = String(note.title ?? "");
  const ref = await noteRef.collection("comments").add({
    authorUid: uid, authorUsername: shown.username, authorDisplayName: shown.displayName, authorAvatar: shown.avatar,
    content, createdAt: new Date().toISOString(), noteId, noteSlug: String(note.slug ?? noteId), noteTitle: title, parentCommentId: parentId, likeCount: 0,
  });

  const href = `/journals/${String(note.slug ?? noteId)}#comments`;
  const jobs: Promise<unknown>[] = [];
  if (authorUid && authorUid !== uid && authorUid !== parentUid) jobs.push(bell(db, { recipientUid: authorUid, type: "comment", message: `${shown.displayName} commented on "${title}"`, actor: shown, linkHref: href }));
  if (parentUid && parentUid !== uid) jobs.push(bell(db, { recipientUid: parentUid, type: "reply", message: `${shown.displayName} replied to your comment on "${title}"`, actor: shown, linkHref: href }));
  if (content.includes("@")) jobs.push(notifyMentions(db, { kind: "comment", sourceId: `${noteId}_${ref.id}`, text: content, author: { uid, name: shown.displayName, username: shown.username, avatar: shown.avatar }, where: `in a comment on “${title}”`, linkHref: href, skipUids: [authorUid, parentUid, note.writerUid].filter((x): x is string => typeof x === "string" && !!x) }));
  await Promise.all(jobs.map((j) => j.catch((e) => console.error("[comments] bell failed", e))));
  return { id: ref.id };
}

// POST /api/notify/like: after the browser records a like (notes/{id}/likes/{uid}), the server checks it's there and tells the author once.
export async function notifyLike(db: Firestore, uid: string, noteId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(noteId)) throw new CommentError("Which journal?");
  const [like, noteSnap] = await Promise.all([db.doc(`notes/${noteId}/likes/${uid}`).get(), db.doc(`notes/${noteId}`).get()]);
  const note = noteSnap.data();
  if (!like.exists || !note) return false;
  const authorUid = await noteAuthorUid(db, note);
  if (!authorUid || authorUid === uid) return false;
  const me = await whoIs(db, uid);
  await bell(db, { id: `like_${noteId}_${uid}`, recipientUid: authorUid, type: "like", message: `${me.displayName} liked "${String(note.title ?? "")}"`, actor: me, linkHref: `/journals/${String(note.slug ?? noteId)}` });
  return true;
}
