import { addFanPointsByUsername } from "./fans-server";
import { countPlay, countUse, songIdOk } from "./sounds-server";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import {
  MOMENT_DEFAULT_HOURS, MOMENT_TEXT_MAX, MOMENT_VIDEO_MAX_SECONDS, MOMENT_VIDEO_SOURCE_MAX_SECONDS, momentVideoParts, MOMENT_AUDIO_MAX_SECONDS, AUDIO_MAX_BYTES, AUDIO_TYPES, sniffAudio,
  isMomentExpired, isMomentHours, isMomentKind, momentExpiry, type MomentHours, type MomentKind, type MomentLink,
} from "./moments-rules";
import type { ShareCard } from "./share-targets";
import { isKidUid } from "./kids";
import { sendMessage } from "./messages-server";
import { mentionedUsernames, notifyMentions } from "./mentions-server";
import { MESSAGE_MAX } from "./messages-rules";
import { VIDEO_MAX_BYTES, VIDEO_TYPES, isoWeekKey } from "./video-rules";
import { effectiveTier, type AccountTier } from "./users";
import { limit } from "./limits-server";
import { isAutoFollowed } from "./journals-directory";
import { MOMENTS_PINNED_MAX } from "./media-rules";
import { markProfile, type MarkProfileDeps } from "./media-mark-server";
import { shapeOf } from "./media-mark";
import { MENTION_BLOCKED, REPLY_BLOCKED, RESHARE_BLOCKED, firstName, hearsOnlyFromFollowed, mayReach, mayReshare, teenAudience } from "./young";

// Server side of Moments. Clients never read or write the `moments` collection directly (firestore.rules say no):
// every read goes through here so the audience check (the owner and their followers) and the expiry check can't be skipped,
// and nothing past its time is ever returned — the sweep below then removes the leftovers.
export class MomentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// The permanent NotesApp mark on moments (owner, 5 Nov 2026; lib/media-mark.ts): a moment's picture is marked as it is posted (only the
// marked copy kept), and a moment's video goes to Cloudflare Stream with the creator's watermark profile burned in. A Stream video is
// kept in the moment's `videoKey` as "stream:<uid>", so everything that deletes, keeps or passes on a moment's files (expiry, deleting,
// the parts of a long video, reshares, reports, account deletion) works for it unchanged: `remove` deletes it from Stream.
export const STREAM_KEY = "stream:";
export const streamUidOf = (key: string | undefined) => (key?.startsWith(STREAM_KEY) ? key.slice(STREAM_KEY.length) : null);
export type MomentStreamDeps = MarkProfileDeps & {
  configured: boolean;
  create: (creatorUid: string, maxSeconds: number, name: string, watermarkUid: string) => Promise<{ uploadURL: string; uid: string }>; // signed playback
  copy: (o: { url: string; watermarkUid: string; creatorUid: string; name: string; signed: boolean; purpose: string }) => Promise<{ uid: string }>;
  get: (uid: string) => Promise<{ readyToStream: boolean; state?: string } | null>;
  token: (uid: string, seconds: number) => Promise<string>;
};
export type MomentDeps = {
  publicUrl: (key: string) => string;
  remove: (key: string) => Promise<void>; // deletes a media object from the bucket, or a "stream:<uid>" video from Stream
  markImage?: (key: string, username: string) => Promise<string>; // the picture marked: returns the marked key (the clean one deleted)
  stream?: MomentStreamDeps;
};

type MomentDoc = {
  ownerUid: string; ownerUsername: string; kind: MomentKind;
  text?: string; imageKey?: string; videoKey?: string; durationSec?: number;
  clipStart?: number; clipEnd?: number; splitGroup?: string; // a part of a longer video: this moment plays clipStart to clipEnd of the shared file
  audioKey?: string; audioDurationSec?: number; // voice-over
  songId?: string; // a NotesApp Sounds song (lib/songs.ts), played while the moment shows
  link?: MomentLink; // kind "link": the card of what was shared (Share to Moments)
  hours: MomentHours; createdAt: string; expiresAt: string;
  likeCount: number; reshareCount: number; viewCount: number;
  ownsMedia: boolean; // false on a reshare: the file belongs to the original
  // momentId/ownerUsername: who it was reshared from (a reshare of a reshare points at the one before); root*: the original.
  resharedFrom?: { momentId: string; ownerUsername: string; rootMomentId: string; rootOwnerUid: string };
  reported?: boolean; // someone reported it: its files are kept as evidence until the report is resolved
  // Pinned to the top of the owner's Media (owner, 3 Nov 2026): it stays past its 24–72 hours while pinned. The TTL field (expireAt) is
  // taken off while it is pinned and the sweep passes it by; unpinning one whose time is up lets it go there and then.
  pinned?: boolean; pinnedAt?: string;
};

