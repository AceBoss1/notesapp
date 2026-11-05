import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import {
  DOWNLOADS_OFF, GB, MEDIA_CAPTION_MAX, MEDIA_PICTURES_MAX, MEDIA_PICTURE_MAX_BYTES, MEDIA_PINNED_MAX, MEDIA_SOUND, TEEN_DOWNLOAD_BLOCKED,
  allowedSwitches, cleanMediaSettings, isMediaAudience, isMediaKind, isOwnMediaKey, mediaPageVisible, mediaVisible, sitePicturesOf, sniffPicture,
  streamPlayer, streamPoster,
  type MediaAudience, type MediaPicture, type MediaPostDoc, type MediaPostView, type MediaSettings, type Relation, type ReplayTile, type SitePicture,
} from "./media-rules";
import { STREAM_MAX_BYTES } from "./stream-config";
import { isoWeekKey } from "./video-rules";
import { limit } from "./limits-server";
import { limitDef } from "./limits";
import { effectiveTier, type AccountTier } from "./users";
import { isAutoFollowed } from "./journals-directory";
import { MENTION_BLOCKED, hearsOnlyFromFollowed, mayReach } from "./young";
import { mentionedUsernames } from "./mentions-server";
import { isPictureUrl } from "./profile-pictures";
import { listPinnedMoments, type MomentDeps, type MomentView } from "./moments-server";
import { replaysFor } from "./media-replays";
import {
  DOWNLOAD_GIVE_UP_MS, NOT_MARKED_YET, VIDEO_DL_NOT_SET_UP, VIDEO_DL_PREPARING, downloadView, shapeOf, videoDownloadName, withFilename,
  type VideoDownload, type WatermarkSettings,
} from "./media-mark";
import { getWatermarkSettings, markProfile, type MarkProfileDeps } from "./media-mark-server";

// Server side of Media (phase M1; lib/media-rules.ts has the rules, docs/MEDIA.md the plan). Clients never read or write mediaPosts,
// mediaUploads, mediaUsage or mediaSettings (firestore.rules say no): every read comes through here, so the audience, teen mode and blocks
// can't be skipped. Everything takes its outside services (the bucket, Cloudflare Stream) as arguments, so it can be tested.
export class MediaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type StreamDownload = { status: "inprogress" | "ready" | "error"; url: string };
export type StreamDeps = MarkProfileDeps & {
  configured: boolean;
  // A one-time address the browser sends the video to. Public playback (Media is public), and Stream itself refuses anything longer.
  // watermarkUid: the creator's watermark profile, burned in as the video arrives (lib/media-mark.ts).
  create: (creatorUid: string, maxSeconds: number, name: string, watermarkUid: string) => Promise<{ uploadURL: string; uid: string }>;
  get: (uid: string) => Promise<{ readyToStream: boolean; duration?: number; size?: number; state?: string; width?: number; height?: number } | null>;
  remove: (uid: string) => Promise<void>;
  // MP4 downloads of a video (POST/GET/DELETE /stream/{uid}/downloads).
  downloads: { enable: (uid: string) => Promise<StreamDownload>; status: (uid: string) => Promise<StreamDownload | null>; disable: (uid: string) => Promise<void> };
  // A copy of a video from a link with a watermark profile (the re-marking of older videos), and a token for a signed video's MP4.
  copy: (o: { url: string; watermarkUid: string; creatorUid: string; name: string; signed: boolean; purpose: string }) => Promise<{ uid: string }>;
  token: (uid: string, seconds: number) => Promise<string>;
};
export type MarkedFile = { bytes: Buffer; type: string; ext: string };
export type MediaDeps = {
  publicUrl: (key: string) => string;
  head: (key: string) => Promise<{ size: number } | null>;
  readStart: (key: string) => Promise<Uint8Array>;
  read: (key: string) => Promise<Buffer>;
  write: (key: string, bytes: Buffer, type: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  // Draws the NotesApp mark into a picture (lib/media-watermark.tsx markPicture).
  markPicture: (bytes: Buffer, username: string, s: WatermarkSettings) => Promise<MarkedFile>;
  stream: StreamDeps;
  mediaBase: string; // NEXT_PUBLIC_R2_PUBLIC_URL: profile pictures are only ever our own uploads
};

type Person = { uid: string; username: string };
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

// ── Plan limits and usage ───────────────────────────────────────────────────────────────────────────────────────────────────────
// mediaUsage/{uid}: { week, videos, day, picturePosts, bytes }. One document, changed in transactions, so two uploads at once can't both
// take the last slot. A new week or day starts its counter from nothing.
export type MediaQuota = {
  videos: { limit: number; used: number }; picturePosts: { limit: number; used: number };
  storage: { limitBytes: number; usedBytes: number }; maxVideoSeconds: number; week: string; day: string;
};
export async function mediaQuota(db: Firestore, uid: string, tier: AccountTier, now = new Date()): Promise<MediaQuota> {
  const [u, videos, pics, gb, maxSec] = await Promise.all([
    db.doc(`mediaUsage/${uid}`).get(), limit(db, "mediaVideosPerWeek", tier), limit(db, "mediaPicturePostsPerDay", tier), limit(db, "mediaStorageGB", tier), limit(db, "mediaVideoMaxSeconds", tier),
  ]);
  const d = u.data() ?? {};
  const week = isoWeekKey(now), day = dayKey(now);
  return {
    videos: { limit: videos, used: d.week === week ? Number(d.videos ?? 0) : 0 },
    picturePosts: { limit: pics, used: d.day === day ? Number(d.picturePosts ?? 0) : 0 },
    storage: { limitBytes: gb === 0 && limitDef("mediaStorageGB").noLimitAt0 ? Infinity : gb * GB, usedBytes: Number(d.bytes ?? 0) },
    maxVideoSeconds: maxSec, week, day,
  };
}

// Takes a slot (a video this week, or a picture post today) and the bytes, or says why not.
async function reserve(db: Firestore, uid: string, q: MediaQuota, what: "video" | "pictures", bytes: number): Promise<void> {
  const ref = db.doc(`mediaUsage/${uid}`);
  await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data() ?? {};
    const videos = d.week === q.week ? Number(d.videos ?? 0) : 0;
    const pics = d.day === q.day ? Number(d.picturePosts ?? 0) : 0;
    const used = Number(d.bytes ?? 0);
    if (what === "video" && videos >= q.videos.limit) {
      throw new MediaError(429, q.videos.limit === 0 ? "Media videos come with a paid plan. Pictures are free to post." : `You've posted your ${q.videos.limit} Media video${q.videos.limit === 1 ? "" : "s"} for this week. It resets on Monday, or move up a plan for more.`);
    }
    if (what === "pictures" && pics >= q.picturePosts.limit) {
      throw new MediaError(429, q.picturePosts.limit === 0 ? "Your plan can't post pictures to Media." : `You've posted ${q.picturePosts.limit} picture post${q.picturePosts.limit === 1 ? "" : "s"} today. Try again tomorrow, or move up a plan for more.`);
    }
    if (used + bytes > q.storage.limitBytes) throw new MediaError(413, "Your Media storage is full. Delete some posts, or move up a plan for more room.");
    t.set(ref, {
      uid, week: q.week, day: q.day, bytes: used + bytes,
      videos: videos + (what === "video" ? 1 : 0), picturePosts: pics + (what === "pictures" ? 1 : 0),
    }, { merge: true });
  });
}

