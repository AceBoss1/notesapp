// NotesApp Sounds against the Firestore emulator: the catalogue (house and artist songs), plays counted from Media views, moment views,
// lives and Notes Life (once a day), a song's page (only what the viewer may see), reactions, the artist's analytics, applying, the
// team's decisions, uploads (checked bytes), and the monthly royalty in ad share. Run: npm run test:sounds → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  applyAsArtist, computeSoundRoyalties, countLifePlay, countPlay, decideArtist, decideSong, finishSongUpload, findSong, listSongs, mySounds,
  removeMySong, setPoolPercent, soundHead, startSongUpload, type SoundDeps,
} from "../../lib/sounds-server";
import { mediaWithSong, reactMediaPost, viewMediaPost } from "../../lib/media-server";
import { SONGS, sniffSong } from "../../lib/songs";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

const objects = new Map<string, Buffer>();
const deps: SoundDeps = {
  publicUrl: (k) => `https://cdn.test/${k}`,
  presign: async (k) => `https://put.test/${k}`,
  head: async (k) => (objects.has(k) ? { size: objects.get(k)!.length } : null),
  readStart: async (k) => new Uint8Array(objects.get(k)!.subarray(0, 32)),
  remove: async (k) => { objects.delete(k); },
};

async function user(uid: string, username: string, extra: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ username, displayName: username, avatar: "", role: "reader", accountTier: "standard", ...extra });
  await db.doc(`usernames/${username}`).set({ uid });
}

