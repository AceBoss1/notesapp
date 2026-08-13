import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "./firebase";

// Another new, #NotesApp-only collection — subscribing unlocks a
// journal's premium entries (see Note.premium in lib/firestore-notes.ts).
// No Paystack/Flutterwave wiring yet: subscribing here is the same
// "(demo)" pattern as the booking calendar on a profile page — it
// grants access immediately, with no real charge. Wiring a real
// gateway is a follow-up build, not this session's scope.
const SUBSCRIPTIONS = "subscriptions";

export type Subscription = {
  subscriberUid: string;
  username: string; // the journal subscribed to
  subscribedAt: string;
  status: "demo"; // only value that exists until real billing is wired
};

function subId(uid: string, username: string) {
  return `${uid}_${username}`;
}

export async function isSubscribed(uid: string, username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, SUBSCRIPTIONS, subId(uid, username)));
  return snap.exists();
}

export async function subscribeToJournal(uid: string, username: string): Promise<void> {
  const sub: Subscription = {
    subscriberUid: uid,
    username,
    subscribedAt: new Date().toISOString(),
    status: "demo",
  };
  await setDoc(doc(db, SUBSCRIPTIONS, subId(uid, username)), sub);
}

export async function unsubscribeFromJournal(uid: string, username: string): Promise<void> {
  await deleteDoc(doc(db, SUBSCRIPTIONS, subId(uid, username)));
}

export async function getSubscriberCount(username: string): Promise<number> {
  const q = query(collection(db, SUBSCRIPTIONS), where("username", "==", username));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}
