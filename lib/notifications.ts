import {
  addDoc,
  collection,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { getUserByDisplayName } from "./users";
import { resolveAuthorUsername } from "./journals-directory";

const NOTIFICATIONS = "notifications";

export type NotificationType =
  | "like"
  | "comment"
  | "reply"
  | "new_post"
  | "suspended"
  | "unsuspended"
  | "appeal_rejected"
  | "role_changed";

export type AppNotification = {
  id: string;
  recipientUid: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  actorUsername?: string;
  actorDisplayName?: string;
  actorAvatar?: string;
  // Where clicking the notification goes. For like/comment/reply/
  // new_post this is a journal entry; for moderation types it's the
  // recipient's own profile.
  linkHref?: string;
};

// No Cloud Functions in this deployment — every notification here is
// written directly by whichever client action caused it (the liker's
// browser writes a notification addressed to the note's author, not
// the author's own browser). firestore.rules can only validate shape
// (recipientUid is a string, type is one of the known values, read
// starts false) — it can't verify "did this uid actually like that
// note," the way a trusted server-side function could. Practical
// effect: a motivated user could write a fake notification to anyone.
// Low severity — it's a fake in-app message, not a data leak or a
// permission escalation, and only the recipient can ever read it. If
// this becomes a real abuse vector, the fix is a Cloud Function that
// owns notification creation instead of the client.
async function createNotification(
  data: Omit<AppNotification, "id" | "read" | "createdAt">
): Promise<void> {
  await addDoc(collection(db, NOTIFICATIONS), {
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

type Actor = { uid: string; username: string; displayName: string; avatar: string };
type NoteRef = { slug: string; title: string; author: string };

export async function notifyLike(note: NoteRef, liker: Actor): Promise<void> {
  const author = await getUserByDisplayName(note.author);
  if (!author || author.uid === liker.uid) return; // no self-notify, no recipient to notify
  await createNotification({
    recipientUid: author.uid,
    type: "like",
    message: `${liker.displayName} liked "${note.title}"`,
    actorUsername: liker.username,
    actorDisplayName: liker.displayName,
    actorAvatar: liker.avatar,
    linkHref: `/journals/${note.slug}`,
  });
}

export async function notifyComment(note: NoteRef, commenter: Actor): Promise<void> {
  const author = await getUserByDisplayName(note.author);
  if (!author || author.uid === commenter.uid) return;
  await createNotification({
    recipientUid: author.uid,
    type: "comment",
    message: `${commenter.displayName} commented on "${note.title}"`,
    actorUsername: commenter.username,
    actorDisplayName: commenter.displayName,
    actorAvatar: commenter.avatar,
    linkHref: `/journals/${note.slug}#comments`,
  });
}

export async function notifyReply(
  parentComment: { authorUid: string; authorUsername: string; authorDisplayName: string },
  note: NoteRef,
  replier: Actor
): Promise<void> {
  if (parentComment.authorUid === replier.uid) return;
  await createNotification({
    recipientUid: parentComment.authorUid,
    type: "reply",
    message: `${replier.displayName} replied to your comment on "${note.title}"`,
    actorUsername: replier.username,
    actorDisplayName: replier.displayName,
    actorAvatar: replier.avatar,
    linkHref: `/journals/${note.slug}#comments`,
  });
}

// Fan-out to everyone following OR subscribed to the author — only
// needs the author's username (resolveAuthorUsername(), no Firestore
// round trip), not a uid, which is why this works for @na-notesapp
// even though it has no real Firebase Auth account behind it. Likes/
// comments/replies on na-notesapp's notes have nowhere to deliver a
// notification (no uid to notify), so those stay silent for it — new
// posts are the one notification type na-notesapp can trigger.
export async function notifyNewPost(note: NoteRef): Promise<void> {
  const authorUsername = resolveAuthorUsername(note.author);
  if (!authorUsername) return; // unmapped author — nobody to fan out to

  const [followSnap, subSnap] = await Promise.all([
    getDocs(query(collection(db, "follows"), where("username", "==", authorUsername))),
    getDocs(query(collection(db, "subscriptions"), where("username", "==", authorUsername))),
  ]);

  const recipientUids = new Set<string>([
    ...followSnap.docs.map((d) => d.data().followerUid as string),
    ...subSnap.docs.map((d) => d.data().subscriberUid as string),
  ]);
  if (recipientUids.size === 0) return;

  const batch = writeBatch(db);
  recipientUids.forEach((uid) => {
    const ref = doc(collection(db, NOTIFICATIONS));
    batch.set(ref, {
      recipientUid: uid,
      type: "new_post",
      message: `${note.author} published "${note.title}"`,
      actorUsername: authorUsername,
      actorDisplayName: note.author,
      linkHref: `/journals/${note.slug}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });
  await batch.commit();
}

export async function notifySuspended(uid: string, username: string, reason: string): Promise<void> {
  await createNotification({
    recipientUid: uid,
    type: "suspended",
    message: `Your account was suspended: ${reason}`,
    linkHref: `/u/${username}`,
  });
}

export async function notifyUnsuspended(uid: string, username: string, viaAppeal: boolean): Promise<void> {
  await createNotification({
    recipientUid: uid,
    type: "unsuspended",
    message: viaAppeal
      ? "Your appeal was upheld — your account is active again."
      : "Your account is active again.",
    linkHref: `/u/${username}`,
  });
}

export async function notifyAppealRejected(uid: string, username: string): Promise<void> {
  await createNotification({
    recipientUid: uid,
    type: "appeal_rejected",
    message: "Your appeal wasn't upheld — your account remains suspended.",
    linkHref: `/u/${username}`,
  });
}

export async function notifyRoleChanged(uid: string, username: string, newRoleLabel: string): Promise<void> {
  await createNotification({
    recipientUid: uid,
    type: "role_changed",
    message: `Your role was changed to ${newRoleLabel}.`,
    linkHref: `/u/${username}`,
  });
}

// Live subscription — the bell needs real-time updates, not a
// one-shot fetch, so this is the one place in the app that uses
// onSnapshot instead of getDocs.
export function subscribeToNotifications(
  uid: string,
  callback: (notifications: AppNotification[]) => void,
  max = 30
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS),
    where("recipientUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification));
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS, id), { read: true });
}

export async function markAllRead(notifications: AppNotification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, NOTIFICATIONS, n.id), { read: true }));
  await batch.commit();
}
