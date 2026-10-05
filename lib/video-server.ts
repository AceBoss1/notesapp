import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES, VIDEO_WEEKLY_LIMIT, fmtBytes, isoWeekKey, sniffVideo } from "./video-rules";
import type { AccountTier } from "./users";

// Server side of post videos. Flow: the composer asks to upload (`startVideoUpload`: type, size, length and the
// weekly quota are checked, the file is limited to its declared size by the signed URL), PUTs the file straight to R2,
// then asks us to verify it (`finishVideoUpload`: the stored size matches and the first bytes really are MP4/WebM).
// Only then is `videoUploads/{id}` marked verified — and firestore.rules refuse to save a post that points at a video
// that isn't a verified upload by that same member. Everything here takes its dependencies as arguments so it can be tested.
export class VideoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type StartInput = { size: number; contentType: string; durationSec: number };

export async function startVideoUpload(
  db: Firestore,
  uid: string,
  tier: AccountTier,
  input: StartInput,
  presign: (key: string, contentType: string, size: number) => Promise<string>,
  now = new Date()
): Promise<{ id: string; key: string; uploadUrl: string }> {
  const ext = VIDEO_TYPES[input.contentType];
  if (!ext) throw new VideoError(400, "Use an MP4 (H.264) or WebM video.");
  if (!Number.isInteger(input.size) || input.size <= 0) throw new VideoError(400, "That file looks empty.");
  if (input.size > VIDEO_MAX_BYTES) throw new VideoError(413, `That video is ${fmtBytes(input.size)} — the limit is ${fmtBytes(VIDEO_MAX_BYTES)}.`);
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) throw new VideoError(400, "We couldn't read the video's length.");
  if (input.durationSec > VIDEO_MAX_SECONDS + 1) throw new VideoError(413, `Videos can be up to ${VIDEO_MAX_SECONDS / 60} minutes.`);

  const limit = VIDEO_WEEKLY_LIMIT[tier] ?? 0;
  const usageRef = db.doc(`videoUsage/${uid}_${isoWeekKey(now)}`);
  await db.runTransaction(async (t) => {
    const used = ((await t.get(usageRef)).data()?.count as number | undefined) ?? 0;
    if (used >= limit) {
      throw new VideoError(429, limit === 0 ? "Your plan can't publish video." : `You've used your ${limit} video upload${limit === 1 ? "" : "s"} for this week. It resets on Monday, or move up a plan for more.`);
    }
    t.set(usageRef, { uid, week: isoWeekKey(now), count: used + 1 }, { merge: true });
  });

  const id = randomBytes(8).toString("hex");
  const key = `videos/${uid}/${id}.${ext}`;
  try {
    const uploadUrl = await presign(key, input.contentType, input.size);
    await db.doc(`videoUploads/${id}`).set({
      uid, key, size: input.size, contentType: input.contentType, durationSec: Math.round(input.durationSec), verified: false,
      createdAt: now.toISOString(), expireAt: new Date(now.getTime() + 2 * 86_400_000), // unverified records clean themselves up
    });
    return { id, key, uploadUrl };
  } catch (err) {
    await usageRef.update({ count: FieldValue.increment(-1) }).catch(() => {});
    throw err;
  }
}

export type FinishDeps = {
  head: (key: string) => Promise<{ size: number } | null>;
  readStart: (key: string) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
};

export async function finishVideoUpload(db: Firestore, uid: string, id: string, deps: FinishDeps, now = new Date()): Promise<{ key: string; size: number }> {
  const ref = db.doc(`videoUploads/${id}`);
  const rec = (await ref.get()).data();
  if (!rec || rec.uid !== uid) throw new VideoError(404, "That upload wasn't found.");
  if (rec.verified === true) return { key: rec.key, size: rec.size };

  const reject = async (why: string): Promise<never> => {
    await deps.remove(rec.key).catch(() => {});
    await ref.delete().catch(() => {});
    // The attempt doesn't count against this week's quota.
    await db.doc(`videoUsage/${uid}_${isoWeekKey(new Date(rec.createdAt))}`).update({ count: FieldValue.increment(-1) }).catch(() => {});
    throw new VideoError(400, why);
  };

  const head = await deps.head(rec.key);
  if (!head) throw new VideoError(409, "The video hasn't finished uploading yet.");
  if (head.size !== rec.size || head.size > VIDEO_MAX_BYTES) return reject("The uploaded file didn't match what you selected. Try again.");
  const kind = sniffVideo(await deps.readStart(rec.key));
  if (!kind || kind !== VIDEO_TYPES[rec.contentType]) {
    return reject("That file isn't a standard MP4 (H.264) or WebM video. Phones' HEVC/.mov files need exporting as MP4 (H.264) first.");
  }
  await ref.update({ verified: true, verifiedAt: now.toISOString(), expireAt: FieldValue.delete() });
  return { key: rec.key, size: head.size };
}
