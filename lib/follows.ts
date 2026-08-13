import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";
import { MANDATORY_USERNAMES } from "./journals-directory";

// New collection, genuinely #NotesApp-only — Precheks has no concept
// of following an author. Doc id is `${followerUid}_${username}` so a
// follow relationship is get/set/delete-able by id without a query.
const FOLLOWS = "follows";

export type Follow = {
  followerUid: string;
  username: string; // the journal being followed
  followedAt: string;
  mandatory: boolean;
};

function followId(uid: string, username: string) {
  return `${uid}_${username}`;
}

export async function isFollowing(uid: string, username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, FOLLOWS, followId(uid, username)));
  return snap.exists();
}

export async function getFollowedUsernames(uid: string): Promise<string[]> {
  const q = query(collection(db, FOLLOWS), where("followerUid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data().username as string);
}

export async function getFollowerCount(username: string): Promise<number> {
  const q = query(collection(db, FOLLOWS), where("username", "==", username));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function followJournal(
  uid: string,
  username: string,
  mandatory = false
): Promise<void> {
  const follow: Follow = {
    followerUid: uid,
    username,
    followedAt: new Date().toISOString(),
    mandatory,
  };
  await setDoc(doc(db, FOLLOWS, followId(uid, username)), follow);
}

// Throws if the target is one of the 3 mandatory journals — free-tier
// members can't unfollow @NotesApp or either founder. (This is also
// enforced in firestore.rules, so a client-side bypass can't work
// either.) Letting paid tiers unfollow these is a documented future
// change, not implemented yet — see README.
export async function unfollowJournal(uid: string, username: string): Promise<void> {
  if (MANDATORY_USERNAMES.includes(username)) {
    throw new Error("This journal is auto-followed for every member and can't be unfollowed yet.");
  }
  await deleteDoc(doc(db, FOLLOWS, followId(uid, username)));
}
