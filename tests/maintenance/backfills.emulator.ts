// Admin → Maintenance's backfills (lib/backfills.ts runBackfill) against the Firestore emulator: a dry run lists and writes
// nothing, apply writes exactly that list (and only with the dry run's planHash), a second run finds nothing left, and undo puts
// a run back except journals edited since. Run: npm run test:maintenance → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PlanChanged, listRuns, runBackfill, undoRun } from "../../lib/backfills";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  await db.doc("users/u_emma").set({ displayName: "Emmanuel Adams", username: "emmanuel" });
  await db.doc("usernames/emmanuel").set({ uid: "u_emma" });
  await db.doc("users/u_ada1").set({ displayName: "Ada Obi", username: "ada1" });
  await db.doc("users/u_ada2").set({ displayName: "Ada Obi", username: "ada2" });
  await db.doc("notes/n1").set({ title: "Old post", slug: "old-post", author: "Emmanuel Adams", categories: ["Fintech", "Pottery"], tags: [] });
  await db.doc("notes/n2").set({ title: "Twin", slug: "twin", author: "Ada Obi", categories: ["Pottery"] });
  await db.doc("notes/n3").set({ title: "Done", slug: "done", author: "x", authorUid: "u_emma", authorUsername: "emmanuel", topics: ["ai"], categories: ["AI"], tags: [] });

  // Authors: the dry run lists n1, flags the twin, writes nothing.
  const dry = await runBackfill(db, "author-uids", false);
  assert.equal(dry.total, 3); assert.equal(dry.applied, false);
  assert.deepEqual(dry.changes.map((c) => [c.id, c.slug, c.set]), [["n1", "old-post", { authorUsername: "emmanuel", authorUid: "u_emma" }]]);
  assert.deepEqual(dry.flags.map((f) => [f.id, f.note]), [["n2", 'author "Ada Obi" matches 2 accounts']]);
  assert.equal((await db.doc("notes/n1").get()).data()!.authorUid, undefined, "a dry run writes nothing");

  assert.match(dry.planHash, /^[0-9a-f]{16}$/);
  assert.equal((await runBackfill(db, "author-uids", false)).planHash, dry.planHash, "the same plan gives the same hash");
  await assert.rejects(runBackfill(db, "author-uids", true, { planHash: "0000000000000000" }), (e: unknown) => e instanceof PlanChanged && e.fresh.changes.length === 1);
  assert.equal((await db.doc("notes/n1").get()).data()!.authorUid, undefined, "a stale plan writes nothing");
  assert.equal((await db.collection("maintenanceRuns").get()).size, 0, "and records no run");

  const by = { uid: "u_boss", name: "Boss" };
  const done = await runBackfill(db, "author-uids", true, { planHash: dry.planHash, by, backupConfirmed: true });
  assert.equal(done.changes.length, 1);
  assert.ok(done.runId);
  const img = (await db.doc(`maintenanceRuns/${done.runId}/changes/n1`).get()).data()!;
  assert.deepEqual(img, { before: {}, missing: ["authorUsername", "authorUid"], after: { authorUsername: "emmanuel", authorUid: "u_emma" } });
  assert.equal((await db.doc("notes/n1").get()).data()!.authorUid, "u_emma");
  assert.equal((await db.doc("notes/n1").get()).data()!.title, "Old post", "merged, nothing else touched");
  assert.equal((await runBackfill(db, "author-uids", false)).changes.length, 0, "nothing left the second time");

  // Topics: n1 gets fintech and keeps Pottery as a hashtag; n2 has no topic and is listed.
  const t = await runBackfill(db, "topics", true, { by });
  assert.deepEqual(t.changes.find((c) => c.id === "n1")?.set, { topics: ["fintech"], categories: ["Fintech"], tags: ["pottery"] });
  assert.ok(t.flags.some((f) => f.id === "n2" && /no topic yet/.test(f.note)));
  assert.deepEqual((await db.doc("notes/n1").get()).data()!.topics, ["fintech"]);
  assert.equal((await runBackfill(db, "topics", false)).changes.length, 0);
  assert.deepEqual((await db.doc(`maintenanceRuns/${t.runId}/changes/n1`).get()).data()!.before, { categories: ["Fintech", "Pottery"], tags: [] }, "old values kept");

  // Runs are listed newest first with who and how many.
  const runs = await listRuns(db);
  assert.deepEqual(runs.map((r) => [r.job, r.status, r.count, r.written, r.byName]), [["topics", "applied", t.changes.length, t.changes.length, "Boss"], ["author-uids", "applied", 1, 1, "Boss"]]);
  assert.equal(runs[1].backupConfirmed, true);

  // Undo the topics run: n1's old categories and tags come back, the topics field it never had is removed.
  const u = await undoRun(db, t.runId!, by);
  assert.equal(u.restored, t.changes.length); assert.deepEqual(u.kept, []);
  const n1 = (await db.doc("notes/n1").get()).data()!;
  assert.deepEqual([n1.topics, n1.categories, n1.tags, n1.authorUid], [undefined, ["Fintech", "Pottery"], [], "u_emma"], "only that run's fields go back");
  assert.equal((await listRuns(db))[0].status, "undone");
  await assert.rejects(undoRun(db, t.runId!, by), /already undone/);

  // A journal edited since the run is left as it is and listed; the rest are put back.
  await db.doc("notes/n4").set({ title: "Later", slug: "later", author: "Emmanuel Adams" });
  await db.doc("notes/n5").set({ title: "Gone", slug: "gone", author: "Emmanuel Adams" });
  const a2 = await runBackfill(db, "author-uids", true, { by });
  assert.deepEqual(a2.changes.map((c) => c.id).sort(), ["n4", "n5"]);
  await db.doc("notes/n4").update({ authorUsername: "emma-renamed" });
  await db.doc("notes/n5").delete();
  const u2 = await undoRun(db, a2.runId!, by);
  assert.equal(u2.restored, 0);
  assert.deepEqual(u2.kept.map((k) => [k.id, k.note]).sort(), [["n4", "changed since the run (authorUsername), left as it is"], ["n5", "deleted since the run"]]);
  assert.equal((await db.doc("notes/n4").get()).data()!.authorUsername, "emma-renamed");
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
