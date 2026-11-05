// The permanent NotesApp mark beyond Media posts, against the Firestore emulator: shop item photos, service pictures and journal pictures
// marked as they're uploaded (/api/upload/mark, lib/mark-uploads-server.ts), and the one-off re-marking job (lib/media-mark-backfill.ts)
// over everything posted before the mark: Media pictures and videos, replays, shop items, services and journals. Pictures are written
// over their own addresses in their own format (no swap, no delete), except one still used unmarked or a GIF (a new key, original kept).
// Resumable, safe to run again, survives a failure part-way, counts storage again. The bucket and Cloudflare Stream are stand-ins.
// Run: npm run test:marks-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { MediaDeps } from "../../lib/media-server";
import { IN_PLACE_CACHE, keyOfUrl, markKey, markUpload } from "../../lib/mark-uploads-server";
import { controlBackfill, getBackfill, picturesIn, runBackfill } from "../../lib/media-mark-backfill";
import { sniffPicture } from "../../lib/media-rules";
import { FormatNotKept } from "../../lib/media-mark";
import { createHash } from "node:crypto";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

// ── Stand-ins ──
const B = "https://cdn.test";
const objects = new Map<string, Buffer>();
const removed: string[] = [], written: string[] = [];
const cacheOf = new Map<string, string | undefined>(), typeOf = new Map<string, string>();
let failWrites = 0;
const stream = new Map<string, { readyToStream: boolean; size?: number; state?: string; width?: number; height?: number; signed?: boolean; watermark?: string; from?: string }>();
const dlOn = new Map<string, { status: "inprogress" | "ready" | "error"; url: string }>();
const profiles: string[] = [], streamRemoved: string[] = [];
let cp = 0, wm = 0;
const TAIL = (u: string) => Buffer.from(`|na@${u}`);
const deps: MediaDeps = {
  publicUrl: (k) => `${B}/${k}`,
  head: async (k) => (objects.has(k) ? { size: objects.get(k)!.length } : null),
  readStart: async (k) => objects.get(k)!.subarray(0, 32),
  read: async (k) => { if (!objects.has(k)) throw new Error("NoSuchKey"); return objects.get(k)!; },
  write: async (k, b, type, cache) => { if (failWrites > 0) { failWrites--; throw new Error("R2 hiccup"); } objects.set(k, b); written.push(k); cacheOf.set(k, cache); typeOf.set(k, type); },
  remove: async (k) => { objects.delete(k); removed.push(k); },
  // The mark stand-in: the picture plus "|na@user". keepFormat: WebP, JPEG and PNG come back in their own format; GIF can't be kept.
  markPicture: async (b, u, _s, o) => {
    const f = sniffPicture(b);
    if (!f) throw new Error("not a picture");
    if (o?.keepFormat && (f === "gif" || f === "avif")) throw new FormatNotKept();
    const kept = o?.keepFormat ? f : "webp";
    return { bytes: Buffer.concat([b, TAIL(u)]), type: kept === "jpeg" ? "image/jpeg" : `image/${kept}`, ext: kept === "jpeg" ? "jpg" : kept };
  },
  mediaBase: B,
  stream: {
    configured: true,
    create: async () => { throw new Error("no uploads here"); },
    get: async (uid) => stream.get(uid) ?? null,
    remove: async (uid) => { streamRemoved.push(uid); stream.delete(uid); dlOn.delete(uid); },
    downloads: {
      enable: async (uid) => { const d = { status: "inprogress" as const, url: `https://customer-x.cloudflarestream.com/${uid}/downloads/default.mp4` }; dlOn.set(uid, d); return d; },
      status: async (uid) => dlOn.get(uid) ?? null,
      disable: async (uid) => { dlOn.delete(uid); },
    },
    copy: async (o) => { const uid = `copy${++cp}`; stream.set(uid, { readyToStream: false, signed: o.signed, watermark: o.watermarkUid, from: o.url }); return { uid }; },
    token: async (uid, secs) => `tok-${uid}-${secs}`,
    watermark: async (o) => { profiles.push(o.name); return { uid: `wm${++wm}` }; },
    dropWatermark: async () => {},
    markPng: async () => Buffer.from("\x89PNG fake"),
  },
};
const WEBP = (n = 100) => Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 "), Buffer.alloc(n)]);
const put = (key: string, b: Buffer = WEBP()) => { objects.set(key, b); return key; };
const isMarkedFor = (key: string, u: string) => !!objects.get(key)?.subarray(-TAIL(u).length).equals(TAIL(u));

