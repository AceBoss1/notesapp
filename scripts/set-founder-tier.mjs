// One-off: puts every account that carries the `admin` claim (the founders) on the Business
// publishing tier, so the stored `accountTier` matches what the site already shows for them.
// Dry run by default; --apply to write. Safe to re-run.
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/set-founder-tier.mjs [--apply]
// (or FIREBASE_SERVICE_ACCOUNT_KEY='<json one line>')
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const apply = process.argv.includes("--apply");
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
const db = getFirestore();

const admins = [];
let page;
do {
  const res = await getAuth().listUsers(1000, page);
  admins.push(...res.users.filter((u) => u.customClaims?.admin === true));
  page = res.pageToken;
} while (page);

console.log(`${admins.length} account(s) carry the admin claim.`);
for (const a of admins) {
  const ref = db.doc(`users/${a.uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`  ${a.email}: no users/${a.uid} document — skipped`);
    continue;
  }
  const tier = snap.data().accountTier;
  console.log(`  ${a.email} (@${snap.data().username}): ${tier} -> business${tier === "business" ? " (already)" : ""}`);
  if (apply && tier !== "business") await ref.update({ accountTier: "business" });
}
console.log(apply ? "Done." : "Dry run — nothing written. Re-run with --apply.");
