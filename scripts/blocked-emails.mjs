// Finds existing accounts whose sign-in email is at a blocked throwaway domain (lib/email-blocklist.ts; keep the list below in step)
// and, with --suspend, suspends them indefinitely with the reason shown to the member.
//
//   Dry run (default, writes nothing):
//     FIREBASE_SERVICE_ACCOUNT_KEY='<json, one line>' node scripts/blocked-emails.mjs
//   Suspend them:
//     FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/blocked-emails.mjs --suspend
//
// (or GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json). Lists uid, username and email domain only. Safe to re-run.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BLOCKED = ["petchi.uk"];
const blocked = (email) => {
  const d = String(email || "").trim().toLowerCase().split("@").pop().replace(/\.+$/, "");
  return !!email && BLOCKED.some((b) => d === b || d.endsWith(`.${b}`));
};
const suspend = process.argv.includes("--suspend");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
const auth = getAuth(), db = getFirestore();

const found = [];
let token;
do {
  const page = await auth.listUsers(1000, token);
  for (const u of page.users) if (blocked(u.email)) found.push(u);
  token = page.pageToken;
} while (token);

console.log(`${found.length} account(s) use a blocked throwaway email domain.`);
for (const u of found) {
  const prof = await db.doc(`users/${u.uid}`).get();
  const username = prof.exists ? prof.data().username : "(no profile)";
  console.log(`  ${u.uid}  @${username}  ${u.email.split("@").pop()}${prof.exists && prof.data().suspended ? "  (already suspended)" : ""}`);
  if (suspend && prof.exists && !prof.data().suspended) {
    await db.doc(`suspensions/${u.uid}`).set({
      reason: "This account uses a temporary (throwaway) email address, which #NotesApp doesn't allow. Contact support to move it to your own email address.",
      suspendedAt: new Date().toISOString(), suspendedByUid: "system", appealStatus: "none",
    });
    await db.doc(`users/${u.uid}`).update({ suspended: true });
  }
}
if (!suspend) console.log("Dry run: nothing written. Re-run with --suspend to suspend them.");