// A rejected upload gives its slot back (if it is still the same week) and its bytes.
async function giveBack(db: Firestore, uid: string, week: string | null, bytes: number): Promise<void> {
  const ref = db.doc(`mediaUsage/${uid}`);
  await db.runTransaction(async (t) => {
    const d = (await t.get(ref)).data();
    if (!d) return;
    const patch: Record<string, number> = { bytes: Math.max(0, Number(d.bytes ?? 0) - bytes) };
    if (week && d.week === week) patch.videos = Math.max(0, Number(d.videos ?? 0) - 1);
    t.update(ref, patch);
  });
}
const freeBytes = (db: Firestore, uid: string, bytes: number) => giveBack(db, uid, null, bytes);
// A file's size changed (a picture once marked, a video once Stream knows it): the storage counter follows.
export const shiftBytes = (db: Firestore, uid: string, delta: number) =>
  delta ? db.doc(`mediaUsage/${uid}`).set({ uid, bytes: FieldValue.increment(delta) }, { merge: true }).catch(() => {}) : Promise.resolve();

// ── Who is looking ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function relationOf(db: Firestore, viewer: Person | null, owner: Person, now = new Date()): Promise<Relation> {
  if (!viewer) return { signedIn: false, self: false, viewerFollows: false, followsViewer: false, subscribed: false, blocked: false };
  if (viewer.uid === owner.uid) return { signedIn: true, self: true, viewerFollows: true, followsViewer: true, subscribed: true, blocked: false };
  const [a, b, f1, f2, sub] = await db.getAll(
    db.doc(`dmBlocks/${owner.uid}_${viewer.uid}`), db.doc(`dmBlocks/${viewer.uid}_${owner.uid}`),
    db.doc(`follows/${viewer.uid}_${owner.username}`), db.doc(`follows/${owner.uid}_${viewer.username || "-"}`),
    db.doc(`subscriptions/${viewer.uid}_${owner.username}`),
  );
  const s = sub.data();
  const subscribed = !!s && (s.status === "demo" || (!!s.currentPeriodEnd && new Date(String(s.currentPeriodEnd)).getTime() > now.getTime()));
  return { signedIn: true, self: false, blocked: a.exists || b.exists, viewerFollows: f1.exists || isAutoFollowed(owner.username), followsViewer: f2.exists && !!viewer.username, subscribed };
}

// ── Views of a post ────────────────────────────────────────────────────────────────────────────────────────────────────────────
function toView(id: string, p: MediaPostDoc, viewerUid: string | null, deps: Pick<MediaDeps, "publicUrl">): MediaPostView {
  // Never a clean upload: a picture waiting for its mark isn't shown, even to its creator.
  const pictures = (p.pictures ?? []).filter((x) => x.marked !== false).map((x) => deps.publicUrl(x.key));
  const video = p.video ? { streamUid: p.video.streamUid, durationSec: p.video.durationSec, poster: streamPoster(p.video.streamUid), player: streamPlayer(p.video.streamUid) } : undefined;
  const mine = viewerUid === p.ownerUid;
  return {
    id, kind: p.kind, caption: p.caption, sound: p.sound, status: p.status, ...(mine && p.rejectedReason ? { rejectedReason: p.rejectedReason } : {}),
    pictures, ...(video ? { video } : {}), cover: video && p.status === "ready" ? video.poster : pictures[0] ?? "",
    audience: p.audience, allowComments: p.allowComments, allowShares: p.allowShares, allowGifts: p.allowGifts, allowDownloads: p.allowDownloads,
    pinned: p.pinned, createdAt: p.createdAt,
    viewCount: p.viewCount ?? 0, downloadCount: p.downloadCount ?? 0, sharesCount: p.sharesCount ?? 0, commentsCount: p.commentsCount ?? 0, reactionsCount: p.reactionsCount ?? 0, giftsTotal: p.giftsTotal ?? 0,
    mine,
    // The video's download: others only learn it is ready; the creator also sees it being prepared, or why it failed.
    ...(p.download && p.allowDownloads && (mine || p.download.state === "ready") ? { videoDownload: downloadView(p.download) } : {}),
    ...(mine && p.download?.state === "failed" && p.download.why ? { videoDownloadWhy: p.download.why } : {}),
  };
}

