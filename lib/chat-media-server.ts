import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { MessageError } from "./messages-server";
import type { MessageAttachment } from "./messages-rules";
import { MOMENT_VIDEO_MAX_SECONDS } from "./moments-rules";
import { createMoment, type MomentDeps } from "./moments-server";
import { safeFileName } from "./private-files";

// Server-only. Reusing one of your own chat photos or videos outside the chat (the full-screen viewer's "Post as my moment" and
// "Set as my profile picture"). Chat files are private, so this is the one place one is copied to the public media bucket, and only
// when the person who sent it asks: someone else's photo can be kept, forwarded or saved, never published.
export type ReuseTarget = "moment" | "avatar";
export type ReuseInput = { cid: unknown; mid: unknown; i: unknown; to: unknown; durationSec?: unknown };
export type ReuseDeps = { copy: (fromPrivateKey: string, toPublicKey: string, contentType: string) => Promise<void>; publicUrl: (key: string) => string; moments: MomentDeps };

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MOMENT_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export async function reuseOwnMedia(db: Firestore, me: { uid: string; username: string }, input: ReuseInput, deps: ReuseDeps, now = new Date()) {
  const to = input.to;
  if (to !== "moment" && to !== "avatar") throw new MessageError(400, "Choose a moment or your profile picture.");
  const cid = String(input.cid ?? "-"), mid = String(input.mid ?? "-"), i = Number(input.i ?? 0);
  const conv = (await db.doc(`conversations/${cid}`).get()).data();
  if (!conv || !(conv.participants as string[]).includes(me.uid)) throw new MessageError(404, "That file wasn't found.");
  const msg = (await db.doc(`conversations/${cid}/messages/${mid}`).get()).data();
  const a = (msg?.attachments as MessageAttachment[] | undefined)?.[i];
  if (!msg || !a || msg.deleted || msg.removed) throw new MessageError(404, "That file wasn't found.");
  if (msg.from !== me.uid) throw new MessageError(403, "You can only use photos and videos you sent yourself.");

  const folder = to === "avatar" ? "avatars" : "moments";
  const key = `${folder}/${me.uid}/${now.getTime()}-${safeFileName(a.name)}`;
  if (to === "avatar") {
    if (a.kind !== "image" || !AVATAR_TYPES.has(a.type)) throw new MessageError(400, "Use a JPEG, PNG or WebP photo for your profile picture.");
    await deps.copy(a.key, key, a.type);
    return { url: deps.publicUrl(key) };
  }
  if (a.kind === "image" && a.type.startsWith("image/")) {
    await deps.copy(a.key, key, a.type);
    return { moment: await createMoment(db, me, { kind: "image", imageKey: key }, deps.moments) };
  }
  if (a.kind === "video" && MOMENT_VIDEO_TYPES.has(a.type)) {
    // Chat videos don't store their length; the viewer reads it from the video it is playing (as the moment composer does).
    const durationSec = Number(input.durationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) throw new MessageError(400, "Play the video for a moment first, so we know how long it is.");
    await deps.copy(a.key, key, a.type);
    const id = randomBytes(8).toString("hex");
    await db.doc(`videoUploads/${id}`).set({ uid: me.uid, key, size: a.size, contentType: a.type, durationSec: Math.round(durationSec), verified: true, verifiedAt: now.toISOString(), purpose: "moment", fromChat: { cid, mid, i }, createdAt: now.toISOString() });
    return { moment: await createMoment(db, me, { kind: "video", videoUploadId: id, clipStart: 0, clipEnd: Math.min(durationSec, MOMENT_VIDEO_MAX_SECONDS) }, deps.moments) };
  }
  throw new MessageError(400, "Moments take photos, and MP4 or WebM videos.");
}
