// Team hub server (lib/team-server.ts) against the Firestore emulator: several people on an item, monthly items, the BIMI seed.
// Run: npm run test:team-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { addComment, createItem, sendWorkReminders, updateItem, type DigestDeps } from "../../lib/team-server";
import { BIMI_BACKLOG, seedOnce } from "../../lib/team-seed";
import { addMonths, lagosDate } from "../../lib/team";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));
const people = [{ uid: "u_boss", name: "Boss", email: "" }, { uid: "u_ada", name: "Ada", email: "" }, { uid: "u_tunde", name: "Tunde", email: "" }];

(async () => {
  // Assigned to three people at once: each of the others gets a bell, the person who did it doesn't.
  const { id } = await createItem(db, "u_boss", { title: "Launch post", ownerUids: ["u_boss", "u_ada", "u_tunde"], due: "2026-11-20" });
  const it = (await db.doc(`teamItems/${id}`).get()).data()!;
  assert.deepEqual(it.ownerUids, ["u_boss", "u_ada", "u_tunde"]); assert.equal(it.ownerUid, "u_boss");
  assert.equal((await bells("u_ada")).length, 1); assert.match((await bells("u_ada"))[0], /assigned you “Launch post” with 2 others/);
  assert.equal((await bells("u_tunde")).length, 1);
  assert.equal((await bells("u_boss")).length, 0, "no bell for assigning yourself");

  // Adding someone tells only them; taking someone off tells no one.
  await db.doc("users/u_chi").set({ uid: "u_chi", displayName: "Chi" });
  await updateItem(db, id, { ownerUids: ["u_ada", "u_tunde", "u_chi"] }, "u_boss");
  assert.equal((await bells("u_chi")).length, 1); assert.equal((await bells("u_ada")).length, 1, "Ada isn't told again");
  assert.deepEqual((await db.doc(`teamItems/${id}`).get()).data()!.ownerUids, ["u_ada", "u_tunde", "u_chi"]);
  // Older callers sending one owner still work.
  const { id: one } = await createItem(db, "u_boss", { title: "Old style", ownerUid: "u_ada" });
  assert.deepEqual((await db.doc(`teamItems/${one}`).get()).data()!.ownerUids, ["u_ada"]);

  // A comment reaches everyone on the item.
  await addComment(db, "u_ada", id, "Draft is up", people);
  assert.equal((await bells("u_tunde")).length, 2); assert.equal((await bells("u_chi")).length, 2); assert.equal((await bells("u_ada")).length, 2, "not the writer (her two are the assignments)");

  // Deadline reminders: one per person.
  const sent: string[] = [];
  const deps: DigestDeps = { bell: async (uid) => { sent.push(uid); }, email: async () => {}, emailOf: async () => null, people: async () => people };
  await db.doc(`teamItems/${id}`).update({ due: "2026-10-18", remindedDays: [] });
  assert.equal(await sendWorkReminders(db, new Date("2026-10-17T09:00:00Z"), deps), 3);
  assert.deepEqual(sent.sort(), ["u_ada", "u_chi", "u_tunde"]);
  sent.length = 0;
  await sendWorkReminders(db, new Date("2026-10-17T10:00:00Z"), deps);
  assert.deepEqual(sent, [], "not twice for the same threshold");

  // Monthly: done → open again, due a month on, reminders reset.
  const { id: m } = await createItem(db, "u_boss", { title: "Monthly check", ownerUids: ["u_boss"], due: "2026-11-02", repeat: "monthly" });
  await db.doc(`teamItems/${m}`).update({ remindedDays: [3, 1, 0] });
  const r = await updateItem(db, m, { status: "done" }, "u_boss");
  const after = (await db.doc(`teamItems/${m}`).get()).data()!;
  assert.equal(after.status, "todo"); assert.equal(after.due, "2026-12-02"); assert.deepEqual(after.remindedDays, []); assert.ok(after.lastDoneAt); assert.equal(after.doneAt, "");
  assert.equal(r.rolledTo, "2026-12-02");
  // Turning the repeat off lets it close.
  await updateItem(db, m, { repeat: "" }, "u_boss");
  await updateItem(db, m, { status: "done" }, "u_boss");
  assert.equal((await db.doc(`teamItems/${m}`).get()).data()!.status, "done");
  // A monthly item done long after its date goes to the next date after today.
  const { id: late } = await createItem(db, "u_boss", { title: "Late", ownerUids: ["u_boss"], due: "2026-01-02", repeat: "monthly" });
  await updateItem(db, late, { status: "done" }, "u_boss");
  const lateDue = String((await db.doc(`teamItems/${late}`).get()).data()!.due);
  assert.ok(lateDue > lagosDate() && lateDue <= addMonths(lagosDate(), 1), `rolled past today: ${lateDue}`);

  // The BIMI seed: once, with the monthly item on the founder.
  assert.equal(await seedOnce(db, "bimi-test", BIMI_BACKLOG, "u_boss"), BIMI_BACKLOG.length);
  assert.equal(await seedOnce(db, "bimi-test", BIMI_BACKLOG, "u_boss"), 0);
  const monthly = (await db.collection("teamItems").where("seedKey", "==", "bimi-monthly-record").get()).docs.map((d) => d.data());
  assert.equal(monthly.length, 1); assert.equal(monthly[0].repeat, "monthly"); assert.deepEqual(monthly[0].ownerUids, ["u_boss"]);
  const apply = (await db.collection("teamItems").where("seedKey", "==", "bimi-cmc-apply").get()).docs[0].data();
  assert.equal(apply.due, "2027-08-31");

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
