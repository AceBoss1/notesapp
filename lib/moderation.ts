import { doc, updateDoc, setDoc, getDoc, deleteField, getDocs, collection, query, where } from "firebase/firestore";
import type { GoldBadgeKind } from "./badges";
import type { GoldRequestStatus, GoldTrack } from "./gold";
import { db } from "./firebase";
import { UserRole, Suspension, AccountTier } from "./users";
import {
  notifySuspended,
  notifyUnsuspended,
  notifyAppealRejected,
  notifyRoleChanged,
  notifyTierDecision,
} from "./notifications";

const USERS = "users";
// Reason / appeal text live in suspensions/{uid} (readable only by the
// member and admins). users/{uid} is public and keeps just `suspended`.
const SUSPENSIONS = "suspensions";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  staff: "Staff (in-house writer)",
  volunteer: "Volunteer (contributing writer)",
  reader: "Reader",
};

// Admin-only in practice — enforced by firestore.rules' users/{uid}
// update rule (isAdmin() branch), not just by which UI surfaces call
// this. A non-admin calling this directly would get a permission
// error from Firestore, not a silent no-op.
export async function suspendUser(
  uid: string,
  username: string,
  reason: string,
  suspendedByUid: string
): Promise<void> {
  const suspension: Suspension = {
    reason,
    suspendedAt: new Date().toISOString(),
    suspendedByUid,
    appealStatus: "none",
  };
  await setDoc(doc(db, SUSPENSIONS, uid), suspension);
  await updateDoc(doc(db, USERS, uid), { suspended: true });
  notifySuspended(uid, username, reason).catch((err) =>
    console.warn("notifySuspended failed:", err)
  );
}

export async function unsuspendUser(
  uid: string,
  username: string,
  resolvedByUid: string,
  upheld: boolean
): Promise<void> {
  // Called both for a direct admin unsuspend (upheld=false, no appeal
  // involved — admin just reversed their own call) and for resolving
  // an appeal in the member's favor (upheld=true). Either way the
  // account goes back to active; only the recorded appealStatus
  // differs, for the history.
  await updateDoc(doc(db, SUSPENSIONS, uid), {
    appealStatus: upheld ? "upheld" : "none",
    resolvedAt: new Date().toISOString(),
    resolvedByUid,
  });
  await updateDoc(doc(db, USERS, uid), { suspended: false });
  notifyUnsuspended(uid, username, upheld).catch((err) =>
    console.warn("notifyUnsuspended failed:", err)
  );
}

export async function rejectAppeal(uid: string, username: string, resolvedByUid: string): Promise<void> {
  // Status-quo remains: still suspended, appeal recorded as rejected.
  await updateDoc(doc(db, SUSPENSIONS, uid), {
    appealStatus: "rejected",
    resolvedAt: new Date().toISOString(),
    resolvedByUid,
  });
  notifyAppealRejected(uid, username).catch((err) =>
    console.warn("notifyAppealRejected failed:", err)
  );
}

// Admin-only (firestore.rules lets admins update any user field).
// Until self-serve tier billing exists, this is how a paid or approved
// tier is applied to an account.
export async function updateUserTier(uid: string, tier: AccountTier): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { accountTier: tier });
}

// Admin-only: approve (→ Free Basic, publishing enabled) or reject a Free
// Basic application, and tell the member.
export async function resolveTierRequest(uid: string, username: string, adminUid: string, approve: boolean): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, USERS, uid), {
    ...(approve ? { accountTier: "basic" as AccountTier } : {}),
    "tierRequest.status": approve ? "approved" : "rejected",
    "tierRequest.resolvedAt": now,
    "tierRequest.resolvedByUid": adminUid,
  });
  notifyTierDecision(uid, username, approve).catch((err) => console.warn("notifyTierDecision failed:", err));
}

// Admin-only: grant/revoke the gold badge (identity check or endorsement).
// Stored now; shown publicly only once GOLD_BADGE_LIVE is true.
export async function setGoldBadge(uid: string, kind: GoldBadgeKind | null, note?: string): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    goldBadge: kind ? { kind, grantedAt: new Date().toISOString(), ...(note ? { note } : {}) } : deleteField(),
  });
}

// Endorsement applications live in the private badgeRequests/{uid}
// (member + admins read; the server route writes new ones).
export type BadgeRequest = {
  status: GoldRequestStatus;
  kind?: GoldBadgeKind; // absent on early endorsement-only requests
  track?: GoldTrack;
  message: string;
  requestedAt: string;
  depositPaidAt?: string;
  // Pass/fail summary of the Dojah identity check, written by /api/dojah/webhook (no ID data).
  dojah?: { verificationStatus: string; overall: boolean | null; steps: Record<string, boolean>; unscored?: string[]; passed: boolean; terminal: boolean; receivedAt: string };
  resolvedAt?: string;
  resolvedByUid?: string;
};

export async function getBadgeRequest(uid: string): Promise<BadgeRequest | null> {
  try {
    const snap = await getDoc(doc(db, "badgeRequests", uid));
    return snap.exists() ? (snap.data() as BadgeRequest) : null;
  } catch {
    return null;
  }
}

export async function getAllBadgeRequests(): Promise<Record<string, BadgeRequest>> {
  const snap = await getDocs(collection(db, "badgeRequests"));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as BadgeRequest]));
}

// Admin-only. Approving does NOT grant the badge: the member then subscribes
// (gold pricing) and the badge switches on when that payment lands.
export async function resolveBadgeRequest(uid: string, adminUid: string, approve: boolean): Promise<void> {
  await updateDoc(doc(db, "badgeRequests", uid), {
    status: approve ? "approved" : "rejected",
    resolvedAt: new Date().toISOString(),
    resolvedByUid: adminUid,
  });
}

export async function updateUserRole(uid: string, username: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, USERS, uid), { role });
  notifyRoleChanged(uid, username, ROLE_LABEL[role]).catch((err) =>
    console.warn("notifyRoleChanged failed:", err)
  );
}

// Called by the suspended member themselves — firestore.rules only
// lets them move their OWN appealStatus to "pending" and set
// appealText/appealedAt; every other field on this update is rejected
// by the rule if present, so this function only ever sends those three.
export async function submitAppeal(uid: string, appealText: string): Promise<void> {
  await updateDoc(doc(db, SUSPENSIONS, uid), {
    appealStatus: "pending",
    appealText,
    appealedAt: new Date().toISOString(),
  });
}

// The member's own suspension record (null if none / not readable).
export async function getSuspension(uid: string): Promise<Suspension | null> {
  try {
    const snap = await getDoc(doc(db, SUSPENSIONS, uid));
    return snap.exists() ? (snap.data() as Suspension) : null;
  } catch {
    return null;
  }
}

// Admin-only: every suspension record, keyed by uid.
export async function getAllSuspensions(): Promise<Record<string, Suspension>> {
  const snap = await getDocs(collection(db, SUSPENSIONS));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as Suspension]));
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