// ── Posting ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Teen mode: only people a teen follows can @mention them (the Moments rule, lib/young.ts mayReach).
async function mentionGate(db: Firestore, author: Person, text: string): Promise<void> {
  if (!text.includes("@")) return;
  const names = mentionedUsernames(text).slice(0, 30);
  if (!names.length) return;
  const claims = await db.getAll(...names.map((n) => db.doc(`usernames/${n}`)));
  for (let i = 0; i < names.length; i++) {
    const uid = claims[i].exists ? String(claims[i].data()?.uid ?? "") : "";
    if (!uid || uid === author.uid) continue;
    const u = (await db.doc(`users/${uid}`).get()).data();
    if (!hearsOnlyFromFollowed(u)) continue;
    const followed = (await db.doc(`follows/${uid}_${author.username}`).get()).exists;
    if (!mayReach({ target: u, self: false, targetFollowsThem: followed })) throw new MediaError(403, MENTION_BLOCKED(names[i]));
  }
}

const cleanCaption = (v: unknown) => {
  const s = String(v ?? "").replace(/\r\n/g, "\n").trim();
  if (s.length > MEDIA_CAPTION_MAX) throw new MediaError(413, `Captions can be up to ${MEDIA_CAPTION_MAX.toLocaleString("en-NG")} characters.`);
  return s;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

async function pinnedCount(db: Firestore, uid: string, except?: string): Promise<number> {
  const s = await db.collection("mediaPosts").where("ownerUid", "==", uid).get(); // one field, no index needed
  return s.docs.filter((d) => d.id !== except && d.data().pinned === true).length;
}

// The video's upload address. The plan's weekly videos, longest video and storage are checked first; the slot is taken now and given back
// if the video is rejected (too long, or never arrives).
// The video arrives with the creator's mark burned in by Stream (a watermark profile for the video's frame shape, from the width and
// height the browser read), so Stream never keeps a clean copy.
export async function startMediaVideo(db: Firestore, owner: Person, tier: AccountTier, input: { durationSec: unknown; size: unknown; name?: unknown; width?: unknown; height?: unknown }, deps: MediaDeps, now = new Date()): Promise<{ uploadId: string; uploadURL: string; maxSeconds: number }> {
  if (!owner.username) throw new MediaError(400, "Finish setting up your profile first.");
  if (!deps.stream.configured) throw new MediaError(503, "Media videos aren't switched on yet. Pictures work now.");
  const durationSec = Number(input.durationSec), size = Number(input.size);
  if (!Number.isFinite(durationSec) || durationSec <= 0) throw new MediaError(400, "We couldn't read the video's length.");
  if (!Number.isInteger(size) || size <= 0) throw new MediaError(400, "That file looks empty.");
  if (size > STREAM_MAX_BYTES) throw new MediaError(413, `Videos can be up to ${Math.round(STREAM_MAX_BYTES / 1048576)} MB.`);
  const q = await mediaQuota(db, owner.uid, tier, now);
  if (q.videos.limit > 0 && durationSec > q.maxVideoSeconds + 1) throw new MediaError(413, `Media videos on your plan can be up to ${q.maxVideoSeconds} seconds.`);
  await reserve(db, owner.uid, q, "video", size);
  try {
    const shape = shapeOf(input.width, input.height, "9x16"); // unknown: most Media videos are filmed on a phone
    const profileUid = await markProfile(db, owner, shape, deps.stream, now);
    const up = await deps.stream.create(owner.uid, q.maxVideoSeconds, String(input.name ?? "media video").slice(0, 120), profileUid);
    const uploadId = randomBytes(8).toString("hex");
    await db.doc(`mediaUploads/${uploadId}`).set({
      uid: owner.uid, streamUid: up.uid, durationSec: Math.round(durationSec), size, week: q.week, used: false, marked: true, shape, profileUid,
      createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000), // an upload never posted cleans itself up
    });
    return { uploadId, uploadURL: up.uploadURL, maxSeconds: q.maxVideoSeconds };
  } catch (err) {
    await giveBack(db, owner.uid, q.week, size).catch(() => {});
    throw err;
  }
}

export type CreateInput = {
  kind?: unknown; caption?: unknown; audience?: unknown; pictureKeys?: unknown; videoUploadId?: unknown;
  allowComments?: unknown; allowShares?: unknown; allowGifts?: unknown; allowDownloads?: unknown; pinned?: unknown;
};

