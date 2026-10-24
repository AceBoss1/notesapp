// Admin → Backups (lib/backups.ts, lib/backups-client.ts): names, limits and the exact requests sent to Google's Firestore Admin
// API, against a stand-in fetch (no Google account, no network). Run: npm run test:backups → "ALL OK".
import assert from "node:assert/strict";
import { describeSchedule, fmtBytes, newDbId, pitrMinute, retentionSeconds, validDbId } from "../../lib/backups";
import { backupsApi, GoogleApiError } from "../../lib/backups-client";

// Database names: Google's rule, and never the live one.
assert.ok(validDbId("restore-20261024-2315"));
for (const bad of ["(default)", "Restore-1", "1restore", "abc", "restore-", "a".repeat(64), "re store", 5]) assert.ok(!validDbId(bad), String(bad));
assert.equal(newDbId("restore", new Date("2026-10-24T22:15:30Z")), "restore-20261024-2315", "Lagos time");
assert.equal(newDbId("clone", new Date("2026-12-31T23:30:00Z")), "clone-20270101-0030", "past midnight in Lagos");
assert.ok(validDbId(newDbId("clone")));

// Retention: 1 day to 14 weeks.
assert.equal(retentionSeconds(7), "604800s"); assert.equal(retentionSeconds(98), "8467200s");
assert.equal(retentionSeconds(0), null); assert.equal(retentionSeconds(99), null); assert.equal(retentionSeconds(1.5), null);
assert.equal(describeSchedule({ name: "x", retention: "1209600s", dailyRecurrence: {} }), "Every day, kept 2 weeks");
assert.equal(describeSchedule({ name: "x", retention: "604800s", dailyRecurrence: {} }), "Every day, kept 7 days");
assert.equal(describeSchedule({ name: "x", retention: "8467200s", weeklyRecurrence: { day: "SUNDAY" } }), "Every Sunday, kept 14 weeks");
assert.equal(fmtBytes("0"), "–"); assert.equal(fmtBytes(950), "950 B"); assert.equal(fmtBytes("2500000"), "2.5 MB");

// A point-in-time copy: a whole minute, inside the window, not in the future.
const now = new Date("2026-10-24T12:00:00Z");
assert.equal(pitrMinute("2026-10-24T10:15:42+01:00", "2026-10-17T12:00:00Z", now), "2026-10-24T09:15:00.000Z");
assert.equal(pitrMinute("2026-10-16T10:00:00Z", "2026-10-17T12:00:00Z", now), null, "older than the window");
assert.equal(pitrMinute("2026-10-24T13:00:00Z", undefined, now), null, "the future");
assert.equal(pitrMinute("nonsense", undefined, now), null);

// The requests, as Google receives them.
(async () => {
  const sent: { url: string; method: string; auth: string; body?: unknown }[] = [];
  let answer: { status: number; json: unknown } = { status: 200, json: {} };
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    sent.push({ url, method: init.method ?? "GET", auth: String((init.headers as Record<string, string>).Authorization), body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(answer.json), { status: answer.status });
  }) as typeof fetch;
  const api = backupsApi({ token: "tok", until: Date.now() + 60_000 }, "notesapp-prod");
  const last = () => sent[sent.length - 1];
  const base = "https://firestore.googleapis.com/v1/projects/notesapp-prod";

  await api.pitrOn();
  assert.deepEqual(last(), { url: `${base}/databases/(default)?updateMask=pointInTimeRecoveryEnablement`, method: "PATCH", auth: "Bearer tok", body: { pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" } });
  await api.protectionOn();
  assert.deepEqual(last().body, { deleteProtectionState: "DELETE_PROTECTION_ENABLED" });
  await api.createSchedule({ days: 14 });
  assert.deepEqual([last().method, last().url, last().body], ["POST", `${base}/databases/(default)/backupSchedules`, { retention: "1209600s", dailyRecurrence: {} }]);
  await api.createSchedule({ weekly: "SUNDAY", days: 98 });
  assert.deepEqual(last().body, { retention: "8467200s", weeklyRecurrence: { day: "SUNDAY" } });
  await assert.rejects(api.createSchedule({ days: 200 }), /1 to 98 days/);
  await api.deleteSchedule("projects/notesapp-prod/databases/(default)/backupSchedules/abc");
  assert.deepEqual([last().method, last().url], ["DELETE", "https://firestore.googleapis.com/v1/projects/notesapp-prod/databases/(default)/backupSchedules/abc"]);
  await api.restore("projects/notesapp-prod/locations/eur3/backups/b1", "restore-20261024-2315");
  assert.deepEqual([last().method, last().url, last().body], ["POST", `${base}/databases:restore`, { databaseId: "restore-20261024-2315", backup: "projects/notesapp-prod/locations/eur3/backups/b1" }]);
  await api.clone("2026-10-24T09:15:00.000Z", "clone-20261024-1015");
  assert.deepEqual(last().body, { databaseId: "clone-20261024-1015", pitrSnapshot: { database: "projects/notesapp-prod/databases/(default)", snapshotTime: "2026-10-24T09:15:00.000Z" } });

  answer = { status: 200, json: { backups: [{ name: "a", snapshotTime: "2026-10-22T00:00:00Z" }, { name: "b", snapshotTime: "2026-10-23T00:00:00Z" }] } };
  assert.deepEqual((await api.backups()).map((b) => b.name), ["b", "a"], "newest first, from every location");
  assert.equal(last().url, `${base}/locations/-/backups`);
  answer = { status: 200, json: {} };
  assert.deepEqual(await api.schedules(), []); assert.deepEqual(await api.databases(), []);

  // Google's refusals, in plain words; an expired sign-in never reaches Google.
  answer = { status: 403, json: { error: { message: "Permission denied" } } };
  await assert.rejects(api.database(), (e: unknown) => e instanceof GoogleApiError && e.status === 403 && /Cloud Datastore Owner/.test(e.message));
  answer = { status: 400, json: { error: { message: "Database ID already exists." } } };
  await assert.rejects(api.restore("x", "restore-1234"), /already exists/);
  const n = sent.length;
  await assert.rejects(backupsApi({ token: "old", until: Date.now() - 1 }, "p").database(), /expired/);
  assert.equal(sent.length, n);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
