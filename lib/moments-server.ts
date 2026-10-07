import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import {
  MOMENT_DEFAULT_HOURS, MOMENT_TEXT_MAX, MOMENT_VIDEO_MAX_SECONDS, MOMENT_VIDEO_SOURCE_MAX_SECONDS, momentVideoParts, MOMENT_AUDIO_MAX_SECONDS, AUDIO_MAX_BYTES, AUDIO_TYPES, sniffAudio,
  isMomentExpired, isMomentHours, isMomentKind, momentExpiry, type MomentHours, type MomentKind,
} from "./moments-rules";
import { sendMessage } from "./messages-server";
import { MESSAGE_MAX } from "./messages-rules";
import { VIDEO_MAX_BYTES, VIDEO_TYPES, isoWeekKey } from "./video-rules";
import { effectiveTier, type AccountTier } from "./users";
import { limit } from "./limits-server";

// Server side of Moments. Clients never read or write the `moments` collection directly (firestore.rules say no):
// every read goes through here so the audience check (the owner and their followers) and the expiry check can't be skipped,
// and nothing past its time is ever returned — the sweep below then removes the leftovers.
export class MomentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type MomentDeps = {
  publicUrl: (key: string) => string;
  remove: (key: string) => Promise<void>; // deletes a media object from the bucket
};

type MomentDoc = {
  ownerUid: string; ownerUsername: string; kind: MomentKind;
  text?: string; imageKey?: string; videoKey?: string; durationSec?: number;
  clipStart?: number; clipEnd?: number; splitGroup?: string; // a part of a longer video: this moment plays clipStart to clipEnd of the shared file
  audioKey?: string; audioDurationSec?: number; // voice-over
  hours: MomentHours; createdAt: string; expiresAt: string;
  likeCount: number; reshareCount: number; viewCount: number;
  ownsMedia: boolean; // false on a reshare: the file belongs to the original
  // momentId/ownerUsername: who it was reshared from (a reshare of a reshare points at the one before); root*: the original.
  resharedFrom?: { momentId: string; ownerUsername: string; rootMomentId: string; rootOwnerUid: string };
  reported?: boolean; // someone reported it: its files are kept as evidence until the report is resolved
};

export type MomentView = {
  id: string; ownerUid: string; ownerUsername: string; kind: MomentKind;
  text?: string; imageUrl?: string; videoUrl?: string; durationSec?: number; clipStart?: number; clipEnd?: number; audioUrl?: string; audioDurationSec?: number;
  hours: MomentHours; createdAt: string; expiresAt: string;
  likeCount: number; reshareCount: number; liked: boolean; mine: boolean;
  viewCount?: number; // only for the owner
  resharedFrom?: { ownerUsername: string };
};

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

async function follows(db: Firestore, viewerUid: string, ownerUsername: string): Promise<boolean> {
  return (await db.doc(`follows/${viewerUid}_${ownerUsername}`).get()).exists;
}

// The audience: the owner, and members who follow the owner's journal.
async function canSee(db: Firestore, viewerUid: string, m: MomentDoc): Promise<boolean> {
  if (m.ownerUid === viewerUid) return true;
  // A block either way hides the moments (and the reshares that point at them).
  const [a, b] = await Promise.all([db.doc(`dmBlocks/${m.ownerUid}_${viewerUid}`).get(), db.doc(`dmBlocks/${viewerUid}_${m.ownerUid}`).get()]);
  if (a.exists || b.exists) return false;
  return follows(db, viewerUid, m.ownerUsername);
}

function toView(id: string, m: MomentDoc, viewerUid: string, liked: boolean, deps: MomentDeps): MomentView {
  return {
    id, ownerUid: m.ownerUid, ownerUsername: m.ownerUsername, kind: m.kind,
    ...(m.text ? { text: m.text } : {}),
    ...(m.imageKey ? { imageUrl: deps.publicUrl(m.imageKey) } : {}),
    ...(m.videoKey ? { videoUrl: deps.publicUrl(m.videoKey), durationSec: m.durationSec, ...(m.clipEnd ? { clipStart: m.clipStart ?? 0, clipEnd: m.clipEnd } : {}) } : {}),
    ...(m.audioKey ? { audioUrl: deps.publicUrl(m.audioKey), audioDurationSec: m.audioDurationSec } : {}),
    hours: m.hours, createdAt: m.createdAt, expiresAt: m.expiresAt,
    likeCount: m.likeCount, reshareCount: m.reshareCount, liked, mine: m.ownerUid === viewerUid,
    ...(m.ownerUid === viewerUid ? { viewCount: m.viewCount } : {}),
    ...(m.resharedFrom ? { resharedFrom: { ownerUsername: m.resharedFrom.ownerUsername } } : {}),
  };
}

