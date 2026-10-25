import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { resolveAuthorUsername } from "./journals-directory";
import { MAX_NOTE_TAGS, matchTopic, parseTags, topicLabel, topicsOf } from "./topics";

// The one-off fixes for older journals, run from Admin → Maintenance (app/(main)/admin/maintenance) or from the command line
// (scripts/backfill-author-uids.ts, scripts/backfill-topics.ts). Both only fill what's missing and are safe to re-run; a dry run
// lists what would change and touches nothing.
// Safety (v0.91.0): apply needs the dry run's planHash (refused if the journals changed since) and a confirmed backup. Every apply
// is a run in maintenanceRuns/{runId} with a before-image of each changed field (changes/{noteId}: before, missing, after), so
// undoRun puts the run back, leaving alone any journal edited since. Both collections are server-only (firestore.rules).
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
export type BackfillResult = { job: Backfill; applied: boolean; total: number; changes: Change[]; flags: Flag[]; planHash: string; runId?: string };
export type RunBy = { uid: string; name: string };
export class PlanChanged extends Error { constructor(readonly fresh: BackfillResult) { super("The journals changed since your dry run. Check the new list, then apply again."); } }

// The same plan always gives the same hash: the dry run hands it out, apply recomputes it and refuses a mismatch.
export function planHashOf(changes: Change[]): string {
  const rows = changes.map((c): [string, unknown] => [c.id, stable(c.set)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object" && !(v instanceof Timestamp)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
  return v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

const PER_BATCH = 200; // each change is two writes (the journal and its before-image); Firestore takes 500 to a batch

// Reads every journal and works out the change for each. A dry run stops there. Apply (with the dry run's planHash, when given)
// records a run, then writes each change with its before-image in the same batch, so a run cut short can still be undone.
export async function runBackfill(db: Firestore, job: Backfill, apply: boolean, opts: { planHash?: string; by?: RunBy; backupConfirmed?: boolean } = {}): Promise<BackfillResult> {
  const notes = await db.collection("notes").get();
  const lookups = job === "author-uids" ? firestoreLookups(db) : null;
  const changes: Change[] = [];
  const flags: Flag[] = [];
  const current = new Map<string, Record<string, unknown>>();
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
    current.set(d.id, d.data());
  }
  const result: BackfillResult = { job, applied: false, total: notes.size, changes, flags, planHash: planHashOf(changes) };
  if (!apply) return result;
  if (opts.planHash !== undefined && opts.planHash !== result.planHash) throw new PlanChanged(result);
  const run = db.collection("maintenanceRuns").doc(`${new Date().toISOString().slice(0, 10)}-${job}-${randomUUID().slice(0, 8)}`);
  await run.set({ job, at: FieldValue.serverTimestamp(), by: opts.by?.uid ?? "", byName: opts.by?.name ?? "", count: changes.length, planHash: result.planHash, backupConfirmed: opts.backupConfirmed === true, status: "applying", written: 0 });
  for (let i = 0; i < changes.length; i += PER_BATCH) {
    const batch = db.batch();
    const part = changes.slice(i, i + PER_BATCH);
    for (const c of part) {
      const was = current.get(c.id) ?? {};
      const keys = Object.keys(c.set);
      batch.set(run.collection("changes").doc(c.id), {
        before: Object.fromEntries(keys.filter((k) => k in was).map((k) => [k, was[k]])),
        missing: keys.filter((k) => !(k in was)),
        after: c.set,
      });
      batch.set(db.doc(`notes/${c.id}`), c.set, { merge: true });
    }
    batch.update(run, { written: FieldValue.increment(part.length) });
    await batch.commit();
  }
  await run.update({ status: "applied", appliedAt: FieldValue.serverTimestamp() });
  return { ...result, applied: true, runId: run.id };
}

export type Run = { id: string; job: string; at: string | null; byName: string; count: number; written: number; status: "applying" | "applied" | "undone"; backupConfirmed: boolean; undoneAt: string | null; undoneByName: string; restored: number | null; kept: number | null };
const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);

export async function listRuns(db: Firestore, limit = 10): Promise<Run[]> {
  const s = await db.collection("maintenanceRuns").orderBy("at", "desc").limit(limit).get();
  return s.docs.map((d) => {
    const r = d.data();
    return { id: d.id, job: String(r.job ?? ""), at: iso(r.at), byName: String(r.byName ?? ""), count: Number(r.count ?? 0), written: Number(r.written ?? 0), status: r.status, backupConfirmed: r.backupConfirmed === true, undoneAt: iso(r.undoneAt), undoneByName: String(r.undoneByName ?? ""), restored: typeof r.restored === "number" ? r.restored : null, kept: typeof r.kept === "number" ? r.kept : null };
  });
}

export type UndoResult = { runId: string; restored: number; kept: Flag[] };

// Puts a run back: each journal whose changed fields still hold what the run wrote gets its before-image again (fields that
// didn't exist are removed). A journal edited since, or deleted, is left as it is and listed. A run can be undone once.
export async function undoRun(db: Firestore, runId: string, by: RunBy): Promise<UndoResult> {
  const run = db.doc(`maintenanceRuns/${runId}`);
  const r = (await run.get()).data();
  if (!r) throw new Error("No such run.");
  if (r.status === "undone") throw new Error("This run was already undone.");
  const changes = await run.collection("changes").get();
  const kept: Flag[] = [];
  let restored = 0;
  for (let i = 0; i < changes.docs.length; i += 400) {
    const part = changes.docs.slice(i, i + 400);
    const notes = await db.getAll(...part.map((c) => db.doc(`notes/${c.id}`)));
    const batch = db.batch();
    part.forEach((c, j) => {
      const { before = {}, missing = [], after = {} } = c.data() as { before?: Record<string, unknown>; missing?: string[]; after?: Record<string, unknown> };
      const now = notes[j].data();
      const slug = String(now?.slug ?? "");
      const title = String(now?.title ?? "(deleted)").slice(0, 80);
      if (!now) { kept.push({ id: c.id, slug, title, note: "deleted since the run" }); return; }
      const moved = Object.keys(after).filter((k) => !same(now[k], after[k]));
      if (moved.length) { kept.push({ id: c.id, slug, title, note: `changed since the run (${moved.join(", ")}), left as it is` }); return; }
      batch.set(notes[j].ref, { ...before, ...Object.fromEntries(missing.map((k) => [k, FieldValue.delete()])) }, { merge: true });
      restored++;
    });
    await batch.commit();
  }
  await run.update({ status: "undone", undoneAt: FieldValue.serverTimestamp(), undoneBy: by.uid, undoneByName: by.name, restored, kept: kept.length });
  return { runId, restored, kept };
}
