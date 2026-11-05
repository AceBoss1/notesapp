// Media phase M1 against the Firestore emulator: uploads and plan limits, the permanent NotesApp mark (pictures marked before they show,
// the clean upload deleted; videos uploaded with the creator's Stream watermark profile), downloads of the marked files, audiences, teen rules, site
// pictures and their Hide switches, the profile picture album, and pinned Moments staying past their time. The bucket and Cloudflare
// Stream are stand-ins. Run: npm run test:media-server → "ALL OK".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  createMediaPost, creatorMedia, deleteMediaPost, downloadPicture, downloadVideo, mediaQuota, mediaStudio, refreshVideo, setMediaSettings, startMediaVideo, sweepProcessingVideos, updateMediaPost,
  type MediaDeps,
} from "../../lib/media-server";
import { listForOwner, listPinnedMoments, pinMoment, sweepExpiredMoments, toggleLike } from "../../lib/moments-server";
import { resetLimitCache } from "../../lib/limits-server";
import { sitePictureId, sniffPicture } from "../../lib/media-rules";
import { markPicture } from "../../lib/media-watermark";
import { eraseAccount } from "../../lib/account-server";
import { resetWatermarkCache } from "../../lib/media-mark-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

// ── Stand-ins for the bucket and Cloudflare Stream ──
const objects = new Map<string, Buffer>();
const removed: string[] = [], streamRemoved: string[] = [], written: string[] = [];
const stream = new Map<string, { readyToStream: boolean; duration?: number; size?: number; state?: string; width?: number; height?: number }>();
const dlOn = new Map<string, { status: "inprogress" | "ready" | "error"; url: string }>(); // MP4 downloads per Stream video
const created: { creator: string; watermarkUid: string }[] = [], profiles: { name: string; opacity: number; scale: number; padding: number; position: string; png: Buffer }[] = [];
const dropped: string[] = [], disabled: string[] = [];
let sv = 0, wm = 0, failWrites = 0;
// The mark stand-in: a picture comes back 8 bytes longer, ending with the @username it was marked for; anything else isn't a picture.
const MARK_TAIL = (u: string) => Buffer.from(`|na@${u}`);
const deps: MediaDeps = {
  publicUrl: (k) => `https://cdn.test/${k}`,
  head: async (k) => (objects.has(k) ? { size: objects.get(k)!.length } : null),
  readStart: async (k) => objects.get(k)!.subarray(0, 32),
  read: async (k) => { if (!objects.has(k)) throw new Error("NoSuchKey"); return objects.get(k)!; },
  write: async (k, b) => { if (failWrites > 0) { failWrites--; throw new Error("R2 is down"); } objects.set(k, b); written.push(k); },
  remove: async (k) => { objects.delete(k); removed.push(k); },
  markPicture: async (b, u) => { if (!sniffPicture(b)) throw new Error("not a picture"); return { bytes: Buffer.concat([b, MARK_TAIL(u)]), type: "image/webp", ext: "webp" }; },
  mediaBase: "https://cdn.test",
  stream: {
    configured: true,
    create: async (creator, _max, _name, watermarkUid) => { created.push({ creator, watermarkUid }); return { uploadURL: "https://upload.test/one-time", uid: `sv${++sv}` }; },
    get: async (uid) => stream.get(uid) ?? null,
    remove: async (uid) => { streamRemoved.push(uid); stream.delete(uid); },
    downloads: {
      enable: async (uid) => { const d = { status: "inprogress" as const, url: `https://customer-x.cloudflarestream.com/${uid}/downloads/default.mp4` }; dlOn.set(uid, d); return d; },
      status: async (uid) => dlOn.get(uid) ?? null,
      disable: async (uid) => { disabled.push(uid); dlOn.delete(uid); },
    },
    copy: async () => { throw new Error("no copies in this test (tests/media/marks.emulator.ts has the re-marking)"); },
    token: async (uid, secs) => `tok-${uid}-${secs}`,
    watermark: async (o) => { profiles.push(o); return { uid: `wm${++wm}` }; },
    dropWatermark: async (uid) => { dropped.push(uid); },
    markPng: (u, shape, st) => import("../../lib/media-watermark").then((m) => m.renderVideoMark(u, shape, st)),
  },
};
const marked = (k: string) => k.replace(/\.webp$/, "-na.webp");
const momentDeps = { publicUrl: (k: string) => `https://cdn.test/${k}`, remove: async () => {} };
const WEBP_STUB = Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 "), Buffer.alloc(100)]);
const put = (key: string, b: Buffer = WEBP_STUB) => { objects.set(key, b); return key; };

