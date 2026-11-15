// Growth measurement on the Firestore emulator (lib/growth-server.ts): the source kept with a new account (once, the channel only for
// teens), first values once each, new visitors, creator-link opens and installs by channel, returns in weeks 1 to 4 with what brought
// them, the hourly snapshot for Admin → Growth, a member's own invite numbers, and closing an account.
// Run: npm run test:growth-server → "GROWTH SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { encodeTouch, classifyTouch } from "../../lib/growth";
import {
  _resetFirstValueMemory, firstValue, gatherGrowth, growthDocsFor, inviteStats, markFirstValue, markSeen, recordInstall, recordSignupSource, recordVisit, storedGrowth,
} from "../../lib/growth-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const DAY = 86_400_000;
const now = new Date("2026-11-15T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const cookie = (path: string, params: Record<string, string> = {}, refHost = "") => encodeTouch(classifyTouch({ path, params, refHost, ownHosts: ["notesapp.name.ng"], now }));

async function member(uid: string, username: string, extra: Record<string, unknown> = {}) {
  await db.doc(`usernames/${username}`).set({ uid });
  await db.doc(`users/${uid}`).set({ uid, username, displayName: username, role: "reader", accountTier: "standard", createdAt: now.toISOString(), ...extra });
}

(async () => {
  await member("ada", "ada", { createdAt: ago(200).toISOString() });
  await member("new1", "new1");
  await member("teen1", "teen1", { teen: true });
  await member("old1", "old1", { createdAt: ago(30).toISOString() });

  // ---- the source goes with the account, once ----
  assert.deepEqual(await recordSignupSource(db, "new1", cookie("/install", { by: "ada" }), {}, now), { recorded: true, channel: "creators" });
  const g1 = (await db.doc("growthMembers/new1").get()).data()!;
  assert.equal(g1.channel, "creators");
  assert.equal(g1.detail, "ada");
  assert.equal(g1.landedDay, "2026-11-15");
  assert.equal(g1.young, false);
  assert.ok(!("ip" in g1) && !("url" in g1) && !("email" in g1), "no IP, address or email");
  assert.deepEqual(await recordSignupSource(db, "new1", cookie("/", {}, "www.google.com"), {}, now), { recorded: false }, "only once");
  assert.equal((await db.doc("growthMembers/new1").get()).data()!.channel, "creators", "the first record stays");
  await recordSignupSource(db, "teen1", cookie("/install", { by: "ada" }), { installed: true }, now);
  const gt = (await db.doc("growthMembers/teen1").get()).data()!;
  assert.equal(gt.channel, "creators");
  assert.equal(gt.detail, undefined, "a teen keeps the channel only, never the creator's name");
  assert.equal(gt.young, true);
  assert.equal(gt.installedAt, now.toISOString(), "installed before joining (the install cookie)");
  assert.deepEqual(await recordSignupSource(db, "old1", cookie("/"), {}, now), { recorded: false }, "a month-old account isn't new");
  assert.deepEqual(await recordSignupSource(db, "ghost", cookie("/"), {}, now), { recorded: false }, "no account");
  await member("plain", "plain");
  await recordSignupSource(db, "plain", "forged|cookie", {}, now);
  assert.equal((await db.doc("growthMembers/plain").get()).data()!.channel, "direct", "no readable cookie: Direct");


  // ---- first value: once per kind ----
  _resetFirstValueMemory();
  assert.equal(await markFirstValue(db, "new1", "read", ago(0)), true);
  assert.equal(await markFirstValue(db, "new1", "read", ago(0)), false, "remembered");
  _resetFirstValueMemory();
  assert.equal(await markFirstValue(db, "new1", "read", ago(0)), false, "already recorded, even on another server");
  assert.equal(await markFirstValue(db, null, "read"), false, "signed out: nothing");
  assert.equal(await markFirstValue(db, "new1", "nonsense" as never), false);
  assert.equal(await firstValue(db, "new1", "exam"), true);
  assert.equal((await db.doc("growthFirst/new1_exam").get()).data()!.kind, "exam");

  // ---- visits, creator links and installs ----
  const t = classifyTouch({ path: "/jobs", params: {}, refHost: "", ownHosts: [], now });
  assert.deepEqual(await recordVisit(db, { touch: t, ping: "v", signedIn: false }, now), { visit: true, open: false });
  await recordVisit(db, { touch: t, ping: "v", signedIn: false }, now);
  assert.deepEqual(await recordVisit(db, { touch: t, ping: "v", signedIn: true }, now), { visit: false, open: false }, "members aren't new visitors");
  assert.deepEqual(await recordVisit(db, { touch: t, ping: "o", creator: "ada", signedIn: true }, now), { visit: false, open: true });
  await recordVisit(db, { touch: t, ping: "vo", creator: "ADA", signedIn: false }, now);
  assert.deepEqual(await recordVisit(db, { touch: null, ping: "v", signedIn: false }, now), { visit: false, open: false }, "no first touch, nothing to count");
  const day = (await db.doc("growthDaily/20261115").get()).data()!;
  assert.equal(day.visits.jobs, 3);
  assert.equal((await db.doc("growthCreators/ada_202611").get()).data()!.opens, 2);
  assert.deepEqual(await recordInstall(db, { touch: t, uid: null, countDevice: true }, now), { device: true, member: false });
  assert.deepEqual(await recordInstall(db, { touch: null, uid: "new1", countDevice: true }, now), { device: true, member: true }, "a member's install counts in their own channel");
  assert.deepEqual(await recordInstall(db, { touch: null, uid: "new1", countDevice: false }, now), { device: false, member: false }, "once per account");
  const inst = (await db.doc("growthDaily/20261115").get()).data()!.installs;
  assert.deepEqual(inst, { jobs: 1, creators: 1 });

  // ---- returns: weeks 1 to 4 and what brought them ----
  await member("r1", "r1", { createdAt: ago(3).toISOString() });
  await db.doc("growthMembers/r1").set({ uid: "r1", joinedAt: ago(30).toISOString(), channel: "academy", weeks: [], returns: {}, lastSeenDay: "" });
  assert.deepEqual(await markSeen(db, "r1", "bell", ago(30)), { marked: true }, "the day they joined isn't a return");
  assert.deepEqual(await markSeen(db, "r1", "bell", ago(22)), { marked: true, week: 1 });
  assert.deepEqual(await markSeen(db, "r1", "bell", ago(22)), { marked: false }, "once a day");
  await markSeen(db, "r1", "digest", ago(16));
  await markSeen(db, "r1", "nonsense", ago(1));
  await markSeen(db, "r1", "reminder", ago(0));
  const r1 = (await db.doc("growthMembers/r1").get()).data()!;
  assert.deepEqual(r1.weeks.sort(), [1, 2, 4]);
  assert.deepEqual(r1.returns, { bell: 1, digest: 1, own: 1, reminder: 1 });
  assert.equal(r1.lastSeenDay, "2026-11-15");
  await db.doc("growthMembers/r2").set({ uid: "r2", joinedAt: ago(60).toISOString(), channel: "direct", weeks: [], returns: {} });
  assert.deepEqual(await markSeen(db, "r2", "bell", now), { marked: true }, "after week 4, just last seen");
  assert.deepEqual((await db.doc("growthMembers/r2").get()).data()!.returns, {});
  assert.deepEqual(await markSeen(db, "ada", "bell", now), { marked: false }, "members from before measuring began are skipped");

  // ---- the snapshot ----
  await db.doc("payments/p1").set({ uid: "r1", status: "paid", paidAt: ago(10).toISOString(), amountKobo: 100 });
  await db.doc("payments/p2").set({ uid: "r1", status: "pending", paidAt: ago(5).toISOString() });
  await db.doc("referrals/new1").set({ uid: "new1", referredBy: "ada", referredByUsername: "ada", referredAt: now.toISOString() });
  const rep = await gatherGrowth(db, now);
  const r30 = rep.ranges["30"];
  assert.equal(r30.signups, 4, "new1, teen1, plain and r1 (30 days ago, inside the range)");
  assert.equal(r30.installs, 2);
  assert.equal(r30.visits, 3);
  assert.equal(r30.funnels.academy!.steps[5].count, 1, "r1 paid after joining");
  assert.deepEqual(r30.creators.map((c) => [c.username, c.joined, c.installed]), [["ada", 1, 1]], "teen1 never counted for @ada");
  assert.ok(rep.triggers.find((x) => x.trigger === "bell")!.returns >= 1);
  const stored = await storedGrowth(db);
  assert.equal(stored.data.ranges["30"].signups, 4);
  assert.ok((await db.doc("statCache/growth").get()).exists, "kept as a snapshot, read once per page view");

  // ---- a member's own invite numbers ----
  await member("viaby", "viaby");
  await recordSignupSource(db, "viaby", cookie("/install", { by: "ada" }), {}, now); // came through ?by= but the referral wasn't claimed
  const mine = await inviteStats(db, "ada", "ada", now);
  assert.deepEqual(mine, { opened: 2, joined: 2, installed: 1, active: 2 }, "new1 (referral) and viaby (first touch), never teen1");

  // ---- closing an account ----
  for (const ref of growthDocsFor(db, "new1")) await ref.delete();
  assert.equal((await db.doc("growthMembers/new1").get()).exists, false);
  assert.equal((await db.doc("growthFirst/new1_read").get()).exists, false);

  console.log("GROWTH SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
