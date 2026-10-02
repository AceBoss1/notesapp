import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Server-only — never imported from a "use client" file. Distinct
// from lib/firebase.ts (the client SDK used everywhere else in this
// app); this exists solely so app/api/upload/route.ts can verify a
// request really came from a signed-in admin before handing out a
// presigned R2 upload URL, since that route runs on the server with
// no access to the client's auth state otherwise.
//
// FIREBASE_SERVICE_ACCOUNT_KEY is the full service account JSON
// (Firebase Console → Project settings → Service accounts → Generate
// new private key), stored as a single-line env var, NOT committed to
// the repo and NOT prefixed NEXT_PUBLIC_ (it must never reach the
// browser).
export function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set in this environment's variables — required for uploads to work. See README."
    );
  }
  let serviceAccount: object;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    // This exact failure mode (a "No number after minus sign in JSON"
    // or similar SyntaxError) is what happens when the env var holds
    // a placeholder — e.g. a bare "-" typed into Vercel's dashboard
    // while setting things up — instead of the real service account
    // JSON. Firebase Console → Project settings → Service accounts →
    // Generate new private key → paste the ENTIRE file contents as
    // ONE line into this env var, then redeploy. Without this catch,
    // that exact scenario surfaced as a raw, unexplained JSON
    // SyntaxError on whatever page triggered an upload — this message
    // is what should show up instead.
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is set but isn't valid JSON — it's very likely a placeholder value rather than the real service account key. Paste the full JSON from Firebase Console → Project settings → Service accounts → Generate new private key, as one line, then redeploy."
    );
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

// Admin = custom claim `admin: true`. LEGACY_ADMIN_EMAILS is the
// temporary fallback for the claims migration (same list as
// firestore.rules' isLegacyAdminEmail) — delete it once both founders
// carry the claim.
const LEGACY_ADMIN_EMAILS = ["ezurukam@gmail.com", "precheks.info@gmail.com"];

function isAdminToken(decoded: { admin?: unknown; email?: string }): boolean {
  return decoded.admin === true || (!!decoded.email && LEGACY_ADMIN_EMAILS.includes(decoded.email));
}

// Admins, or any account firestore.rules' isPublisher() would let
// write a note (role staff/volunteer, or accountTier != "standard").
// Without this, non-admin publishers could create journals but every
// image upload returned 401.
export async function verifyPublisherRequest(idToken: string | undefined): Promise<string> {
  if (!idToken) throw new Error("Missing auth token");
  const app = getAdminApp();
  const decoded = await getAuth(app).verifyIdToken(idToken);
  if (isAdminToken(decoded)) return decoded.uid;
  const snap = await getFirestore(app).doc(`users/${decoded.uid}`).get();
  const u = snap.data();
  if (!u || u.suspended === true) throw new Error("Not allowed to upload");
  if (u.role === "staff" || u.role === "volunteer" || (u.accountTier && u.accountTier !== "standard")) {
    return decoded.uid;
  }
  // A team member writing for an organisation on Business/Enterprise.
  const mem = await getFirestore(app).collection("orgMembers").where("memberUid", "==", decoded.uid).get();
  for (const m of mem.docs) {
    const org = (await getFirestore(app).doc(`users/${m.data().orgUid}`).get()).data();
    if (org && org.suspended !== true && ["business", "enterprise"].includes(org.accountTier)) return decoded.uid;
  }
  throw new Error("Your account tier can't publish or upload");
}

export async function verifyAdminRequest(idToken: string | undefined): Promise<string> {
  if (!idToken) throw new Error("Missing auth token");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  if (!isAdminToken(decoded)) throw new Error("Not an admin account");
  return decoded.uid;
}

// Grants or revokes the admin claim. The user must sign in again (or
// force-refresh their token) before it shows up.
export async function setAdminClaim(uid: string, admin: boolean): Promise<void> {
  const auth = getAuth(getAdminApp());
  const existing = (await auth.getUser(uid)).customClaims || {};
  await auth.setCustomUserClaims(uid, { ...existing, admin });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

// Any signed-in user (payments — no publisher/admin requirement).
export async function verifySignedInRequest(
  idToken: string | undefined
): Promise<{ uid: string; email: string; emailVerified: boolean }> {
  if (!idToken) throw new Error("Missing auth token");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  return { uid: decoded.uid, email: decoded.email || "", emailVerified: decoded.email_verified === true };
}

// Avatars: any signed-in, non-suspended account may upload their own
// profile picture — no publisher tier needed.
export async function verifyAvatarUploadRequest(idToken: string | undefined): Promise<string> {
  const { uid } = await verifySignedInRequest(idToken);
  const snap = await getAdminDb().doc(`users/${uid}`).get();
  if (snap.data()?.suspended === true) throw new Error("Suspended accounts can't upload");
  return uid;
}

// Emails live ONLY in Firebase Authentication — never in the (publicly
// readable) users/{uid} documents. Server code that needs to email a user
// looks it up here; Auth reads don't count against Firestore quota.
export async function getUserEmail(uid: string): Promise<string | null> {
  try {
    return (await getAuth(getAdminApp()).getUser(uid)).email || null;
  } catch {
    return null;
  }
}

export async function getUserEmails(uids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < uids.length; i += 100) {
    const res = await getAuth(getAdminApp()).getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    res.users.forEach((u) => {
      if (u.email) out[u.uid] = u.email;
    });
  }
  return out;
}