(async () => {
  const user = (uid: string, username: string, extra: object = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username, role: "reader", accountTier: "pro", ...extra });
  await user("u_ada", "ada"); await user("u_bayo", "bayo"); await user("u_org", "acmeorg", { accountTier: "business" });

  // ── New uploads: shop, service, journal pictures marked on the way in; the clean upload deleted ──
  const shop = await markUpload(db, "u_ada", { key: put("shop/u_ada/1-bag.webp"), purpose: "shop" }, deps);
  assert.deepEqual(shop, { key: "shop/u_ada/1-bag-na.webp", url: `${B}/shop/u_ada/1-bag-na.webp` });
  assert.ok(isMarkedFor(shop.key, "ada") && !objects.has("shop/u_ada/1-bag.webp"), "shop photo: marked with @ada, the clean upload gone");
  const svc = await markUpload(db, "u_ada", { key: put("services/u_ada/2-facial.webp"), purpose: "service" }, deps);
  assert.ok(isMarkedFor(svc.key, "ada") && !objects.has("services/u_ada/2-facial.webp"), "service picture marked");
  const note = await markUpload(db, "u_ada", { key: put("notes/u_ada/3-cover.webp"), purpose: "note" }, deps);
  assert.ok(isMarkedFor(note.key, "ada") && !objects.has("notes/u_ada/3-cover.webp"), "journal picture marked");
  // A co-author's picture in a journal carries the journal's primary author (here an organisation's post).
  await db.doc("notes/n_org").set({ title: "Acme", authorUid: "u_org", authorUsername: "acmeorg", writerUid: "u_ada", coAuthorUids: ["u_bayo"], content: "", status: "draft" });
  const co = await markUpload(db, "u_bayo", { key: put("notes/u_bayo/4.webp"), purpose: "note", noteId: "n_org" }, deps);
  assert.ok(isMarkedFor(co.key, "acmeorg"), "a co-author's picture: the journal's primary author");
  const notMine = await markUpload(db, "u_ada", { key: put("notes/u_ada/5.webp"), purpose: "note", noteId: "n_missing" }, deps);
  assert.ok(isMarkedFor(notMine.key, "ada"), "a journal not found: the uploader");
  await rejects(markUpload(db, "u_ada", { key: put("shop/u_bayo/x.webp"), purpose: "shop" }, deps), /wasn't uploaded here/, "someone else's folder");
  await rejects(markUpload(db, "u_ada", { key: put("journals/x.webp"), purpose: "shop" }, deps), /wasn't uploaded here/, "never a shared folder");
  await rejects(markUpload(db, "u_ada", { key: put("services/u_ada/x.webp"), purpose: "shop" }, deps), /wasn't uploaded here/, "the folder must match the kind");
  await rejects(markUpload(db, "u_ada", { key: "shop/u_ada/never.webp", purpose: "shop" }, deps), /hasn't finished uploading/);
  await rejects(markUpload(db, "u_ada", { key: put("shop/u_ada/page.webp", Buffer.from("<html>")), purpose: "shop" }, deps), /couldn't be read as a picture/);
  assert.ok(!objects.has("shop/u_ada/page.webp"), "a file that isn't a picture is deleted");
  await rejects(markUpload(db, "u_ada", { key: shop.key, purpose: "shop" }, deps), /wasn't uploaded here/, "a marked file isn't marked twice");

  // ── Helpers ──
  assert.equal(keyOfUrl(`${B}/journals/1-a.webp`, B), "journals/1-a.webp");
  assert.equal(keyOfUrl("https://elsewhere.test/a.jpg", B), null); assert.equal(keyOfUrl("/images/shop/a.jpg", B), null);
  assert.deepEqual(picturesIn(`Hi ![a](${B}/journals/1.webp) and <img src="${B}/notes/u/2.jpg"> and [link](${B}/journals/doc.pdf) ![x](https://other.test/3.png)`, B), [`${B}/journals/1.webp`, `${B}/notes/u/2.jpg`]);

  // ── Things posted before the mark ──
  // Media: a picture post, a video with a v0.134 download copy, a video still processing.
  put("media/u_ada/old-1.webp", WEBP(200)); put("media/u_ada/old-2.webp", WEBP(300));
  const base = { ownerUid: "u_ada", ownerUsername: "ada", caption: "", sound: "Original sound", audience: "everyone", allowComments: true, allowShares: true, allowGifts: true, pinned: false, createdAt: "2026-10-01T00:00:00Z", updatedAt: "", viewCount: 0, downloadCount: 0, sharesCount: 0, commentsCount: 0, reactions: {}, reactionsCount: 0, giftsTotal: 0, giftsCount: 0 };
  await db.doc("mediaPosts/a_pics").set({ ...base, kind: "pictures", status: "ready", allowDownloads: false, pictures: [{ key: "media/u_ada/old-1.webp", bytes: 216 }, { key: "media/u_ada/old-2.webp", bytes: 316 }], bytes: 532 });
  stream.set("old_v", { readyToStream: true, size: 5000, width: 1080, height: 1920 }); stream.set("old_copy", { readyToStream: true, size: 5100 });
  await db.doc("mediaPosts/b_vid").set({ ...base, kind: "video", status: "ready", allowDownloads: true, video: { streamUid: "old_v", durationSec: 30, bytes: 5000, uploadId: "x" }, bytes: 10100, videoDl: { state: "ready", copyUid: "old_copy", bytes: 5100 } });
  await db.doc("mediaPosts/c_proc").set({ ...base, kind: "video", status: "processing", allowDownloads: false, video: { streamUid: "proc_v", durationSec: 30, bytes: 10, uploadId: "y" }, bytes: 10 });
  // Replays: a video one, an audio one, one already marked.
  stream.set("rep_v", { readyToStream: true, size: 9000, width: 1280, height: 800 });
  const rep = { rid: "r", roomId: "x", cid: "c", communityName: "C", hostUid: "u_bayo", hostUsername: "bayo", hostName: "Bayo", title: "t", audience: "public", listed: true, createdAt: "", publishedAt: "", views: 0 };
  await db.doc("replays/r_video").set({ ...rep, kind: "video", status: "ready", streamUid: "rep_v" });
  await db.doc("replays/r_audio").set({ ...rep, kind: "audio", status: "ready", streamUid: "rep_a" });
  await db.doc("replays/r_done").set({ ...rep, kind: "video", status: "ready", streamUid: "rep_m", marked: true });
  // Shop items: our pictures (one shared by two items, a PNG, a GIF), an outside link and a picture shipped with the app.
  put("journals/10-bag.webp"); put("journals/11-shoe.webp");
  const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from("PNG\r\n"), Buffer.alloc(50)]), GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(40)]);
  put("journals/13-logo.png", PNG); put("journals/12-anim.gif", GIF);
  await db.doc("storeItems/s5").set({ ownerUid: "u_ada", title: "Logo and animation", image: `${B}/journals/13-logo.png`, images: [`${B}/journals/13-logo.png`, `${B}/journals/12-anim.gif`] });
  await db.doc("storeItems/s1").set({ ownerUid: "u_ada", title: "Bag", image: `${B}/journals/10-bag.webp`, images: [`${B}/journals/10-bag.webp`, `${B}/journals/11-shoe.webp`, "https://elsewhere.test/x.jpg"] });
  await db.doc("storeItems/s2").set({ ownerUid: "u_ada", title: "Bag again", image: `${B}/journals/10-bag.webp` });
  await db.doc("storeItems/s3").set({ ownerUid: "u_bayo", title: "Static", image: "/images/shop/x.jpg" });
  await db.doc("storeItems/s4").set({ title: "Ours, no owner", image: "/images/shop/y.jpg" });
  // A site: two service pictures; one is also the site's gallery picture (kept: only the service's copy is marked).
  put("journals/20-facial.webp"); put("journals/21-nails.webp");
  await db.doc("sites/u_bayo").set({ cover: "", blocks: { services: { on: true, items: [{ name: "Facial", image: `${B}/journals/20-facial.webp` }, { name: "Nails", image: `${B}/journals/21-nails.webp` }, { name: "Plain" }] }, gallery: { on: true, items: [{ image: `${B}/journals/21-nails.webp`, caption: "" }] } } });
  // Journals: a cover and a picture in the text; one under an admin-picked name (no account); one with no pictures.
  put("journals/30-cover.webp"); put("journals/31-inline.webp");
  await db.doc("notes/j1").set({ title: "J", authorUid: "u_bayo", featured_image: `${B}/journals/30-cover.webp`, content: `Intro\n\n![a](${B}/journals/31-inline.webp)\n\nAgain ![b](${B}/journals/31-inline.webp)`, status: "published" });
  await db.doc("notes/j2").set({ title: "Founder", author: "Emmanuel", featured_image: `${B}/journals/32-x.webp`, content: "", status: "published" });
  await db.doc("notes/j3").set({ title: "Words", authorUid: "u_bayo", featured_image: "", content: "Only words", status: "published" });
  // Storage counted wrong (the old download copy counted twice).
  await db.doc("mediaUsage/u_ada").set({ uid: "u_ada", bytes: 999_999 });

  // ── Not running until an admin starts it ──
  assert.equal((await runBackfill(db, deps)).status, "idle");
  await controlBackfill(db, "start", "admin1");
  // One small batch at a time (as if the cron were cut off after each): it keeps its place.
  const removedBefore = removed.length;
  failWrites = 1; // and a write that fails once: that item is counted as failed and the next run finishes it
  let s = await runBackfill(db, deps, { budgetMs: 1, batch: 1 });
  assert.equal(s.status, "running"); assert.equal(s.cursor, "a_pics");
  for (let i = 0; i < 40 && s.phase < 6; i++) s = await runBackfill(db, deps, { budgetMs: 1, batch: 1 });
  assert.equal(s.phase, 6, "every kind scanned");
  // Videos wait on Stream: the old video's MP4, then the marked copy.
  assert.equal(s.counts.mediaVideos.pending, 1); assert.equal(s.counts.replays.pending, 1);
  assert.equal(s.status, "running", "not done while videos are copying");
  dlOn.set("old_v", { status: "ready", url: "https://customer-x.cloudflarestream.com/old_v/downloads/default.mp4" });
  dlOn.set("rep_v", { status: "ready", url: "https://customer-x.cloudflarestream.com/rep_v/downloads/default.mp4" });
  s = await runBackfill(db, deps);
  const mcopy = Array.from(stream.entries()).find(([, v]) => v.from?.includes("old_v"))!, rcopy = Array.from(stream.entries()).find(([, v]) => v.from?.includes("rep_v"))!;
  assert.deepEqual([mcopy[1].signed, mcopy[1].from], [false, "https://customer-x.cloudflarestream.com/old_v/downloads/default.mp4"], "a Media video's copy plays publicly");
  assert.deepEqual([rcopy[1].signed, rcopy[1].from], [true, "https://customer-x.cloudflarestream.com/tok-rep_v-21600/downloads/default.mp4"], "a replay's copy stays signed; copied through a token");
  assert.deepEqual(profiles, ["NotesApp @ada 9x16", "NotesApp @bayo 16x10"], "each creator's profile for the video's frame");
  assert.ok(mcopy[1].watermark && rcopy[1].watermark);
  stream.set(mcopy[0], { ...mcopy[1], readyToStream: true, size: 5200 }); stream.set(rcopy[0], { ...rcopy[1], readyToStream: true, size: 9100 });
  s = await runBackfill(db, deps);
  assert.equal(s.status, "done");
  // The picture post whose write failed: nothing half-done is shown, and its clean file is untouched.
  assert.deepEqual(s.counts.mediaPictures, { done: 0, already: 0, pending: 0, failed: 1, skipped: 0, external: 0 });
  const half = (await db.doc("mediaPosts/a_pics").get()).data()!;
  assert.equal(half.marked, undefined, "not marked until every picture is");
  assert.ok(!isMarkedFor("media/u_ada/old-1.webp", "ada"));
  assert.match(String(s.lastError), /a_pics: R2 hiccup/);
  assert.deepEqual([s.counts.shopItems.done, s.counts.shopItems.already, s.counts.shopItems.external, s.counts.shopItems.skipped], [2, 1, 1, 1], "s1 and s5 marked; s2 shares s1's file");
  assert.deepEqual([s.counts.services.done, s.counts.journals.done, s.counts.journals.skipped], [1, 1, 1]);
  // "Run it again" finishes it.
  await controlBackfill(db, "start", "admin1");
  for (let i = 0; i < 10 && (s = await runBackfill(db, deps)).status === "running"; i++);
  assert.equal(s.status, "done");
  assert.deepEqual(s.counts.mediaPictures, { done: 1, already: 0, pending: 0, failed: 0, skipped: 0, external: 0 }, "finished on the second run");

  // ── What it did ──
  // Pictures are written over their own addresses: nothing to swap, nothing deleted, every copied link shows the mark.
  assert.equal(removed.length, removedBefore, "the job deletes no picture files");
  // Media pictures: same keys, marked bytes, storage follows the new size.
  const pics = (await db.doc("mediaPosts/a_pics").get()).data()!;
  assert.equal(pics.marked, true);
  assert.deepEqual(pics.pictures, [{ key: "media/u_ada/old-1.webp", bytes: 223, marked: true }, { key: "media/u_ada/old-2.webp", bytes: 323, marked: true }]);
  assert.ok(isMarkedFor("media/u_ada/old-1.webp", "ada") && isMarkedFor("media/u_ada/old-2.webp", "ada"), "marked in place");
  assert.equal(cacheOf.get("media/u_ada/old-1.webp"), IN_PLACE_CACHE, "a short cache time on an overwritten picture");
  assert.equal(typeOf.get("media/u_ada/old-1.webp"), "image/webp");
  assert.equal(pics.bytes, 216 + 7 + 316 + 7);
  // Media video: points at the marked copy, the old video and the old download copy deleted, downloads on the new one, bytes once.
  const vid = (await db.doc("mediaPosts/b_vid").get()).data()!;
  assert.deepEqual([vid.video.streamUid, vid.video.marked, vid.marked, vid.bytes, vid.videoDl, vid.remark, vid.remarkPending], [mcopy[0], true, true, 5200, undefined, undefined, undefined]);
  assert.ok(streamRemoved.includes("old_v") && streamRemoved.includes("old_copy"), "the unmarked video and the v0.134 copy are deleted");
  assert.equal(vid.download.state, "rendering"); assert.ok(dlOn.has(mcopy[0]), "the creator allowed downloads: Stream makes the marked video's MP4");
  assert.equal((await db.doc("mediaPosts/c_proc").get()).data()!.marked, undefined, "a video still processing is left for a later run");
  // Replays.
  const rv = (await db.doc("replays/r_video").get()).data()!;
  assert.deepEqual([rv.streamUid, rv.marked], [rcopy[0], true]); assert.ok(streamRemoved.includes("rep_v"));
  assert.equal((await db.doc("replays/r_audio").get()).data()!.marked, undefined, "audio: nothing to mark");
  // Shop: same addresses, marked once (the file two items share too); a PNG stays PNG; a GIF gets a marked copy and keeps its original.
  const s1 = (await db.doc("storeItems/s1").get()).data()!, s2 = (await db.doc("storeItems/s2").get()).data()!, s5 = (await db.doc("storeItems/s5").get()).data()!;
  assert.equal(s1.image, `${B}/journals/10-bag.webp`); assert.deepEqual(s1.images, [`${B}/journals/10-bag.webp`, `${B}/journals/11-shoe.webp`, "https://elsewhere.test/x.jpg"]);
  assert.equal(s2.image, `${B}/journals/10-bag.webp`);
  assert.equal(written.filter((k) => k === "journals/10-bag.webp").length, 1, "marked once");
  assert.ok(isMarkedFor("journals/10-bag.webp", "ada") && isMarkedFor("journals/11-shoe.webp", "ada"));
  assert.equal(typeOf.get("journals/13-logo.png"), "image/png"); assert.ok(isMarkedFor("journals/13-logo.png", "ada"), "a PNG is written back as a PNG");
  assert.deepEqual(s5.images, [`${B}/journals/13-logo.png`, `${B}/journals/12-anim-na.webp`], "a GIF can't be written back: the item gets a marked copy");
  assert.ok(objects.get("journals/12-anim.gif")!.equals(GIF) && isMarkedFor("journals/12-anim-na.webp", "ada") && cacheOf.get("journals/12-anim-na.webp") === undefined, "its original kept; the new copy cached long");
  assert.equal((await db.doc("storeItems/s3").get()).data()!.image, "/images/shop/x.jpg");
  // Services: marked in place, except the one that is also the site's gallery picture (the gallery isn't marked): a new copy for the service.
  const site = (await db.doc("sites/u_bayo").get()).data()!;
  assert.deepEqual(site.blocks.services.items.map((x: { image?: string }) => x.image), [`${B}/journals/20-facial.webp`, `${B}/journals/21-nails-na.webp`, undefined]);
  assert.equal(site.blocks.gallery.items[0].image, `${B}/journals/21-nails.webp`, "the gallery isn't marked");
  assert.ok(isMarkedFor("journals/20-facial.webp", "bayo") && !isMarkedFor("journals/21-nails.webp", "bayo") && isMarkedFor("journals/21-nails-na.webp", "bayo"));
  // Journals: the cover and the inline picture marked where they are; the text unchanged.
  const j1 = (await db.doc("notes/j1").get()).data()!;
  assert.equal(j1.featured_image, `${B}/journals/30-cover.webp`);
  assert.equal(j1.content, `Intro\n\n![a](${B}/journals/31-inline.webp)\n\nAgain ![b](${B}/journals/31-inline.webp)`);
  assert.ok(isMarkedFor("journals/30-cover.webp", "bayo") && isMarkedFor("journals/31-inline.webp", "bayo"));
  assert.equal((await db.doc("notes/j2").get()).data()!.featured_image, `${B}/journals/32-x.webp`, "no account to name: left alone");
  // The second run's counts (everything else was done on the first), and storage counted again from the posts.
  assert.deepEqual([s.counts.mediaVideos.already, s.counts.mediaVideos.skipped, s.counts.replays.already, s.counts.replays.skipped], [1, 1, 2, 1]);
  assert.deepEqual([s.counts.shopItems.already, s.counts.shopItems.external, s.counts.shopItems.skipped, s.counts.services.already, s.counts.journals.already, s.counts.journals.skipped], [3, 1, 1, 1, 1, 1]);
  assert.equal((await db.doc("mediaUsage/u_ada").get()).data()!.bytes, 216 + 7 + 316 + 7 + 5200 + 10, "storage: each marked file once");
  assert.ok(s.recounted >= 1);

  // A run cut off right after writing over a picture (the record still says "writing"): the next run sees the file changed and doesn't
  // mark it twice.
  put("journals/40-x.webp"); const before = objects.get("journals/40-x.webp")!;
  await db.doc(`markedFiles/${createHash("sha1").update("journals/40-x.webp").digest("hex")}`).set({ from: "journals/40-x.webp", to: "journals/40-x.webp", inPlace: true, state: "writing", srcHash: createHash("sha1").update(before).digest("hex") });
  objects.set("journals/40-x.webp", Buffer.concat([before, TAIL("ada")])); // the write had landed
  const w1 = written.length;
  assert.deepEqual(await markKey(db, "journals/40-x.webp", { uid: "u_ada", username: "ada" }, "shop", deps), { key: "journals/40-x.webp", result: "already", inPlace: true, bytes: before.length + 7 });
  assert.equal(written.length, w1, "not written again");
  put("journals/41-y.webp"); const b41 = objects.get("journals/41-y.webp")!;
  await db.doc(`markedFiles/${createHash("sha1").update("journals/41-y.webp").digest("hex")}`).set({ from: "journals/41-y.webp", to: "journals/41-y.webp", inPlace: true, state: "writing", srcHash: createHash("sha1").update(b41).digest("hex") });
  assert.equal((await markKey(db, "journals/41-y.webp", { uid: "u_ada", username: "ada" }, "shop", deps)).result, "marked", "cut off before the write landed: marked now");
  assert.ok(isMarkedFor("journals/41-y.webp", "ada") && !objects.get("journals/41-y.webp")!.subarray(0, -7).subarray(-7).equals(TAIL("ada")), "marked once");

  // ── Run again: nothing changes, everything counts as already marked ──
  const w0 = written.length, r0 = removed.length, c0 = cp;
  await controlBackfill(db, "start", "admin1");
  for (let i = 0; i < 10 && (s = await runBackfill(db, deps)).status === "running"; i++);
  assert.equal(s.status, "done");
  assert.deepEqual([written.length, removed.length, cp], [w0, r0, c0], "idempotent: no new files, deletes or copies");
  assert.deepEqual([s.counts.mediaPictures.already, s.counts.mediaVideos.already, s.counts.replays.already, s.counts.shopItems.already, s.counts.services.already, s.counts.journals.already], [1, 1, 2, 3, 1, 1]);
  // Pause and carry on; only one run at a time.
  await controlBackfill(db, "start", "admin1"); await controlBackfill(db, "pause", "admin1");
  assert.equal((await runBackfill(db, deps)).status, "paused", "paused: the cron does nothing");
  await controlBackfill(db, "resume", "admin1");
  await db.doc("serverConfig/markBackfill").update({ lockUntil: Date.now() + 60_000 });
  assert.equal((await runBackfill(db, deps)).busy, true, "another run holds the lease");
  assert.equal((await getBackfill(db)).status, "running");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