export async function createMediaPost(db: Firestore, owner: Person, tier: AccountTier, input: CreateInput, deps: MediaDeps, now = new Date()): Promise<MediaPostView> {
  if (!owner.username) throw new MediaError(400, "Finish setting up your profile first.");
  if (!isMediaKind(input.kind)) throw new MediaError(400, "Choose a video or pictures.");
  const caption = cleanCaption(input.caption);
  await mentionGate(db, owner, caption);
  const audience: MediaAudience = isMediaAudience(input.audience) ? input.audience : "everyone";
  const user = (await db.doc(`users/${owner.uid}`).get()).data();
  const sw = allowedSwitches(user, { allowComments: bool(input.allowComments, true), allowShares: bool(input.allowShares, true), allowGifts: bool(input.allowGifts, true), allowDownloads: bool(input.allowDownloads, false) });
  const pinned = input.pinned === true;
  if (pinned && (await pinnedCount(db, owner.uid)) >= MEDIA_PINNED_MAX) throw new MediaError(409, `You can pin up to ${MEDIA_PINNED_MAX} posts. Unpin one first.`);
  const base = {
    ownerUid: owner.uid, ownerUsername: owner.username, kind: input.kind, caption, sound: MEDIA_SOUND, audience, ...sw,
    pinned, ...(pinned ? { pinnedAt: now.toISOString() } : {}), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    viewCount: 0, downloadCount: 0, sharesCount: 0, commentsCount: 0, reactions: {}, reactionsCount: 0, giftsTotal: 0, giftsCount: 0,
  };
  const ref = db.collection("mediaPosts").doc();

  if (input.kind === "pictures") {
    const keys = Array.isArray(input.pictureKeys) ? input.pictureKeys : [];
    if (!keys.length) throw new MediaError(400, "Add at least one picture.");
    if (keys.length > MEDIA_PICTURES_MAX) throw new MediaError(400, `Up to ${MEDIA_PICTURES_MAX} pictures in one post.`);
    if (new Set(keys).size !== keys.length) throw new MediaError(400, "The same picture is in twice.");
    const pictures: MediaPicture[] = [];
    for (const key of keys) {
      if (!isOwnMediaKey(key, owner.uid)) throw new MediaError(400, "That picture wasn't uploaded for Media.");
      const head = await deps.head(key);
      if (!head) throw new MediaError(409, "A picture hasn't finished uploading yet.");
      if (head.size > MEDIA_PICTURE_MAX_BYTES) throw new MediaError(413, "A picture is too large.");
      if (!sniffPicture(await deps.readStart(key))) throw new MediaError(400, "One of the files isn't a picture.");
      pictures.push({ key, bytes: head.size, marked: false });
    }
    const bytes = pictures.reduce((n, p) => n + p.bytes, 0);
    await reserve(db, owner.uid, await mediaQuota(db, owner.uid, tier, now), "pictures", bytes);
    // Hidden ("processing") until every picture carries the mark and its clean upload is gone; the cron finishes it if this is cut short.
    const doc: MediaPostDoc = { ...base, kind: "pictures", pictures, status: "processing", marked: false, bytes };
    await ref.set(doc);
    const done = await markPicturePost(db, ref.id, deps, now).catch((e) => { console.error("[media] marking failed; the cron tries again", ref.id, e); return null; });
    return toView(ref.id, done ?? doc, owner.uid, deps);
  }

  // A video: the upload this member started (once). It shows to others once Stream has it ready (refreshVideo).
  const uploadId = String(input.videoUploadId ?? "");
  if (!/^[0-9a-f]{16}$/.test(uploadId)) throw new MediaError(400, "Upload the video first.");
  const upRef = db.doc(`mediaUploads/${uploadId}`);
  const doc = await db.runTransaction(async (t) => {
    const up = (await t.get(upRef)).data();
    if (!up || up.uid !== owner.uid) throw new MediaError(404, "That upload wasn't found.");
    if (up.used === true) throw new MediaError(409, "That video is already posted.");
    t.update(upRef, { used: true, postId: ref.id, expireAt: FieldValue.delete() });
    const marked = up.marked === true;
    const d: MediaPostDoc = { ...base, kind: "video", video: { streamUid: String(up.streamUid), durationSec: Number(up.durationSec), bytes: Number(up.size), uploadId, marked }, status: "processing", marked, bytes: Number(up.size) };
    t.set(ref, d);
    return d;
  });
  return toView(ref.id, (await refreshVideo(db, ref.id, deps, now)) ?? doc, owner.uid, deps);
}

// ── The mark on pictures ────────────────────────────────────────────────────────────────────────────────────────────────────────
// The marked file's key, next to the clean upload's (never the same key, so no cache ever holds a clean picture under it).
export function markedKey(key: string, ext: string): string {
  const base = key.replace(/\.[A-Za-z0-9]+$/, "");
  const k = `${base}-na.${ext}`;
  return k === key ? `${base}-na2.${ext}` : k;
}
export class PictureUnreadable extends Error {}
// One picture: read, marked, written under its new key; then the clean file is deleted. Returns the picture as stored now. Safe to run
// again after any step failed: a picture already marked only has its clean file deleted (if that hadn't happened yet).
export async function markOnePicture(x: MediaPicture, username: string, s: WatermarkSettings, deps: Pick<MediaDeps, "read" | "write" | "remove" | "markPicture">, save: (next: MediaPicture) => Promise<void>): Promise<MediaPicture> {
  if (x.marked === true) {
    if (x.cleanKey) { await deps.remove(x.cleanKey); const next = { key: x.key, bytes: x.bytes, marked: true }; await save(next); return next; }
    return x;
  }
  const src = await deps.read(x.key);
  let out: MarkedFile;
  try { out = await deps.markPicture(src, username, s); } catch (e) { throw new PictureUnreadable(e instanceof Error ? e.message : "unreadable"); }
  const key = markedKey(x.key, out.ext);
  await deps.write(key, out.bytes, out.type);
  const withClean: MediaPicture = { key, bytes: out.bytes.length, marked: true, cleanKey: x.key };
  await save(withClean); // the marked file is the post's before the clean one goes
  await deps.remove(x.key);
  const next: MediaPicture = { key, bytes: out.bytes.length, marked: true };
  await save(next);
  return next;
}

// A picture post waiting for its mark: each picture marked in turn, then the post is shown. A file we can't read as a picture rejects
// the post (its files removed, its bytes given back); anything else is tried again by the cron, and given up after a day.
export async function markPicturePost(db: Firestore, id: string, deps: MediaDeps, now = new Date()): Promise<MediaPostDoc | null> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p || p.kind !== "pictures" || p.status !== "processing") return p ?? null;
  const s = await getWatermarkSettings(db, now.getTime());
  const pics = [...(p.pictures ?? [])];
  const reject = async (why: string): Promise<MediaPostDoc> => {
    for (const x of pics) { await deps.remove(x.key).catch(() => {}); if (x.cleanKey) await deps.remove(x.cleanKey).catch(() => {}); }
    await freeBytes(db, p.ownerUid, p.bytes);
    const patch = { status: "rejected" as const, rejectedReason: why, bytes: 0, pictures: pics.map((x) => ({ key: x.key, bytes: 0, marked: false })), updatedAt: now.toISOString() };
    await ref.update(patch);
    return { ...p, ...patch };
  };
  try {
    for (let i = 0; i < pics.length; i++) {
      pics[i] = await markOnePicture(pics[i], p.ownerUsername, s, deps, async (next) => { pics[i] = next; await ref.update({ pictures: pics }); });
    }
  } catch (e) {
    if (e instanceof PictureUnreadable) return reject("One of the files couldn't be read as a picture. Try saving it as a JPEG or WebP and posting again.");
    if (now.getTime() - Date.parse(p.createdAt) > 86_400_000) return reject("We couldn't finish adding the NotesApp mark to these pictures. Please post them again.");
    throw e;
  }
  const bytes = pics.reduce((n, x) => n + x.bytes, 0);
  const patch = { pictures: pics, status: "ready" as const, marked: true, bytes, updatedAt: now.toISOString() };
  await shiftBytes(db, p.ownerUid, bytes - p.bytes);
  await ref.update(patch);
  return { ...p, ...patch };
}