export type MomentView = {
  id: string; ownerUid: string; ownerUsername: string; kind: MomentKind;
  text?: string; imageUrl?: string; videoUrl?: string; durationSec?: number;
  clipStart?: number; clipEnd?: number; audioUrl?: string; audioDurationSec?: number; songId?: string;
  streamVideo?: boolean; // the video is on Cloudflare Stream (signed): the viewer asks for a player link (POST action "play")
  link?: MomentLink;
  hours: MomentHours; createdAt: string; expiresAt: string;
  likeCount: number; reshareCount: number; liked: boolean; mine: boolean;
  viewCount?: number; // only for the owner
  resharedFrom?: { ownerUsername: string };
  pinned?: boolean;
};

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

async function follows(db: Firestore, viewerUid: string, ownerUsername: string): Promise<boolean> {
  return isAutoFollowed(ownerUsername) || (await db.doc(`follows/${viewerUid}_${ownerUsername}`).get()).exists;
}

// Whether a member lets anyone signed in see their moments (their choice, in their profile settings). Off unless they switch it on.
export async function momentsPublic(db: Firestore, uid: string): Promise<boolean> {
  return (await db.doc(`userPrefs/${uid}`).get()).data()?.momentsPublic === true;
}
export async function getMomentPrefs(db: Firestore, uid: string): Promise<{ momentsPublic: boolean }> {
  return { momentsPublic: await momentsPublic(db, uid) };
}
export async function setMomentPrefs(db: Firestore, uid: string, value: unknown): Promise<void> {
  if (typeof value !== "boolean") throw new MomentError(400, "Choose who can see your moments.");
  if (value && hearsOnlyFromFollowed((await db.doc(`users/${uid}`).get()).data())) throw new MomentError(403, "In teen mode your moments are for people you follow back.");
  await db.doc(`userPrefs/${uid}`).set({ uid, momentsPublic: value }, { merge: true });
}

// The audience: the owner, and members who follow the owner's journal, or anyone signed in if the owner made their moments public.
async function canSee(db: Firestore, viewerUid: string, m: MomentDoc): Promise<boolean> {
  if (m.ownerUid === viewerUid) return true;
  // A block either way hides the moments (and the reshares that point at them).
  const [a, b] = await Promise.all([db.doc(`dmBlocks/${m.ownerUid}_${viewerUid}`).get(), db.doc(`dmBlocks/${viewerUid}_${m.ownerUid}`).get()]);
  if (a.exists || b.exists) return false;
  // Teen mode: a teen's moments are for people they follow back, never public, whatever the setting says.
  const owner = (await db.doc(`users/${m.ownerUid}`).get()).data();
  if (!(await rootOk(db, viewerUid, m))) return false;
  if (hearsOnlyFromFollowed(owner)) return teenSees(db, m.ownerUid, m.ownerUsername, viewerUid);
  return (await follows(db, viewerUid, m.ownerUsername)) || momentsPublic(db, m.ownerUid);
}

// A reshare of a teen's moment (made before reshares of them were refused) also keeps to the teen's own audience.
async function rootOk(db: Firestore, viewerUid: string, m: MomentDoc): Promise<boolean> {
  const rootUid = m.resharedFrom?.rootOwnerUid;
  if (!rootUid || rootUid === m.ownerUid || rootUid === viewerUid) return true;
  const root = (await db.doc(`users/${rootUid}`).get()).data();
  return !hearsOnlyFromFollowed(root) || teenSees(db, rootUid, String(root?.username ?? ""), viewerUid);
}

// Both ways: the viewer follows the teen, and the teen follows the viewer.
async function teenSees(db: Firestore, ownerUid: string, ownerUsername: string, viewerUid: string, viewerUsername?: string): Promise<boolean> {
  if (ownerUid === viewerUid) return true;
  const name = viewerUsername ?? String((await db.doc(`users/${viewerUid}`).get()).data()?.username ?? "");
  if (!name || !ownerUsername) return false;
  const [a, b] = await Promise.all([db.doc(`follows/${viewerUid}_${ownerUsername}`).get(), db.doc(`follows/${ownerUid}_${name}`).get()]);
  return teenAudience({ signedIn: true, self: false, viewerFollows: a.exists, followsViewer: b.exists });
}

// Teen mode: only people a teen follows can @mention them in a moment (the moment isn't shared, and the person is told why).
// Kept on turning 18 by users.keepRepliesFollowers. The same people as replies on journals (teenGate in lib/comments-server.ts).
async function mentionGate(db: Firestore, author: { uid: string; username: string }, text: string): Promise<void> {
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
    if (!mayReach({ target: u, self: false, targetFollowsThem: followed })) throw new MomentError(403, MENTION_BLOCKED(names[i]));
  }
}

