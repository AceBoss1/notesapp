// Fan levels against the Firestore emulator (lib/fans-server.ts): points for money and actions within the daily caps, never for oneself;
// the top list and badges (rank and tier); the Top fans page with teens only for their followers and the creator's choice to hide it;
// a fan's own level; vehicle picks; live entrances; comment and reaction points through the real comment code; the admin settings.
// Run: npm run test:fans-server → "FANS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { addFanPoints, fanBadges, fanBoard, getFanSettings, liveEntrance, resetFanCaches, saveFanSettings, setVehicle, topFanList } from "../../lib/fans-server";
import { FAN_LIVE } from "../../lib/fans";
import { notifyLike, postComment } from "../../lib/comments-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const person = (uid: string, extra: Record<string, unknown> = {}) => Promise.all([
  db.doc(`users/${uid}`).set({ uid, username: uid, displayName: `${uid[0].toUpperCase()}${uid.slice(1)} Test`, role: "publisher", accountTier: "basic", ...extra }),
  db.doc(`usernames/${uid}`).set({ uid }),
]);
const sub = (fan: string, creator: string, tier?: string, days = 20) => db.doc(`subscriptions/${fan}_${creator}`).set({ subscriberUid: fan, username: creator, status: "active", currentPeriodEnd: new Date(Date.now() + days * 86_400_000).toISOString(), ...(tier ? { tier } : {}) });

