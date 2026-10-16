// Gives every journal the account id and username of its author and co-authors, so a journal never depends on a display name
// (which changes when someone renames, and which two people can share). Dry run by default: it lists what it would change.
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx -y tsx scripts/backfill-author-uids.ts [--apply]
//   (or FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-notesapp against the emulator)
// Only fills what's missing; never changes an id that's already there. A display name that matches more than one account is
// left alone and listed, for a person to decide. Safe to re-run.
import { pathToFileURL } from "node:url";
import { resolveAuthorUsername } from "../lib/journals-directory";

type NoteDoc = { author?: string; authorUid?: string; authorUsername?: string; coAuthors?: string[]; coAuthorUids?: string[] };
export type Lookups = {
  uidOfUsername: (username: string) => Promise<string | null>;
  usernameOfUid: (uid: string) => Promise<string | null>;
  // every account with exactly this display name
  byDisplayName: (name: string) => Promise<{ uid: string; username: string }[]>;
};
export type Plan = { set: Partial<NoteDoc>; unsure: string[] };

const SYNTHETIC = new Set(["na-notesapp", "notesapp"]); // channels with no account of their own

export async function planBackfill(n: NoteDoc, l: Lookups): Promise<Plan> {
  const set: Partial<NoteDoc> = {};
  const unsure: string[] = [];
  let username = n.authorUsername || (n.authorUid ? await l.usernameOfUid(n.authorUid) : null) || resolveAuthorUsername(String(n.author ?? ""));
  let uid = n.authorUid || (username && !SYNTHETIC.has(username) ? await l.uidOfUsername(username) : null);
  if (!username && !uid && n.author) {
    const m = await l.byDisplayName(n.author);
    if (m.length === 1) ({ uid, username } = m[0]);
    else if (m.length > 1) unsure.push(`author "${n.author}" matches ${m.length} accounts`);
    else unsure.push(`author "${n.author}" matches no account`);
  }
  if (username && !n.authorUsername) set.authorUsername = username;
  if (uid && !n.authorUid) set.authorUid = uid;
  const names = n.coAuthors ?? [];
  if (names.length && (n.coAuthorUids ?? []).length < names.length) {
    const have = new Set(n.coAuthorUids ?? []);
    for (const name of names) {
      const m = await l.byDisplayName(name);
      if (m.length === 1) have.add(m[0].uid);
      else unsure.push(`co-author "${name}" matches ${m.length} accounts`);
    }
    if (have.size > (n.coAuthorUids ?? []).length) set.coAuthorUids = Array.from(have);
  }
  return { set, unsure };
}

async function main() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" } : { credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const db = getFirestore();
  const names = new Map<string, { uid: string; username: string }[]>();
  const lookups: Lookups = {
    uidOfUsername: async (u) => String((await db.doc(`usernames/${u}`).get()).data()?.uid ?? "") || null,
    usernameOfUid: async (uid) => String((await db.doc(`users/${uid}`).get()).data()?.username ?? "") || null,
    byDisplayName: async (name) => {
      if (!names.has(name)) {
        const s = await db.collection("users").where("displayName", "==", name).limit(5).get();
        names.set(name, s.docs.map((d) => ({ uid: d.id, username: String(d.data().username ?? "") })));
      }
      return names.get(name)!;
    },
  };
  const notes = await db.collection("notes").get();
  let changed = 0;
  for (const d of notes.docs) {
    const { set, unsure } = await planBackfill(d.data() as NoteDoc, lookups);
    if (Object.keys(set).length) {
      changed++;
      console.log(`${apply ? "set" : "would set"} notes/${d.id} (${String(d.data().title ?? "").slice(0, 50)}): ${JSON.stringify(set)}`);
      if (apply) await d.ref.set(set, { merge: true });
    }
    for (const u of unsure) console.log(`  check notes/${d.id}: ${u}`);
  }
  console.log(`${notes.size} journals, ${changed} ${apply ? "updated" : "to update (run again with --apply)"}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e); process.exit(1); });