function toView(id: string, m: MomentDoc, viewerUid: string, liked: boolean, deps: MomentDeps): MomentView {
  return {
    id, ownerUid: m.ownerUid, ownerUsername: m.ownerUsername, kind: m.kind,
    ...(m.text ? { text: m.text } : {}),
    ...(m.imageKey ? { imageUrl: deps.publicUrl(m.imageKey) } : {}),
    ...(m.videoKey ? { ...(streamUidOf(m.videoKey) ? { streamVideo: true } : { videoUrl: deps.publicUrl(m.videoKey) }), durationSec: m.durationSec, ...(m.clipEnd ? { clipStart: m.clipStart ?? 0, clipEnd: m.clipEnd } : {}) } : {}),
    ...(m.audioKey ? { audioUrl: deps.publicUrl(m.audioKey), audioDurationSec: m.audioDurationSec } : {}),
    ...(m.songId ? { songId: m.songId } : {}),
    ...(m.link ? { link: m.link } : {}),
    hours: m.hours, createdAt: m.createdAt, expiresAt: m.expiresAt,
    likeCount: m.likeCount, reshareCount: m.reshareCount, liked, mine: m.ownerUid === viewerUid,
    ...(m.ownerUid === viewerUid ? { viewCount: m.viewCount } : {}),
    ...(m.resharedFrom ? { resharedFrom: { ownerUsername: m.resharedFrom.ownerUsername } } : {}),
    ...(m.pinned ? { pinned: true } : {}),
  };
}

// Still showing: its time isn't up, or it is pinned (then it stays until it is unpinned or deleted).
const isShowing = (m: MomentDoc, now: Date) => m.pinned === true || !isMomentExpired(m.expiresAt, now);

export type CreateInput = { kind: unknown; text?: unknown; hours?: unknown; imageKey?: unknown; videoUploadId?: unknown; clipStart?: unknown; clipEnd?: unknown; audioUploadId?: unknown; songId?: unknown };

export async function createMoment(db: Firestore, owner: { uid: string; username: string }, input: CreateInput, deps: MomentDeps, now = new Date()): Promise<MomentView> {
  if (!owner.username) throw new MomentError(400, "Finish setting up your profile first.");
  if (!isMomentKind(input.kind)) throw new MomentError(400, "Pick image, video or text.");
  const hours = input.hours === undefined ? MOMENT_DEFAULT_HOURS : input.hours;
  if (!isMomentHours(hours)) throw new MomentError(400, "A moment can last 24, 48 or 72 hours.");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length > MOMENT_TEXT_MAX) throw new MomentError(413, `Text can be up to ${MOMENT_TEXT_MAX} characters.`);
  await mentionGate(db, owner, text);

  let videoRef: ReturnType<Firestore["doc"]> | null = null;
  let partsAllowed = 1;
  const doc: Omit<MomentDoc, "createdAt" | "expiresAt"> = {
    ownerUid: owner.uid, ownerUsername: owner.username, kind: input.kind, hours,
    likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: true,
  };
  if (text) doc.text = text;
  // A song from NotesApp Sounds (lib/songs.ts), on any kind of moment.
  if (input.songId !== undefined && input.songId !== null && input.songId !== "") {
    if (typeof input.songId !== "string" || !(await songIdOk(db, input.songId))) throw new MomentError(400, "That song isn't in NotesApp Sounds.");
    doc.songId = input.songId;
  }

  if (input.kind === "text") {
    if (!text) throw new MomentError(400, "Write something to share.");
  } else if (input.kind === "image") {
    const key = String(input.imageKey ?? "");
    // Uploaded through /api/upload (purpose "moment"), which puts it under this member's own folder. It is given the NotesApp mark now and
    // only the marked copy is kept (the clean upload is deleted).
    if (!key.startsWith(`moments/${owner.uid}/`) || key.includes("..")) throw new MomentError(400, "Upload an image first.");
    if (!deps.markImage) throw new MomentError(503, "Pictures can't be shared as moments right now. Try again later.");
    try { doc.imageKey = await deps.markImage(key, owner.username); } catch { throw new MomentError(400, "That picture couldn't be read. Try a JPEG or WebP."); }
  } else {
    const upRef = db.doc(`videoUploads/${String(input.videoUploadId ?? "")}`);
    const up = (await upRef.get()).data();
    if (!up || up.uid !== owner.uid) throw new MomentError(400, "The video hasn't finished uploading.");
    if (!(up.contentType in VIDEO_TYPES)) throw new MomentError(400, "Use an MP4 or WebM video.");
    let videoKey: string;
    if (up.streamUid) {
      // Sent straight to Stream (startMomentVideo), with the mark burned in: there once Stream has the file.
      if (up.verified !== true) {
        const v = await deps.stream?.get(String(up.streamUid)).catch(() => null);
        if (!v || v.state === "pendingupload" || v.state === "error") throw new MomentError(400, v?.state === "error" ? "Cloudflare couldn't take that video. Try an MP4." : "The video hasn't finished uploading.");
        await upRef.update({ verified: true, verifiedAt: now.toISOString() });
      }
      videoKey = `${STREAM_KEY}${up.streamUid}`;
    } else {
      // A video in our bucket (shared from a chat, lib/chat-media-server.ts): Stream copies it with the mark, and the bucket's copy goes.
      if (up.verified !== true) throw new MomentError(400, "The video hasn't finished uploading.");
      if (!String(up.key).startsWith(`moments/${owner.uid}/`)) throw new MomentError(400, "That video wasn't uploaded for a moment.");
      if (!deps.stream?.configured) throw new MomentError(503, "Video moments aren't switched on yet. Pictures and text work now.");
      const profileUid = await markProfile(db, owner, shapeOf(up.width, up.height, "9x16"), deps.stream, now);
      const c = await deps.stream.copy({ url: deps.publicUrl(String(up.key)), watermarkUid: profileUid, creatorUid: owner.uid, name: `moment of @${owner.username}`, signed: true, purpose: "moment" });
      await upRef.update({ streamUid: c.uid, bucketKey: up.key, verified: true }); // the other parts use the same Stream video
      videoKey = `${STREAM_KEY}${c.uid}`;
      // The bucket's copy is removed once Stream has it (sweepMomentCopies); a few minutes, not the moment's whole life.
    }
    // Which stretch of the file this moment plays: at most 90 seconds. A video that's short enough needs no clip.
    const start = input.clipStart === undefined ? 0 : Number(input.clipStart);
    const end = input.clipEnd === undefined ? Math.min(up.durationSec, MOMENT_VIDEO_MAX_SECONDS) : Number(input.clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > up.durationSec + 1) throw new MomentError(400, "That part of the video isn't valid.");
    if (end - start > MOMENT_VIDEO_MAX_SECONDS + 1) throw new MomentError(413, `Each moment can be up to ${MOMENT_VIDEO_MAX_SECONDS} seconds.`);
    doc.videoKey = videoKey;
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
  if (full.songId) await countUse(db, full.songId, "moments");
  if (text.includes("@")) {
    const u = (await db.doc(`users/${owner.uid}`).get()).data();
    await notifyMentions(db, { kind: "moment", sourceId: id, text, author: { uid: owner.uid, name: String(u?.displayName ?? owner.username), username: owner.username, avatar: String(u?.avatar ?? "") }, where: "in a moment", linkHref: `/u/${owner.username}` }, now).catch(() => {});
  }
  return toView(id, full, owner.uid, false, deps);
}

