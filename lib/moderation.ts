import { doc, updateDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { UserRole, Suspension } from "./users";

const USERS = "users";

// Admin-only in practice — enforced by firestore.rules' users/{uid}
// update rule (isAdmin() branch), not just by which UI surfaces call
// this. A non-admin calling this directly would get a permission
// error from Firestore, not a silent no-op.
export async function suspendUser(
  uid: string,
  reason: string,
  suspendedByUid: string
): Promise<void> {
  const suspension: Suspension = {
    reason,
    suspendedAt: new Date().toISOString(),
    suspendedByUid,
    appealStatus: "none",
  };
  await updateDoc(doc(db, USERS, uid), { suspended: true, suspension });
}

export async function unsuspendUser(uid: string, resolvedByUid: string, upheld: boolean): Promise<void> {
  // Called both for a direct admin unsuspend (upheld=false, no appeal
  // involved — admin just reversed their own call) and for resolving
  // an appeal in the member's favor (upheld=true). Either way the
  // account goes back to active; only the recorded appealStatus
  // differs, for the history.
  await updateDoc(doc(db, USERS, uid), {
    suspended: false,
    "suspension.appealStatus": upheld ? "upheld" : "none",
    "suspension.resolvedAt": new Date().toISOString(),
    "suspension.resolvedByUid": resolvedByUid,
  });
}

export async function rejectAppeal(uid: string, resolvedByUid: string): Promise<void> {
  // Status-quo remains: still suspended, appeal recorded as rejected.
  await updateDoc(doc(db, USERS, uid), {
    "suspension.appealStatus": "rejected",
    "suspension.resolvedAt": new Date().toISOString(),
    "suspension.resolvedByUid": resolvedByUid,
  });
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { role });
}

// Called by the suspended member themselves — firestore.rules only
// lets them move their OWN appealStatus to "pending" and set
// appealText/appealedAt; every other field on this update is rejected
// by the rule if present, so this function only ever sends those three.
export async function submitAppeal(uid: string, appealText: string): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    "suspension.appealStatus": "pending",
    "suspension.appealText": appealText,
    "suspension.appealedAt": new Date().toISOString(),
  });
}

// Used by Comments.tsx to gate rendering — one query up front instead
// of a per-comment lookup. Small dataset today; if the user base grows
// large enough for this to matter, this is the first thing to swap for
// a denormalized `authorStatus` field written at comment-create time.
export async function getSuspendedUids(): Promise<Set<string>> {
  const q = query(collection(db, USERS), where("suspended", "==", true));
  const snap = await getDocs(q);
  return new Set(snap.docs.map((d) => d.id));
}
