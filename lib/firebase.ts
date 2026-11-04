import { initializeApp, getApps, getApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { setting } from "@/lib/config";

// Google sign-in's helper pages live on the auth domain (<project>.firebaseapp.com). With NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE=on,
// each of our sites serves them itself at /__/auth (next.config.js proxies them), so a redirect sign-in stays on the address the
// visitor is on: Safari and in-app browsers, which block another site's storage, can then finish it (lib/social-auth-client.ts).
function authDomain(): string | undefined {
  const own = setting("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (typeof window === "undefined" || !/^(on|true|yes|1)$/i.test(setting("NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE") ?? "")) return own;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" ? own : window.location.host;
}

const firebaseConfig = {
  apiKey: setting("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: authDomain(),
  projectId: setting("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: setting("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: setting("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: setting("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// The live database, or a restored one after a recovery (NEXT_PUBLIC_FIRESTORE_DATABASE_ID, Admin → Backups).
export const DATABASE_ID = setting("NEXT_PUBLIC_FIRESTORE_DATABASE_ID")?.trim() || "(default)";
export const db = DATABASE_ID === "(default)" ? getFirestore(app) : getFirestore(app, DATABASE_ID);
// Local development, CI and screenshots: point Firestore at the emulator (never set on the live site). Each copy of the SDK
// (the browser, server components, API routes) connects its own instance; connecting one twice throws, which is ignored.
const emulator = setting("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST");
if (emulator) {
  const [host, port] = emulator.split(":");
  try { connectFirestoreEmulator(db, host, Number(port) || 8080); } catch { /* already connected */ }
}
export const auth = getAuth(app);
// The same for sign-in: the Auth emulator (never on the live site).
const authEmulator = setting("NEXT_PUBLIC_AUTH_EMULATOR_HOST");
if (authEmulator) {
  try { connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true }); } catch { /* already connected */ }
}