async function main() {
  await user("u_owner", "emmanuel");
  await user("u_ada", "ada");
  await user("u_bayo", "bayo");
  await user("u_viewer", "viewer");
  const now = new Date("2026-11-10T12:00:00Z");

  // The catalogue: 11 house songs, credited to @emmanuel.
  assert.equal(SONGS.length, 11);
  assert.ok(SONGS.every((s) => s.ownerUsername === "emmanuel" && s.artist === "Emmanuel Adams"));
  assert.equal((await listSongs(db, deps)).length, 11);
  assert.equal((await findSong(db, "leave-am", deps))?.title, "Leave Am");
  assert.equal(await findSong(db, "nope-123", deps), undefined);

  // A Media post with a song: a first view counts one play; the owner's own view and a second view don't.
  await db.doc("mediaPosts/p1").set({ ownerUid: "u_ada", ownerUsername: "ada", kind: "pictures", caption: "hi", sound: "Leave Am · Emmanuel Adams", songId: "leave-am", audience: "everyone", status: "ready", allowComments: true, allowShares: true, allowGifts: true, allowDownloads: false, pinned: false, createdAt: now.toISOString(), updatedAt: now.toISOString(), pictures: [{ key: "media/u_ada/1.webp", bytes: 1, marked: true }], viewCount: 0, downloadCount: 0, sharesCount: 0, commentsCount: 0, reactions: {}, reactionsCount: 0, giftsTotal: 0, giftsCount: 0, bytes: 1 });
  await db.doc("mediaPosts/p2").set({ ownerUid: "u_bayo", ownerUsername: "bayo", kind: "pictures", caption: "", sound: "x", songId: "leave-am", audience: "followers", status: "ready", allowComments: true, allowShares: true, allowGifts: true, allowDownloads: false, pinned: false, createdAt: now.toISOString(), updatedAt: "", pictures: [], viewCount: 0, downloadCount: 0, sharesCount: 0, commentsCount: 0, reactions: {}, reactionsCount: 0, giftsTotal: 0, giftsCount: 0, bytes: 0 });
  await viewMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1");
  await viewMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1");
  await viewMediaPost(db, { uid: "u_ada", username: "ada" }, "p1");
  let head = await soundHead(db, "leave-am", deps);
  assert.equal(head.plays.media, 1, "one play from one viewer");
  assert.equal(head.artist?.username, "emmanuel");

  // The song's page shows only what the viewer may see (p2 is for @bayo's followers).
  assert.deepEqual((await mediaWithSong(db, { uid: "u_viewer", username: "viewer" }, "leave-am", deps)).map((x) => x.post.id), ["p1"]);
  await db.doc("follows/u_viewer_bayo").set({ followerUid: "u_viewer", username: "bayo" });
  assert.equal((await mediaWithSong(db, { uid: "u_viewer", username: "viewer" }, "leave-am", deps)).length, 2, "a follower sees the followers-only post");
  assert.equal((await mediaWithSong(db, null, "leave-am", deps)).length, 1, "signed out: the public post only");

  // Reactions: one per member; the same again takes it back; another changes it.
  let r = await reactMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1", "🔥");
  assert.deepEqual([r.reaction, r.reactions["🔥"], r.reactionsCount], ["🔥", 1, 1]);
  r = await reactMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1", "❤️");
  assert.deepEqual([r.reaction, r.reactions["🔥"], r.reactions["❤️"], r.reactionsCount], ["❤️", 0, 1, 1]);
  r = await reactMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1", "❤️");
  assert.deepEqual([r.reaction, r.reactionsCount], [null, 0]);
  await rejects(reactMediaPost(db, { uid: "u_viewer", username: "viewer" }, "p1", "💩"), /Pick a reaction/);

  // Lives and Notes Life.
  await countPlay(db, "leave-am", "live", 25, now);
  assert.equal(await countLifePlay(db, "u_viewer", "leave-am", now), true);
  assert.equal(await countLifePlay(db, "u_viewer", "leave-am", now), false, "once a day per player");
  await rejects(countLifePlay(db, "u_viewer", "not-a-song", now), /isn't in NotesApp Sounds/);
  head = await soundHead(db, "leave-am", deps);
  assert.deepEqual([head.plays.live, head.plays.life], [25, 1]);

  // The owner's analytics: house songs show up under their name.
  const mine = await mySounds(db, "u_owner", "emmanuel", deps, new Date());
  assert.equal(mine.isHouse, true);
  assert.equal(mine.songs.length, 11);
  assert.equal(mine.songs.find((s) => s.id === "leave-am")!.plays.total, 1 + 25 + 1);

  // Artists: apply, the team verifies, then upload (bytes checked), review, use.
  await rejects(startSongUpload(db, { uid: "u_ada", username: "ada" }, { title: "x" }, deps, now), /verified artists/);
  await rejects(applyAsArtist(db, { uid: "u_ada", username: "ada" }, { stageName: "Ada", links: ["https://audiomack.com/ada"] }), /own the rights/);
  await applyAsArtist(db, { uid: "u_ada", username: "ada" }, { stageName: "Ada Sings", links: ["https://audiomack.com/ada"], ownsRights: true });
  await rejects(applyAsArtist(db, { uid: "u_ada", username: "ada" }, { stageName: "Ada", links: ["https://x.y"], ownsRights: true }), /with the team/);
  await decideArtist(db, "u_ada", "verified", "", "admin");
  const up = await startSongUpload(db, { uid: "u_ada", username: "ada" }, { title: "Lagos Rain", size: 20, contentType: "audio/mpeg", durationSec: 200, hook: 60, coverType: "image/webp", coverSize: 4 }, deps, now);
  assert.match(up.id, /^lagos-rain-[0-9a-f]{6}$/);
  const key = `sounds/u_ada/${up.id}.mp3`, coverKey = `sounds/u_ada/${up.id}-cover.webp`;
  objects.set(key, Buffer.concat([Buffer.from("ID3"), Buffer.alloc(17)])); objects.set(coverKey, Buffer.alloc(4));
  assert.ok(sniffSong(new Uint8Array(objects.get(key)!)));
  const song = await finishSongUpload(db, { uid: "u_ada" }, up.id, deps, now);
  assert.equal(song.status, "pending");
  assert.equal(await findSong(db, up.id, deps), undefined, "not usable before review");
  await decideSong(db, up.id, "approved", "", "admin");
  assert.equal((await findSong(db, up.id, deps))?.artist, "Ada Sings");
  assert.equal((await listSongs(db, deps)).length, 12);
  // A file that isn't audio is refused and removed.
  const bad = await startSongUpload(db, { uid: "u_ada", username: "ada" }, { title: "Bad", size: 20, contentType: "audio/mpeg", durationSec: 100, coverType: "image/png", coverSize: 4 }, deps, now);
  objects.set(`sounds/u_ada/${bad.id}.mp3`, Buffer.from("<html>not a song!!!!")); objects.set(`sounds/u_ada/${bad.id}-cover.png`, Buffer.alloc(4));
  await rejects(finishSongUpload(db, { uid: "u_ada" }, bad.id, deps, now), /doesn't look like/);
  assert.equal(objects.has(`sounds/u_ada/${bad.id}.mp3`), false);

  // Royalties: 10% of ₦100,000 split by the month's plays (emmanuel 27, ada 3).
  await countPlay(db, up.id, "media", 3, now);
  await rejects(setPoolPercent(db, 80, "admin"), /0 to 50/);
  await setPoolPercent(db, 10, "admin");
  const month = now.toISOString().slice(0, 7);
  const out = await computeSoundRoyalties(db, month, 100_000_00, now.toISOString());
  assert.deepEqual([out.statements, out.poolKobo, out.plays], [2, 10_000_00, 30]);
  const st = (await db.doc(`adShareStatements/${month}_u_owner_sounds`).get()).data()!;
  assert.deepEqual([st.kind, st.impressions, st.shareKobo, st.status], ["sounds", 27, 9_000_00, "pending_review"]);
  const ada = (await db.doc(`adShareStatements/${month}_u_ada_sounds`).get()).data()!;
  assert.equal(ada.shareKobo, 1_000_00);
  assert.equal((await mySounds(db, "u_ada", "ada", deps, now)).royalties[0].shareKobo, 1_000_00);

  // The artist takes their song down: it stops being usable.
  await removeMySong(db, "u_ada", up.id);
  assert.equal(await findSong(db, up.id, deps), undefined);
  await rejects(removeMySong(db, "u_bayo", up.id), /not found/);

  console.log("ALL OK");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
