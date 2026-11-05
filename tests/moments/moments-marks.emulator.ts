// Moments with the permanent NotesApp mark (owner, 5 Nov 2026), against the Firestore emulator: a picture is marked as it's posted and
// only the marked copy kept; a video goes to Cloudflare Stream with the creator's watermark profile (signed playback, a player link only
// for the moment's audience, teen rules unchanged), the parts of a long video share one Stream video, and expiry or deleting removes it
// from Stream while a pinned moment keeps it. The bucket and Stream are stand-ins. Run: npm run test:moments-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  createMoment, deleteMoment, listForOwner, momentPlayer, pinMoment, sweepExpiredMoments, sweepMomentCopies, startMomentVideo, type MomentDeps,
} from "../../lib/moments-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

const objects = new Map<string, Buffer>(), removed: string[] = [];
const videos = new Map<string, { readyToStream: boolean; state?: string }>();
const created: { creator: string; maxSeconds: number; watermarkUid: string }[] = [], profiles: string[] = [];
let sv = 0, wm = 0;
const deps: MomentDeps = {
  publicUrl: (k) => `https://cdn.test/${k}`,
  remove: async (k) => { removed.push(k); objects.delete(k); if (k.startsWith("stream:")) videos.delete(k.slice(7)); },
  // The mark stand-in: the marked copy under a new key, the clean upload deleted (lib/moments-api.ts does this with the real drawing).
  markImage: async (k, u) => { if (!objects.has(k)) throw new Error("NoSuchKey"); const to = k.replace(/\.\w+$/, "-na.webp"); objects.set(to, Buffer.concat([objects.get(k)!, Buffer.from(`|na@${u}`)])); objects.delete(k); removed.push(k); return to; },
  stream: {
    configured: true,
    create: async (creator, maxSeconds, _name, watermarkUid) => { created.push({ creator, maxSeconds, watermarkUid }); const uid = `sv${++sv}`; videos.set(uid, { readyToStream: false, state: "pendingupload" }); return { uploadURL: "https://upload.test/one-time", uid }; },
    copy: async () => ({ uid: `copy${++sv}` }),
    get: async (uid) => videos.get(uid) ?? null,
    token: async (uid, secs) => `tok-${uid}-${secs}`,
    watermark: async (o) => { profiles.push(o.name); return { uid: `wm${++wm}` }; },
    dropWatermark: async () => {},
    markPng: async () => Buffer.from("\x89PNG"),
  },
};