// A video post still processing: asks Stream. Ready → shown; too long, failed, or never arrived after a day → rejected, its slot and bytes
// given back, and the file removed. Returns the post as it is now (null if missing).
export async function refreshVideo(db: Firestore, id: string, deps: MediaDeps, now = new Date()): Promise<MediaPostDoc | null> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p || p.kind !== "video" || p.status !== "processing" || !p.video) return p ?? null;
  const v = await deps.stream.get(p.video.streamUid).catch(() => null);
  const up = (await db.doc(`mediaUploads/${p.video.uploadId}`).get()).data();
  const reject = async (why: string): Promise<MediaPostDoc> => {
    await deps.stream.remove(p.video!.streamUid).catch(() => {});
    await giveBack(db, p.ownerUid, String(up?.week ?? ""), p.bytes);
    const patch = { status: "rejected" as const, rejectedReason: why, bytes: 0, updatedAt: now.toISOString() };
    await ref.update(patch);
    return { ...p, ...patch };
  };
  const ageMs = now.getTime() - new Date(p.createdAt).getTime();
  if (!v) return ageMs > 86_400_000 ? reject("The video never finished uploading. Your slot for this week is back.") : p;
  if (v.state === "error") return reject("Cloudflare couldn't process this video. Try exporting it as MP4 and posting again; your slot is back.");
  if (!v.readyToStream) return p;
  const user = (await db.doc(`users/${p.ownerUid}`).get()).data();
  const max = await limit(db, "mediaVideoMaxSeconds", effectiveTier({ username: String(user?.username ?? ""), role: user?.role ?? "reader", accountTier: user?.accountTier ?? "standard" }));
  const duration = Number(v.duration ?? p.video.durationSec);
  if (duration > max + 1) return reject(`The video is longer than your plan's ${max} seconds. Your slot is back.`);
  const bytes = Number(v.size ?? p.bytes);
  const patch = { status: "ready" as const, video: { ...p.video, durationSec: Math.round(duration), bytes }, bytes, updatedAt: now.toISOString() };
  if (bytes !== p.bytes) await db.doc(`mediaUsage/${p.ownerUid}`).update({ bytes: FieldValue.increment(bytes - p.bytes) }).catch(() => {});
  await ref.update(patch);
  // Downloads were switched on while it processed: Stream makes the MP4 of the (marked) video now.
  const next = { ...p, ...patch };
  if (p.allowDownloads && isMarked(next)) return (await startDownload(db, id, next, deps, now)) ?? next;
  return next;
}

// ── Downloads: the stored file is already marked, so a download is that file ──────────────────────────────────────────────────────
export const isMarked = (p: MediaPostDoc) => p.marked === true || p.video?.marked === true;
// A video's MP4 (Stream makes it from the marked video, so it carries the mark). No second copy and nothing more in storage.
export async function startDownload(db: Firestore, id: string, p: MediaPostDoc, deps: Pick<MediaDeps, "stream">, now: Date): Promise<MediaPostDoc> {
  if (!p.video) return p;
  const at = now.toISOString();
  let dl: VideoDownload;
  try {
    const r = await deps.stream.downloads.enable(p.video.streamUid);
    dl = r.status === "ready" && r.url ? { state: "ready", url: r.url, startedAt: at, updatedAt: at } : r.status === "error" ? { state: "failed", why: "Cloudflare couldn't make the download file. Switch downloads off and on to try again.", startedAt: at, updatedAt: at } : { state: "rendering", startedAt: at, updatedAt: at };
  } catch {
    dl = { state: "failed", why: "Cloudflare couldn't start the download file. Switch downloads off and on to try again.", startedAt: at, updatedAt: at };
  }
  await db.doc(`mediaPosts/${id}`).update({ download: dl, dlRendering: dl.state === "rendering" ? true : FieldValue.delete() });
  return { ...p, download: dl, dlRendering: dl.state === "rendering" ? true : undefined };
}
async function stopDownload(db: Firestore, id: string, p: MediaPostDoc, deps: Pick<MediaDeps, "stream">): Promise<void> {
  if (p.video && p.download) await deps.stream.downloads.disable(p.video.streamUid).catch(() => {});
  await db.doc(`mediaPosts/${id}`).update({ download: FieldValue.delete(), dlRendering: FieldValue.delete() });
}
// The MP4 being made: asks Stream once. Returns the download as it is now.
export async function stepDownload(db: Firestore, id: string, deps: Pick<MediaDeps, "stream">, now = new Date()): Promise<VideoDownload | undefined> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  const d = p?.download;
  if (!p?.video || !d || d.state !== "rendering") return d;
  const r = await deps.stream.downloads.status(p.video.streamUid).catch(() => null);
  const at = now.toISOString();
  let next: VideoDownload = d;
  if (r?.status === "ready" && r.url) next = { ...d, state: "ready", url: r.url, updatedAt: at };
  else if (!r || r.status === "error" || now.getTime() - Date.parse(d.startedAt) > DOWNLOAD_GIVE_UP_MS) next = { ...d, state: "failed", why: "Cloudflare couldn't make the download file. Switch downloads off and on to try again.", updatedAt: at };
  if (next === d) return d;
  await ref.update({ download: next, dlRendering: FieldValue.delete() });
  return next;
}