// Share to Moments (lib/share-targets.ts): a moment that carries an item's card (its title, cover and link, crediting whoever made it)
// with an optional caption. Everything else is a moment like any other: 24 hours unless the member picks 48 or 72, the same audience
// (followers, or anyone signed in if they made their moments public; a teen's only for people they follow back), the same daily limit.
// `resolve` builds the card from the item as it is now, and returns null for anything that isn't public (a draft, members-only, gone).
export type ShareInput = { share?: unknown; text?: unknown; hours?: unknown };
export async function shareToMoment(
  db: Firestore, owner: { uid: string; username: string }, input: ShareInput, deps: MomentDeps,
  resolve: (db: Firestore, ref: unknown) => Promise<ShareCard | null>, now = new Date()
): Promise<MomentView> {
  if (isKidUid(owner.uid)) throw new MomentError(403, "Moments aren't part of a child profile.");
  if (!owner.username) throw new MomentError(400, "Finish setting up your profile first.");
  const hours = input.hours === undefined ? MOMENT_DEFAULT_HOURS : input.hours;
  if (!isMomentHours(hours)) throw new MomentError(400, "A moment can last 24, 48 or 72 hours.");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length > MOMENT_TEXT_MAX) throw new MomentError(413, `Text can be up to ${MOMENT_TEXT_MAX} characters.`);
  await mentionGate(db, owner, text);
  const card = await resolve(db, input.share);
  if (!card) throw new MomentError(404, "That can't be shared: it may be private, a draft, or no longer there.");
  const link: MomentLink = Object.fromEntries(Object.entries(card).filter(([, v]) => v !== undefined)) as MomentLink;
  const id = randomBytes(8).toString("hex");
  const full: MomentDoc = {
    ownerUid: owner.uid, ownerUsername: owner.username, kind: "link", link, ...(text ? { text } : {}), hours,
    createdAt: now.toISOString(), expiresAt: momentExpiry(now, hours).toISOString(),
    likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: false, // the cover belongs to the item, never deleted with the moment
  };
  const usageRef = db.doc(`momentUsage/${owner.uid}_${dayKey(now)}`);
  const ownerDoc = (await db.doc(`users/${owner.uid}`).get()).data();
  const dailyLimit = await limit(db, "momentsPerDay", effectiveTier({ username: ownerDoc?.username ?? "", role: ownerDoc?.role ?? "reader", accountTier: ownerDoc?.accountTier ?? "standard" }));
  await db.runTransaction(async (t) => {
    const used = ((await t.get(usageRef)).data()?.count as number | undefined) ?? 0;
    if (used >= dailyLimit) throw new MomentError(429, `You can share ${dailyLimit} moments a day. Try again tomorrow.`);
    t.set(usageRef, { uid: owner.uid, day: dayKey(now), count: used + 1 }, { merge: true });
    t.set(db.doc(`moments/${id}`), { ...full, expireAt: new Date(full.expiresAt) });
  });
  // Fan points for sharing a creator's work (lib/fans.ts: 10 a share, 5 a day count).
  if (card.creatorUsername) await addFanPointsByUsername(db, card.creatorUsername, owner.uid, { action: "share" }).catch(() => 0);
  if (text.includes("@")) {
    await notifyMentions(db, { kind: "moment", sourceId: id, text, author: { uid: owner.uid, name: String(ownerDoc?.displayName ?? owner.username), username: owner.username, avatar: String(ownerDoc?.avatar ?? "") }, where: "in a moment", linkHref: `/u/${owner.username}` }, now).catch(() => {});
  }
  return toView(id, full, owner.uid, false, deps);
}

