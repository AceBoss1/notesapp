import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  VIDEO_DL_NOT_SET_UP, VIDEO_DL_STORAGE, cleanWatermarkOverrides, nextDlStep, streamWatermarkParams, watermarkProfileKey, watermarkSettings,
  type VideoDl, type WatermarkSettings,
} from "./media-video-dl";
import type { MediaPostDoc } from "./media-rules";

// Server side of watermarked video downloads (lib/media-video-dl.ts has the rules). A video whose creator switches downloads on gets a
// second Stream copy with the creator's see-through mark burned in, and MP4 downloads only on that copy. The steps run when the studio
// opens, when someone opens the download, and from the cron (lib/media-server.ts sweepProcessingVideos), so nothing waits on a webhook.
// Collections (server-only in firestore.rules): mediaPosts/{id}.videoDl and .dlPending, mediaWatermarks/{uid} (the creator's profile),
// serverConfig/mediaWatermark (the look, from Admin → Limits).

export class VideoDlError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type VideoDlDeps = {
  enable: (uid: string) => Promise<{ status: "inprogress" | "ready" | "error"; url: string }>;
  status: (uid: string) => Promise<{ status: "inprogress" | "ready" | "error"; url: string } | null>;
  disable: (uid: string) => Promise<void>;
  copy: (o: { url: string; watermarkUid: string; creatorUid: string; name: string }) => Promise<{ uid: string }>;
  get: (uid: string) => Promise<{ readyToStream: boolean; state?: string; size?: number } | null>;
  remove: (uid: string) => Promise<void>;
  watermark: (o: { png: Buffer; name: string; opacity: number; padding: number; scale: number; position: string }) => Promise<{ uid: string }>;
  dropWatermark: (uid: string) => Promise<void>;
  mark: (username: string) => Promise<Buffer>; // the transparent PNG (lib/media-watermark.tsx renderVideoMark)
  token: (uid: string, seconds: number) => Promise<string>;
};

// ── The look (Admin → Limits → Video download watermark): serverConfig/mediaWatermark through a 30-second cache ──
const TTL_MS = 30_000;
let cache: { at: number; data: WatermarkSettings } | null = null;
export async function getWatermarkSettings(db: Firestore, now = Date.now()): Promise<WatermarkSettings> {
  if (cache && now - cache.at < TTL_MS) return cache.data;
  const data = watermarkSettings(cleanWatermarkOverrides((await db.doc("serverConfig/mediaWatermark").get()).data()?.overrides));
  cache = { at: now, data };
  return data;
}
export async function saveWatermarkSettings(db: Firestore, input: unknown, adminUid: string, now = new Date()): Promise<WatermarkSettings> {
  const overrides = cleanWatermarkOverrides(input);
  await db.doc("serverConfig/mediaWatermark").set({ overrides, updatedAt: now.toISOString(), updatedBy: adminUid });
  cache = { at: now.getTime(), data: watermarkSettings(overrides) };
  return cache.data;
}
export const resetWatermarkCache = () => { cache = null; };

// The creator's watermark profile: made once from their @username and the look in force, made again when either changes. An old profile
// is deleted from Stream (copies already made keep their mark: it is burned in).
export async function watermarkProfile(db: Firestore, owner: { uid: string; username: string }, deps: VideoDlDeps): Promise<string> {
  const s = await getWatermarkSettings(db);
  const key = watermarkProfileKey(owner.username, s);
  const ref = db.doc(`mediaWatermarks/${owner.uid}`);
  const cur = (await ref.get()).data();
  if (cur?.key === key && cur.profileUid) return String(cur.profileUid);
  const png = await deps.mark(owner.username);
  const made = await deps.watermark({ png, name: `NotesApp @${owner.username}`, ...streamWatermarkParams(s) });
  await ref.set({ uid: owner.uid, profileUid: made.uid, key, createdAt: new Date().toISOString() });
  if (cur?.profileUid) await deps.dropWatermark(String(cur.profileUid)).catch(() => {});
  return made.uid;
}

// Bytes in the creator's Media storage (mediaUsage/{uid}.bytes, the same counter posts use). Adding can be refused when storage is full.
async function addBytes(db: Firestore, uid: string, bytes: number, limitBytes: number | null): Promise<void> {
  const ref = db.doc(`mediaUsage/${uid}`);
  await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data() ?? {};
    const used = Number(d.bytes ?? 0);
    if (bytes > 0 && limitBytes !== null && used + bytes > limitBytes) throw new VideoDlError(413, VIDEO_DL_STORAGE);
    t.set(ref, { uid, bytes: Math.max(0, used + bytes) }, { merge: true });
  });
}

// Downloads switched on (for a ready video): checks there is room, takes the bytes, and asks Stream for the original's MP4, which the
// watermarked copy is made from. The post's own `bytes` include the copy's, so deleting the post frees both.
export async function startVideoDl(db: Firestore, id: string, owner: { uid: string; username: string }, limitBytes: number | null, deps: VideoDlDeps | undefined, now = new Date()): Promise<VideoDl> {
  if (!deps) throw new VideoDlError(503, VIDEO_DL_NOT_SET_UP);
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p?.video || p.status !== "ready") throw new VideoDlError(409, "The video isn't ready yet.");
  if (p.videoDl && p.videoDl.state !== "failed") return p.videoDl;
  if (p.videoDl) await stopVideoDl(db, id, deps); // a failed attempt: tidy it, then start again
  const bytes = p.video.bytes || 0;
  await addBytes(db, owner.uid, bytes, limitBytes);
  try {
    const profileUid = await watermarkProfile(db, owner, deps);
    const src = await deps.enable(p.video.streamUid);
    const at = now.toISOString();
    const dl: VideoDl = { state: "source", startedAt: at, updatedAt: at, profileUid, bytes, ...(src.status === "ready" && src.url ? { sourceUrl: src.url } : {}) };
    await ref.update({ videoDl: dl, dlPending: true, bytes: FieldValue.increment(bytes), updatedAt: at });
    return dl;
  } catch (e) {
    await addBytes(db, owner.uid, -bytes, null).catch(() => {});
    throw e;
  }
}