export type CreateInput = { kind: unknown; text?: unknown; hours?: unknown; imageKey?: unknown; videoUploadId?: unknown; clipStart?: unknown; clipEnd?: unknown; audioUploadId?: unknown };

export async function createMoment(db: Firestore, owner: { uid: string; username: string }, input: CreateInput, deps: MomentDeps, now = new Date()): Promise<MomentView> {
  if (!owner.username) throw new MomentError(400, "Finish setting up your profile first.");
  if (!isMomentKind(input.kind)) throw new MomentError(400, "Pick image, video or text.");
  const hours = input.hours === undefined ? MOMENT_DEFAULT_HOURS : input.hours;
  if (!isMomentHours(hours)) throw new MomentError(400, "A moment can last 24, 48 or 72 hours.");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length > MOMENT_TEXT_MAX) throw new MomentError(413, `Text can be up to ${MOMENT_TEXT_MAX} characters.`);

  let videoRef: ReturnType<Firestore["doc"]> | null = null;
  let partsAllowed = 1;
  const doc: Omit<MomentDoc, "createdAt" | "expiresAt"> = {
    ownerUid: owner.uid, ownerUsername: owner.username, kind: input.kind, hours,
    likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: true,
  };
  if (text) doc.text = text;

  if (input.kind === "text") {
    if (!text) throw new MomentError(400, "Write something to share.");
  } else if (input.kind === "image") {
    const key = String(input.imageKey ?? "");
    // Uploaded through /api/upload (purpose "moment"), which puts it under this member's own folder.
    if (!key.startsWith(`moments/${owner.uid}/`) || key.includes("..")) throw new MomentError(400, "Upload an image first.");
    doc.imageKey = key;
  } else {
    const up = (await db.doc(`videoUploads/${String(input.videoUploadId ?? "")}`).get()).data();
    if (!up || up.uid !== owner.uid || up.verified !== true) throw new MomentError(400, "The video hasn't finished uploading.");
    if (!String(up.key).startsWith(`moments/${owner.uid}/`)) throw new MomentError(400, "That video wasn't uploaded for a moment.");
    if (!(up.contentType in VIDEO_TYPES)) throw new MomentError(400, "Use an MP4 or WebM video.");
    // Which stretch of the file this moment plays: at most 90 seconds. A video that's short enough needs no clip.
    const start = input.clipStart === undefined ? 0 : Number(input.clipStart);
    const end = input.clipEnd === undefined ? Math.min(up.durationSec, MOMENT_VIDEO_MAX_SECONDS) : Number(input.clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > up.durationSec + 1) throw new MomentError(400, "That part of the video isn't valid.");
    if (end - start > MOMENT_VIDEO_MAX_SECONDS + 1) throw new MomentError(413, `Each moment can be up to ${MOMENT_VIDEO_MAX_SECONDS} seconds.`);
    doc.videoKey = up.key;
    doc.durationSec = up.durationSec;
    if (up.durationSec > MOMENT_VIDEO_MAX_SECONDS + 1 || input.clipEnd !== undefined) { doc.clipStart = start; doc.clipEnd = end; }
    doc.splitGroup = String(input.videoUploadId);
    videoRef = db.doc(`videoUploads/${String(input.videoUploadId)}`);
    partsAllowed = (up.partsAllowed as number | undefined) ?? 1;
  }

  // Voice-over (any kind): a verified recording of this member's, not already used.
  let audioRef: ReturnType<Firestore["doc"]> | null = null;
  if (input.audioUploadId) {
    audioRef = db.doc(`momentAudio/${String(input.audioUploadId)}`);
    const au = (await audioRef.get()).data();
    if (!au || au.uid !== owner.uid || au.verified !== true || au.attached === true) throw new MomentError(400, "The voice-over hasn't finished uploading.");
    if (!String(au.key).startsWith(`moments/${owner.uid}/`)) throw new MomentError(400, "That recording wasn't made for a moment.");
    if (au.durationSec > MOMENT_AUDIO_MAX_SECONDS + 1) throw new MomentError(413, `Voice-overs can be up to ${MOMENT_AUDIO_MAX_SECONDS} seconds.`);
    doc.audioKey = au.key;
    doc.audioDurationSec = au.durationSec;
  }

  const id = randomBytes(8).toString("hex");
  const createdAt = now.toISOString();
  const full: MomentDoc = { ...doc, createdAt, expiresAt: momentExpiry(now, hours).toISOString() };
  const usageRef = db.doc(`momentUsage/${owner.uid}_${dayKey(now)}`);
  const ownerDoc = (await db.doc(`users/${owner.uid}`).get()).data();
  const dailyLimit = await limit(db, "momentsPerDay", effectiveTier({ username: ownerDoc?.username ?? "", role: ownerDoc?.role ?? "reader", accountTier: ownerDoc?.accountTier ?? "standard" }));
  await db.runTransaction(async (t) => {
    // All reads first (a transaction can't read after it has written).
    const used = ((await t.get(usageRef)).data()?.count as number | undefined) ?? 0;
    const created = videoRef ? (((await t.get(videoRef)).data()?.partsCreated as number | undefined) ?? 0) : 0;
    if (used >= dailyLimit) throw new MomentError(429, `You can share ${dailyLimit} moments a day. Try again tomorrow.`);
    t.set(usageRef, { uid: owner.uid, day: dayKey(now), count: used + 1 }, { merge: true });
    if (videoRef) {
      // Each part of an upload uses one of the parts it was allowed; the first owns the file, the others share it.
      if (created >= partsAllowed) throw new MomentError(400, "That video has already been shared in every part there was room for.");
      t.update(videoRef, { partsCreated: created + 1 });
      full.ownsMedia = created === 0;
    }
    t.set(db.doc(`moments/${id}`), { ...full, expireAt: new Date(full.expiresAt) });
    if (audioRef) t.update(audioRef, { attached: true });
  });
  return toView(id, full, owner.uid, false, deps);
}

