import { FieldPath, FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import {
  BACKFILL_PHASES, emptyBackfill, emptyCounts, shapeOf, signedDownloadUrl, type BackfillKind, type BackfillState, type MarkShape,
} from "./media-mark";
import { markProfile } from "./media-mark-server";
import { isMarked, shiftBytes, startDownload, type MediaDeps } from "./media-server";
import { markKey, markUrl, type PictureStore } from "./mark-uploads-server";
import type { MediaPicture, MediaPostDoc } from "./media-rules";
import type { RemarkState, ReplayDoc } from "./live-recording";

// The one-off re-marking of everything posted before the permanent NotesApp mark (owner, 5 Nov 2026; lib/media-mark.ts says what and
// why). Started from Admin → Limits (app/api/admin/media-marks), carried on by the cron (app/api/cron/reminders, job "markBackfill") a
// batch at a time until it is done. Its place (phase and last document) and counts live in serverConfig/markBackfill; a video's steps
// live on the video's own document (remark, remarkPending), so the job survives being cut off anywhere. Idempotent: what carries the
// mark is counted as "already" and left alone; a picture marked earlier is found in markedFiles (lib/mark-uploads-server.ts).
//
// Pictures: read → marked → written back OVER THE SAME KEY in the same format (lib/mark-uploads-server.ts markKey), so every address
// already copied elsewhere (share cards, journal drafts, emails, link previews) shows the marked picture and nothing is deleted. Only a
// picture still used unmarked (the owner's site cover/gallery or profile picture), or a GIF/AVIF, gets a new "-na" key on the item,
// and its original is kept.
// Videos (Media and replays): Stream makes an MP4 of the old video → copies it with the creator's watermark profile → when the copy is
// ready the post or replay points at it → the old video (and any v0.134 download copy) is deleted.
// Last, every member's Media storage is counted again from their posts.

const STATE = "serverConfig/markBackfill";
const GIVE_UP_MS = 86_400_000; // a video copy not ready in a day is given up (and tried again on the next run, up to 3 times)
const MAX_TRIES = 3;

export async function getBackfill(db: Firestore): Promise<BackfillState> {
  return { ...emptyBackfill(), ...((await db.doc(STATE).get()).data() as Partial<BackfillState> | undefined) };
}
// Start (or start again: the counts begin from nothing; what's marked counts as "already"), pause and carry on.
export async function controlBackfill(db: Firestore, action: "start" | "pause" | "resume", adminUid: string, now = new Date()): Promise<BackfillState> {
  const cur = await getBackfill(db);
  const at = now.toISOString();
  if (action === "pause") { if (cur.status === "running") await db.doc(STATE).set({ status: "paused", updatedAt: at }, { merge: true }); }
  else if (action === "resume") { if (cur.status === "paused") await db.doc(STATE).set({ status: "running", updatedAt: at }, { merge: true }); }
  else if (cur.status !== "running") await db.doc(STATE).set({ ...emptyBackfill(), status: "running", startedAt: at, updatedAt: at, startedBy: adminUid, lockUntil: 0 });
  return getBackfill(db);
}

// One go: up to `budgetMs` of work (the cron gives it about 20 seconds). Only one go runs at a time (a lease on the state document).
export async function runBackfill(db: Firestore, deps: MediaDeps, o: { now?: () => Date; budgetMs?: number; batch?: number } = {}): Promise<BackfillState & { busy?: boolean }> {
  const clock = o.now ?? (() => new Date());
  const t0 = Date.now(), budget = o.budgetMs ?? 20_000, batch = o.batch ?? 10;
  const ref = db.doc(STATE);
  const got = await db.runTransaction(async (t) => {
    const s = { ...emptyBackfill(), ...((await t.get(ref)).data() as Partial<BackfillState> | undefined) };
    if (s.status !== "running") return { s, ok: false };
    if ((s.lockUntil ?? 0) > Date.now()) return { s, ok: false, busy: true };
    t.set(ref, { lockUntil: Date.now() + budget + 60_000 }, { merge: true });
    return { s, ok: true };
  });
  if (!got.ok) return { ...got.s, ...(got.busy ? { busy: true } : {}) };
  const s: BackfillState = { ...got.s, counts: { ...emptyCounts(), ...got.s.counts } };
  const save = () => ref.set({ ...s, lockUntil: Date.now() + budget + 60_000, updatedAt: clock().toISOString() });
  try {
    for (let first = true; first || Date.now() - t0 < budget; first = false) { // at least one batch a go
      // Videos on their way first (they only wait on Stream), then the next batch of the current phase.
      await advanceVideos(db, s, deps, clock(), batch);
      const phase = BACKFILL_PHASES[s.phase];
      if (!phase) {
        if ((await pendingVideos(db)) === 0) { s.status = "done"; s.finishedAt = clock().toISOString(); }
        break;
      }
      if (phase === "recount") {
        const n = await recountStorage(db, s, batch);
        if (n === 0) { s.phase++; s.cursor = null; }
      } else {
        const col = phase === "storeItems" ? "storeItems" : phase === "sites" ? "sites" : phase === "notes" ? "notes" : phase;
        let q = db.collection(col).orderBy(FieldPath.documentId()).limit(batch);
        if (s.cursor) q = q.startAfter(s.cursor);
        const snap = await q.get();
        if (snap.empty) { s.phase++; s.cursor = null; }
        for (const d of snap.docs) {
          try {
            if (phase === "mediaPosts") await mediaPost(db, d.ref, s, deps, clock());
            else if (phase === "replays") await replay(db, d.ref, s, deps, clock());
            else if (phase === "storeItems") await storeItem(db, d.ref, s, deps, clock());
            else if (phase === "sites") await siteServices(db, d.ref, s, deps, clock());
            else await journal(db, d.ref, s, deps, clock());
          } catch (e) {
            const kind: BackfillKind = phase === "mediaPosts" ? (d.data().kind === "video" ? "mediaVideos" : "mediaPictures") : phase === "replays" ? "replays" : phase === "storeItems" ? "shopItems" : phase === "sites" ? "services" : "journals";
            s.counts[kind].failed++;
            s.lastError = `${col}/${d.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
            console.error("[mark-backfill]", col, d.id, e);
          }
          s.cursor = d.id;
        }
      }
      await save();
    }
    s.runs++;
  } finally {
    s.lockUntil = 0;
    await ref.set({ ...s, updatedAt: clock().toISOString() });
  }
  return s;
}

const pendingVideos = async (db: Firestore) =>
  (await db.collection("mediaPosts").where("remarkPending", "==", true).limit(1).get()).size + (await db.collection("replays").where("remarkPending", "==", true).limit(1).get()).size;

async function advanceVideos(db: Firestore, s: BackfillState, deps: MediaDeps, now: Date, batch: number): Promise<number> {
  let moved = 0;
  for (const col of ["mediaPosts", "replays"] as const) {
    const snap = await db.collection(col).where("remarkPending", "==", true).limit(batch).get();
    for (const d of snap.docs) {
      const kind: BackfillKind = col === "replays" ? "replays" : "mediaVideos";
      const out = await stepVideo(db, target(col, d.ref, d.data(), deps), deps, now).catch((e) => { s.lastError = String(e instanceof Error ? e.message : e).slice(0, 300); return "pending" as const; });
      if (out === "done" || out === "failed") { s.counts[kind].pending = Math.max(0, s.counts[kind].pending - 1); s.counts[kind][out]++; moved++; }
    }
  }
  return moved;
}

// ── Videos ──
type VideoTarget = {
  ref: DocumentReference; oldUid: string; owner: { uid: string; username: string }; signed: boolean; purpose: string; shape: MarkShape;
  remark?: RemarkState; swap: (newUid: string, size?: number) => Promise<void>;
};
function target(col: "mediaPosts" | "replays", ref: DocumentReference, data: FirebaseFirestore.DocumentData, deps: MediaDeps): VideoTarget {
  if (col === "replays") {
    const r = data as ReplayDoc;
    return {
      ref, oldUid: r.streamUid, owner: { uid: r.hostUid, username: r.hostUsername }, signed: true, purpose: "replay", shape: "16x10", remark: r.remark,
      swap: async (newUid) => { await ref.update({ streamUid: newUid, marked: true, remark: FieldValue.delete(), remarkPending: FieldValue.delete() }); },
    };
  }
  const p = data as MediaPostDoc;
  return {
    ref, oldUid: p.video!.streamUid, owner: { uid: p.ownerUid, username: p.ownerUsername }, signed: false, purpose: "media", shape: "9x16", remark: p.remark,
    swap: async (newUid, size) => {
      const bytes = Number(size || p.video!.bytes || 0);
      if (p.videoDl?.copyUid) await deps.stream.remove(p.videoDl.copyUid).catch(() => {}); // the v0.134 download copy
      await shiftBytes(ref.firestore, p.ownerUid, bytes - (p.bytes || 0)); // the post counted the copy too: now the one marked video
      const next = { video: { ...p.video!, streamUid: newUid, bytes, marked: true }, marked: true, bytes, updatedAt: new Date().toISOString() };
      await ref.update({ ...next, remark: FieldValue.delete(), remarkPending: FieldValue.delete(), videoDl: FieldValue.delete(), dlPending: FieldValue.delete(), download: FieldValue.delete(), dlRendering: FieldValue.delete() });
      if (p.allowDownloads) await startDownload(ref.firestore, ref.id, { ...p, ...next, download: undefined }, deps, new Date());
    },
  };
}

// One step of a video's re-marking. "wait": Stream hasn't finished the original yet (nothing started).
export async function stepVideo(db: Firestore, t: VideoTarget, deps: MediaDeps, now: Date): Promise<"pending" | "done" | "failed" | "wait"> {
  const r = t.remark;
  const fail = async (why: string): Promise<"failed"> => {
    if (r?.newUid) await deps.stream.remove(r.newUid).catch(() => {});
    await deps.stream.downloads.disable(t.oldUid).catch(() => {});
    await t.ref.update({ remark: { step: "failed", startedAt: r?.startedAt ?? now.toISOString(), tries: r?.tries ?? 1, why }, remarkPending: FieldValue.delete() });
    return "failed";
  };
  if (!r || r.step === "failed") {
    if (r?.step === "failed" && r.tries >= MAX_TRIES) return "failed";
    const v = await deps.stream.get(t.oldUid);
    if (!v) { await t.ref.update({ remark: { step: "failed", startedAt: now.toISOString(), tries: MAX_TRIES, why: "The video isn't on Cloudflare Stream any more." } }); return "failed"; }
    if (!v.readyToStream) return "wait";
    if (!t.owner.username) return fail("The creator has no @username for the mark.");
    const profileUid = await markProfile(db, t.owner, shapeOf(v.width, v.height, t.shape), deps.stream, now);
    await deps.stream.downloads.enable(t.oldUid);
    await t.ref.update({ remark: { step: "source", startedAt: now.toISOString(), profileUid, tries: (r?.tries ?? 0) + 1 }, remarkPending: true });
    return "pending";
  }
  if (now.getTime() - Date.parse(r.startedAt) > GIVE_UP_MS) return fail("Cloudflare took more than a day. Run the job again to retry.");
  if (r.step === "source") {
    const d = await deps.stream.downloads.status(t.oldUid).catch(() => null);
    if (!d || d.status === "error") return fail("Cloudflare couldn't make an MP4 of the old video to copy.");
    if (d.status !== "ready" || !d.url) return "pending";
    const url = t.signed ? signedDownloadUrl(d.url, t.oldUid, await deps.stream.token(t.oldUid, 6 * 3600)) : d.url;
    const c = await deps.stream.copy({ url, watermarkUid: r.profileUid!, creatorUid: t.owner.uid, name: `marked copy of ${t.ref.path}`, signed: t.signed, purpose: t.purpose });
    await t.ref.update({ remark: { ...r, step: "copying", newUid: c.uid } });
    return "pending";
  }
  const v = await deps.stream.get(r.newUid!).catch(() => null);
  if (!v || v.state === "error") return fail("Cloudflare couldn't add the mark to the copy.");
  if (!v.readyToStream) return "pending";
  await t.swap(r.newUid!, v.size);
  await deps.stream.remove(t.oldUid); // the unmarked video (and its MP4) goes
  return "done";
}

async function startVideo(db: Firestore, col: "mediaPosts" | "replays", ref: DocumentReference, data: FirebaseFirestore.DocumentData, kind: BackfillKind, s: BackfillState, deps: MediaDeps, now: Date) {
  const out = await stepVideo(db, target(col, ref, data, deps), deps, now);
  if (out === "pending") s.counts[kind].pending++;
  else if (out === "wait") s.counts[kind].skipped++;
  else s.counts[kind][out]++;
}

// ── Each kind ──
async function mediaPost(db: Firestore, ref: DocumentReference, s: BackfillState, deps: MediaDeps, now: Date) {
  const p = (await ref.get()).data() as MediaPostDoc;
  if (p.kind === "video") {
    if (isMarked(p)) return void s.counts.mediaVideos.already++;
    if (p.status !== "ready" || !p.video) return void s.counts.mediaVideos.skipped++;
    if (p.remarkPending) return; // already on its way (advanceVideos counts it)
    return startVideo(db, "mediaPosts", ref, p, "mediaVideos", s, deps, now);
  }
  if (p.marked === true) return void s.counts.mediaPictures.already++;
  if (p.status !== "ready") return void s.counts.mediaPictures.skipped++; // a new post being marked by its own upload, or rejected
  const pics: MediaPicture[] = [...(p.pictures ?? [])];
  let failed = false;
  for (let i = 0; i < pics.length; i++) {
    if (pics[i].marked === true && !pics[i].cleanKey) continue;
    const o = await markKey(db, pics[i].key, { uid: p.ownerUid, username: p.ownerUsername }, "media", deps, now);
    if (o.result === "missing" || o.result === "failed") { failed = true; continue; }
    pics[i] = { key: o.key, bytes: o.bytes ?? pics[i].bytes, marked: true };
    await ref.update({ pictures: pics });
  }
  if (failed) throw new Error("a picture couldn't be read or marked");
  const bytes = pics.reduce((n, x) => n + x.bytes, 0);
  await shiftBytes(db, p.ownerUid, bytes - (p.bytes || 0));
  await ref.update({ pictures: pics, marked: true, bytes, updatedAt: now.toISOString() });
  s.counts.mediaPictures.done++;
}

async function replay(db: Firestore, ref: DocumentReference, s: BackfillState, deps: MediaDeps, now: Date) {
  const r = (await ref.get()).data() as ReplayDoc;
  if (r.marked) return void s.counts.replays.already++;
  if (r.kind !== "video" || r.status !== "ready" || !r.streamUid) return void s.counts.replays.skipped++; // an audio replay has no picture
  if (r.remarkPending) return;
  return startVideo(db, "replays", ref, r, "replays", s, deps, now);
}

const users = new Map<string, string>();
async function usernameOf(db: Firestore, uid: string): Promise<string> {
  if (!users.has(uid)) users.set(uid, String((await db.doc(`users/${uid}`).get()).data()?.username ?? ""));
  return users.get(uid)!;
}
// The addresses of one item, marked: the new addresses by old, and the outcome for the item's count.
async function markAll(db: Firestore, urls: string[], owner: { uid: string; username: string }, kind: string, deps: PictureStore, now: Date) {
  const map = new Map<string, string>();
  let marked = 0, already = 0, external = 0, failed = 0;
  for (const u of Array.from(new Set(urls.filter(Boolean)))) {
    const o = await markUrl(db, u, owner, kind, deps, now);
    if (o.url !== u) map.set(u, o.url);
    if (o.result === "marked") marked++; else if (o.result === "already") already++; else if (o.result === "external") external++; else failed++;
  }
  const result: "done" | "already" | "external" | "failed" | "skipped" = failed ? "failed" : marked || map.size ? "done" : already ? "already" : external ? "external" : "skipped";
  return { map, result };
}
const swapIn = (v: string, map: Map<string, string>) => map.get(v) ?? v;

async function storeItem(db: Firestore, ref: DocumentReference, s: BackfillState, deps: MediaDeps, now: Date) {
  const d = (await ref.get()).data() ?? {};
  const uid = String(d.ownerUid ?? "");
  const username = uid ? await usernameOf(db, uid) : "";
  const urls = [String(d.image ?? ""), ...((d.images as string[] | undefined) ?? [])];
  if (!username) return void s.counts.shopItems.skipped++; // NotesApp's own catalogue items have no owner account
  const { map, result } = await markAll(db, urls, { uid, username }, "shop", deps, now);
  if (map.size) {
    await ref.update({ ...(d.image ? { image: swapIn(String(d.image), map) } : {}), ...(Array.isArray(d.images) ? { images: (d.images as string[]).map((u) => swapIn(u, map)) } : {}) });
  }
  s.counts.shopItems[result]++;
}

async function siteServices(db: Firestore, ref: DocumentReference, s: BackfillState, deps: MediaDeps, now: Date) {
  const d = (await ref.get()).data() ?? {};
  const items = (d.blocks?.services?.items as { image?: string }[] | undefined) ?? [];
  const urls = items.map((x) => String(x.image ?? "")).filter(Boolean);
  if (!urls.length) return; // no service pictures: not counted
  const uid = ref.id, username = await usernameOf(db, uid);
  if (!username) return void s.counts.services.skipped++;
  const { map, result } = await markAll(db, urls, { uid, username }, "service", deps, now);
  if (map.size) {
    await ref.update({ "blocks.services.items": items.map((x) => (x.image ? { ...x, image: swapIn(x.image, map) } : x)) });
  }
  s.counts.services[result]++;
}

// Our picture addresses in a journal's text (Markdown images and links, or HTML), so each can be swapped for its marked copy.
export function picturesIn(text: string, mediaBase: string): string[] {
  const base = mediaBase.replace(/\/$/, "");
  if (!base || !text.includes(base)) return [];
  const re = new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^\\s)"'<>\\]]+\\.(?:webp|jpe?g|png|gif|avif)`, "gi");
  return Array.from(new Set(text.match(re) ?? []));
}
async function journal(db: Firestore, ref: DocumentReference, s: BackfillState, deps: MediaDeps, now: Date) {
  const n = (await ref.get()).data() ?? {};
  const uid = String(n.authorUid ?? "");
  const content = String(n.content ?? "");
  const urls = [String(n.featured_image ?? ""), ...picturesIn(content, deps.mediaBase)].filter(Boolean);
  if (!urls.length) return; // no pictures: not counted
  // The primary author's @username (an organisation's for its posts). Journals written under an admin-picked name have no account.
  const username = String(n.authorUsername ?? "") || (uid ? await usernameOf(db, uid) : "");
  if (!username) return void s.counts.journals.skipped++;
  const { map, result } = await markAll(db, urls, { uid, username }, "note", deps, now);
  if (map.size) {
    let text = content;
    for (const [a, b] of Array.from(map.entries())) text = text.split(a).join(b);
    await ref.update({ ...(n.featured_image ? { featured_image: swapIn(String(n.featured_image), map) } : {}), ...(text !== content ? { content: text } : {}) });
  }
  s.counts.journals[result]++;
}

// Every member's Media storage, counted again from what they have: their posts' files (once each) and video uploads not yet posted.
async function recountStorage(db: Firestore, s: BackfillState, batch: number): Promise<number> {
  let q = db.collection("mediaUsage").orderBy(FieldPath.documentId()).limit(batch);
  if (s.cursor) q = q.startAfter(s.cursor);
  const snap = await q.get();
  for (const d of snap.docs) {
    const uid = d.id;
    const [posts, ups] = await Promise.all([db.collection("mediaPosts").where("ownerUid", "==", uid).get(), db.collection("mediaUploads").where("uid", "==", uid).get()]);
    const bytes = posts.docs.reduce((n, x) => n + (x.data().status === "rejected" ? 0 : Number(x.data().bytes ?? 0)), 0)
      + ups.docs.reduce((n, x) => n + (x.data().used === true ? 0 : Number(x.data().size ?? 0)), 0);
    await d.ref.set({ bytes }, { merge: true });
    s.recounted++;
    s.cursor = uid;
  }
  return snap.size;
}
