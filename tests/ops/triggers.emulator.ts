// The stage-trigger numbers gathered on the server (lib/ops-metrics-server.ts) against the Firestore emulator, without Redis
// (timings kept in memory), Cloud Monitoring or Cloudflare. Run: npm run test:ops-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { gatherTriggers, recordTiming, trackJob } from "../../lib/ops-metrics-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date("2026-10-24T12:00:00Z");
const dayAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);

(async () => {
  // Scheduled runs: a run that throws is started but never finished, like one the time limit cut off.
  await trackJob(db, async () => 1, () => new Date(`${dayAgo(2)}T10:00:00Z`));
  await assert.rejects(trackJob(db, async () => { throw new Error("cut off"); }, () => new Date(`${dayAgo(2)}T10:15:00Z`)));
  const d2 = (await db.doc(`opsDaily/${dayAgo(2)}`).get()).data()!;
  assert.deepEqual([d2.jobsStarted, d2.jobsFinished], [2, 1]);
  await db.doc(`opsDaily/${dayAgo(0)}`).set({ jobsStarted: 1, jobsFinished: 0, partnerBlocks: 2 }); // today's run may still be going
  await db.doc(`opsDaily/${dayAgo(40)}`).set({ jobsStarted: 9, jobsFinished: 0, partnerBlocks: 9 }); // too old to count

  for (let i = 0; i < 3; i++) await db.collection("ledger").add({ status: "held" });
  await db.doc("presence/a").set({ lastSeen: Timestamp.fromDate(new Date(now.getTime() - 3_600_000)) });
  await db.doc("presence/b").set({ lastSeen: Timestamp.fromDate(new Date(now.getTime() - 20 * 3_600_000)) });
  await db.doc("presence/c").set({ lastSeen: Timestamp.fromDate(new Date(now.getTime() - 3 * 86_400_000)) });
  await db.doc("communityRooms/r1").set({ createdAt: new Date(now.getTime() - 5 * 86_400_000).toISOString(), peak: 6 });
  await db.doc("communityRooms/r2").set({ createdAt: new Date(now.getTime() - 50 * 86_400_000).toISOString(), peak: 40 });
  for (const v of [700, 800, 900, 950, 1600]) await recordTiming("page", v, now);
  for (const v of [300, 400]) await recordTiming("feed", v, now);
  await recordTiming("search", 650, now);
  await recordTiming("report", 4200, new Date(now.getTime() - 10 * 86_400_000));
  await recordTiming("page", 99_999_999, now); // out of range: dropped

  const t = Object.fromEntries((await gatherTriggers(db, now)).map((x) => [x.key, x]));
  assert.deepEqual(Object.keys(t), ["limits", "money", "speed", "members", "scale"]);
  assert.deepEqual([t.limits.stage, t.money.stage, t.speed.stage, t.members.stage, t.scale.stage], [1, 2, 3, 3, 4]);

  assert.deepEqual(t.limits.parts.map((p) => [p.value, p.status]), [["1", "near"], ["2", "near"]], "one run cut off (not today's), two blocks today, none from 40 days ago");
  assert.equal(t.limits.status, "near");
  assert.deepEqual(t.money.parts.map((p) => p.value), ["3", "4.2 s"]);
  assert.equal(t.money.status, "ok");
  assert.deepEqual(t.speed.parts.map((p) => [p.value, p.status]), [["1.6 s", "crossed"], ["400 ms", "ok"]]);
  assert.equal(t.speed.status, "crossed");
  assert.equal(t.members.parts[0].value, "2", "presence in the last 24 hours");
  assert.deepEqual([t.members.parts[1].value, t.members.parts[1].status], ["not connected", "unknown"]);
  assert.equal((await db.doc(`opsDaily/${dayAgo(0)}`).get()).data()!.activeMembers, 2, "kept for next month's comparison");
  assert.deepEqual(t.scale.parts.map((p) => [p.value, p.status]), [["650 ms", "crossed"], ["6 people", "ok"], ["not connected", "unknown"]]);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