async function likedSet(db: Firestore, uid: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const snaps = await db.getAll(...ids.map((id) => db.doc(`moments/${id}/likes/${uid}`)));
  return new Set(snaps.filter((s) => s.exists).map((s) => s.ref.parent.parent!.id));
}

export type MomentGroup = { ownerUid: string; ownerUsername: string; moments: MomentView[] };

// Moments from the people the viewer follows, plus the viewer's own. Expired ones are never returned.
export async function listFeed(db: Firestore, viewer: { uid: string; username: string }, deps: MomentDeps, now = new Date()): Promise<MomentGroup[]> {
  const f = await db.collection("follows").where("followerUid", "==", viewer.uid).limit(300).get();
  const names = Array.from(new Set([...(viewer.username ? [viewer.username] : []), ...f.docs.map((d) => d.data().username as string)]));
  const docs: { id: string; m: MomentDoc }[] = [];
  for (let i = 0; i < names.length; i += 30) {
    // `in` on one field only, so no composite index; expiry is filtered below.
    const snap = await db.collection("moments").where("ownerUsername", "in", names.slice(i, i + 30)).get();
    for (const d of snap.docs) {
      const m = d.data() as MomentDoc;
      if (!isMomentExpired(m.expiresAt, now)) docs.push({ id: d.id, m });
    }
  }
  // Hide anyone who blocked the viewer, or whom the viewer blocked.
  const [byMe, onMe] = await Promise.all([db.collection("dmBlocks").where("blocker", "==", viewer.uid).get(), db.collection("dmBlocks").where("blocked", "==", viewer.uid).get()]);
  const hidden = new Set([...byMe.docs.map((d) => d.data().blocked as string), ...onMe.docs.map((d) => d.data().blocker as string)]);
  const visible = docs.filter((d) => !hidden.has(d.m.ownerUid));
  const liked = await likedSet(db, viewer.uid, visible.map((d) => d.id));
  const groups = new Map<string, MomentGroup>();
  for (const { id, m } of visible.sort((a, b) => (a.m.createdAt < b.m.createdAt ? -1 : 1))) {
    const g = groups.get(m.ownerUid) ?? { ownerUid: m.ownerUid, ownerUsername: m.ownerUsername, moments: [] };
    g.moments.push(toView(id, m, viewer.uid, liked.has(id), deps));
    groups.set(m.ownerUid, g);
  }
  // Own moments first, then newest activity first.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.ownerUid === viewer.uid) return -1;
    if (b.ownerUid === viewer.uid) return 1;
    return a.moments[a.moments.length - 1].createdAt < b.moments[b.moments.length - 1].createdAt ? 1 : -1;
  });
}

