// One-off migration: removes the `email` field from every users/{uid}
// document (emails live only in Firebase Authentication now — the users
// collection is publicly readable, so a stored email was a public leak).
//
//   Dry run (default — writes nothing):
//     FIREBASE_SERVICE_ACCOUNT_KEY='<json, one line>' node scripts/strip-user-emails.mjs
//   Apply:
//     FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/strip-user-emails.mjs --apply
//
// (or GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json). Reads every user
// doc once and writes only the ones that have an email. Safe to re-run.
// Deploy the new code FIRST so nothing re-creates the field, then run this.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
const db = getFirestore();

const snap = await db.collection("users").get();
const withEmail = snap.docs.filter((d) => typeof d.data().email === "string");
console.log(`${snap.size} user docs, ${withEmail.length} contain an email field.`);
if (!apply) {
  console.log("Dry run — nothing written. Re-run with --apply to remove the field.");
  process.exit(0);
}
for (let i = 0; i < withEmail.length; i += 400) {
  const batch = db.batch();
  withEmail.slice(i, i + 400).forEach((d) => batch.update(d.ref, { email: FieldValue.delete() }));
  await batch.commit();
  console.log(`Cleaned ${Math.min(i + 400, withEmail.length)} / ${withEmail.length}`);
}
console.log("Done. Anyone reading users/{uid} now sees no email.");