(async () => {
  const person = (uid: string, username: string, extra: object = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username, avatar: "", role: "reader", accountTier: "pro", ...extra });
  const follow = (fromUid: string, toUsername: string) => db.doc(`follows/${fromUid}_${toUsername}`).set({ followerUid: fromUid, username: toUsername, followedAt: "x" });
  await person("u_ada", "ada"); await person("u_fan", "fan"); await person("u_stranger", "stranger"); await person("u_tobi", "tobi", { teen: true });
  await follow("u_fan", "ada"); await follow("u_stranger", "tobi"); await follow("u_fan", "tobi"); await follow("u_tobi", "fan");
  const ada = { uid: "u_ada", username: "ada" };

  // ── A picture: marked as it's posted, the clean upload deleted ──
  objects.set("moments/u_ada/1-me.jpg", Buffer.from("jpeg"));
  const pic = await createMoment(db, ada, { kind: "image", imageKey: "moments/u_ada/1-me.jpg" }, deps);
  assert.equal(pic.imageUrl, "https://cdn.test/moments/u_ada/1-me-na.webp", "only the marked copy is shown");
  assert.ok(!objects.has("moments/u_ada/1-me.jpg") && objects.get("moments/u_ada/1-me-na.webp")!.toString().endsWith("|na@ada"), "the clean upload is gone; marked for @ada");
  assert.equal((await db.doc(`moments/${pic.id}`).get()).data()!.imageKey, "moments/u_ada/1-me-na.webp");
  await rejects(createMoment(db, ada, { kind: "image", imageKey: "moments/u_ada/never.jpg" }, deps), /couldn't be read/);
  await rejects(createMoment(db, ada, { kind: "image", imageKey: "moments/u_ada/x.jpg" }, { ...deps, markImage: undefined }), /can't be shared as moments right now/, "never posted unmarked");

  // ── A video: straight to Stream with @ada's watermark profile for its frame, signed playback ──
  const st = await startMomentVideo(db, ada, "pro", { size: 1000, contentType: "video/mp4", durationSec: 150, width: 1080, height: 1920 }, deps);
  assert.deepEqual([st.uploadURL, st.partsNeeded, st.partsAllowed], ["https://upload.test/one-time", 2, 2], "150 seconds: two parts, one Stream video");
  assert.deepEqual(created[0], { creator: "u_ada", maxSeconds: 150, watermarkUid: "wm1" }); assert.deepEqual(profiles, ["NotesApp @ada 9x16"]);
  const up = (await db.doc(`videoUploads/${st.id}`).get()).data()!;
  assert.deepEqual([up.streamUid, up.marked, up.key], ["sv1", true, undefined], "nothing in our bucket");
  await rejects(startMomentVideo(db, ada, "pro", { size: 1000, contentType: "video/quicktime", durationSec: 10 }, deps), /MP4/);
  await rejects(startMomentVideo(db, ada, "pro", { size: 1000, contentType: "video/mp4", durationSec: 10 }, { stream: { ...deps.stream!, configured: false } }), /aren't switched on/);
  await rejects(startMomentVideo(db, { uid: "u_fan", username: "fan" }, "standard", { size: 1000, contentType: "video/mp4", durationSec: 10 }, deps), /come with a paid plan/, "the plan's weekly video moments, as before");
  // Posted before Stream has the file: refused; once it arrived, both parts play the one Stream video.
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 0, clipEnd: 75 }, deps), /hasn't finished uploading/);
  videos.set("sv1", { readyToStream: false, state: "queued" });
  const p1 = await createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 0, clipEnd: 75 }, deps);
  const p2 = await createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 75, clipEnd: 150 }, deps);
  await rejects(createMoment(db, ada, { kind: "video", videoUploadId: st.id, clipStart: 0, clipEnd: 10 }, deps), /every part/);
  assert.deepEqual([p1.streamVideo, p1.videoUrl, p1.clipStart, p1.clipEnd, p2.clipStart], [true, undefined, 0, 75, 75], "no file address is ever sent; the player is asked for");
  assert.deepEqual([(await db.doc(`moments/${p1.id}`).get()).data()!.videoKey, (await db.doc(`moments/${p2.id}`).get()).data()!.ownsMedia], ["stream:sv1", false]);

  // ── Playing: a signed player link, only for the moment's audience ──
  assert.deepEqual(await momentPlayer(db, "u_fan", p1.id, deps), { player: "https://iframe.videodelivery.net/tok-sv1-21600" });
  await rejects(momentPlayer(db, "u_stranger", p1.id, deps), /isn't available/, "not a follower");
  await rejects(momentPlayer(db, "u_fan", pic.id, deps), /no video/);
  assert.equal((await listForOwner(db, "u_fan", "ada", deps)).filter((m) => m.streamVideo).length, 2);
  // Teen rules unchanged: a teen's video moment plays only for people they follow back.
  const tst = await startMomentVideo(db, { uid: "u_tobi", username: "tobi" }, "pro", { size: 1000, contentType: "video/mp4", durationSec: 20 }, deps);
  assert.equal(profiles[1], "NotesApp @tobi 9x16", "no frame size: a phone's");
  videos.set(`sv${sv}`, { readyToStream: true });
  const tm = await createMoment(db, { uid: "u_tobi", username: "tobi" }, { kind: "video", videoUploadId: tst.id }, deps);
  assert.ok((await momentPlayer(db, "u_fan", tm.id, deps)).player, "a mutual follower");
  await rejects(momentPlayer(db, "u_stranger", tm.id, deps), /isn't available/, "follows the teen, not followed back");

  // ── Expiry: the Stream video goes with the last part; a pinned part keeps it ──
  await pinMoment(db, "u_ada", p2.id, true, deps);
  const later = new Date(Date.now() + 2 * 86_400_000);
  await sweepExpiredMoments(db, deps, later);
  assert.equal((await db.doc(`moments/${p1.id}`).get()).exists, false, "the unpinned part expired");
  assert.ok(!removed.includes("stream:sv1") && videos.has("sv1"), "the pinned part still needs the Stream video");
  assert.equal((await db.doc(`moments/${p2.id}`).get()).data()!.ownsMedia, true, "passed on to the pinned part");
  assert.ok(removed.includes(`moments/u_ada/1-me-na.webp`), "the picture moment expired with its marked file");
  assert.deepEqual(await pinMoment(db, "u_ada", p2.id, false, deps, later), { pinned: false, removed: true });
  assert.ok(removed.includes("stream:sv1") && !videos.has("sv1"), "unpinned after its time: deleted from Stream");
  assert.ok(removed.includes(`stream:sv${sv}`), "the teen's expired video moment: deleted from Stream");
  // Deleting a moment deletes its Stream video too.
  const dst = await startMomentVideo(db, ada, "pro", { size: 1000, contentType: "video/mp4", durationSec: 20 }, deps);
  const duid = `sv${sv}`; videos.set(duid, { readyToStream: true });
  const dm = await createMoment(db, ada, { kind: "video", videoUploadId: dst.id }, deps);
  await deleteMoment(db, "u_ada", dm.id, deps);
  assert.ok(removed.includes(`stream:${duid}`) && !videos.has(duid));

  // ── A video shared from a chat (in our bucket): Stream copies it with the mark; the bucket's copy goes once Stream has it ──
  await db.doc("videoUploads/chat1").set({ uid: "u_ada", key: "moments/u_ada/9-clip.mp4", contentType: "video/mp4", durationSec: 30, verified: true, purpose: "moment", partsAllowed: 1, partsCreated: 0, createdAt: new Date().toISOString() });
  const cm = await createMoment(db, ada, { kind: "video", videoUploadId: "chat1" }, deps);
  const cuid = String((await db.doc("videoUploads/chat1").get()).data()!.streamUid);
  assert.equal((await db.doc(`moments/${cm.id}`).get()).data()!.videoKey, `stream:${cuid}`);
  assert.equal(await sweepMomentCopies(db, deps), 0, "kept until Stream has it");
  videos.set(cuid, { readyToStream: true });
  assert.equal(await sweepMomentCopies(db, deps), 1);
  assert.ok(removed.includes("moments/u_ada/9-clip.mp4"), "the unmarked file in our bucket is deleted");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