// One member's active moments, if the viewer is in the audience (used for the ring on a profile picture).
export async function listForOwner(db: Firestore, viewerUid: string, ownerUsername: string, deps: MomentDeps, now = new Date()): Promise<MomentView[]> {
  const snap = await db.collection("moments").where("ownerUsername", "==", ownerUsername).get();
  const docs = snap.docs.map((d) => ({ id: d.id, m: d.data() as MomentDoc })).filter((d) => !isMomentExpired(d.m.expiresAt, now));
  if (!docs.length) return [];
  if (!(await canSee(db, viewerUid, docs[0].m))) return [];
  const liked = await likedSet(db, viewerUid, docs.map((d) => d.id));
  return docs.sort((a, b) => (a.m.createdAt < b.m.createdAt ? -1 : 1)).map((d) => toView(d.id, d.m, viewerUid, liked.has(d.id), deps));
}

async function loadActive(db: Firestore, viewerUid: string, id: string, now: Date): Promise<{ m: MomentDoc }> {
  const m = (await db.doc(`moments/${id}`).get()).data() as MomentDoc | undefined;
  // Missing, expired and not-in-the-audience all look the same.
  if (!m || isMomentExpired(m.expiresAt, now) || !(await canSee(db, viewerUid, m))) throw new MomentError(404, "That moment isn't available any more.");
  return { m };
}

export async function toggleLike(db: Firestore, uid: string, id: string, now = new Date()): Promise<{ liked: boolean; likeCount: number }> {
  const { m } = await loadActive(db, uid, id, now);
  const likeRef = db.doc(`moments/${id}/likes/${uid}`);
  const ref = db.doc(`moments/${id}`);
  return db.runTransaction(async (t) => {
    const had = (await t.get(likeRef)).exists;
    if (had) t.delete(likeRef); else t.set(likeRef, { uid, at: now.toISOString(), expireAt: new Date(m.expiresAt) });
    t.update(ref, { likeCount: FieldValue.increment(had ? -1 : 1) });
    return { liked: !had, likeCount: Math.max(0, m.likeCount + (had ? -1 : 1)) };
  });
}

// Counts each member once; the owner's own views don't count.
export async function recordView(db: Firestore, uid: string, id: string, now = new Date()): Promise<void> {
  const { m } = await loadActive(db, uid, id, now);
  if (m.ownerUid === uid) return;
  const viewRef = db.doc(`moments/${id}/views/${uid}`);
  await db.runTransaction(async (t) => {
    if ((await t.get(viewRef)).exists) return;
    t.set(viewRef, { uid, at: now.toISOString(), expireAt: new Date(m.expiresAt) });
    t.update(db.doc(`moments/${id}`), { viewCount: FieldValue.increment(1) });
  });
}

// A reshare puts the moment on the resharer's own ring for the rest of the original's time — never longer.
export async function reshare(db: Firestore, user: { uid: string; username: string }, id: string, deps: MomentDeps, now = new Date()): Promise<MomentView> {
  const { m } = await loadActive(db, user.uid, id, now);
  if (m.ownerUid === user.uid) throw new MomentError(400, "That's already your moment.");
  // A reshare of a reshare is allowed; it points at the original so the chain can be traced and cleaned up together.
  const rootMomentId = m.resharedFrom?.rootMomentId ?? id;
  const rootOwnerUid = m.resharedFrom?.rootOwnerUid ?? m.ownerUid;
  if (rootOwnerUid === user.uid) throw new MomentError(400, "That began as your own moment.");
  if (!user.username) throw new MomentError(400, "Finish setting up your profile first.");
  const newId = `rs_${user.uid}_${id}`; // one reshare per member per moment
  const { reported: _reported, ...rest } = m;
  void _reported;
  const full: MomentDoc = {
    ...rest, ownerUid: user.uid, ownerUsername: user.username, createdAt: now.toISOString(),
    likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: false,
    resharedFrom: { momentId: id, ownerUsername: m.ownerUsername, rootMomentId, rootOwnerUid },
  };
  await db.runTransaction(async (t) => {
    if ((await t.get(db.doc(`moments/${newId}`))).exists) throw new MomentError(409, "You've already reshared this moment.");
    t.set(db.doc(`moments/${newId}`), { ...full, expireAt: new Date(m.expiresAt) });
    t.update(db.doc(`moments/${id}`), { reshareCount: FieldValue.increment(1) });
  });
  return toView(newId, full, user.uid, false, deps);
}

