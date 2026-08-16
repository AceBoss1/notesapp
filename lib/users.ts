import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { User as FirebaseUser } from "firebase/auth";
import { db } from "./firebase";
import { ADMIN_PROFILES, SocialLinks } from "./admin";

export type UserRole = "admin" | "staff" | "volunteer" | "reader";
export type AppealStatus = "none" | "pending" | "upheld" | "rejected";

export type Suspension = {
  reason: string;
  suspendedAt: string;
  suspendedByUid: string;
  appealStatus: AppealStatus;
  appealText?: string;
  appealedAt?: string;
  resolvedAt?: string;
  resolvedByUid?: string;
};

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
  social: SocialLinks;
  // "staff" = in-house writers, "volunteer" = external contributing
  // writers (Precheks' own terms, in parens so the mapping's explicit
  // wherever this is surfaced). Neither currently grants note-publish
  // permission — firestore.rules' notes/journals create rule still
  // only checks isAdmin() (the 2 hardcoded founder emails), not this
  // field. Wiring role-based publish permission is the same migration
  // the README's "admin allowlist won't survive multi-tenant" section
  // already flags — Firebase custom claims via Admin SDK, not a
  // Firestore-document field a client could reason about. This field
  // is a label + moderation marker today, not an authorization grant.
  role: UserRole;
  email: string;
  createdAt: string;
  // Not written by any path yet — this is where the "verified badge
  // for Pro/Business accounts that pass basic verification" roadmap
  // item lands once it's built. Until then this is always undefined
  // for every real account; only the 4 hardcoded official accounts
  // (lib/journals-directory.ts's VERIFIED_USERNAMES) show the badge.
  verified?: boolean;
  // Precheks built its own suspend feature independently, on the same
  // shared `users` collection, using a flat boolean — not the
  // `status` enum this used to be. That's now the canonical field
  // both apps read; NotesApp's richer appeal metadata (reason,
  // appealStatus, timestamps) lives alongside it in `suspension`,
  // additive and NotesApp-only, same pattern as `Note.premium`.
  // Precheks never reads or writes `suspension` — only `suspended`.
  suspended: boolean;
  // Present once a suspension has ever happened, even after it's
  // resolved — keeps a record rather than deleting history.
  suspension?: Suspension;
};

const USERS = "users";
const USERNAMES = "usernames"; // reservation collection, doc id = username

export async function isUsernameTaken(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, USERNAMES, username));
  return snap.exists();
}

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getUserByUsername(
  username: string
): Promise<UserProfile | null> {
  const reservation = await getDoc(doc(db, USERNAMES, username));
  if (!reservation.exists()) return null;
  return getUserByUid(reservation.data().uid);
}

export async function getUserByDisplayName(
  displayName: string
): Promise<UserProfile | null> {
  const q = query(
    collection(db, USERS),
    where("displayName", "==", displayName),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}

// Sign-up: reserves the username and creates the profile atomically.
export async function signUpProfile(params: {
  uid: string;
  email: string;
  username: string;
  displayName: string;
}): Promise<void> {
  const { uid, email, username, displayName } = params;
  const usernameRef = doc(db, USERNAMES, username);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists()) {
      throw new Error("That username is already taken.");
    }
    const admin = ADMIN_PROFILES[email];
    const profile: UserProfile = {
      uid,
      username,
      displayName: admin?.displayName || displayName,
      bio: admin?.bio || "",
      avatar: admin?.avatar || "/images/headshots/default-avatar.png",
      social: admin?.social || {},
      role: admin ? "admin" : "reader",
      email,
      createdAt: new Date().toISOString(),
      suspended: false,
    };
    tx.set(usernameRef, { uid });
    tx.set(doc(db, USERS, uid), profile);
  });
}

// Called after an admin signs in via /admin/login — auto-creates their
// public profile the first time, using the known mapping in lib/admin.ts,
// so admin accounts created directly in the Firebase console still get a
// matching @username profile without going through /signup.
export async function ensureAdminProfile(user: FirebaseUser): Promise<void> {
  if (!user.email || !(user.email in ADMIN_PROFILES)) return;
  const existing = await getUserByUid(user.uid);
  if (existing) return;

  const admin = ADMIN_PROFILES[user.email];
  const usernameRef = doc(db, USERNAMES, admin.username);
  const reserved = await getDoc(usernameRef);
  if (reserved.exists()) return; // username somehow already taken, skip

  const profile: UserProfile = {
    uid: user.uid,
    username: admin.username,
    displayName: admin.displayName,
    bio: admin.bio,
    avatar: admin.avatar,
    social: admin.social,
    role: "admin",
    email: user.email,
    createdAt: new Date().toISOString(),
    suspended: false,
  };
  await setDoc(usernameRef, { uid: user.uid });
  await setDoc(doc(db, USERS, user.uid), profile);
}

export async function updateProfile(
  uid: string,
  data: Partial<Pick<UserProfile, "displayName" | "bio" | "avatar" | "social">>
): Promise<void> {
  await updateDoc(doc(db, USERS, uid), data);
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const q = query(collection(db, USERS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
}

export type CommentActivity = {
  id: string;
  noteId: string;
  noteSlug: string;
  noteTitle: string;
  content: string;
  createdAt: string;
};

export async function getCommentsByUser(
  uid: string,
  max = 10
): Promise<CommentActivity[]> {
  const q = query(
    collectionGroup(db, "comments"),
    where("authorUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      noteId: data.noteId,
      noteSlug: data.noteSlug,
      noteTitle: data.noteTitle,
      content: data.content,
      createdAt: data.createdAt,
    };
  });
}
