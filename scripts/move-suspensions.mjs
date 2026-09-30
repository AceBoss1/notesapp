// One-off migration: moves the `suspension` object (reason, appeal text…)
// off the publicly readable users/{uid} document into the private
// suspensions/{uid} document. Dry-run by default; --apply to write.
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/move-suspensions.mjs [--apply]
// Deploy the new code + firestore.rules FIRST. Safe to re-run.
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
const db = getFirestore();

const snap = await db.collection("users").get();
const withSusp = snap.docs.filter((d) => d.data().suspension && typeof d.data().suspension === "object");
console.log(`${snap.size} user docs, ${withSusp.length} carry a suspension object.`);
if (!apply) {
  console.log("Dry run — nothing written. Re-run with --apply.");
  process.exit(0);
}
for (const d of withSusp) {
  await db.collection("suspensions").doc(d.id).set(d.data().suspension, { merge: true });
  await d.ref.update({ suspension: FieldValue.delete() });
  console.log(`Moved ${d.id}`);
}
console.log("Done.");