// A reply goes to the owner's inbox. It keeps only a reference (id and expiry) — after the moment expires the message
// stays and says so, but the moment can't be opened.
export async function replyToMoment(db: Firestore, uid: string, id: string, text: string, now = new Date()): Promise<{ conversationId: string }> {
  const { m } = await loadActive(db, uid, id, now);
  if (m.ownerUid === uid) throw new MomentError(400, "You can't reply to your own moment.");
  if (String(text ?? "").trim().length > MESSAGE_MAX) throw new MomentError(413, `Messages can be up to ${MESSAGE_MAX} characters.`);
  const sent = await sendMessage(db, uid, m.ownerUid, { text, moment: { momentId: id, expiresAt: m.expiresAt } }, now);
  return { conversationId: sent.conversationId };
}

export async function deleteMoment(db: Firestore, uid: string, id: string, deps: MomentDeps): Promise<void> {
  const ref = db.doc(`moments/${id}`);
  const m = (await ref.get()).data() as MomentDoc | undefined;
  if (!m || m.ownerUid !== uid) throw new MomentError(404, "That moment wasn't found.");
  // Reshares point at the original's file, so they go with it.
  const shares = await db.collection("moments").where("resharedFrom.rootMomentId", "==", ref.id).get();
  for (const d of shares.docs) await removeMoment(db, d.id, d.data() as MomentDoc, deps);
  await removeMoment(db, ref.id, m, deps);
}

async function removeMoment(db: Firestore, id: string, m: MomentDoc, deps: MomentDeps) {
  // A reported moment's files stay until its report is resolved (the report holds the keys); see lib/reports-server.ts.
  // Whether this moment owns the file is read afresh: an earlier part removed in the same sweep may have passed it on to this one.
  const owns = ((await db.doc(`moments/${id}`).get()).data()?.ownsMedia as boolean | undefined) ?? m.ownsMedia;
  let keepVideo = false;
  if (owns && m.splitGroup) {
    // Other parts of the same video still need the file: pass it on to one of them instead of deleting it.
    const others = (await db.collection("moments").where("splitGroup", "==", m.splitGroup).get()).docs.filter((d) => d.id !== id);
    if (others.length) { await others[0].ref.update({ ownsMedia: true }); keepVideo = true; }
  }
  if (owns && !m.reported) for (const key of [m.imageKey, m.videoKey, m.audioKey]) if (key && !(keepVideo && key === m.videoKey)) await deps.remove(key).catch(() => {});
  await db.recursiveDelete(db.doc(`moments/${id}`)); // the likes and views under it go too
}

// Run by the scheduler: removes moments whose time is up, and their files. Reads are already refusing them.
export async function sweepExpiredMoments(db: Firestore, deps: MomentDeps, now = new Date(), batch = 200): Promise<number> {
  const snap = await db.collection("moments").where("expiresAt", "<=", now.toISOString()).limit(batch).get();
  for (const d of snap.docs) await removeMoment(db, d.id, d.data() as MomentDoc, deps);
  return snap.size;
}

// A moment's video: same file checks as post videos (finishVideoUpload in lib/video-server.ts verifies it afterwards), but
// 90 seconds at most, in the member's own `moments/` folder, and no weekly post-video quota — moments have their own daily limit.
// Where the member stands on video moments this week: the plan's allowance, what's used, and what's left.
const weeklyVideoLimit = (db: Firestore, tier: AccountTier) => limit(db, "momentVideosPerWeek", tier);

