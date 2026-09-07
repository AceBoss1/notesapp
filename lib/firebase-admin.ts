import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set — required for server-side admin verification. See README."
    );
  }
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount) });
}

export async function verifyAdminRequest(idToken: string | undefined): Promise<string> {
  if (!idToken) throw new Error("Missing auth token");
  const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
  const email = decoded.email;
  // Mirrors firestore.rules' isAdmin() allowlist exactly — keep both
  // in sync if this ever changes. Hardcoded here rather than imported
  // from lib/admin.ts because that file has no server/client
  // boundary concerns of its own; duplicating the two emails is safer
  // than risking an accidental client-bundle import chain pulling
  // firebase-admin into browser code.
  const ADMIN_EMAILS = ["ezurukam@gmail.com", "precheks.info@gmail.com"];
  if (!email || !ADMIN_EMAILS.includes(email)) {
    throw new Error("Not an admin account");
  }
  return email;
}