// Run by the scheduler: posts still processing (pictures waiting for their mark, videos Stream hasn't finished), oldest first, and the
// video downloads being made.
export async function sweepProcessingVideos(db: Firestore, deps: MediaDeps, now = new Date(), batch = 50): Promise<number> {
  const s = await db.collection("mediaPosts").where("status", "==", "processing").limit(batch).get();
  for (const d of s.docs) {
    if (d.data().kind === "pictures") await markPicturePost(db, d.id, deps, now).catch((e) => console.error("[media] marking failed", d.id, e));
    else await refreshVideo(db, d.id, deps, now);
  }
  const r = await db.collection("mediaPosts").where("dlRendering", "==", true).limit(batch).get();
  for (const d of r.docs) await stepDownload(db, d.id, deps, now).catch(() => {});
  return s.size + r.size;
}

export type UpdateInput = { caption?: unknown; audience?: unknown; allowComments?: unknown; allowShares?: unknown; allowGifts?: unknown; allowDownloads?: unknown; pinned?: unknown };
export async function updateMediaPost(db: Firestore, owner: Person, id: string, input: UpdateInput, deps: Pick<MediaDeps, "publicUrl" | "stream">, now = new Date()): Promise<MediaPostView> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p || p.ownerUid !== owner.uid) throw new MediaError(404, "That post wasn't found.");
  const patch: Partial<MediaPostDoc> & Record<string, unknown> = { updatedAt: now.toISOString() };
  if (input.caption !== undefined) { patch.caption = cleanCaption(input.caption); await mentionGate(db, owner, patch.caption); }
  if (input.audience !== undefined) {
    if (!isMediaAudience(input.audience)) throw new MediaError(400, "Choose who can see it.");
    patch.audience = input.audience;
  }
  const user = (await db.doc(`users/${owner.uid}`).get()).data();
  Object.assign(patch, allowedSwitches(user, {
    allowComments: bool(input.allowComments, p.allowComments), allowShares: bool(input.allowShares, p.allowShares),
    allowGifts: bool(input.allowGifts, p.allowGifts), allowDownloads: bool(input.allowDownloads, p.allowDownloads),
  }));
  if (typeof input.pinned === "boolean" && input.pinned !== p.pinned) {
    if (input.pinned && (await pinnedCount(db, owner.uid, id)) >= MEDIA_PINNED_MAX) throw new MediaError(409, `You can pin up to ${MEDIA_PINNED_MAX} posts. Unpin one first.`);
    patch.pinned = input.pinned;
    patch.pinnedAt = input.pinned ? now.toISOString() : (FieldValue.delete() as unknown as string);
  }
  await ref.update(patch);
  let next = { ...p, ...patch, pinnedAt: patch.pinned === false ? undefined : (patch.pinnedAt ?? p.pinnedAt) } as MediaPostDoc;
  // A video's downloads: on asks Stream for the MP4 of the marked video (once it is ready and marked: refreshVideo and the re-marking
  // job start it otherwise); off removes the MP4.
  if (p.kind === "video" && patch.allowDownloads !== p.allowDownloads) {
    if (patch.allowDownloads && p.status === "ready" && isMarked(p)) next = await startDownload(db, id, next, deps, now);
    else if (!patch.allowDownloads) { await stopDownload(db, id, p, deps); next = { ...next, download: undefined, dlRendering: undefined }; }
  }
  return toView(id, next, owner.uid, deps);
}

export async function deleteMediaPost(db: Firestore, uid: string, id: string, deps: MediaDeps): Promise<void> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p || p.ownerUid !== uid) throw new MediaError(404, "That post wasn't found.");
  for (const x of p.pictures ?? []) { await deps.remove(x.key).catch(() => {}); if (x.cleanKey) await deps.remove(x.cleanKey).catch(() => {}); }
  if (p.video) await deps.stream.remove(p.video.streamUid).catch(() => {}); // its MP4 goes with it
  if (p.videoDl?.copyUid) await deps.stream.remove(p.videoDl.copyUid).catch(() => {}); // a v0.134 download copy not yet removed
  if (p.bytes) await freeBytes(db, uid, p.bytes);
  await db.recursiveDelete(ref);
}

// Counts each signed-in member once; the owner's own views don't count. (M2's feed adds watch time and completion.)
export async function viewMediaPost(db: Firestore, viewer: Person | null, id: string): Promise<void> {
  if (!viewer) return;
  const p = (await db.doc(`mediaPosts/${id}`).get()).data() as MediaPostDoc | undefined;
  if (!p || p.ownerUid === viewer.uid) return;
  const owner = { uid: p.ownerUid, username: p.ownerUsername };
  const ownerDoc = (await db.doc(`users/${p.ownerUid}`).get()).data();
  if (!mediaVisible({ owner: ownerDoc, audience: p.audience, status: p.status, rel: await relationOf(db, viewer, owner) })) return;
  const vref = db.doc(`mediaPosts/${id}/views/${viewer.uid}`);
  await db.runTransaction(async (t) => {
    if ((await t.get(vref)).exists) return;
    t.set(vref, { uid: viewer.uid, at: new Date().toISOString() });
    t.update(db.doc(`mediaPosts/${id}`), { viewCount: FieldValue.increment(1) });
  });
}

// ── Settings: site pictures and the album ──────────────────────────────────────────────────────────────────────────────────────
export async function getMediaSettings(db: Firestore, uid: string): Promise<MediaSettings> {
  return cleanMediaSettings((await db.doc(`mediaSettings/${uid}`).get()).data());
}
export async function setMediaSettings(db: Firestore, uid: string, input: { hideAllSite?: unknown; showAlbum?: unknown; hide?: unknown }, now = new Date()): Promise<MediaSettings> {
  const cur = await getMediaSettings(db, uid);
  const next = { ...cur };
  if (typeof input.hideAllSite === "boolean") next.hideAllSite = input.hideAllSite;
  if (typeof input.showAlbum === "boolean") next.showAlbum = input.showAlbum;
  if (input.hide && typeof input.hide === "object") {
    const h = input.hide as { id?: unknown; hidden?: unknown };
    const id = String(h.id ?? "");
    if (!/^s[0-9a-f]{16}$/.test(id)) throw new MediaError(400, "Which picture?");
    const set = new Set(next.hiddenSite);
    if (h.hidden === true) set.add(id); else set.delete(id);
    next.hiddenSite = Array.from(set);
  }
  const clean = cleanMediaSettings(next);
  await db.doc(`mediaSettings/${uid}`).set({ uid, ...clean, updatedAt: now.toISOString() });
  return clean;
}

