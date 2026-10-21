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
import { api } from "./moments-client";

const NOTIFICATIONS = "notifications";

export type NotificationType =
  | "like"
  | "comment"
  | "reply"
  | "new_post"
  | "suspended"
  | "unsuspended"
  | "appeal_rejected"
  | "role_changed"
  | "gift"
  | "coauthor"
  | "stock"
  | "badge"
  | "order" // store order updates (buyer and seller)
  | "merch" // official merch pre-orders
  | "booking"
  | "ad" // advertiser campaigns
  | "plan" // Pro/Business plans and trials
  | "org" // organisation verification and invitations
  | "message" // a new direct message
  | "moment" // a reply or reshare of a moment
  | "review" // a review or a seller reply on a store item
  | "recommendation" // someone wrote you a recommendation
  | "mention" // someone @mentioned you in public: a comment, a journal, a moment, a review (never a chat)
  | "course" // Notes Academy: a co-tutor invitation, a course sale
  | "team" // the team hub: a comment on your work, the morning summary
  | "community" // communities: join requests, approvals, announcements in General, comments on your posts
  | "event"; // events: reminders 24 hours and 1 hour before, and changes to an event you said you'd go to

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

// Notifications are written by the server only (firestore.rules lets browsers read their own and mark them read, never create):
// comments, replies and likes in lib/comments-server.ts, @mentions in lib/mentions-server.ts, moderation in /api/admin/notify,
// everything else through notifyBell in lib/email.ts. These two ask the server after the browser did its part.
export async function notifyLiked(noteId: string): Promise<void> {
  await api("/api/notify/like", { body: { noteId } });
}
export type ModerationNotice = "suspended" | "unsuspended" | "appeal_rejected" | "role_changed" | "tier_decision";
export async function notifyModeration(uid: string, kind: ModerationNotice): Promise<void> {
  await api("/api/admin/notify", { body: { uid, kind } });
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
