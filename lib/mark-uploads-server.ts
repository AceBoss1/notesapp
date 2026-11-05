import { createHash } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { MARK_FOLDER, type MarkPurpose } from "./upload-rules";
import { getWatermarkSettings } from "./media-mark-server";
import { markedKey, type MediaDeps } from "./media-server";

// The permanent NotesApp mark on shop item photos, site service pictures and journal pictures (owner, 5 Nov 2026: "can we apply it on shop
// items, services image and journal too"), the same mark and the same rule as Media pictures (lib/media-mark.ts): the browser uploads to
// the member's own folder (shop/, services/, notes/: app/api/upload), then /api/upload/mark has our server draw the mark, write the
// marked copy next to it and delete the clean file. Only the marked address ever goes into an item, a site or a journal.
// Not marked (owner's list): profile pictures, site pictures (cover, banner, gallery), course covers, community pictures, chat, Notes Life.

export class MarkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type PictureStore = Pick<MediaDeps, "read" | "write" | "remove" | "markPicture" | "publicUrl" | "mediaBase">;

const usernameOf = async (db: Firestore, uid: string) => String((await db.doc(`users/${uid}`).get()).data()?.username ?? "");

// Whose @username goes in the corner: the uploader's, or for a journal picture the journal's primary author (its authorUid: an
// organisation for an organisation's post) when the uploader is one of its authors.
export async function markOwner(db: Firestore, uid: string, purpose: MarkPurpose, noteId?: unknown): Promise<string> {
  if (purpose === "note" && typeof noteId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(noteId)) {
    const n = (await db.doc(`notes/${noteId}`).get()).data();
    const authors = [n?.authorUid, n?.writerUid, ...((n?.coAuthorUids as string[] | undefined) ?? [])].filter(Boolean);
    if (n?.authorUid && authors.includes(uid)) {
      const name = String(n.authorUsername ?? "") || (await usernameOf(db, String(n.authorUid)));
      if (name) return name;
    }
  }
  return usernameOf(db, uid);
}

// One upload: checked to be the caller's own, marked, written; the clean file deleted. Returns the marked picture's key and address.
export async function markUpload(db: Firestore, uid: string, input: { key?: unknown; purpose: MarkPurpose; noteId?: unknown }, deps: PictureStore): Promise<{ key: string; url: string }> {
  const key = String(input.key ?? "");
  const folder = `${MARK_FOLDER[input.purpose]}/${uid}/`;
  if (!key.startsWith(folder) || key.includes("..") || !/^[A-Za-z0-9._/-]{1,300}$/.test(key) || /-na2?\.(webp|jpg)$/.test(key)) throw new MarkError(400, "That picture wasn't uploaded here.");
  const username = await markOwner(db, uid, input.purpose, input.noteId);
  if (!username) throw new MarkError(400, "Finish setting up your profile first: the mark carries your @username.");
  let src: Buffer;
  try { src = await deps.read(key); } catch { throw new MarkError(409, "The picture hasn't finished uploading. Try again."); }
  let out;
  try { out = await deps.markPicture(src, username, await getWatermarkSettings(db)); } catch {
    await deps.remove(key).catch(() => {});
    throw new MarkError(400, "That file couldn't be read as a picture. Try a JPEG or WebP.");
  }
  const marked = markedKey(key, out.ext);
  await deps.write(marked, out.bytes, out.type);
  await deps.remove(key);
  return { key: marked, url: deps.publicUrl(marked) };
}

// ── For the re-marking job (lib/media-mark-backfill.ts): pictures already on items, sites and journals ──
// Our bucket's key for an address, or null for anything else (an outside link, a picture shipped with the app): those are left alone.
export function keyOfUrl(url: string, mediaBase: string): string | null {
  const base = mediaBase.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  const key = decodeURIComponent(url.slice(base.length + 1).split(/[?#]/)[0]);
  return /^[A-Za-z0-9._/-]{1,400}$/.test(key) && !key.includes("..") ? key : null;
}
// A picture marked by the job is recorded (markedFiles/{hash of its old key}), so the same file used by two items is marked once and both
// point at the one marked copy, and running the job again changes nothing.
const fileRef = (db: Firestore, key: string) => db.doc(`markedFiles/${createHash("sha1").update(key).digest("hex")}`);
export const isMarkedKey = (key: string) => /-na2?\.(webp|jpg)$/.test(key);

// Is the clean file still used somewhere that isn't marked (the owner's site cover, banner or gallery, or their profile picture)? Then
// it is kept: only the copy on the item is marked (owner: don't mark shared originals behind the creator's back).
export async function usedUnmarked(db: Firestore, ownerUid: string, url: string): Promise<boolean> {
  const [u, site] = await db.getAll(db.doc(`users/${ownerUid}`), db.doc(`sites/${ownerUid}`));
  if (String(u.data()?.avatar ?? "") === url) return true;
  const sd = site.data();
  if (!sd) return false;
  const copy = JSON.parse(JSON.stringify(sd)) as { blocks?: { services?: { items?: { image?: string }[] } } };
  for (const it of copy.blocks?.services?.items ?? []) delete it.image; // service pictures are marked themselves
  return JSON.stringify(copy).includes(url);
}

export type UrlOutcome = { url: string; result: "marked" | "already" | "external" | "missing" | "failed"; kept?: boolean };
// One address on an item: the marked copy's address (made now, or found from an earlier run), or the same address when it is not ours.
export async function markUrl(db: Firestore, url: string, owner: { uid: string; username: string }, kind: string, deps: PictureStore, now = new Date()): Promise<UrlOutcome> {
  const key = keyOfUrl(url, deps.mediaBase);
  if (!key) return { url, result: "external" };
  if (isMarkedKey(key)) return { url, result: "already" };
  const ref = fileRef(db, key);
  const done = (await ref.get()).data();
  if (done?.to) return { url: deps.publicUrl(String(done.to)), result: "already" };
  let src: Buffer;
  try { src = await deps.read(key); } catch { return { url, result: "missing" }; }
  let out;
  try { out = await deps.markPicture(src, owner.username, await getWatermarkSettings(db, now.getTime())); } catch { return { url, result: "failed" }; }
  const to = markedKey(key, out.ext);
  await deps.write(to, out.bytes, out.type);
  const kept = await usedUnmarked(db, owner.uid, url);
  await ref.set({ from: key, to, kind, ownerUid: owner.uid, kept, at: now.toISOString() });
  return { url: deps.publicUrl(to), result: "marked", kept };
}
// After the item points at the marked copy: the clean file goes, unless something unmarked still uses it.
export async function dropClean(db: Firestore, url: string, deps: PictureStore): Promise<void> {
  const key = keyOfUrl(url, deps.mediaBase);
  if (!key || isMarkedKey(key)) return;
  const d = (await fileRef(db, key).get()).data();
  if (d?.to && d.kept !== true && !d.removed) { await deps.remove(key).catch(() => {}); await fileRef(db, key).update({ removed: true }); }
}
