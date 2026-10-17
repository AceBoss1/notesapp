import type { Firestore } from "firebase-admin/firestore";
import { DEFAULT_AVATAR } from "./admin";

// A member's past profile pictures (shown like Facebook's: swipe or ‹ › through them). profilePictures/{id}: uid, url,
// createdAt. Public to read (they were public profile pictures); only the server writes. Pictures from before this was kept
// weren't recorded, so a history starts with the picture someone had when they next changed it.
export class PictureError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type ProfilePicture = { id: string; url: string; createdAt: string };
const MAX_PER_MEMBER = 200;

// Our uploads and the built-in images only: a picture someone actually used, never an arbitrary address.
export const isPictureUrl = (u: unknown, mediaBase: string): u is string =>
  typeof u === "string" && u.length <= 600 && u !== DEFAULT_AVATAR && (u.startsWith("/images/") || (!!mediaBase && u.startsWith(`${mediaBase.replace(/\/$/, "")}/`)));

// After a member changes their picture: the new one (it must be the avatar on their profile now) and, the first time, the one
// it replaced, so the history isn't just one picture.
export async function recordPicture(db: Firestore, uid: string, body: { url?: unknown; previous?: unknown }, mediaBase: string, now = new Date()): Promise<void> {
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user) throw new PictureError("Profile not found.", 404);
  if (!isPictureUrl(body.url, mediaBase) || user.avatar !== body.url) throw new PictureError("That isn't your profile picture.");
  const mine = await db.collection("profilePictures").where("uid", "==", uid).get(); // one field, no index needed
  const have = new Set(mine.docs.map((d) => String(d.data().url)));
  if (mine.size >= MAX_PER_MEMBER) throw new PictureError("You have a lot of pictures already. Remove some old ones first.");
  const batch = db.batch();
  if (isPictureUrl(body.previous, mediaBase) && !have.has(body.previous) && body.previous !== body.url) {
    batch.set(db.collection("profilePictures").doc(), { uid, url: body.previous, createdAt: new Date(now.getTime() - 1000).toISOString() });
  }
  if (!have.has(body.url)) batch.set(db.collection("profilePictures").doc(), { uid, url: body.url, createdAt: now.toISOString() });
  await batch.commit();
}

// A member takes an old picture out of their history (not the one they're using now).
export async function removePicture(db: Firestore, uid: string, id: string): Promise<void> {
  if (!id || id.includes("/")) throw new PictureError("Which picture?");
  const ref = db.doc(`profilePictures/${id}`);
  const p = (await ref.get()).data();
  if (!p || p.uid !== uid) throw new PictureError("Picture not found.", 404);
  const user = (await db.doc(`users/${uid}`).get()).data();
  if (user?.avatar === p.url) throw new PictureError("That's your profile picture now. Change it first, then remove this one.");
  await ref.delete();
}
