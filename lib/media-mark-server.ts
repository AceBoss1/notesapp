import type { Firestore } from "firebase-admin/firestore";
import {
  MARK_SHAPE_KEYS, STREAM_PROFILE, cleanWatermarkOverrides, markProfileKey, watermarkSettings, type MarkShape, type WatermarkSettings,
} from "./media-mark";

// Server side of the permanent NotesApp mark (lib/media-mark.ts has the look). The look lives in serverConfig/mediaWatermark (Admin →
// Limits → Media watermark), read through a 30-second cache; it applies to new uploads (and to the re-marking job while it runs). A
// creator's Cloudflare Stream watermark profiles live in mediaWatermarks/{uid} (server-only in firestore.rules): one per frame shape.

// ── The look ──
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

// ── Stream watermark profiles ──
export type MarkProfileDeps = {
  // POST /stream/watermarks: a PNG (transparent background) with how see-through it is, its padding, scale and position.
  watermark: (o: { png: Buffer; name: string; opacity: number; padding: number; scale: number; position: string }) => Promise<{ uid: string }>;
  dropWatermark: (uid: string) => Promise<void>;
  markPng: (username: string, shape: MarkShape, s: WatermarkSettings) => Promise<Buffer>; // lib/media-watermark.tsx renderVideoMark
};
type ProfileRow = { uid: string; key: string; createdAt: string };
type ProfilesDoc = { uid: string; profileUid?: string; profiles?: Partial<Record<MarkShape, ProfileRow>>; retired?: { uid: string; at: string }[] };
// A profile replaced (new look or new @username) is kept for 3 days before it is deleted from Stream, so an upload that was handed it a
// moment ago still finishes with it. Videos already made keep their mark either way: it is burned in.
export const RETIRE_AFTER_MS = 3 * 86_400_000;

export async function markProfile(db: Firestore, owner: { uid: string; username: string }, shape: MarkShape, deps: MarkProfileDeps, now = new Date()): Promise<string> {
  if (!MARK_SHAPE_KEYS.includes(shape)) throw new Error("unknown frame shape");
  const s = await getWatermarkSettings(db, now.getTime());
  const key = markProfileKey(owner.username, shape, s);
  const ref = db.doc(`mediaWatermarks/${owner.uid}`);
  const cur = ((await ref.get()).data() ?? { uid: owner.uid }) as ProfilesDoc;
  const have = cur.profiles?.[shape];
  const retired = (cur.retired ?? []).filter((r) => now.getTime() - Date.parse(r.at) < RETIRE_AFTER_MS);
  const due = (cur.retired ?? []).filter((r) => !retired.includes(r));
  for (const r of due) await deps.dropWatermark(r.uid).catch(() => {});
  if (have?.key === key && have.uid) {
    if (due.length) await ref.set({ retired }, { merge: true });
    return have.uid;
  }
  const png = await deps.markPng(owner.username, shape, s);
  const made = await deps.watermark({ png, name: `NotesApp @${owner.username} ${shape}`, ...STREAM_PROFILE });
  if (have?.uid) retired.push({ uid: have.uid, at: now.toISOString() });
  if (cur.profileUid) retired.push({ uid: cur.profileUid, at: now.toISOString() }); // the old download-copy profile (v0.134)
  await ref.set({ uid: owner.uid, profiles: { ...(cur.profiles ?? {}), [shape]: { uid: made.uid, key, createdAt: now.toISOString() } }, retired });
  return made.uid;
}

// Every profile of a creator (an account being deleted).
export async function dropMarkProfiles(db: Firestore, uid: string, deps: Pick<MarkProfileDeps, "dropWatermark">): Promise<void> {
  const ref = db.doc(`mediaWatermarks/${uid}`);
  const d = (await ref.get()).data() as ProfilesDoc | undefined;
  if (!d) return;
  for (const p of Object.values(d.profiles ?? {})) if (p?.uid) await deps.dropWatermark(p.uid).catch(() => {});
  if (d.profileUid) await deps.dropWatermark(d.profileUid).catch(() => {});
  for (const r of d.retired ?? []) await deps.dropWatermark(r.uid).catch(() => {});
  await ref.delete();
}