async function likedSet(db: Firestore, uid: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const snaps = await db.getAll(...ids.map((id) => db.doc(`moments/${id}/likes/${uid}`)));
  return new Set(snaps.filter((s) => s.exists).map((s) => s.ref.parent.parent!.id));
}

// A song's page (/sounds/<id>): the moments made with it that this viewer may see now (newest first, up to 60). Never signed out.
export async function momentsWithSong(db: Firestore, viewerUid: string | null, songId: string, deps: MomentDeps, now = new Date()): Promise<MomentGroup[]> {
  if (!viewerUid) return [];
  const snap = await db.collection("moments").where("songId", "==", songId).limit(200).get();
  const live = snap.docs.map((d) => ({ id: d.id, m: d.data() as MomentDoc })).filter((d) => isShowing(d.m, now)).sort((a, b) => b.m.createdAt.localeCompare(a.m.createdAt));
  const shown: { id: string; m: MomentDoc }[] = [];
  for (const d of live) { if (shown.length >= 60) break; if (await canSee(db, viewerUid, d.m)) shown.push(d); }
  const liked = await likedSet(db, viewerUid, shown.map((d) => d.id));
  const owners = Array.from(new Set(shown.map((d) => d.m.ownerUid)));
  const users = owners.length ? await db.getAll(...owners.map((u) => db.doc(`users/${u}`))) : [];
  const info = new Map(users.map((u) => [u.id, u.data()]));
  // One ring per person, like the Moments strip: tapping it plays their moments with this song in order.
  const groups = new Map<string, MomentGroup>();
  for (const d of shown) {
    const g = groups.get(d.m.ownerUid) ?? { ownerUid: d.m.ownerUid, ownerUsername: d.m.ownerUsername, displayName: String(info.get(d.m.ownerUid)?.displayName ?? d.m.ownerUsername), avatar: String(info.get(d.m.ownerUid)?.avatar ?? ""), moments: [] };
    g.moments.push(toView(d.id, d.m, viewerUid, liked.has(d.id), deps));
    groups.set(d.m.ownerUid, g);
  }
  for (const g of groups.values()) g.moments.reverse(); // oldest first within a person, as the viewer plays them
  return [...groups.values()];
}

