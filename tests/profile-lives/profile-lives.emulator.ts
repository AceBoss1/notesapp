// 🔴 Go live from your profile (lib/profile-lives-server.ts, docs/GO_LIVE.md) against the Firestore emulator: who can start one (the team,
// while the staff test pass is on), who can join (everyone / followers / subscribers), Live now, the profile's LIVE, the lobby, the summary.
// Run by test:profile-lives-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { liveNow, profileLiveLobby, profileLiveOf, profileLiveSummary, resetLiveNowCache, startProfileLive } from "../../lib/profile-lives-server";
import { beatRoom, endRoom, joinRoom, markRoomEvent } from "../../lib/rooms-server";
import { joinLine, postRoomEvent } from "../../lib/room-events-server";
import { resetStaffPassCache } from "../../lib/staff-pass-server";
import { CommunityError } from "../../lib/community-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const user = (uid: string, extra = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: uid[0].toUpperCase() + uid.slice(1), avatar: `https://media.test/${uid}.webp`, role: "reader", accountTier: "standard", ...extra }),
  db.doc(`usernames/${uid}`).set({ uid }),
]);
const follow = (fan: string, host: string, at = new Date().toISOString()) => db.doc(`follows/${fan}_${host}`).set({ followerUid: fan, username: host, followedAt: at, mandatory: false });
const rejects = (p: Promise<unknown>, status: number, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof CommunityError && e.status === status && re.test(e.message));
const pass = async (on: boolean) => { await db.doc("serverConfig/staffPass").set(on ? { on: true, until: new Date(Date.now() + 86_400_000).toISOString() } : { on: false, until: null }); resetStaffPassCache(); };
const told: string[] = [];
const tell = async (_db: unknown, l: { roomId: string }) => { told.push(l.roomId); return 2; };

