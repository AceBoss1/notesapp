import { PutObjectCommand } from "@aws-sdk/client-s3";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Fetch } from "./ai-providers";
import { setting } from "./config";
import {
  AVATAR_CLOSED, AVATAR_FOLDER, AVATAR_MAKER_FOR_EVERYONE, AVATAR_MODEL, AVATAR_NOT_SET_UP, AVATAR_PER_DAY, AvatarError, avatarDay, checkPhoto,
  isAvatarProvider, photoType, type AvatarStatus,
} from "./avatar-maker";
import { drawAvatar, type AvatarConfig, type Photo } from "./avatar-providers";
import { hasStaffPass } from "./staff-pass-server";

// Server side of Nana's avatar maker (lib/avatar-maker.ts). Collections, server-only in firestore.rules:
//   avatarCounts/{uid}_{day}  how many avatars a member made on a Lagos day (the daily limit), and when the last one was made
// The finished picture goes to the media bucket under avatars/{uid}/, so it can be set as a profile picture like any upload
// (lib/profile-pictures.ts accepts only our own addresses). The member's photo is sent to the image model and is not kept by us.
export type AvatarDeps = {
  config: () => AvatarConfig | null;
  fetch: Fetch;
  mark: (picture: Buffer, type: string) => Promise<{ bytes: Buffer; type: string }>;
  store: (key: string, bytes: Buffer, type: string) => Promise<string>;
};

// Which image model is set up: AVATAR_IMAGE_PROVIDER (openai or gemini) and AVATAR_IMAGE_KEY; AVATAR_IMAGE_MODEL only to change the model.
export function avatarConfig(): AvatarConfig | null {
  const provider = (setting("AVATAR_IMAGE_PROVIDER") || "").trim().toLowerCase();
  const key = (setting("AVATAR_IMAGE_KEY") || "").trim();
  if (!isAvatarProvider(provider) || !key) return null;
  return { provider, key, model: (setting("AVATAR_IMAGE_MODEL") || "").trim() || AVATAR_MODEL[provider] };
}
const r2Ready = () => !!(setting("R2_ACCOUNT_ID") && setting("R2_ACCESS_KEY_ID") && setting("R2_SECRET_ACCESS_KEY") && setting("NEXT_PUBLIC_R2_PUBLIC_URL"));
async function storeAvatar(key: string, bytes: Buffer, type: string): Promise<string> {
  if (!r2Ready()) throw new AvatarError("Pictures can't be kept here: the media storage isn't set up.", 503);
  const { getR2Client, R2_BUCKET, r2PublicUrl } = await import("./r2");
  await getR2Client().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: type, CacheControl: "public, max-age=31536000, immutable" }));
  return r2PublicUrl(key);
}
export const realAvatarDeps = (): AvatarDeps => ({
  config: avatarConfig,
  fetch: (url, init) => fetch(url, init),
  mark: async (picture, type) => { const { markAvatar } = await import("./avatar-render"); return markAvatar(picture, type); },
  store: storeAvatar,
});

const countRef = (db: Firestore, uid: string, day: string) => db.collection("avatarCounts").doc(`${uid}_${day}`);
const allowed = async (db: Firestore, uid: string, now: Date) => AVATAR_MAKER_FOR_EVERYONE || (await hasStaffPass(db, uid, now));

// What the profile page needs to decide whether to show the maker, and how many are left today.
export async function avatarStatus(db: Firestore, uid: string, deps: Pick<AvatarDeps, "config"> = { config: avatarConfig }, now = new Date()): Promise<AvatarStatus> {
  if (!(await allowed(db, uid, now))) return { open: false, ready: false, limit: 0, used: 0, left: 0, closed: AVATAR_CLOSED };
  const used = Number((await countRef(db, uid, avatarDay(now)).get()).data()?.count) || 0;
  return { open: true, ready: !!deps.config(), limit: AVATAR_PER_DAY, used, left: Math.max(0, AVATAR_PER_DAY - used) };
}

