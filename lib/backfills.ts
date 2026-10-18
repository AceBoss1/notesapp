import type { Firestore } from "firebase-admin/firestore";
import { resolveAuthorUsername } from "./journals-directory";
import { MAX_NOTE_TAGS, matchTopic, parseTags, topicLabel, topicsOf } from "./topics";

// The one-off fixes for older journals, run from Admin → Maintenance (app/(main)/admin/maintenance) or from the command line
// (scripts/backfill-author-uids.ts, scripts/backfill-topics.ts). Both only fill what's missing and are safe to re-run; a dry run
// lists what would change and touches nothing.
//   author-uids → every journal gets the account id and username of its author and co-authors, so a rename never loses a post.
//                 A display name that matches more than one account is left alone and listed, for a person to decide.
//   topics      → every journal is filed under topics (lib/topics.ts) and its hashtags tidied. One that already has topics keeps
//                 them; journals that match no topic are listed, for their writer or an editor to file.

type NoteDoc = { title?: string; slug?: string; author?: string; authorUid?: string; authorUsername?: string; coAuthors?: string[]; coAuthorUids?: string[]; topics?: string[]; categories?: string[]; tags?: string[] };
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

export function firestoreLookups(db: Firestore): Lookups {
  const names = new Map<string, { uid: string; username: string }[]>();
  return {
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
}

export const BACKFILLS = ["author-uids", "topics"] as const;
export type Backfill = (typeof BACKFILLS)[number];
export const isBackfill = (j: unknown): j is Backfill => typeof j === "string" && (BACKFILLS as readonly string[]).includes(j);

export type Change = { id: string; slug: string; title: string; set: Record<string, unknown> };
export type Flag = { id: string; slug: string; title: string; note: string };
export type BackfillResult = { job: Backfill; applied: boolean; total: number; changes: Change[]; flags: Flag[] };

// Reads every journal, works out the change for each and, with apply, writes them (400 to a batch). Returns the same list either
// way, so the dry run and the real run read alike.
export async function runBackfill(db: Firestore, job: Backfill, apply: boolean): Promise<BackfillResult> {
  const notes = await db.collection("notes").get();
  const lookups = job === "author-uids" ? firestoreLookups(db) : null;
  const changes: Change[] = [];
  const flags: Flag[] = [];
  for (const d of notes.docs) {
    const n = d.data() as NoteDoc;
    const full = String(n.title ?? "");
    const title = (full.length > 80 ? `${full.slice(0, 79)}…` : full) || "(untitled)";
    const slug = String(n.slug ?? "");
    if (lookups) {
      const { set, unsure } = await planBackfill(n, lookups);
      if (Object.keys(set).length) changes.push({ id: d.id, slug, title, set });
      for (const note of unsure) flags.push({ id: d.id, slug, title, note });
    } else {
      const { set, unfiled } = planTopics(n);
      if (Object.keys(set).length) changes.push({ id: d.id, slug, title, set });
      if (unfiled) flags.push({ id: d.id, slug, title, note: `no topic yet (categories ${JSON.stringify(n.categories ?? [])})` });
    }
  }
  if (apply) {
    for (let i = 0; i < changes.length; i += 400) {
      const batch = db.batch();
      for (const c of changes.slice(i, i + 400)) batch.set(db.doc(`notes/${c.id}`), c.set, { merge: true });
      await batch.commit();
    }
  }
  return { job, applied: apply, total: notes.size, changes, flags };
}