(async () => {
  await Promise.all(["emma", "ada", "tobi", "chi", "kemi", "teen", "fan"].map((u) => person(u, u === "teen" ? { teen: true } : {})));

  // Money: 1 point per ₦100. Never for oneself.
  assert.equal(await addFanPoints(db, "emma", "ada", { kobo: 2_500_000 }), 250, "₦25,000 VVIP month");
  assert.equal(await addFanPoints(db, "emma", "emma", { kobo: 2_500_000 }), 0, "not for oneself");
  await addFanPoints(db, "emma", "tobi", { kobo: 750_000 });
  await addFanPoints(db, "emma", "chi", { kobo: 250_000 });
  await addFanPoints(db, "emma", "teen", { kobo: 1_000_000 });
  // Actions within today's caps: 5 shares count, the 6th doesn't.
  let shares = 0;
  for (let i = 0; i < 6; i++) shares += await addFanPoints(db, "emma", "kemi", { action: "share" });
  assert.equal(shares, 50, "5 shares a day count");
  const kemi = (await db.doc("fanScores/emma_kemi").get()).data()!;
  assert.equal(kemi.points, 50); assert.equal(kemi.dayCounts.share, 5);
  // A new Lagos day starts the caps again.
  assert.equal(await addFanPoints(db, "emma", "kemi", { action: "share" }, new Date(Date.now() + 86_400_000)), 10);

  // The top list, most points first.
  resetFanCaches();
  assert.deepEqual((await topFanList(db, "emma")).map((r) => r.uid), ["ada", "teen", "tobi", "kemi", "chi"]);

  // Badges: rank (top 99) and tier, for any uid list, even when the creator hides the list.
  await sub("ada", "emma", "vvip"); await sub("tobi", "emma", "vip"); await sub("chi", "emma"); await sub("kemi", "emma", "vip", -1);
  const b = await fanBadges(db, "emma", ["ada", "tobi", "chi", "kemi", "nobody"]);
  assert.equal(b.creatorFirstName, "Emma");
  assert.deepEqual(b.badges.ada, { rank: { emoji: "🥇", tone: "gold", label: "Emma's Top Fan", place: 1 }, tier: "vvip" });
  assert.equal(b.badges.tobi.rank!.emoji, "🥉"); assert.equal(b.badges.tobi.tier, "vip");
  assert.equal(b.badges.chi.tier, "premium", "a subscription from before tiers is Premium");
  assert.equal(b.badges.kemi.tier, undefined, "an ended subscription has no tier badge");
  assert.equal(b.badges.nobody, undefined);

  // The Top fans page: a teen only for people who follow them; the creator's choice to hide it; the viewer's own level.
  let board = (await fanBoard(db, null, "emma"))!;
  assert.deepEqual(board.rows.map((r) => [r.place, r.username]), [[1, "ada"], [3, "tobi"], [4, "kemi"], [5, "chi"]], "signed out: the teen isn't shown (places stay)");
  await db.doc("follows/fan_teen").set({ followerUid: "fan", username: "teen" });
  board = (await fanBoard(db, { uid: "fan", username: "fan" }, "emma"))!;
  assert.ok(board.rows.some((r) => r.username === "teen"), "a follower sees the teen");
  assert.deepEqual(board.me!.points, 0); assert.equal(board.me!.place, null); assert.equal(board.me!.fans, 5);
  board = (await fanBoard(db, { uid: "chi", username: "chi" }, "emma"))!;
  assert.deepEqual([board.me!.place, board.me!.points, board.me!.tier], [5, 25, "premium"]);
  assert.deepEqual(board.me!.next, { place: 3, needed: 51 }, "to the top 3 (top 10 is already reached)");
  await db.doc("publisherSettings/emma").set({ uid: "emma", fansHidden: true }, { merge: true });
  board = (await fanBoard(db, null, "emma"))!;
  assert.equal(board.hidden, true); assert.deepEqual(board.rows, []);
  assert.equal((await fanBoard(db, { uid: "emma", username: "emma" }, "emma"))!.hidden, false, "the creator still sees it");
  assert.equal((await fanBadges(db, "emma", ["ada"])).badges.ada.rank!.place, 1, "badges still show");
  await db.doc("publisherSettings/emma").set({ fansHidden: false }, { merge: true });
  await person("young", { teen: true });
  await addFanPoints(db, "young", "ada", { kobo: 100_000 });
  assert.equal((await fanBoard(db, null, "young"))!.hidden, true, "a teen creator's list is hidden");

  // Vehicles and live entrances: #1 with VVIP by yacht or jet; #2 needs any tier; #3 (tobi, VIP) by e-bike or bicycle.
  await setVehicle(db, "ada", 1, "jet");
  await assert.rejects(setVehicle(db, "ada", 1, "suv"), /isn't one of the two/);
  await assert.rejects(setVehicle(db, "ada", 4, "jet"), /Pick a vehicle/);
  const e1 = (await liveEntrance(db, "emma", "ada", "in"))!;
  assert.deepEqual([e1.vehicle, e1.place, e1.tier, e1.badge, e1.way], ["jet", 1, "vvip", "🥇 Emma's Top Fan", "in"]);
  assert.equal(await liveEntrance(db, "emma", "teen", "in"), null, "#2 without a subscription: no entrance");
  assert.equal((await liveEntrance(db, "emma", "tobi", "out"))!.vehicle, "ebike");
  assert.equal(await liveEntrance(db, "emma", "chi", "in"), null, "#5: no entrance");
  assert.equal(await liveEntrance(db, "emma", "emma", "in"), null);
  await sub("ada", "emma", "vip");
  assert.equal(await liveEntrance(db, "emma", "ada", "in"), null, "#1 without VVIP: no yacht or jet");

  // Comments and reactions through the real code: 3 a comment (10 a day), 1 a reaction once per journal.
  await db.doc("notes/n1").set({ title: "Raising your first ₦5m", slug: "raise", status: "published", authorUid: "emma", authorUsername: "emma" });
  const before = (await db.doc("fanScores/emma_fan").get()).data()?.points ?? 0;
  await postComment(db, "fan", { noteId: "n1", content: "Great read" }, false);
  assert.equal((await db.doc("fanScores/emma_fan").get()).data()!.points, before + 3);
  await db.doc("notes/n1/likes/fan").set({ at: "x" });
  await notifyLike(db, "fan", "n1"); await notifyLike(db, "fan", "n1");
  assert.equal((await db.doc("fanScores/emma_fan").get()).data()!.points, before + 4, "a reaction counts once");

  // Admin settings: saved, applied live, refused when out of range.
  await saveFanSettings(db, { vipUpliftPct: 15, vipMin: 6_000 }, "admin1");
  assert.equal(FAN_LIVE.vipUpliftPct, 15); assert.equal((await getFanSettings(db)).vipMin, 6_000);
  await assert.rejects(saveFanSettings(db, { vvipMin: 600_000 }, "admin1"), /VVIP: the lowest price is above the highest/);
  assert.deepEqual((await db.doc("serverConfig/fans").get()).data()!.overrides, { vipMin: 6_000, vipUpliftPct: 15 });

  console.log("FANS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