export type MomentGroup = { ownerUid: string; ownerUsername: string; displayName: string; avatar: string; isOrg?: boolean; moments: MomentView[] };

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
  const unblocked = docs.filter((d) => !hidden.has(d.m.ownerUid));
  // Names and pictures for the tiles (one read for each member who has something up).
  const ownerIds = Array.from(new Set(unblocked.map((d) => d.m.ownerUid)));
  const owners = ownerIds.length ? await db.getAll(...ownerIds.map((u) => db.doc(`users/${u}`))) : [];
  // A teen's moments only when they follow the viewer back (teen mode).
  const teenOk = new Map<string, boolean>();
  for (const o of owners) if (hearsOnlyFromFollowed(o.data()) && o.id !== viewer.uid) teenOk.set(o.id, (await db.doc(`follows/${o.id}_${viewer.username}`).get()).exists);
  // A reshare of a teen's moment keeps to the teen's own audience (people they follow back), whoever reshared it.
  const roots = Array.from(new Set(unblocked.map((d) => d.m.resharedFrom?.rootOwnerUid).filter((u): u is string => !!u && u !== viewer.uid && !teenOk.has(u))));
  const rootUsers = roots.length ? await db.getAll(...roots.map((u) => db.doc(`users/${u}`))) : [];
  for (const r of rootUsers) if (hearsOnlyFromFollowed(r.data())) teenOk.set(r.id, await teenSees(db, r.id, String(r.data()?.username ?? ""), viewer.uid, viewer.username));
  const visible = unblocked.filter((d) => teenOk.get(d.m.ownerUid) !== false && (!d.m.resharedFrom || d.m.ownerUid === viewer.uid || teenOk.get(d.m.resharedFrom.rootOwnerUid) !== false));
  const liked = await likedSet(db, viewer.uid, visible.map((d) => d.id));
  const who = new Map(owners.map((o) => [o.id, { displayName: String(o.data()?.displayName ?? ""), avatar: String(o.data()?.avatar ?? ""), isOrg: o.data()?.accountKind === "organisation" }]));
  const groups = new Map<string, MomentGroup>();
  for (const { id, m } of visible.sort((a, b) => (a.m.createdAt < b.m.createdAt ? -1 : 1))) {
    const g = groups.get(m.ownerUid) ?? { ownerUid: m.ownerUid, ownerUsername: m.ownerUsername, displayName: who.get(m.ownerUid)?.displayName || m.ownerUsername, avatar: who.get(m.ownerUid)?.avatar ?? "", isOrg: who.get(m.ownerUid)?.isOrg ?? false, moments: [] };
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
  const { resharedFrom: _r, ...first } = docs[0].m;
  void _r;
  if (!(await canSee(db, viewerUid, first))) return [];
  // Each reshare also keeps to its original's audience when that's a teen's (teen mode).
  const ok = await Promise.all(docs.map((d) => (d.m.ownerUid === viewerUid ? true : rootOk(db, viewerUid, d.m))));
  const shown = docs.filter((_, i) => ok[i]);
  if (!shown.length) return [];
  const liked = await likedSet(db, viewerUid, shown.map((d) => d.id));
  return shown.sort((a, b) => (a.m.createdAt < b.m.createdAt ? -1 : 1)).map((d) => toView(d.id, d.m, viewerUid, liked.has(d.id), deps));
}

async function loadActive(db: Firestore, viewerUid: string, id: string, now: Date): Promise<{ m: MomentDoc }> {
  const m = (await db.doc(`moments/${id}`).get()).data() as MomentDoc | undefined;
  // Missing, expired and not-in-the-audience all look the same.
  if (!m || !isShowing(m, now) || !(await canSee(db, viewerUid, m))) throw new MomentError(404, "That moment isn't available any more.");
  return { m };
}

export async function toggleLike(db: Firestore, uid: string, id: string, now = new Date()): Promise<{ liked: boolean; likeCount: number }> {
  const { m } = await loadActive(db, uid, id, now);
  const likeRef = db.doc(`moments/${id}/likes/${uid}`);
  const ref = db.doc(`moments/${id}`);
  return db.runTransaction(async (t) => {
    const had = (await t.get(likeRef)).exists;
    if (had) t.delete(likeRef); else t.set(likeRef, { uid, at: now.toISOString(), ...(m.pinned ? {} : { expireAt: new Date(m.expiresAt) }) }); // a pinned one's go with it
    t.update(ref, { likeCount: FieldValue.increment(had ? -1 : 1) });
    return { liked: !had, likeCount: Math.max(0, m.likeCount + (had ? -1 : 1)) };
  });
}

// Counts each member once; the owner's own views don't count.
export async function recordView(db: Firestore, uid: string, id: string, now = new Date()): Promise<void> {
  const { m } = await loadActive(db, uid, id, now);
  if (m.ownerUid === uid) return;
  const viewRef = db.doc(`moments/${id}/views/${uid}`);
  const fresh = await db.runTransaction(async (t) => {
    if ((await t.get(viewRef)).exists) return false;
    t.set(viewRef, { uid, at: now.toISOString(), ...(m.pinned ? {} : { expireAt: new Date(m.expiresAt) }) });
    t.update(db.doc(`moments/${id}`), { viewCount: FieldValue.increment(1) });
    return true;
  });
  if (fresh && m.songId) await countPlay(db, m.songId, "moment", 1, now); // a first view of a moment with a song: one play of it
}