// The site kit's pictures (cover, top banner, gallery, services), each with its Hide switch.
export async function sitePictures(db: Firestore, uid: string, settings?: MediaSettings): Promise<SitePicture[]> {
  const s = settings ?? (await getMediaSettings(db, uid));
  return sitePicturesOf((await db.doc(`sites/${uid}`).get()).data() as Parameters<typeof sitePicturesOf>[0], s.hiddenSite);
}

// Past profile pictures, newest first, with the one in use now at the front. If the one in use was never recorded (changed before the
// history was kept, or the browser's note to us failed), it is recorded here, on the server, so the album keeps it from now on.
export type AlbumPicture = { id: string; url: string; createdAt: string; current: boolean };
export async function profileAlbum(db: Firestore, uid: string, avatar: string, mediaBase: string, now = new Date()): Promise<AlbumPicture[]> {
  const s = await db.collection("profilePictures").where("uid", "==", uid).get();
  const list = s.docs.map((d) => ({ id: d.id, url: String(d.data().url), createdAt: String(d.data().createdAt ?? "") }));
  if (isPictureUrl(avatar, mediaBase) && !list.some((p) => p.url === avatar)) {
    const ref = db.collection("profilePictures").doc();
    const rec = { uid, url: avatar, createdAt: now.toISOString(), recordedBy: "server" };
    await ref.set(rec);
    list.push({ id: ref.id, url: avatar, createdAt: rec.createdAt });
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((p) => ({ ...p, current: p.url === avatar }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

// ── A creator's Media (/u/{username}, the Media tab, and /u/{username}/media) ────────────────────────────────────────────────────
export type CreatorMedia = {
  owner: { uid: string; username: string; displayName: string; avatar: string };
  visible: boolean; // false: a teen's Media for someone they don't follow back (nothing else is sent)
  pinnedMoments: MomentView[]; pinnedPosts: MediaPostView[];
  posts: MediaPostView[]; sitePictures: SitePicture[]; album: AlbumPicture[]; replays: ReplayTile[];
  counts: { all: number; videos: number; pictures: number; album: number; replays: number; posts: number };
};

export async function creatorMedia(db: Firestore, viewer: Person | null, username: string, deps: MediaDeps, momentDeps: MomentDeps, now = new Date()): Promise<CreatorMedia> {
  const claim = (await db.doc(`usernames/${username.toLowerCase()}`).get()).data();
  const uid = String(claim?.uid ?? "");
  const user = uid ? (await db.doc(`users/${uid}`).get()).data() : undefined;
  if (!user || user.suspended === true) throw new MediaError(404, "Profile not found.");
  const owner = { uid, username: String(user.username ?? username) };
  const ownerOut = { ...owner, displayName: String(user.displayName ?? owner.username), avatar: String(user.avatar ?? "") };
  const rel = await relationOf(db, viewer, owner, now);
  const empty = { pinnedMoments: [], pinnedPosts: [], posts: [], sitePictures: [], album: [], replays: [], counts: { all: 0, videos: 0, pictures: 0, album: 0, replays: 0, posts: 0 } };
  if (!mediaPageVisible(user, rel)) return { owner: ownerOut, visible: false, ...empty };

  const settings = await getMediaSettings(db, uid);
  const snap = await db.collection("mediaPosts").where("ownerUid", "==", uid).get();
  const posts = snap.docs.map((d) => ({ id: d.id, p: d.data() as MediaPostDoc }))
    .filter((x) => mediaVisible({ owner: user, audience: x.p.audience, status: x.p.status, rel }))
    .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt))
    .map((x) => toView(x.id, x.p, viewer?.uid ?? null, deps));
  const pinnedPosts = posts.filter((p) => p.pinned);
  const site = settings.hideAllSite ? [] : (await sitePictures(db, uid, settings)).filter((p) => !p.hidden);
  const album = settings.showAlbum ? await profileAlbum(db, uid, ownerOut.avatar, deps.mediaBase, now) : [];
  const replays = await replaysFor(db, uid);
  const pinnedMoments = await listPinnedMoments(db, viewer?.uid ?? null, uid, momentDeps).catch(() => []);
  const videos = posts.filter((p) => p.kind === "video").length;
  const pictures = posts.length - videos + site.length;
  return {
    owner: ownerOut, visible: true, pinnedMoments, pinnedPosts, posts, sitePictures: site, album, replays,
    counts: { all: posts.length + site.length + album.length + replays.length, videos, pictures, album: album.length, replays: replays.length, posts: posts.length },
  };
}

// ── The studio (/profile/media) ─────────────────────────────────────────────────────────────────────────────────────────────────
export type Studio = {
  posts: MediaPostView[]; quota: Omit<MediaQuota, "storage"> & { storage: { limitBytes: number | null; usedBytes: number } };
  settings: MediaSettings; sitePictures: SitePicture[]; albumCount: number; streamReady: boolean; teen: boolean; tier: AccountTier;
  totals: { views: number; downloads: number; posts: number };
};
export async function mediaStudio(db: Firestore, me: Person, tier: AccountTier, deps: MediaDeps, now = new Date()): Promise<Studio> {
  const snap = await db.collection("mediaPosts").where("ownerUid", "==", me.uid).get();
  const docs: { id: string; p: MediaPostDoc }[] = [];
  for (const d of snap.docs) {
    let p = d.data() as MediaPostDoc;
    if (p.status === "processing") p = (await (p.kind === "pictures" ? markPicturePost(db, d.id, deps, now).catch(() => null) : refreshVideo(db, d.id, deps, now))) ?? p;
    if (p.download?.state === "rendering") { const dl = await stepDownload(db, d.id, deps, now).catch(() => p.download); p = { ...p, download: dl }; }
    docs.push({ id: d.id, p });
  }
  const user = (await db.doc(`users/${me.uid}`).get()).data();
  const settings = await getMediaSettings(db, me.uid);
  const q = await mediaQuota(db, me.uid, tier, now);
  const album = await profileAlbum(db, me.uid, String(user?.avatar ?? ""), deps.mediaBase, now);
  const posts = docs.sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt)).map((x) => toView(x.id, x.p, me.uid, deps));
  return {
    posts, settings, sitePictures: await sitePictures(db, me.uid, settings), albumCount: album.length, streamReady: deps.stream.configured,
    teen: hearsOnlyFromFollowed(user), tier,
    quota: { ...q, storage: { limitBytes: Number.isFinite(q.storage.limitBytes) ? q.storage.limitBytes : null, usedBytes: q.storage.usedBytes } },
    totals: { views: posts.reduce((n, p) => n + p.viewCount, 0), downloads: posts.reduce((n, p) => n + p.downloadCount, 0), posts: posts.length },
  };
}

