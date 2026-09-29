import { doc, getDoc, deleteDoc, collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "./firebase";

// Paid, server-written records (see lib/payments.ts). A subscription
// is active while currentPeriodEnd is in the future — that includes
// "cancelled" ones that simply won't renew. Legacy "demo" records
// from before billing existed are grandfathered as active.
const SUBSCRIPTIONS = "subscriptions";

export type Subscription = {
  subscriberUid: string;
  username: string; // the journal subscribed to
  subscribedAt: string;
  status: "active" | "cancelled" | "demo";
  currentPeriodEnd?: string;
};

function subId(uid: string, username: string) {
  return `${uid}_${username}`;
}

export async function isSubscribed(uid: string, username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, SUBSCRIPTIONS, subId(uid, username)));
  if (!snap.exists()) return false;
  const sub = snap.data() as Subscription;
  if (sub.status === "demo") return true;
  return !!sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > Date.now();
}

export async function unsubscribeFromJournal(uid: string, username: string): Promise<void> {
  await deleteDoc(doc(db, SUBSCRIPTIONS, subId(uid, username)));
}

export async function getSubscriberCount(username: string): Promise<number> {
  const q = query(collection(db, SUBSCRIPTIONS), where("username", "==", username));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