export async function momentVideoQuota(db: Firestore, uid: string, tier: AccountTier, now = new Date()): Promise<{ limit: number; used: number; remaining: number }> {
  const limit = await weeklyVideoLimit(db, tier);
  const used = ((await db.doc(`videoUsage/${uid}_${isoWeekKey(now)}_moment`).get()).data()?.count as number | undefined) ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

// A moment's video: same file checks as post videos (finishVideoUpload in lib/video-server.ts verifies it afterwards), in the member's
// own `moments/` folder, with no weekly post-video quota: moments have their own weekly allowance by plan, one for each moment.
// A video longer than 90 seconds is cut into parts, one moment each: the parts it needs come out of the allowance, and if there
// isn't room for all of them only the first 90 seconds of as many parts as there is room for are used (`partsAllowed`).
export async function startMomentVideo(
  db: Firestore, uid: string, tier: AccountTier, input: { size: number; contentType: string; durationSec: number },
  presign: (key: string, contentType: string, size: number) => Promise<string>, now = new Date()
): Promise<{ id: string; key: string; uploadUrl: string; partsAllowed: number; partsNeeded: number }> {
  const ext = VIDEO_TYPES[input.contentType];
  if (!ext) throw new MomentError(400, "Use an MP4 (H.264) or WebM video.");
  if (!Number.isInteger(input.size) || input.size <= 0) throw new MomentError(400, "That file looks empty.");
  if (input.size > VIDEO_MAX_BYTES) throw new MomentError(413, "That video is too large.");
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) throw new MomentError(400, "We couldn't read the video's length.");
  if (input.durationSec > MOMENT_VIDEO_SOURCE_MAX_SECONDS + 1) throw new MomentError(413, `Videos can be up to ${MOMENT_VIDEO_SOURCE_MAX_SECONDS / 60} minutes.`);
  const partsNeeded = momentVideoParts(input.durationSec);
  const limit = await weeklyVideoLimit(db, tier);
  const quotaDoc = `videoUsage/${uid}_${isoWeekKey(now)}_moment`;
  const usageRef = db.doc(quotaDoc);
  let partsAllowed = 0;
  await db.runTransaction(async (t) => {
    const used = ((await t.get(usageRef)).data()?.count as number | undefined) ?? 0;
    const remaining = limit - used;
    if (remaining <= 0) {
      throw new MomentError(429, limit === 0
        ? "Video moments come with a paid plan. Pictures and text are free."
        : `You've used your ${limit} video moment${limit === 1 ? "" : "s"} for this week. It resets on Monday, or move up a plan for more.`);
    }
    partsAllowed = Math.min(partsNeeded, remaining);
    t.set(usageRef, { uid, week: isoWeekKey(now), kind: "moment", count: used + partsAllowed }, { merge: true });
  });
  const id = randomBytes(8).toString("hex");
  const key = `moments/${uid}/${id}.${ext}`;
  try {
    const uploadUrl = await presign(key, input.contentType, input.size);
    await db.doc(`videoUploads/${id}`).set({
      uid, key, size: input.size, contentType: input.contentType, durationSec: Math.round(input.durationSec), verified: false, quotaDoc,
      partsAllowed, partsNeeded, partsCreated: 0,
      createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000),
    });
    return { id, key, uploadUrl, partsAllowed, partsNeeded };
  } catch (err) {
    await usageRef.update({ count: FieldValue.increment(-partsAllowed) }).catch(() => {});
    throw err;
  }
}

