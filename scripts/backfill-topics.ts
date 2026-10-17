// Files every journal under topics (lib/topics.ts) and tidies its hashtags. Dry run by default: it lists what it would change.
//
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx -y tsx scripts/backfill-topics.ts [--apply]
//   (or FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-notesapp against the emulator)
// A journal that already has topics keeps them. Otherwise its categories and tags are read through the topic aliases; a category
// that means no topic is kept as a hashtag. Journals that match no topic are listed, for their writer or an editor to file.
import { pathToFileURL } from "node:url";
import { MAX_NOTE_TAGS, matchTopic, parseTags, topicLabel, topicsOf } from "../lib/topics";

type NoteDoc = { title?: string; topics?: string[]; categories?: string[]; tags?: string[] };
export function planTopics(n: NoteDoc): { set: Partial<NoteDoc>; unfiled: boolean } {
  const set: Partial<NoteDoc> = {};
  const has = Array.isArray(n.topics) && n.topics.length > 0;
  const topics = topicsOf(n);
  if (!has && topics.length) { set.topics = topics; set.categories = topics.map(topicLabel); }
  const leftover = (n.categories ?? []).filter((c) => !matchTopic(c));
  const tags = parseTags([...(n.tags ?? []), ...(has ? [] : leftover)], MAX_NOTE_TAGS).filter((t) => !topics.includes(matchTopic(t) ?? ""));
  if (JSON.stringify(tags) !== JSON.stringify(n.tags ?? [])) set.tags = tags;
  return { set, unfiled: topics.length === 0 };
}

async function main() {
  const { initializeApp, cert, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const apply = process.argv.includes("--apply");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: process.env.GCLOUD_PROJECT || "demo-notesapp" } : { credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
  const db = getFirestore();
  const notes = await db.collection("notes").get();
  let changed = 0, unfiled = 0;
  for (const d of notes.docs) {
    const n = d.data() as NoteDoc;
    const plan = planTopics(n);
    if (Object.keys(plan.set).length) {
      changed++;
      console.log(`${apply ? "set" : "would set"} notes/${d.id} (${String(n.title ?? "").slice(0, 50)}): ${JSON.stringify(plan.set)}`);
      if (apply) await d.ref.set(plan.set, { merge: true });
    }
    if (plan.unfiled) { unfiled++; console.log(`  no topic: notes/${d.id} (${String(n.title ?? "").slice(0, 50)}) categories ${JSON.stringify(n.categories ?? [])}`); }
  }
  console.log(`${notes.size} journals, ${changed} ${apply ? "updated" : "to update (run again with --apply)"}, ${unfiled} with no topic yet.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().catch((e) => { console.error(e); process.exit(1); });