(async () => {
  const person = (uid: string, username: string, extra: object = {}) => Promise.all([
    db.doc(`users/${uid}`).set({ uid, username, displayName: username[0].toUpperCase() + username.slice(1), avatar: "", role: "reader", accountTier: "standard", ...extra }),
    db.doc(`usernames/${username}`).set({ uid }),
  ]);
  const follow = (fromUid: string, toUsername: string) => db.doc(`follows/${fromUid}_${toUsername}`).set({ followerUid: fromUid, username: toUsername, followedAt: "x" });
  await person("u_tunde", "tunde", { accountTier: "pro", avatar: "https://cdn.test/avatars/u_tunde/now.webp" });
  await person("u_fan", "fan"); await person("u_sub", "sub"); await person("u_stranger", "stranger"); await person("u_free", "freeone");
  await person("u_teen", "tobi", { teen: true }); await person("u_mutual", "mutual");
  await follow("u_fan", "tunde"); await follow("u_stranger", "tobi"); await follow("u_mutual", "tobi"); await follow("u_teen", "mutual");
  await db.doc("subscriptions/u_sub_tunde").set({ subscriberUid: "u_sub", username: "tunde", status: "active", currentPeriodEnd: new Date(Date.now() + 9e8).toISOString() });
  const T = { uid: "u_tunde", username: "tunde" };
  const fan = { uid: "u_fan", username: "fan" }, sub = { uid: "u_sub", username: "sub" }, stranger = { uid: "u_stranger", username: "stranger" };
  const mutual = { uid: "u_mutual", username: "mutual" }, teen = { uid: "u_teen", username: "tobi" };

  // ── Pictures: our own folder, real pictures, up to 10 ──
  const p1 = await createMediaPost(db, T, "pro", { kind: "pictures", caption: "Payday is not a holiday #MoneyNotes", pictureKeys: [put("media/u_tunde/1-a.webp"), put("media/u_tunde/1-b.webp")] }, deps);
  assert.equal(p1.status, "ready"); assert.equal(p1.pictures.length, 2); assert.equal(p1.audience, "everyone");
  // The permanent mark: each picture marked with @tunde under a new key, the clean upload deleted, only the marked one shown.
  assert.deepEqual(p1.pictures, ["https://cdn.test/media/u_tunde/1-a-na.webp", "https://cdn.test/media/u_tunde/1-b-na.webp"], "only the marked copies are shown");
  assert.ok(!objects.has("media/u_tunde/1-a.webp") && !objects.has("media/u_tunde/1-b.webp") && removed.includes("media/u_tunde/1-a.webp"), "the clean uploads are deleted");
  assert.ok(objects.get("media/u_tunde/1-a-na.webp")!.subarray(-9).equals(MARK_TAIL("tunde")), "marked for @tunde");
  const p1doc = (await db.doc(`mediaPosts/${p1.id}`).get()).data()!;
  assert.equal(p1doc.marked, true); assert.deepEqual(p1doc.pictures.map((x: { marked: boolean; cleanKey?: string }) => [x.marked, x.cleanKey]), [[true, undefined], [true, undefined]]);
  assert.equal(p1doc.bytes, (WEBP_STUB.length + 9) * 2, "the post counts the marked files");
  assert.equal(p1.allowDownloads, false, "downloads are off unless turned on");
  assert.equal(p1.commentsCount, 0, "M2's counters are there from the start");
  const stored = (await db.doc(`mediaPosts/${p1.id}`).get()).data()!;
  assert.deepEqual([stored.reactionsCount, stored.giftsTotal, stored.sound], [0, 0, "Original sound"], "reactions, gifts and original sound");
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_fan/x.webp")] }, deps), /wasn't uploaded for Media/, "someone else's folder");
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: ["media/u_tunde/never.webp"] }, deps), /hasn't finished uploading/);
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/page.webp", Buffer.from("<html><body>hi</body></html>"))] }, deps), /isn't a picture/);
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: Array.from({ length: 11 }, (_, i) => put(`media/u_tunde/m${i}.webp`)) }, deps), /Up to 10 pictures/);
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", caption: "x".repeat(2201), pictureKeys: [put("media/u_tunde/c.webp")] }, deps), /up to 2,200 characters/);

  // ── Plan limits from Admin → Limits: picture posts a day, storage ──
  await db.doc("serverConfig/limits").set({ overrides: { mediaPicturePostsPerDay: { pro: 2 } } }); resetLimitCache();
  await createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/2.webp")] }, deps);
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/3.webp")] }, deps), /posted 2 picture posts today/);
  await db.doc("serverConfig/limits").delete(); resetLimitCache();
  const usedBefore = (await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes;
  assert.equal(usedBefore, (WEBP_STUB.length + 9) * 3, "storage counts each marked picture's bytes, once");
  await db.doc("mediaUsage/u_tunde").update({ bytes: 20 * 1024 ** 3 - 10 });
  await rejects(createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/4.webp")] }, deps), /storage is full/);
  await db.doc("mediaUsage/u_tunde").update({ bytes: usedBefore });

  // ── Video: Stream direct upload, weekly slots, longest video; a rejected upload gives its slot back ──
  await rejects(startMediaVideo(db, { uid: "u_free", username: "freeone" }, "standard", { durationSec: 20, size: 1000 }, deps), /come with a paid plan/);
  await rejects(startMediaVideo(db, T, "pro", { durationSec: 200, size: 1000 }, deps), /up to 180 seconds/);
  await rejects(startMediaVideo(db, T, "pro", { durationSec: 20, size: 300 * 1024 * 1024 }, deps), /up to 200 MB/);
  const v1 = await startMediaVideo(db, T, "pro", { durationSec: 58, size: 5_000_000, name: "payday.mp4", width: 1080, height: 1920 }, deps);
  assert.equal(v1.maxSeconds, 180); assert.equal(v1.uploadURL, "https://upload.test/one-time");
  // The video goes to Stream with @tunde's watermark profile for a 9:16 frame: one full-frame transparent PNG, laid on at scale 1.
  assert.deepEqual(created[0], { creator: "u_tunde", watermarkUid: "wm1" });
  assert.deepEqual(profiles.map((x) => [x.name, x.opacity, x.scale, x.padding, x.position]), [["NotesApp @tunde 9x16", 1, 1, 0, "center"]]);
  assert.equal(profiles[0].png.subarray(1, 4).toString(), "PNG");
  assert.equal((await db.doc(`mediaUploads/${v1.uploadId}`).get()).data()!.marked, true);
  const vAgain = await startMediaVideo(db, T, "pro", { durationSec: 5, size: 1000, width: 720, height: 1280 }, deps);
  assert.equal(created[1].watermarkUid, "wm1", "the same profile is used again for the same shape");
  await db.doc(`mediaUploads/${vAgain.uploadId}`).delete(); await db.doc("mediaUsage/u_tunde").update({ videos: 1, bytes: FieldValue.increment(-1000) });
  await startMediaVideo(db, T, "pro", { durationSec: 5, size: 1000, width: 1920, height: 1080 }, deps).then(async (x) => { await db.doc(`mediaUploads/${x.uploadId}`).delete(); await db.doc("mediaUsage/u_tunde").update({ videos: 1, bytes: FieldValue.increment(-1000) }); });
  assert.deepEqual([created[2].watermarkUid, profiles[1].name], ["wm2", "NotesApp @tunde 16x9"], "a landscape video: a 16:9 profile");
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).videos.used, 1);
  const vp = await createMediaPost(db, T, "pro", { kind: "video", videoUploadId: v1.uploadId, caption: "Ajo tracker", audience: "everyone" }, deps);
  assert.equal(vp.status, "processing");
  assert.equal((await db.doc(`mediaPosts/${vp.id}`).get()).data()!.marked, true, "a video posted from now on is marked");
  await rejects(createMediaPost(db, T, "pro", { kind: "video", videoUploadId: v1.uploadId }, deps), /already posted/, "an upload is posted once");
  await rejects(createMediaPost(db, fan, "standard", { kind: "video", videoUploadId: v1.uploadId }, deps), /wasn't found/, "only by its uploader");
  assert.ok(!(await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.some((p) => p.id === vp.id), "processing: the owner's only");
  stream.set("sv1", { readyToStream: true, duration: 58.4, size: 4_900_000 });
  assert.equal((await refreshVideo(db, vp.id, deps))!.status, "ready");
  const seen = (await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.find((p) => p.id === vp.id)!;
  assert.equal(seen.video!.player, "https://iframe.videodelivery.net/sv1"); assert.match(seen.cover, /videodelivery\.net\/sv1\/thumbnails/);
  const v2 = await startMediaVideo(db, T, "pro", { durationSec: 60, size: 1000 }, deps);
  const vp2 = await createMediaPost(db, T, "pro", { kind: "video", videoUploadId: v2.uploadId }, deps);
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).videos.used, 2);
  const uidOf = async (id: string) => String((await db.doc(`mediaPosts/${id}`).get()).data()!.video.streamUid);
  const sv2 = await uidOf(vp2.id);
  stream.set(sv2, { readyToStream: true, duration: 400 }); // longer than it said
  const rej = (await refreshVideo(db, vp2.id, deps))!;
  assert.equal(rej.status, "rejected"); assert.match(String(rej.rejectedReason), /longer than your plan's 180 seconds/);
  assert.ok(streamRemoved.includes(sv2), "the file is removed from Stream");
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).videos.used, 1, "the slot is given back");
  const v3 = await startMediaVideo(db, T, "pro", { durationSec: 30, size: 1000 }, deps);
  const vp3 = await createMediaPost(db, T, "pro", { kind: "video", videoUploadId: v3.uploadId }, deps);
  stream.set(await uidOf(vp3.id), { readyToStream: false, state: "error" });
  assert.equal((await refreshVideo(db, vp3.id, deps))!.status, "rejected", "Stream couldn't process it");
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).videos.used, 1);

  // ── Who can see: everyone / followers / subscribers, and blocks ──
  const fp = await createMediaPost(db, T, "pro", { kind: "pictures", audience: "followers", pictureKeys: [put("media/u_tunde/f.webp")] }, deps);
  const sp = await createMediaPost(db, T, "pro", { kind: "pictures", audience: "subscribers", pictureKeys: [put("media/u_tunde/s.webp")] }, deps);
  const ids = async (v: { uid: string; username: string } | null) => (await creatorMedia(db, v, "tunde", deps, momentDeps)).posts.map((p) => p.id);
  assert.ok(!(await ids(null)).includes(fp.id) && (await ids(null)).includes(p1.id), "signed out: everyone posts only");
  assert.ok(!(await ids(stranger)).includes(fp.id));
  assert.ok((await ids(fan)).includes(fp.id) && !(await ids(fan)).includes(sp.id), "a follower: followers, not subscribers");
  assert.ok((await ids(sub)).includes(sp.id), "a subscriber");
  assert.ok((await ids(T)).includes(sp.id) && (await ids(T)).includes(vp2.id), "the owner sees everything, rejected too");
  await db.doc("dmBlocks/u_tunde_u_stranger").set({ blocker: "u_tunde", blocked: "u_stranger" });
  assert.equal((await creatorMedia(db, stranger, "tunde", deps, momentDeps)).visible, false, "a block hides their Media");
  await db.doc("dmBlocks/u_tunde_u_stranger").delete();

  // ── Teen mode: mutual followers only, no downloads, shares or gifts, mentions only from people they follow ──
  const tp = await createMediaPost(db, teen, "standard", { kind: "pictures", audience: "everyone", allowDownloads: true, allowShares: true, allowGifts: true, pictureKeys: [put("media/u_teen/a.webp")] }, deps);
  assert.deepEqual([tp.allowDownloads, tp.allowShares, tp.allowGifts, tp.allowComments], [false, false, false, true], "switches forced off for a teen");
  assert.equal((await creatorMedia(db, null, "tobi", deps, momentDeps)).visible, false, "never signed out");
  const notBack = await creatorMedia(db, stranger, "tobi", deps, momentDeps);
  assert.equal(notBack.visible, false, "follows the teen, not followed back"); assert.equal(notBack.posts.length, 0);
  assert.deepEqual((await creatorMedia(db, mutual, "tobi", deps, momentDeps)).posts.map((p) => p.id), [tp.id], "mutual followers see it");
  const tpe = await updateMediaPost(db, teen, tp.id, { allowDownloads: true }, deps);
  assert.equal(tpe.allowDownloads, false, "and can't be turned on later");
  await db.doc(`mediaPosts/${tp.id}`).update({ allowDownloads: true }); // even if it were on somehow
  await rejects(downloadPicture(db, mutual, tp.id, 0, deps), /Downloads are off for this member's Media/);
  await rejects(createMediaPost(db, stranger, "standard", { kind: "pictures", caption: "Nice one @tobi", pictureKeys: [put("media/u_stranger/a.webp")] }, deps), /@tobi only hears from people they follow/);
  await createMediaPost(db, mutual, "standard", { kind: "pictures", caption: "Well done @tobi", pictureKeys: [put("media/u_mutual/a.webp")] }, deps);

  // ── A picture post is only shown once marked: a write that fails leaves it hidden ("processing"), and the cron finishes it ──
  failWrites = 1;
  const slow = await createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/slow.webp")] }, deps);
  assert.equal(slow.status, "processing"); assert.deepEqual(slow.pictures, [], "the clean picture is never shown, not even to its creator");
  assert.ok(!(await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.some((p) => p.id === slow.id), "hidden from others");
  assert.ok(objects.has("media/u_tunde/slow.webp"), "the clean file waits for its mark");
  await sweepProcessingVideos(db, deps);
  const slowNow = (await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.find((p) => p.id === slow.id)!;
  assert.deepEqual(slowNow.pictures, ["https://cdn.test/media/u_tunde/slow-na.webp"], "marked by the cron, then shown");
  assert.ok(!objects.has("media/u_tunde/slow.webp"), "and the clean file deleted");
  // A file the mark can't read (it passed the first bytes' check but isn't a picture): the post is rejected, its files and bytes go.
  const used1 = (await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes;
  const bad = await createMediaPost(db, T, "pro", { kind: "pictures", pictureKeys: [put("media/u_tunde/bad.webp", Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 "), Buffer.alloc(40)]))] }, { ...deps, markPicture: async () => { throw new Error("decode"); } });
  assert.equal(bad.status, "rejected"); assert.match(String(bad.rejectedReason), /couldn't be read as a picture/);
  assert.ok(!objects.has("media/u_tunde/bad.webp")); assert.equal((await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes, used1);

  // ── Downloads: the stored, marked file (no stamping on the way out, no second copy) ──
  const req = eval("require") as NodeRequire;
  const sq = req("next/dist/server/lib/squoosh/impl") as { decodeBuffer: (b: Buffer) => Promise<{ data: Uint8Array; width: number; height: number }>; encodeWebp: (i: unknown, o: { quality: number }) => Promise<Uint8Array> };
  const im = await sq.decodeBuffer(readFileSync(join(__dirname, "..", "..", "public/images/journal/defi.jpg")));
  const realWebp = Buffer.from(await sq.encodeWebp({ data: im.data, width: im.width, height: im.height }, { quality: 80 }));
  const realDeps: MediaDeps = { ...deps, markPicture: (b, u, st) => markPicture(b, u, st) };
  const dp = await createMediaPost(db, T, "pro", { kind: "pictures", allowDownloads: true, pictureKeys: [put("media/u_tunde/real.webp", realWebp)] }, realDeps);
  assert.equal(dp.status, "ready");
  const storedPic = objects.get("media/u_tunde/real-na.webp")!;
  assert.ok(storedPic && sniffPicture(storedPic) === "webp" && !storedPic.equals(realWebp), "really marked, still WebP");
  assert.ok(!objects.has("media/u_tunde/real.webp"), "the clean original is gone");
  const got = await downloadPicture(db, null, dp.id, 0, deps);
  assert.ok(got.bytes.equals(storedPic), "the download is the stored, marked file"); assert.equal(got.type, "image/webp");
  assert.match(got.filename, /^tunde-notesapp-.+-1\.webp$/);
  assert.equal((await db.doc(`mediaPosts/${dp.id}`).get()).data()!.downloadCount, 1);
  await rejects(downloadPicture(db, fan, p1.id, 0, deps), /hasn't allowed downloads/);
  await rejects(downloadPicture(db, fan, dp.id, 5, deps), /picture wasn't found/);
  // A picture posted before the mark (not re-marked yet) is marked on the way out: never the clean file.
  await db.doc(`mediaPosts/${dp.id}`).update({ pictures: [{ key: "media/u_tunde/old.webp", bytes: realWebp.length }], marked: FieldValue.delete() }); put("media/u_tunde/old.webp", realWebp);
  const old = await downloadPicture(db, null, dp.id, 0, realDeps);
  assert.ok(!old.bytes.equals(realWebp) && sniffPicture(old.bytes) === "webp", "old pictures are marked as they're downloaded");
  await db.doc(`mediaPosts/${dp.id}`).update({ pictures: [{ key: "media/u_tunde/real-na.webp", bytes: storedPic.length, marked: true }], marked: true }); objects.delete("media/u_tunde/old.webp");
  await db.doc(`mediaPosts/${vp.id}`).update({ allowDownloads: true }); await rejects(downloadPicture(db, fan, vp.id, 0, deps), /That's a video/); await db.doc(`mediaPosts/${vp.id}`).update({ allowDownloads: false });
  await updateMediaPost(db, T, fp.id, { allowDownloads: true }, deps);
  await rejects(downloadPicture(db, stranger, fp.id, 0, deps), /wasn't found/, "a followers-only post isn't downloadable by a stranger");

  // ── Video downloads: Stream's MP4 of the (marked) video itself, nothing more in storage ──
  const used0 = (await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes;
  const on1 = await updateMediaPost(db, T, vp.id, { allowDownloads: true }, deps);
  assert.equal(on1.videoDownload, "preparing"); assert.ok(dlOn.has("sv1"), "MP4 downloads switched on for the post's own video");
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes, used0, "no second copy, no more storage");
  assert.equal((await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.find((p) => p.id === vp.id)!.videoDownload, undefined, "others don't see it until it's ready");
  await rejects(downloadVideo(db, fan, vp.id, deps), /being made/);
  dlOn.set("sv1", { status: "ready", url: "https://customer-x.cloudflarestream.com/sv1/downloads/default.mp4" });
  assert.ok((await sweepProcessingVideos(db, deps)) >= 1, "the cron moves it along");
  const vget = await downloadVideo(db, fan, vp.id, deps);
  assert.equal(vget.url, `https://customer-x.cloudflarestream.com/sv1/downloads/default.mp4?filename=${encodeURIComponent(`tunde-notesapp-${vp.id.slice(0, 6)}.mp4`)}`, "the marked video's MP4, named for @tunde");
  assert.equal((await db.doc(`mediaPosts/${vp.id}`).get()).data()!.downloadCount, 1);
  assert.equal((await creatorMedia(db, fan, "tunde", deps, momentDeps)).posts.find((p) => p.id === vp.id)!.videoDownload, "ready");
  await updateMediaPost(db, T, vp.id, { allowDownloads: false }, deps);
  assert.ok(disabled.includes("sv1") && !dlOn.has("sv1"), "off: the MP4 is removed");
  await rejects(downloadVideo(db, fan, vp.id, deps), /hasn't allowed downloads/);
  // Stream fails to make the MP4: the creator sees why.
  await updateMediaPost(db, T, vp.id, { allowDownloads: true }, deps);
  dlOn.set("sv1", { status: "error", url: "" });
  await sweepProcessingVideos(db, deps);
  const failed = (await mediaStudio(db, T, "pro", deps)).posts.find((p) => p.id === vp.id)!;
  assert.equal(failed.videoDownload, "failed"); assert.match(String(failed.videoDownloadWhy), /off and on to try again/);
  await updateMediaPost(db, T, vp.id, { allowDownloads: false }, deps);
  // A video posted before the mark isn't downloadable until it's re-marked.
  await db.doc(`mediaPosts/${vp.id}`).update({ marked: false, "video.marked": false, allowDownloads: true });
  await rejects(downloadVideo(db, fan, vp.id, deps), /being given the NotesApp mark/);
  await db.doc(`mediaPosts/${vp.id}`).update({ marked: true, "video.marked": true, allowDownloads: false });
  // The look from Admin → Limits applies to new uploads: a new profile; the replaced one is deleted from Stream 3 days later.
  await db.doc("serverConfig/mediaWatermark").set({ overrides: { centreOpacityPct: 20, corner: 3 } }); resetWatermarkCache();
  const v5 = await startMediaVideo(db, T, "pro", { durationSec: 5, size: 1000, width: 1080, height: 1920 }, deps);
  assert.equal(created[created.length - 1].watermarkUid, `wm${wm}`); assert.notEqual(`wm${wm}`, "wm1"); assert.deepEqual(dropped, [], "kept a while for uploads already given it");
  await db.doc(`mediaUploads/${v5.uploadId}`).delete(); await db.doc("mediaUsage/u_tunde").update({ videos: 1, bytes: FieldValue.increment(-1000) });
  const later3 = new Date(Date.now() + 4 * 86_400_000);
  const v6 = await startMediaVideo(db, T, "pro", { durationSec: 5, size: 1000, width: 1920, height: 1080 }, deps, later3);
  assert.ok((dropped as string[]).includes("wm1"), "then deleted");
  await db.doc(`mediaUploads/${v6.uploadId}`).delete(); await db.doc("mediaUsage/u_tunde").update({ videos: 1, bytes: FieldValue.increment(-1000) });
  await db.doc("serverConfig/mediaWatermark").delete(); resetWatermarkCache();
  // Teens: never.
  await rejects(downloadVideo(db, mutual, tp.id, deps), /Downloads are off for this member's Media/);

  // ── Site pictures: shown by default, each hideable, and a switch for all ──
  await db.doc("sites/u_tunde").set({ uid: "u_tunde", cover: "https://cdn.test/site/cover.webp", blocks: { gallery: { on: true, items: [{ image: "https://cdn.test/site/g1.webp", caption: "Shop" }, { image: "https://cdn.test/site/g2.webp", caption: "" }] }, services: { on: true, items: [{ name: "Ajo", image: "https://cdn.test/site/s1.webp" }] } } });
  const shown = async () => (await creatorMedia(db, fan, "tunde", deps, momentDeps)).sitePictures.map((p) => p.url);
  assert.deepEqual(await shown(), ["https://cdn.test/site/cover.webp", "https://cdn.test/site/g1.webp", "https://cdn.test/site/g2.webp", "https://cdn.test/site/s1.webp"], "on by default");
  await setMediaSettings(db, "u_tunde", { hide: { id: sitePictureId("https://cdn.test/site/g2.webp"), hidden: true } });
  assert.equal((await shown()).includes("https://cdn.test/site/g2.webp"), false, "one hidden");
  const studio = await mediaStudio(db, T, "pro", deps);
  assert.equal(studio.sitePictures.length, 4, "the studio still lists it"); assert.equal(studio.sitePictures.filter((p) => p.hidden).length, 1);
  await setMediaSettings(db, "u_tunde", { hideAllSite: true });
  assert.deepEqual(await shown(), [], "hide all site pictures");
  await setMediaSettings(db, "u_tunde", { hideAllSite: false, hide: { id: sitePictureId("https://cdn.test/site/g2.webp"), hidden: false } });
  assert.equal((await shown()).length, 4);
  await rejects(setMediaSettings(db, "u_tunde", { hide: { id: "../x", hidden: true } }), /Which picture/);

  // ── Lives & replays (#256): ready, listed replays only, newest first, the host's picture as the tile ──
  const rp = (id: string, o: Record<string, unknown>) => db.doc(`replays/${id}`).set({ rid: id, roomId: "r", cid: "c", communityName: "C", hostUid: "u_tunde", hostUsername: "tunde", hostName: "Tunde", hostAvatar: "https://cdn.test/t.webp", title: id, audience: "public", listed: true, kind: "audio", status: "ready", streamUid: "s", duration: 61.4, createdAt: "2026-11-01T10:00:00Z", publishedAt: "2026-11-01T10:00:00Z", views: 0, ...o });
  await rp("old", {}); await rp("new", { publishedAt: "2026-11-02T10:00:00Z", audience: "subscribers" });
  await rp("processing", { status: "processing" }); await rp("kept", { audience: "community", listed: false });
  await rp("other", { hostUid: "u_someone" });
  const reps = (await creatorMedia(db, fan, "tunde", deps, momentDeps)).replays;
  assert.deepEqual(reps.map((r) => r.id), ["new", "old"], "listed and ready, newest first");
  assert.deepEqual(reps[1], { id: "old", title: "old", poster: "https://cdn.test/t.webp", durationSec: 61, href: "/replays/old", createdAt: "2026-11-01T10:00:00Z" });

  // ── The profile picture album: recorded on the server from now on ──
  await db.collection("profilePictures").add({ uid: "u_tunde", url: "https://cdn.test/avatars/u_tunde/old.webp", createdAt: "2026-10-01T00:00:00.000Z" });
  let cm = await creatorMedia(db, fan, "tunde", deps, momentDeps);
  assert.deepEqual(cm.album.map((a) => [a.url, a.current]), [["https://cdn.test/avatars/u_tunde/now.webp", true], ["https://cdn.test/avatars/u_tunde/old.webp", false]]);
  const recs = await db.collection("profilePictures").where("uid", "==", "u_tunde").get();
  assert.equal(recs.size, 2, "the picture in use was recorded"); assert.ok(recs.docs.some((d) => d.data().recordedBy === "server"));
  await creatorMedia(db, fan, "tunde", deps, momentDeps);
  assert.equal((await db.collection("profilePictures").where("uid", "==", "u_tunde").get()).size, 2, "recorded once");
  await db.doc("users/u_tunde").update({ avatar: "https://evil.test/x.png" });
  await creatorMedia(db, fan, "tunde", deps, momentDeps);
  assert.equal((await db.collection("profilePictures").where("uid", "==", "u_tunde").get()).size, 2, "only our own uploads are recorded");
  await db.doc("users/u_tunde").update({ avatar: "https://cdn.test/avatars/u_tunde/now.webp" });
  await setMediaSettings(db, "u_tunde", { showAlbum: false });
  assert.equal((await creatorMedia(db, fan, "tunde", deps, momentDeps)).album.length, 0, "the album can be turned off");
  await setMediaSettings(db, "u_tunde", { showAlbum: true });

  // ── Pinned posts: up to 3 ──
  await updateMediaPost(db, T, p1.id, { pinned: true }, deps); await updateMediaPost(db, T, vp.id, { pinned: true }, deps); await updateMediaPost(db, T, dp.id, { pinned: true }, deps);
  await rejects(updateMediaPost(db, T, fp.id, { pinned: true }, deps), /pin up to 3 posts/);
  cm = await creatorMedia(db, fan, "tunde", deps, momentDeps);
  assert.equal(cm.pinnedPosts.length, 3);
  await rejects(updateMediaPost(db, fan, p1.id, { pinned: false }, deps), /wasn't found/, "only the owner changes a post");

  // ── Pinned Moments stay past their 24–72 hours while pinned; unpinning an expired one lets it go ──
  const now = new Date();
  const mk = (id: string, hoursLeft: number) => db.doc(`moments/${id}`).set({ ownerUid: "u_tunde", ownerUsername: "tunde", kind: "text", text: id, hours: 24, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + hoursLeft * 3_600_000).toISOString(), expireAt: new Date(now.getTime() + hoursLeft * 3_600_000), likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: true });
  await mk("m_pin", 5); await mk("m_plain", 5); await mk("m_gone", -1);
  await rejects(pinMoment(db, "u_tunde", "m_gone", true, momentDeps), /wasn't found/, "a moment already past its time can't be pinned");
  await rejects(pinMoment(db, "u_fan", "m_pin", true, momentDeps), /wasn't found/, "only the owner pins");
  assert.deepEqual(await pinMoment(db, "u_tunde", "m_pin", true, momentDeps), { pinned: true, removed: false });
  assert.equal((await db.doc("moments/m_pin").get()).data()!.expireAt, undefined, "the TTL field is off while pinned");
  const later = new Date(now.getTime() + 3 * 86_400_000);
  const swept = await sweepExpiredMoments(db, momentDeps, later);
  assert.ok(swept >= 2, "the unpinned ones went");
  assert.equal((await db.doc("moments/m_plain").get()).exists, false);
  assert.equal((await db.doc("moments/m_pin").get()).exists, true, "the pinned one stays");
  assert.deepEqual((await listPinnedMoments(db, "u_fan", "u_tunde", momentDeps)).map((m) => [m.id, m.pinned]), [["m_pin", true]], "shown on their Media");
  assert.deepEqual(await listPinnedMoments(db, null, "u_tunde", momentDeps), [], "moments are never shown signed out");
  assert.deepEqual(await listPinnedMoments(db, "u_stranger", "u_tunde", momentDeps), [], "only to the moment's audience");
  assert.equal((await listForOwner(db, "u_fan", "tunde", momentDeps, later)).length, 0, "the ring is for live moments only");
  assert.equal((await toggleLike(db, "u_fan", "m_pin", later)).liked, true, "it can still be opened and liked");
  assert.equal((await db.doc("moments/m_pin/likes/u_fan").get()).data()!.expireAt, undefined, "its likes don't expire under it");
  assert.equal((await creatorMedia(db, fan, "tunde", deps, momentDeps)).pinnedMoments.length, 1);
  assert.deepEqual(await pinMoment(db, "u_tunde", "m_pin", false, momentDeps, later), { pinned: false, removed: true }, "unpinned after its time: it goes");
  assert.equal((await db.doc("moments/m_pin").get()).exists, false);
  // Unpinned while its time isn't up: it keeps its time.
  await mk("m_back", 5);
  await pinMoment(db, "u_tunde", "m_back", true, momentDeps); await pinMoment(db, "u_tunde", "m_back", false, momentDeps);
  const back = (await db.doc("moments/m_back").get()).data()!;
  assert.equal(back.pinned, false); assert.ok(back.expireAt, "its TTL is back");
  // Up to 10 pinned.
  for (let i = 0; i < 10; i++) { await mk(`m_${i}`, 5); await pinMoment(db, "u_tunde", `m_${i}`, true, momentDeps); }
  await mk("m_11", 5);
  await rejects(pinMoment(db, "u_tunde", "m_11", true, momentDeps), /pin up to 10 moments/);
  // A long list of pinned, expired moments doesn't stall the sweep.
  await mk("m_late", 1);
  assert.ok((await sweepExpiredMoments(db, momentDeps, later, 3)) >= 1);
  assert.equal((await db.doc("moments/m_late").get()).exists, false, "paged past the pinned ones");

  // ── Counts for the tab, and deleting ──
  cm = await creatorMedia(db, fan, "tunde", deps, momentDeps);
  assert.equal(cm.counts.posts, cm.posts.length);
  assert.equal(cm.counts.all, cm.posts.length + cm.sitePictures.length + cm.album.length + cm.replays.length);
  assert.equal(cm.counts.replays, 2, "the two listed replays count on the tab");
  assert.equal(cm.counts.videos, 1);
  const bytesBefore = (await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes;
  await deleteMediaPost(db, "u_tunde", p1.id, deps);
  assert.ok(removed.includes("media/u_tunde/1-a-na.webp") && removed.includes("media/u_tunde/1-b-na.webp"), "its files go");
  assert.equal((await mediaQuota(db, "u_tunde", "pro")).storage.usedBytes, bytesBefore - (WEBP_STUB.length + 9) * 2, "and their bytes are freed");
  await rejects(deleteMediaPost(db, "u_fan", dp.id, deps), /wasn't found/);

  // ── Deleting an account takes its Media with it ──
  const gone: string[] = [];
  await eraseAccount(db, "u_mutual", async () => {}, async (k) => { gone.push(k); });
  assert.equal((await db.collection("mediaPosts").where("ownerUid", "==", "u_mutual").get()).size, 0);
  assert.ok(gone.includes("media/u_mutual/a-na.webp"));
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