// Voice-over upload, same shape as the video one: ask (type, size and length checked, size signed in), PUT to the bucket,
// then finish (the stored size matches and the first bytes really are WebM or MP4 audio).
export async function startMomentAudio(
  db: Firestore, uid: string, input: { size: number; contentType: string; durationSec: number },
  presign: (key: string, contentType: string, size: number) => Promise<string>, now = new Date()
): Promise<{ id: string; key: string; uploadUrl: string }> {
  const ext = AUDIO_TYPES[input.contentType];
  if (!ext) throw new MomentError(400, "Use a recording made in the browser (WebM or MP4 audio).");
  if (!Number.isInteger(input.size) || input.size <= 0) throw new MomentError(400, "That recording looks empty.");
  if (input.size > AUDIO_MAX_BYTES) throw new MomentError(413, "That recording is too large.");
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) throw new MomentError(400, "We couldn't read the recording's length.");
  if (input.durationSec > MOMENT_AUDIO_MAX_SECONDS + 1) throw new MomentError(413, `Voice-overs can be up to ${MOMENT_AUDIO_MAX_SECONDS} seconds.`);
  const id = randomBytes(8).toString("hex");
  const key = `moments/${uid}/${id}.${ext}`;
  const uploadUrl = await presign(key, input.contentType, input.size);
  await db.doc(`momentAudio/${id}`).set({
    uid, key, size: input.size, contentType: input.contentType, durationSec: Math.round(input.durationSec), verified: false, attached: false,
    createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000), // an unused recording is removed after two days
  });
  return { id, key, uploadUrl };
}

export type AudioFinishDeps = {
  head: (key: string) => Promise<{ size: number } | null>;
  readStart: (key: string) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
};

export async function finishMomentAudio(db: Firestore, uid: string, id: string, deps: AudioFinishDeps): Promise<{ key: string }> {
  const ref = db.doc(`momentAudio/${id}`);
  const rec = (await ref.get()).data();
  if (!rec || rec.uid !== uid) throw new MomentError(404, "That recording wasn't found.");
  if (rec.verified === true) return { key: rec.key };
  const reject = async (why: string): Promise<never> => {
    await deps.remove(rec.key).catch(() => {});
    await ref.delete().catch(() => {});
    throw new MomentError(400, why);
  };
  const head = await deps.head(rec.key);
  if (!head) throw new MomentError(409, "The recording hasn't finished uploading yet.");
  if (head.size !== rec.size || head.size > AUDIO_MAX_BYTES) return reject("The uploaded file didn't match the recording. Try again.");
  if (!sniffAudio(await deps.readStart(rec.key), rec.contentType)) return reject("That doesn't look like an audio recording.");
  await ref.update({ verified: true });
  return { key: rec.key };
}

// Run by the scheduler: recordings that were uploaded but never used by a moment.
export async function sweepStaleAudio(db: Firestore, deps: MomentDeps, now = new Date(), batch = 200): Promise<number> {
  const snap = await db.collection("momentAudio").where("expireAt", "<=", now).limit(batch).get();
  for (const d of snap.docs) {
    if (d.data().attached !== true) await deps.remove(String(d.data().key)).catch(() => {});
    await d.ref.delete();
  }
  return snap.size;
}

// For an admin who has decided a reported moment must go: removes it now (and the reshares of it) with its files.
export async function adminRemoveMoment(db: Firestore, id: string, deps: MomentDeps): Promise<void> {
  const ref = db.doc(`moments/${id}`);
  const m = (await ref.get()).data() as MomentDoc | undefined;
  if (!m) return;
  const rootId = m.resharedFrom?.rootMomentId ?? id;
  const shares = await db.collection("moments").where("resharedFrom.rootMomentId", "==", rootId).get();
  for (const d of shares.docs) await removeMoment(db, d.id, { ...(d.data() as MomentDoc), reported: false }, deps);
  const root = (await db.doc(`moments/${rootId}`).get()).data() as MomentDoc | undefined;
  if (root) await removeMoment(db, rootId, { ...root, reported: false }, deps);
  if (rootId !== id) await removeMoment(db, id, { ...m, reported: false }, deps);
}

export type Viewer = { uid: string; username: string; displayName: string; avatar: string; at: string };

// Who has seen a moment: the owner only. Each person once, newest first.
export async function listViewers(db: Firestore, ownerUid: string, id: string, now = new Date()): Promise<Viewer[]> {
  const m = (await db.doc(`moments/${id}`).get()).data() as MomentDoc | undefined;
  if (!m || m.ownerUid !== ownerUid || isMomentExpired(m.expiresAt, now)) throw new MomentError(404, "That moment isn't available any more.");
  const snap = await db.collection(`moments/${id}/views`).orderBy("at", "desc").limit(200).get();
  if (snap.empty) return [];
  const users = await db.getAll(...snap.docs.map((d) => db.doc(`users/${d.id}`)));
  return snap.docs.map((d, i) => {
    const u = users[i].data();
    return { uid: d.id, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "", at: d.data().at };
  });
}
