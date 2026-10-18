// Admin → Maintenance's backfills (lib/backfills.ts runBackfill) against the Firestore emulator: a dry run lists and writes
// nothing, apply writes exactly that list, and a second run finds nothing left. Run: npm run test:maintenance → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { runBackfill } from "../../lib/backfills";
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

  const done = await runBackfill(db, "author-uids", true);
  assert.equal(done.changes.length, 1);
  assert.equal((await db.doc("notes/n1").get()).data()!.authorUid, "u_emma");
  assert.equal((await db.doc("notes/n1").get()).data()!.title, "Old post", "merged, nothing else touched");
  assert.equal((await runBackfill(db, "author-uids", false)).changes.length, 0, "nothing left the second time");

  // Topics: n1 gets fintech and keeps Pottery as a hashtag; n2 has no topic and is listed.
  const t = await runBackfill(db, "topics", true);
  assert.deepEqual(t.changes.find((c) => c.id === "n1")?.set, { topics: ["fintech"], categories: ["Fintech"], tags: ["pottery"] });
  assert.ok(t.flags.some((f) => f.id === "n2" && /no topic yet/.test(f.note)));
  assert.deepEqual((await db.doc("notes/n1").get()).data()!.topics, ["fintech"]);
  assert.equal((await runBackfill(db, "topics", false)).changes.length, 0);
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
