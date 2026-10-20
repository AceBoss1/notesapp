// Reusing your own chat photo or video as a moment or profile picture (lib/chat-media-server.ts) against the Firestore emulator.
// Part of npm run test:messages → "REUSE OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { reuseOwnMedia, type ReuseDeps } from "../../lib/chat-media-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
(async () => {
  for (const u of ["ra", "rb", "rc"]) await db.doc(`users/${u}`).set({ username: u, displayName: u.toUpperCase(), accountTier: "pro" });
  await db.doc("conversations/ra_rb").set({ participants: ["ra", "rb"], createdAt: "2026-10-20T09:00:00Z" });
  const msg = (id: string, data: object) => db.doc(`conversations/ra_rb/messages/${id}`).set({ createdAt: "2026-10-20T09:01:00Z", text: "", ...data });
  const file = (name: string, type: string, kind: string) => ({ key: `messages/ra/x-${name}`, name, size: 2000, type, kind });
  await msg("p1", { from: "ra", attachments: [file("me.jpg", "image/jpeg", "image")] });
  await msg("p2", { from: "rb", attachments: [file("them.jpg", "image/jpeg", "image")] });
  await msg("p3", { from: "ra", attachments: [file("anim.gif", "image/gif", "image")] });
  await msg("v1", { from: "ra", attachments: [file("clip.mp4", "video/mp4", "video")] });
  await msg("v2", { from: "ra", attachments: [file("clip.mov", "video/quicktime", "video")] });
  await msg("d1", { from: "ra", deleted: { at: "2026-10-20T09:05:00Z" }, attachments: [file("gone.jpg", "image/jpeg", "image")] });

  const copies: [string, string, string][] = [];
  const deps: ReuseDeps = { copy: async (a, b, t) => { copies.push([a, b, t]); }, publicUrl: (k) => `https://media.test/${k}`, moments: { publicUrl: (k) => `https://media.test/${k}`, remove: async () => {} } };
  const me = { uid: "ra", username: "ra" };
  const now = new Date("2026-10-20T10:00:00Z");

  // your own photo → profile picture: copied to your avatars folder, and its public address comes back
  const av = await reuseOwnMedia(db, me, { cid: "ra_rb", mid: "p1", i: 0, to: "avatar" }, deps, now) as { url: string };
  assert.equal(av.url, `https://media.test/avatars/ra/${now.getTime()}-me.jpg`);
  assert.deepEqual(copies[0], ["messages/ra/x-me.jpg", `avatars/ra/${now.getTime()}-me.jpg`, "image/jpeg"]);
  // never someone else's; never a GIF as a picture; never a deleted message; only people in the chat; only moment or avatar
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "p2", i: 0, to: "avatar" }, deps, now), /sent yourself/);
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "p3", i: 0, to: "avatar" }, deps, now), /JPEG, PNG or WebP/);
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "d1", i: 0, to: "moment" }, deps, now), /wasn't found/);
  await assert.rejects(reuseOwnMedia(db, { uid: "rc", username: "rc" }, { cid: "ra_rb", mid: "p1", i: 0, to: "avatar" }, deps, now), /wasn't found/);
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "p1", i: 0, to: "cover" }, deps, now), /Choose/);
  assert.equal(copies.length, 1);

  // your own photo → a moment, from the copy in your moments folder
  const pm = await reuseOwnMedia(db, me, { cid: "ra_rb", mid: "p1", i: 0, to: "moment" }, deps, now) as { moment: { id: string } };
  const pd = (await db.doc(`moments/${pm.moment.id}`).get()).data()!;
  assert.equal(pd.kind, "image"); assert.equal(pd.ownerUid, "ra"); assert.equal(pd.imageKey, `moments/ra/${now.getTime()}-me.jpg`);

  // a video needs its length (the viewer reads it); a long one plays its first 90 seconds; MOV isn't a moment format
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "v1", i: 0, to: "moment" }, deps, now), /how long/);
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "v2", i: 0, to: "moment", durationSec: 20 }, deps, now), /MP4 or WebM/);
  await assert.rejects(reuseOwnMedia(db, me, { cid: "ra_rb", mid: "v1", i: 0, to: "avatar" }, deps, now), /JPEG, PNG or WebP/);
  const vm = await reuseOwnMedia(db, me, { cid: "ra_rb", mid: "v1", i: 0, to: "moment", durationSec: 120.4 }, deps, now) as { moment: { id: string } };
  const vd = (await db.doc(`moments/${vm.moment.id}`).get()).data()!;
  assert.equal(vd.kind, "video"); assert.equal(vd.videoKey, `moments/ra/${now.getTime()}-clip.mp4`); assert.equal(vd.clipStart, 0); assert.equal(vd.clipEnd, 90);
  const up = (await db.doc(`videoUploads/${vd.splitGroup}`).get()).data()!;
  assert.equal(up.purpose, "moment"); assert.equal(up.verified, true); assert.deepEqual(up.fromChat, { cid: "ra_rb", mid: "v1", i: 0 });

  console.log("REUSE OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