async function main() {
  await user("emma", { role: "admin" }); // a #NotesApp team account
  await user("ada"); await user("tunde"); await user("chidi");
  await follow("ada", "emma"); await follow("tunde", "emma");
  await db.doc("subscriptions/tunde_emma").set({ subscriberUid: "tunde", username: "emma", tier: "premium", status: "active", currentPeriodEnd: new Date(Date.now() + 86_400_000 * 20).toISOString() });

  // Who can start one.
  await pass(false);
  await rejects(startProfileLive(db, "emma", { title: "Sunday chat" }, new Date(), undefined, tell), 403, /being tried by the #NotesApp team/);
  await pass(true);
  await rejects(startProfileLive(db, "ada", { title: "Sunday chat" }, new Date(), undefined, tell), 403, /being tried by the #NotesApp team/);
  await rejects(startProfileLive(db, "emma", { title: "Hi" }, new Date(), undefined, tell), 400, /title/);

  // A public live: anyone signed in joins; followers were told (the stub); it's on Live now and on the profile.
  const a = await startProfileLive(db, "emma", { title: "Sunday chat: building NotesApp", stageMode: "approve" }, new Date(), undefined, tell);
  assert.equal(a.told, 2); assert.deepEqual(told, [a.id]);
  const room = (await db.doc(`communityRooms/${a.id}`).get()).data()!;
  assert.deepEqual(room.profile, { audience: "everyone", hostUsername: "emma", gifts: true, notified: true });
  assert.equal(room.cid, ""); assert.equal(room.poster, "https://media.test/emma.webp", "the profile picture is the poster by default");
  assert.equal(room.staffPass, true, "opened on the staff test pass");
  assert.equal((await joinRoom(db, "chidi", a.id)).ok, true, "a stranger joins a public live");
  resetLiveNowCache();
  assert.deepEqual((await liveNow(db)).map((l) => l.id), [a.id]);
  const onProfile = await profileLiveOf(db, "emma", "chidi");
  assert.equal(onProfile?.id, a.id); assert.equal(onProfile?.canJoin, true);
  assert.equal((await profileLiveOf(db, "ada", "chidi")), null, "not live");
  const lobby = await profileLiveLobby(db, a.id, null);
  assert.equal(lobby?.status, "live"); assert.equal(lobby?.canJoin, false, "signed out: sign in to join");

  // A gift during it, and the summary (host only).
  await db.doc("gifts/g1").set({ liveId: a.id, toUid: "emma", fromUid: "ada", senderName: "Ada", anonymous: false, amountKobo: 150_000 * 100, createdAt: new Date().toISOString() });
  await rejects(profileLiveSummary(db, "ada", a.id), 403, /Only the host/);
  await endRoom(db, a.id);
  const s = await profileLiveSummary(db, "emma", a.id);
  assert.equal(s.status, "ended"); assert.equal(s.giftKobo, 150_000 * 100); assert.deepEqual(s.topGifters, [{ name: "Ada", kobo: 150_000 * 100 }]);
  assert.ok(s.joined >= 2, "the host and chidi");
  assert.equal(s.hostUsername, "emma");
  resetLiveNowCache();
  assert.deepEqual(await liveNow(db), [], "ended: off Live now");
  assert.equal((await profileLiveLobby(db, a.id, "chidi"))?.status, "ended");

  // Followers only: a follower joins, a stranger doesn't (and isn't listed on Live now), but the profile still shows it's live.
  const f = await startProfileLive(db, "emma", { title: "Followers Q&A", audience: "followers", notify: false }, new Date(), undefined, tell);
  assert.equal(f.told, 0, "bell switched off");
  assert.equal((await joinRoom(db, "ada", f.id)).ok, true);
  await rejects(joinRoom(db, "chidi", f.id), 403, /followers/);
  resetLiveNowCache();
  assert.deepEqual(await liveNow(db), []);
  assert.equal((await profileLiveOf(db, "emma", "chidi"))?.canJoin, false);
  await endRoom(db, f.id);

  // Subscribers only.
  const sb = await startProfileLive(db, "emma", { title: "Subscribers hour", audience: "subscribers", gifts: false }, new Date(), undefined, tell);
  assert.equal((await db.doc(`communityRooms/${sb.id}`).get()).data()!.profile.gifts, false);
  assert.equal((await joinRoom(db, "tunde", sb.id)).ok, true, "a subscriber");
  await rejects(joinRoom(db, "ada", sb.id), 403, /subscribers/);
  await endRoom(db, sb.id);

  // The pass going off stops new ones.
  await pass(false);
  await rejects(startProfileLive(db, "emma", { title: "One more" }, new Date(), undefined, tell), 403, /team/);

  // ── What happens in the live, as lines in its chat (lib/room-events-server.ts) ──
  assert.equal(joinLine(["@ada"], 0), "@ada joined");
  assert.equal(joinLine(["@ada", "@tunde"], 0), "@ada and @tunde joined");
  assert.equal(joinLine(["@ada", "@tunde"], 12), "@ada, @tunde and 12 others joined");
  await pass(true);
  await user("bisi"); await user("kemi");
  const t0 = Date.now();
  const e = await startProfileLive(db, "emma", { title: "Events live" }, new Date(t0), undefined, tell);
  const lines = async () => (await db.collection(`communityRooms/${e.id}/chat`).orderBy("at").get()).docs.map((d) => d.data()).filter((m) => m.ev).map((m) => `${m.ev}: ${m.text}`);
  await joinRoom(db, "ada", e.id, new Date(t0 + 1_000));
  await joinRoom(db, "tunde", e.id, new Date(t0 + 2_000)); // a rush: kept for the grouped line
  await joinRoom(db, "chidi", e.id, new Date(t0 + 3_000));
  await joinRoom(db, "bisi", e.id, new Date(t0 + 4_000));
  assert.deepEqual(await lines(), ["join: @ada joined"], "the first alone; the rush waits");
  await beatRoom(db, "emma", e.id, new Date(t0 + 12_000)); // the host's heartbeat flushes it
  assert.deepEqual((await lines()).slice(1), ["join: @tunde, @chidi and 1 other joined"]);
  await joinRoom(db, "kemi", e.id, new Date(t0 + 30_000)); // quiet again: on its own
  assert.equal((await lines()).at(-1), "join: @kemi joined");
  // Like, share, follow: once each per person; a follow only when it's real; likes counted on the room.
  assert.equal((await markRoomEvent(db, "ada", e.id, "like")).likes, 1);
  assert.equal((await markRoomEvent(db, "ada", e.id, "like")).posted, false, "one like per person");
  await markRoomEvent(db, "tunde", e.id, "like");
  assert.equal((await db.doc(`communityRooms/${e.id}`).get()).data()!.likes, 2);
  await markRoomEvent(db, "ada", e.id, "share");
  assert.equal((await markRoomEvent(db, "chidi", e.id, "follow")).posted, false, "chidi doesn't follow emma");
  await follow("chidi", "emma");
  assert.equal((await markRoomEvent(db, "chidi", e.id, "follow")).posted, true);
  await assert.rejects(markRoomEvent(db, "ada", e.id, "hack"), /Unknown event/);
  await postRoomEvent(db, e.id, "gift", "@ada gifted @emma a Jollof Plate 🎁");
  // (the joins above carry made-up later times, so check the set, not the order)
  assert.deepEqual((await lines()).sort(), ["follow: @chidi followed @emma", "gift: @ada gifted @emma a Jollof Plate 🎁", "join: @ada joined", "join: @kemi joined", "join: @tunde, @chidi and 1 other joined", "like: @ada liked the live", "like: @tunde liked the live", "share: @ada shared the live"]);
  const ev = (await db.collection(`communityRooms/${e.id}/chat`).where("ev", "==", "like").limit(1).get()).docs[0].data();
  assert.deepEqual([ev.from, ev.name], ["", ""], "an event line has no sender");
  await endRoom(db, e.id);
  assert.equal(await postRoomEvent(db, e.id, "gift", "late"), false, "nothing after the live ends");
  await pass(false);

  console.log("PROFILE LIVES OK");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
