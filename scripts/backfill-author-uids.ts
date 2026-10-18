// Gives every journal the account id and username of its author and co-authors, so a journal never depends on a display name
// (which changes when someone renames, and which two people can share). Dry run by default: it lists what it would change.
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx -y tsx scripts/backfill-author-uids.ts [--apply]
//   (or FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-notesapp against the emulator)
// Only fills what's missing; never changes an id that's already there. A display name that matches more than one account is
// The plan itself lives in lib/backfills.ts, shared with Admin → Maintenance (the same dry run and apply from the browser).
import { pathToFileURL } from "node:url";
import { runBackfill } from "../lib/backfills";
export { planBackfill, type Lookups } from "../lib/backfills";

async function main() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" } : { credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const r = await runBackfill(getFirestore(), "author-uids", apply);
  for (const c of r.changes) console.log(`${apply ? "set" : "would set"} notes/${c.id} (${c.title.slice(0, 50)}): ${JSON.stringify(c.set)}`);
  for (const f of r.flags) console.log(`  check notes/${f.id} (${f.title.slice(0, 50)}): ${f.note}`);
  console.log(`${r.total} journals, ${r.changes.length} ${apply ? "updated" : "to update (run again with --apply)"}, ${r.flags.length} to check by hand.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e); process.exit(1); });