// A reshare puts the moment on the resharer's own ring for the rest of the original's time — never longer.
export async function reshare(db: Firestore, user: { uid: string; username: string }, id: string, deps: MomentDeps, now = new Date()): Promise<MomentView> {
  const { m } = await loadActive(db, user.uid, id, now);
  if (m.ownerUid === user.uid) throw new MomentError(400, "That's already your moment.");
  if (isMomentExpired(m.expiresAt, now)) throw new MomentError(400, "This moment's time is up, so it can't be reshared (it stays on its owner's Media because it's pinned).");
  // A reshare of a reshare is allowed; it points at the original so the chain can be traced and cleaned up together.
  const rootMomentId = m.resharedFrom?.rootMomentId ?? id;
  const rootOwnerUid = m.resharedFrom?.rootOwnerUid ?? m.ownerUid;
  if (rootOwnerUid === user.uid) throw new MomentError(400, "That began as your own moment.");
  if (!user.username) throw new MomentError(400, "Finish setting up your profile first.");
  // Teen mode: a teen's moment (or a teen's reshare of someone else's) stays with the people they follow back.
  const [rootOwner, owner] = await db.getAll(db.doc(`users/${rootOwnerUid}`), db.doc(`users/${m.ownerUid}`));
  if (!mayReshare(rootOwner.data()) || !mayReshare(owner.data())) throw new MomentError(403, RESHARE_BLOCKED);
  const newId = `rs_${user.uid}_${id}`; // one reshare per member per moment
  const { reported: _reported, pinned: _pinned, pinnedAt: _pinnedAt, ...rest } = m;
  void _reported; void _pinned; void _pinnedAt;
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
  // Teen mode: only people the teen follows can reply to their moments (kept on turning 18 by users.keepRepliesFollowers).
  const owner = (await db.doc(`users/${m.ownerUid}`).get()).data();
  if (hearsOnlyFromFollowed(owner)) {
    const me = String((await db.doc(`users/${uid}`).get()).data()?.username ?? "");
    const followed = !!me && (await db.doc(`follows/${m.ownerUid}_${me}`).get()).exists;
    if (!mayReach({ target: owner, self: false, targetFollowsThem: followed })) throw new MomentError(403, REPLY_BLOCKED(firstName(owner)));
  }
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

// Run by the scheduler: removes moments whose time is up, and their files. Reads are already refusing them. Pinned ones are passed by
// (they stay on the owner's Media); the query pages past them so a long list of pinned moments can't stall the sweep.
export async function sweepExpiredMoments(db: Firestore, deps: MomentDeps, now = new Date(), batch = 200): Promise<number> {
  let removed = 0;
  let after: string | null = null;
  for (let page = 0; page < 10 && removed < batch; page++) {
    let q = db.collection("moments").where("expiresAt", "<=", now.toISOString()).orderBy("expiresAt").limit(batch);
    if (after) q = q.startAfter(after);
    const snap = await q.get();
    for (const d of snap.docs) {
      const m = d.data() as MomentDoc;
      if (m.pinned === true) continue;
      await removeMoment(db, d.id, m, deps);
      removed++;
    }
    if (snap.size < batch) break;
    after = String(snap.docs[snap.docs.length - 1].data().expiresAt);
  }
  return removed;
}

// Pin a moment to the top of the owner's Media, or unpin it. Pinned, it stays past its time (the TTL field is removed); unpinned after its
// time is up, it goes now, with its files; unpinned before, it keeps its original time.
export async function pinMoment(db: Firestore, uid: string, id: string, pin: boolean, deps: MomentDeps, now = new Date()): Promise<{ pinned: boolean; removed: boolean }> {
  const ref = db.doc(`moments/${id}`);
  const m = (await ref.get()).data() as MomentDoc | undefined;
  if (!m || m.ownerUid !== uid || !isShowing(m, now)) throw new MomentError(404, "That moment wasn't found.");
  if (pin) {
    if (m.pinned) return { pinned: true, removed: false };
    const mine = await db.collection("moments").where("ownerUid", "==", uid).get(); // one field, no index needed
    if (mine.docs.filter((d) => d.data().pinned === true).length >= MOMENTS_PINNED_MAX) throw new MomentError(409, `You can pin up to ${MOMENTS_PINNED_MAX} moments. Unpin one first.`);
    await ref.update({ pinned: true, pinnedAt: now.toISOString(), expireAt: FieldValue.delete() });
    return { pinned: true, removed: false };
  }
  if (!m.pinned) return { pinned: false, removed: false };
  if (isMomentExpired(m.expiresAt, now)) {
    await removeMoment(db, id, { ...m, pinned: false }, deps);
    return { pinned: false, removed: true };
  }
  await ref.update({ pinned: false, pinnedAt: FieldValue.delete(), expireAt: new Date(m.expiresAt) });
  return { pinned: false, removed: false };
}

// A member's pinned moments, newest pin first, for the top of their Media; only for viewers in the moment's audience (the same check as
// the ring). Expired ones are included: that's what pinning is for.
export async function listPinnedMoments(db: Firestore, viewerUid: string | null, ownerUid: string, deps: MomentDeps): Promise<MomentView[]> {
  if (!viewerUid) return []; // moments are never shown signed out
  const snap = await db.collection("moments").where("ownerUid", "==", ownerUid).get();
  const pinned = snap.docs.map((d) => ({ id: d.id, m: d.data() as MomentDoc })).filter((d) => d.m.pinned === true);
  if (!pinned.length || !(await canSee(db, viewerUid, pinned[0].m))) return [];
  const ok = await Promise.all(pinned.map((d) => (d.m.ownerUid === viewerUid ? true : rootOk(db, viewerUid, d.m))));
  const shown = pinned.filter((_, i) => ok[i]);
  const liked = await likedSet(db, viewerUid, shown.map((d) => d.id));
  return shown.sort((a, b) => String(b.m.pinnedAt ?? "").localeCompare(String(a.m.pinnedAt ?? ""))).map((d) => toView(d.id, d.m, viewerUid, liked.has(d.id), deps));
}

// Where the member stands on video moments this week: the plan's allowance, what's used, and what's left.
const weeklyVideoLimit = (db: Firestore, tier: AccountTier) => limit(db, "momentVideosPerWeek", tier);

export async function momentVideoQuota(db: Firestore, uid: string, tier: AccountTier, now = new Date()): Promise<{ limit: number; used: number; remaining: number }> {
  const limit = await weeklyVideoLimit(db, tier);
  const used = ((await db.doc(`videoUsage/${uid}_${isoWeekKey(now)}_moment`).get()).data()?.count as number | undefined) ?? 0;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

// A moment's video goes straight from the browser to Cloudflare Stream (a one-time upload address), with the creator's watermark profile
// for the video's frame shape burned in (owner, 5 Nov 2026: "Move to Stream, burn in"), and signed playback (a moment is only for its
// audience). The same checks as before (type, size, length), and the plan's weekly video moments: a video longer than 90 seconds is cut
// into parts, one moment each, all playing their own stretch of the one Stream video; the parts it needs come out of the allowance, and if
// there isn't room for all of them only the first 90 seconds of as many parts as there is room for are used (`partsAllowed`).
export async function startMomentVideo(
  db: Firestore, owner: { uid: string; username: string }, tier: AccountTier, input: { size: number; contentType: string; durationSec: number; width?: unknown; height?: unknown },
  deps: Pick<MomentDeps, "stream">, now = new Date()
): Promise<{ id: string; uploadURL: string; partsAllowed: number; partsNeeded: number }> {
  const uid = owner.uid;
  if (!owner.username) throw new MomentError(400, "Finish setting up your profile first.");
  if (!deps.stream?.configured) throw new MomentError(503, "Video moments aren't switched on yet. Pictures and text work now.");
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
  try {
    const shape = shapeOf(input.width, input.height, "9x16");
    const profileUid = await markProfile(db, owner, shape, deps.stream, now);
    const up = await deps.stream.create(uid, input.durationSec, `moment of @${owner.username}`, profileUid);
    await db.doc(`videoUploads/${id}`).set({
      uid, streamUid: up.uid, size: input.size, contentType: input.contentType, durationSec: Math.round(input.durationSec), verified: false, quotaDoc,
      purpose: "moment", marked: true, shape, partsAllowed, partsNeeded, partsCreated: 0,
      createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000),
    });
    return { id, uploadURL: up.uploadURL, partsAllowed, partsNeeded };
  } catch (err) {
    await usageRef.update({ count: FieldValue.increment(-partsAllowed) }).catch(() => {});
    throw err;
  }
}

// A moment's video Stream is still copying from our bucket (one shared from a chat): once Stream has it, the bucket's copy is removed.
// An upload never used for a moment is removed from Stream when its upload record runs out (two days).
export async function sweepMomentCopies(db: Firestore, deps: MomentDeps, now = new Date(), batch = 50): Promise<number> {
  const snap = await db.collection("videoUploads").where("bucketKey", ">", "").limit(batch).get();
  let n = 0;
  for (const d of snap.docs) {
    const up = d.data();
    const v = await deps.stream?.get(String(up.streamUid)).catch(() => null);
    const old = now.getTime() - Date.parse(String(up.createdAt ?? now.toISOString())) > 86_400_000;
    if (v?.readyToStream || v?.state === "error" || old) { await deps.remove(String(up.bucketKey)).catch(() => {}); await d.ref.update({ bucketKey: FieldValue.delete() }); n++; }
  }
  return n;
}

// A player link for a moment's Stream video (signed, a few hours), for someone in the moment's audience (the same check as everything else).
export async function momentPlayer(db: Firestore, viewerUid: string, id: string, deps: MomentDeps, now = new Date()): Promise<{ player: string }> {
  const { m } = await loadActive(db, viewerUid, id, now);
  const uid = streamUidOf(m.videoKey);
  if (!uid || !deps.stream) throw new MomentError(400, "That moment has no video to play.");
  return { player: `https://iframe.videodelivery.net/${encodeURIComponent(await deps.stream.token(uid, 6 * 3600))}` };
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
  if (!m || m.ownerUid !== ownerUid || !isShowing(m, now)) throw new MomentError(404, "That moment isn't available any more.");
  const snap = await db.collection(`moments/${id}/views`).orderBy("at", "desc").limit(200).get();
  if (snap.empty) return [];
  const users = await db.getAll(...snap.docs.map((d) => db.doc(`users/${d.id}`)));
  return snap.docs.map((d, i) => {
    const u = users[i].data();
    return { uid: d.id, username: u?.username ?? "", displayName: u?.displayName ?? "Member", avatar: u?.avatar ?? "", at: d.data().at };
  });
}
