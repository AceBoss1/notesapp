// One-off repair for the two founder profiles after the project migration.
//
// Symptom: a founder has TWO profile documents (an old one copied from the previous project
// with a uid that no login belongs to, and a newer one) or NONE for their current login, while
// `usernames/<username>` points at the old one. Pages then read different documents for the same
// person: different badges, role text, tier. ensureAdminProfile() can't repair it because the
// username is already "taken" by the old document.
//
// What it does, per founder (matched by login email):
//   1. finds the founder's current login uid (Firebase Auth);
//   2. makes `users/<that uid>` the one real profile — copied from the old document when it is
//      missing, or, when it exists, filling only gaps (gold badge, verified, bio, avatar, social);
//      role stays admin, tier becomes business;
//   3. points `usernames/<username>` at that uid;
//   4. moves their notes' `authorUid` from the old uid to the new one;
//   5. archives each old document to `usersArchive/<old uid>` and removes it from `users`.
// Nothing is deleted outright: the archived copies keep every field. Dry run by default.
//
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json node scripts/fix-founder-profiles.mjs [--apply]
// Run the dry run first and read what it plans; safe to re-run.
import { pathToFileURL } from "node:url";

export const FOUNDERS = [
  { email: "ezurukam@gmail.com", username: "emmanuel" },
  { email: "precheks.info@gmail.com", username: "chimdinma" },
];
const FILL_IF_MISSING = ["goldBadge", "goldUntil", "badgeUntil", "verified", "bio", "avatar", "social"];

// Returns the list of actions it took (or would take). `db` is a Firestore admin instance.
export async function repairFounder({ db, authUid, founder, apply }) {
  const log = [];
  const step = async (text, fn) => {
    log.push(text);
    if (apply) await fn();
  };
  const A = authUid;
  const canonicalRef = db.doc(`users/${A}`);
  const canonical = (await canonicalRef.get()).data();
  const byName = await db.collection("users").where("username", "==", founder.username).get();
  const orphans = byName.docs.filter((d) => d.id !== A);
  const reservation = (await db.doc(`usernames/${founder.username}`).get()).data();
  log.push(`login uid ${A}; profile at that uid: ${canonical ? "yes" : "NO"}; other documents with @${founder.username}: ${orphans.map((d) => d.id).join(", ") || "none"}; username points at: ${reservation?.uid ?? "nothing"}`);

  // Best old document: the one the username points at, else the one with the most data.
  const best = [...orphans].sort((a, b) => (b.id === reservation?.uid) - (a.id === reservation?.uid) || Object.keys(b.data()).length - Object.keys(a.data()).length)[0];

  if (!canonical) {
    if (!best) {
      log.push("nothing to copy from — the next sign-in will create the profile");
    } else {
      const { email, ...rest } = best.data(); // emails never live on profile documents
      await step(`create users/${A} from ${best.id}`, () => canonicalRef.set({ ...rest, uid: A, role: "admin", accountTier: "business" }));
    }
  } else {
    const fill = {};
    for (const o of orphans) for (const k of FILL_IF_MISSING) if (canonical[k] === undefined && fill[k] === undefined && o.data()[k] !== undefined) fill[k] = o.data()[k];
    if (Object.keys(fill).length) await step(`fill users/${A} gaps from the old copy: ${Object.keys(fill).join(", ")}`, () => canonicalRef.set(fill, { merge: true }));
    await step(`set users/${A} role admin, tier business`, () => canonicalRef.set({ role: "admin", accountTier: "business" }, { merge: true }));
  }
  if (canonical || best) await step(`point usernames/${founder.username} at ${A}`, () => db.doc(`usernames/${founder.username}`).set({ uid: A }));

  for (const o of orphans) {
    const notes = await db.collection("notes").where("authorUid", "==", o.id).get();
    if (notes.size) await step(`move ${notes.size} note(s) from author ${o.id} to ${A}`, async () => {
      for (const n of notes.docs) await n.ref.update({ authorUid: A });
    });
    await step(`archive users/${o.id} to usersArchive/${o.id} and remove it from users`, async () => {
      await db.doc(`usersArchive/${o.id}`).set({ ...o.data(), archivedAt: new Date().toISOString(), archivedFor: "founder profile repair" });
      await o.ref.delete();
    });
  }
  return log;
}

async function main() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const db = getFirestore();
  for (const f of FOUNDERS) {
    console.log(`\n== ${f.email} (@${f.username}) ==`);
    let user;
    try {
      user = await getAuth().getUserByEmail(f.email);
    } catch (e) {
      console.log(`  no login account for this email — skipped (${e.message})`);
      continue;
    }
    for (const line of await repairFounder({ db, authUid: user.uid, founder: f, apply })) console.log(`  ${apply ? "DONE " : "WOULD"}: ${line}`);
  }
  console.log(apply ? "\nDone." : "\nDry run — nothing written. Re-run with --apply.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
