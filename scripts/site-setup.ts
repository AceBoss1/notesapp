// "Set it up for me": fills an organisation's site, About and Contact pages, community, Academy courses and news from a preset
// (scripts/site-presets/<name>.ts), through lib/site-setup-server.ts. A dry run by default: it lists what it would do.
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx -y tsx scripts/site-setup.ts unipa            (dry run)
//   … unipa --apply             fill the site; it stays a preview (a notice on every page, not in search engines); courses and news are drafts
//   … unipa --apply --publish   also publish the preset's courses and news
//   … unipa --apply --force     replace the site's sections and pages even if they are already written
//   … unipa --apply --live      take the preview notice off, once the organisation has taken the site over
//   (or FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-notesapp against the emulators; there, --demo-account also makes the
//    account, on Enterprise, so the site can be looked at and photographed before anything is live)
// The account must exist first: sign it up as an organisation with the preset's username and put it on its plan. Nothing here creates
// a live account, changes a plan or uploads a logo.
import { pathToFileURL } from "node:url";
import { setUpSite, type SitePreset } from "../lib/site-setup-server";
import { unipa } from "./site-presets/unipa";

const PRESETS: Record<string, SitePreset> = { unipa };

async function main() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const args = process.argv.slice(2);
  const preset = PRESETS[args.find((a) => !a.startsWith("--")) ?? ""];
  if (!preset) throw new Error(`Which preset? One of: ${Object.keys(PRESETS).join(", ")}.`);
  const has = (f: string) => args.includes(f);
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(emulator ? { projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" } : { credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const db = getFirestore();
  if (has("--demo-account")) {
    if (!emulator) throw new Error("--demo-account only works against the emulators. On the live site, sign the account up and put it on its plan first.");
    const uid = `u_${preset.username}`;
    if (!(await db.doc(`usernames/${preset.username}`).get()).exists) {
      await db.doc(`users/${uid}`).set({ uid, username: preset.username, displayName: preset.username.toUpperCase(), avatar: "", bio: "", role: "reader", accountTier: "enterprise", accountKind: "organisation", createdAt: new Date().toISOString(), suspended: false });
      await db.doc(`usernames/${preset.username}`).set({ uid });
    }
  }
  const lines = await setUpSite(db, preset, { apply: has("--apply"), force: has("--force"), publish: has("--publish"), live: has("--live") });
  for (const l of lines) console.log(l);
  console.log(has("--apply") ? `Done: /s/${preset.username}` : "Dry run: nothing was changed. Run again with --apply.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
