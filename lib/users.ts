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
import { LEGAL_VERSION, Consent } from "./legal";
import { badgeIncluded } from "./tiers";
import { ttlCache } from "./ttl-cache";
import { GOLD_BADGE_LIVE, GOLD_KIND_LIVE, BadgeLevel, GoldBadgeKind } from "./badges";

export type UserRole = "admin" | "staff" | "volunteer" | "reader";
export type AppealStatus = "none" | "pending" | "upheld" | "rejected";

// "Free Standard" in the Terms of Service = accountTier "standard"
// (every account, by default) — reads, engages, books sessions, buys
// merch; never publishes, never earns anything. The rest of the
// ladder — "basic" through "enterprise" — all grant publish
// permission; what differs between them is ad revenue share and
// NotesApp's commission on that publisher's bookings, subscription
// unlocks, and merch sales. Full numbers live in lib/tiers.ts, not
// duplicated here.
export type AccountTier = "standard" | "basic" | "pro" | "business" | "enterprise";
export type TierRequestStatus = "none" | "pending" | "approved" | "rejected";

export type TierRequest = {
  status: TierRequestStatus;
  message: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedByUid?: string;
};

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
  // Server-written after accepting Terms + Privacy (see /api/consent).
  consent?: Consent;
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
  // DEPRECATED — emails live only in Firebase Auth now. Older documents
  // may still carry one until scripts/strip-user-emails.mjs is run; nothing
  // writes it any more and firestore.rules forbids clients from doing so.
  email?: string;
  createdAt: string;
  // Not written by any path yet — this is where the "verified badge
  // for Pro/Business accounts that pass basic verification" roadmap
  // item lands once it's built. Until then this is always undefined
  // for every real account; only the 4 hardcoded official accounts
  // (lib/journals-directory.ts's VERIFIED_USERNAMES) show the badge.
  verified?: boolean;
  // Paid verified-badge add-on: ISO end of the paid period. Server-written
  // only (see lib/tier-billing.ts); firestore.rules stops clients editing it.
  badgeUntil?: string;
  // Gold badge (identity check / endorsement) — admin-written only, and
  // only displayed once GOLD_BADGE_LIVE (lib/badges.ts) is true.
  goldBadge?: { kind: GoldBadgeKind; grantedAt: string; note?: string; track?: "personal" | "corporate" };
  // Paid gold badges lapse when the subscription period ends. Absent = an
  // admin grant with no expiry. Written only by the server.
  goldUntil?: string;
  accountTier: AccountTier;
  tierRequest?: TierRequest;
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
  suspension?: Suspension; // legacy — now lives in suspensions/{uid}
  // Pro/Business/Enterprise opt in to showing ads on their pages (set by the
  // server from /profile/publishing). Free tiers always show ads.
  adsOptIn?: boolean;
  usernameChangedAt?: string; // set by /api/account/username
  previousUsername?: string;
};

// Admin, staff, and volunteer all get the ✔ automatically — per the
// Terms of Service's explicit claim that "all accounts properly
// designated within these specific administrative and internal
// management tiers automatically receive the official #NotesApp
// verified badge." The 4 hardcoded official accounts
// (lib/journals-directory.ts's VERIFIED_USERNAMES) are verified for a
// different reason (they're the platform itself, not a role), checked
// separately wherever the badge renders.
export function isVerifiedProfile(profile: UserProfile): boolean {
  return profile.role === "admin" || profile.role === "staff" || profile.role === "volunteer";
}

// Everything that earns the ✔ for a real account: an internal role, the
// admin `verified` flag, a Business/Enterprise plan (badge included), or
// an active paid badge add-on. Suspended accounts never show it.
export function hasVerifiedBadge(profile: UserProfile): boolean {
  if (profile.suspended === true) return false;
  return (
    isVerifiedProfile(profile) ||
    !!profile.verified ||
    badgeIncluded(profile.accountTier) ||
    (!!profile.badgeUntil && new Date(profile.badgeUntil).getTime() > Date.now())
  );
}

// #NotesApp team mark (beside the ✔): staff, guest writers and admins —
// i.e. the internal roles. Official accounts are handled by
// VERIFIED_USERNAMES where they render.
export function isTeamMember(profile: UserProfile): boolean {
  return profile.suspended !== true && isVerifiedProfile(profile);
}

// Which ✔ to draw: gold outranks the standard one, and only once gold
// is live. Suspended accounts show none.
export function badgeLevel(profile: UserProfile): BadgeLevel {
  if (profile.suspended === true) return null;
  if (
    GOLD_BADGE_LIVE &&
    profile.goldBadge &&
    GOLD_KIND_LIVE[profile.goldBadge.kind] &&
    (!profile.goldUntil || new Date(profile.goldUntil).getTime() > Date.now())
  ) return "gold";
  return hasVerifiedBadge(profile) ? "verified" : null;
}

// Can this account publish its own journal entries? Every tier except
// "standard" grants it, same as an internal role (admin/staff/
// volunteer) does. firestore.rules' isPublisher() must be kept in
// sync with this — it can't import a TS function, rules aren't JS.
export function canPublish(profile: UserProfile): boolean {
  return profile.role !== "reader" || profile.accountTier !== "standard";
}

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
  if (reservation.exists()) {
    const found = await getUserByUid(reservation.data().uid);
    if (found) return found;
  }
  return adminFallbackProfile(username);
}

// Founder profiles are only written to Firestore the first time that
// founder signs in (ensureAdminProfile) — and are missing entirely
// after a migration to a fresh project. Until then, /u/<username>
// rendered "Profile not found". Serve the known static profile instead.
function adminFallbackProfile(username: string): UserProfile | null {
  const entry = Object.entries(ADMIN_PROFILES).find(([, a]) => a.username === username);
  if (!entry) return null;
  const [, a] = entry;
  return {
    uid: `admin:${a.username}`,
    username: a.username,
    displayName: a.displayName,
    bio: a.bio,
    avatar: a.avatar,
    social: a.social,
    role: "admin",
    createdAt: "",
    accountTier: "basic",
    suspended: false,
  };
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
      createdAt: new Date().toISOString(),
      accountTier: admin ? "basic" : "standard",
      suspended: false,
      consent: { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() },
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
    createdAt: new Date().toISOString(),
    accountTier: "basic",
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

async function readUsersFromFirestore(): Promise<UserProfile[]> {
  const q = query(collection(db, USERS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
}

// Public directory reads are cached (see lib/ttl-cache.ts): on the server
// in-process, in the browser via /api/public/users (CDN-cached and with
// private fields such as email stripped). The admin screen needs the real
// documents and uses getAllUsersForAdmin().
const serverPublicUsers = ttlCache(5 * 60_000, readUsersFromFirestore);
const browserPublicUsers = ttlCache(2 * 60_000, async () => {
  const res = await fetch("/api/public/users");
  if (!res.ok) throw new Error("Couldn't load people right now.");
  return ((await res.json()).users as UserProfile[]) || [];
});

export async function getAllUsers(): Promise<UserProfile[]> {
  return typeof window === "undefined" ? serverPublicUsers() : browserPublicUsers();
}

export function getAllUsersForAdmin(): Promise<UserProfile[]> {
  return readUsersFromFirestore();
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