// ── Downloads ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A picture from a post whose creator allowed downloads, for someone who can see the post: the stored file, which carries the mark. A
// picture posted before the mark and not yet re-marked is marked on the way out (never the clean file). Never a teen's.
export async function downloadPicture(db: Firestore, viewer: Person | null, id: string, index: number, deps: MediaDeps): Promise<{ bytes: Buffer; filename: string; type: string }> {
  const p = (await db.doc(`mediaPosts/${id}`).get()).data() as MediaPostDoc | undefined;
  if (!p) throw new MediaError(404, "That post wasn't found.");
  const owner = { uid: p.ownerUid, username: p.ownerUsername };
  const ownerDoc = (await db.doc(`users/${p.ownerUid}`).get()).data();
  if (!ownerDoc || ownerDoc.suspended === true || !mediaVisible({ owner: ownerDoc, audience: p.audience, status: p.status, rel: await relationOf(db, viewer, owner) })) throw new MediaError(404, "That post wasn't found.");
  if (hearsOnlyFromFollowed(ownerDoc)) throw new MediaError(403, TEEN_DOWNLOAD_BLOCKED);
  if (!p.allowDownloads) throw new MediaError(403, DOWNLOADS_OFF);
  if (p.kind !== "pictures") throw new MediaError(400, "That's a video: use the video download.");
  const pic = (p.pictures ?? [])[index];
  if (!Number.isInteger(index) || !pic || pic.marked === false) throw new MediaError(404, "That picture wasn't found.");
  const raw = await deps.read(pic.key);
  const out: MarkedFile = pic.marked === true
    ? { bytes: raw, ...(sniffPicture(raw) === "webp" ? { type: "image/webp", ext: "webp" } : { type: "image/jpeg", ext: "jpg" }) }
    : await deps.markPicture(raw, p.ownerUsername, await getWatermarkSettings(db));
  if (viewer?.uid !== p.ownerUid) await db.doc(`mediaPosts/${id}`).update({ downloadCount: FieldValue.increment(1) }).catch(() => {});
  return { bytes: out.bytes, type: out.type, filename: `${p.ownerUsername}-notesapp-${id.slice(0, 6)}-${index + 1}.${out.ext}` };
}

// A video from a post whose creator allowed downloads, for someone who can see the post: Stream's MP4 of the video, which carries the
// mark burned in. Never a teen's. While the MP4 is being made, says so (and asks Stream again).
export async function downloadVideo(db: Firestore, viewer: Person | null, id: string, deps: Pick<MediaDeps, "stream">, now = new Date()): Promise<{ url: string; filename: string }> {
  const ref = db.doc(`mediaPosts/${id}`);
  const p = (await ref.get()).data() as MediaPostDoc | undefined;
  if (!p) throw new MediaError(404, "That post wasn't found.");
  const owner = { uid: p.ownerUid, username: p.ownerUsername };
  const ownerDoc = (await db.doc(`users/${p.ownerUid}`).get()).data();
  if (!ownerDoc || ownerDoc.suspended === true || !mediaVisible({ owner: ownerDoc, audience: p.audience, status: p.status, rel: await relationOf(db, viewer, owner) })) throw new MediaError(404, "That post wasn't found.");
  if (hearsOnlyFromFollowed(ownerDoc)) throw new MediaError(403, TEEN_DOWNLOAD_BLOCKED);
  if (!p.allowDownloads) throw new MediaError(403, DOWNLOADS_OFF);
  if (p.kind !== "video" || !p.video) throw new MediaError(400, "That post has pictures: use the picture download.");
  if (!deps.stream.configured) throw new MediaError(503, VIDEO_DL_NOT_SET_UP);
  if (!isMarked(p)) throw new MediaError(409, NOT_MARKED_YET);
  let dl = p.download;
  if (!dl) dl = (await startDownload(db, id, p, deps, now)).download;
  else if (dl.state === "rendering") dl = await stepDownload(db, id, deps, now);
  if (dl?.state !== "ready" || !dl.url) throw new MediaError(409, dl?.state === "failed" ? (dl.why ?? VIDEO_DL_PREPARING) : VIDEO_DL_PREPARING);
  const filename = `${videoDownloadName(p.ownerUsername, id)}.mp4`;
  if (viewer?.uid !== p.ownerUid) await ref.update({ downloadCount: FieldValue.increment(1) }).catch(() => {});
  return { url: withFilename(dl.url, filename), filename };
}

// When an account is deleted: its Media posts and files (the account deletion job calls this).
export async function deleteAllMedia(db: Firestore, uid: string, deps: MediaDeps): Promise<number> {
  const s = await db.collection("mediaPosts").where("ownerUid", "==", uid).get();
  for (const d of s.docs) await deleteMediaPost(db, uid, d.id, deps);
  await Promise.all([db.doc(`mediaUsage/${uid}`).delete(), db.doc(`mediaSettings/${uid}`).delete()]).catch(() => {});
  return s.size;
}