// A photo in, the marked avatar's address out. The day's count goes up only when a picture was made and kept.
export async function makeAvatar(db: Firestore, uid: string, photo: Buffer, deps: AvatarDeps = realAvatarDeps(), now = new Date()): Promise<{ url: string; left: number }> {
  if (!(await allowed(db, uid, now))) throw new AvatarError(AVATAR_CLOSED, 403);
  const config = deps.config();
  if (!config) throw new AvatarError(AVATAR_NOT_SET_UP, 503);
  const input: Photo = { bytes: photo, type: checkPhoto(photo) };
  const ref = countRef(db, uid, avatarDay(now));
  const used = Number((await ref.get()).data()?.count) || 0;
  if (used >= AVATAR_PER_DAY) throw new AvatarError(`You've made ${AVATAR_PER_DAY} avatars today. You can make more tomorrow.`, 429);
  const drawn = await drawAvatar(deps.fetch, config, input);
  const marked = await deps.mark(drawn, photoType(drawn) ?? "image/png");
  const ext = marked.type === "image/webp" ? "webp" : "png";
  const url = await deps.store(`${AVATAR_FOLDER}/${uid}/${now.getTime()}-nana.${ext}`, marked.bytes, marked.type);
  await ref.set({ uid, count: FieldValue.increment(1), lastAt: now.toISOString() }, { merge: true });
  return { url, left: Math.max(0, AVATAR_PER_DAY - used - 1) };
}

// ── Nana AI, the portrait studio (lib/nana-portrait.ts) ──
// The same gate, engine and daily number as the avatar maker, a different picture: a photographic portrait in the chosen look. Free
// plans get the mark drawn in here; paid plans get the picture as it came. The portrait is returned to the page (as a data address),
// not kept: the member downloads it. The member's photo is not kept either.
export type PortraitDeps = Omit<AvatarDeps, "store"> & { webp: (png: Buffer) => Promise<Buffer | null> };
export const realPortraitDeps = (): PortraitDeps => {
  const { store: _store, ...rest } = realAvatarDeps();
  void _store;
  return { ...rest, webp: async (png) => { const { toWebp } = await import("./cover-render"); return toWebp(png, 88); } };
};
export async function makePortrait(
  db: Firestore, uid: string, photo: Buffer, opts: { prompt: string; paid: boolean }, deps: PortraitDeps = realPortraitDeps(), now = new Date(),
): Promise<{ image: string; marked: boolean; left: number }> {
  if (!(await allowed(db, uid, now))) throw new AvatarError(AVATAR_CLOSED.replace("Nana's avatar maker", "Nana AI"), 403);
  const config = deps.config();
  if (!config) throw new AvatarError(AVATAR_NOT_SET_UP.replace("The avatar maker", "Nana AI"), 503);
  const input: Photo = { bytes: photo, type: checkPhoto(photo) };
  const ref = countRef(db, uid, avatarDay(now));
  const used = Number((await ref.get()).data()?.count) || 0;
  if (used >= AVATAR_PER_DAY) throw new AvatarError(`You've made ${AVATAR_PER_DAY} Nana pictures today. You can make more tomorrow.`, 429);
  const drawn = await drawAvatar(deps.fetch, config, input, opts.prompt);
  const drawnType = photoType(drawn) ?? "image/png";
  let out: { bytes: Buffer; type: string };
  if (opts.paid) {
    const webp = drawnType === "image/webp" ? drawn : await deps.webp(drawn).catch(() => null);
    out = webp ? { bytes: webp, type: "image/webp" } : { bytes: drawn, type: drawnType };
  } else out = await deps.mark(drawn, drawnType);
  await ref.set({ uid, count: FieldValue.increment(1), lastAt: now.toISOString() }, { merge: true });
  return { image: `data:${out.type};base64,${out.bytes.toString("base64")}`, marked: !opts.paid, left: Math.max(0, AVATAR_PER_DAY - used - 1) };
}