// Downloads switched off, or the post deleted: the copy and any MP4 are removed from Stream and their bytes given back.
export async function stopVideoDl(db: Firestore, id: string, deps: VideoDlDeps | undefined): Promise<void> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  const d = p?.videoDl;
  if (!p || !d) return;
  if (deps) {
    if (p.video && (d.state === "source" || d.state === "copying")) await deps.disable(p.video.streamUid).catch(() => {});
    if (d.copyUid) await deps.remove(d.copyUid).catch(() => {});
  }
  if (d.bytes) await addBytes(db, p.ownerUid, -d.bytes, null).catch(() => {});
  await ref.update({ videoDl: FieldValue.delete(), dlPending: FieldValue.delete(), bytes: FieldValue.increment(-(d.bytes || 0)) });
}

// One step forward, from what Stream says now. Returns the copy's state after the step (undefined when there is none).
export async function stepVideoDl(db: Firestore, id: string, deps: VideoDlDeps | undefined, now = new Date()): Promise<VideoDl | undefined> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  const d = p?.videoDl;
  if (!p?.video || !d || !deps || d.state === "ready" || d.state === "failed") return d;
  const facts = {
    now: now.getTime(),
    ...(d.state === "source" ? { sourceDownload: await deps.status(p.video.streamUid).catch(() => null) } : {}),
    ...(d.copyUid ? { copy: await deps.get(d.copyUid).catch(() => null) } : {}),
    ...(d.state === "rendering" && d.copyUid ? { copyDownload: await deps.status(d.copyUid).catch(() => null) } : {}),
  };
  const act = nextDlStep(d, facts);
  const at = now.toISOString();
  let next: VideoDl = d;
  if (act.do === "wait") return d;
  if (act.do === "copy") {
    try {
      const c = await deps.copy({ url: act.url, watermarkUid: d.profileUid, creatorUid: p.ownerUid, name: `download of media ${id}` });
      next = { ...d, state: "copying", copyUid: c.uid, sourceUrl: act.url, updatedAt: at };
    } catch {
      return failDl(db, id, p, d, "Cloudflare couldn't start the watermarked copy. Switch downloads off and on to try again.", deps, at);
    }
  } else if (act.do === "render") {
    await deps.disable(p.video.streamUid).catch(() => {}); // the original's MP4 was only needed to make the copy
    const r = await deps.enable(d.copyUid!).catch(() => null);
    if (!r || r.status === "error") return failDl(db, id, p, d, "Cloudflare couldn't make the download file. Switch downloads off and on to try again.", deps, at);
    next = r.status === "ready" && r.url ? { ...d, state: "ready", url: r.url, updatedAt: at } : { ...d, state: "rendering", updatedAt: at };
    if (next.state === "ready" || next.state === "rendering") delete next.sourceUrl;
  } else if (act.do === "ready") {
    next = { ...d, state: "ready", url: act.url, updatedAt: at };
    delete next.sourceUrl;
    // The copy's real size, once Stream knows it: the storage counter follows it.
    if (act.bytes && act.bytes !== d.bytes) {
      await addBytes(db, p.ownerUid, act.bytes - d.bytes, null).catch(() => {});
      await ref.update({ bytes: FieldValue.increment(act.bytes - d.bytes) });
      next.bytes = act.bytes;
    }
  } else {
    return failDl(db, id, p, d, act.why, deps, at);
  }
  await ref.update({ videoDl: next, dlPending: next.state !== "ready" && next.state !== "failed" ? true : FieldValue.delete() });
  return next;
}

// A copy that couldn't be made: whatever Stream has of it is removed and its bytes go back (a failed copy takes no room). The creator sees
// why, and switching downloads off and on tries again.
async function failDl(db: Firestore, id: string, p: MediaPostDoc, d: VideoDl, why: string, deps: VideoDlDeps, at: string): Promise<VideoDl> {
  if (p.video) await deps.disable(p.video.streamUid).catch(() => {});
  if (d.copyUid) await deps.remove(d.copyUid).catch(() => {});
  if (d.bytes) await addBytes(db, p.ownerUid, -d.bytes, null).catch(() => {});
  const next: VideoDl = { state: "failed", startedAt: d.startedAt, updatedAt: at, profileUid: d.profileUid, bytes: 0, why };
  await db.doc(`mediaPosts/${id}`).update({ videoDl: next, dlPending: FieldValue.delete(), bytes: FieldValue.increment(-(d.bytes || 0)) });
  return next;
}

// The posts with a copy on its way, for the cron.
export async function sweepVideoDls(db: Firestore, deps: VideoDlDeps | undefined, now = new Date(), batch = 50): Promise<number> {
  if (!deps) return 0;
  const s = await db.collection("mediaPosts").where("dlPending", "==", true).limit(batch).get();
  for (const d of s.docs) await stepVideoDl(db, d.id, deps, now).catch((e) => console.error("[media] video download step failed", d.id, e));
  return s.size;
}
