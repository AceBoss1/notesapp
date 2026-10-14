import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { answerRequest, changeMessage, pinChat, pinMessage, sweepMessageRequests } from "../../lib/message-edits";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const quiet = async () => {};
const rej = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, re); };
(async () => {
  const now = new Date("2026-10-14T10:00:00Z");
  for (const u of ["a", "b", "c", "d"]) await db.doc(`users/${u}`).set({ username: u, displayName: u.toUpperCase() });
  await db.doc("conversations/a_b").set({ participants: ["a", "b"], createdAt: now.toISOString(), lastMessage: { from: "a", text: "two", at: "2026-10-14T09:02:00Z" } });
  const msg = (cid: string, id: string, data: object) => db.doc(`conversations/${cid}/messages/${id}`).set(data);
  await msg("a_b", "m1", { from: "a", text: "one", createdAt: "2026-10-14T09:01:00Z" });
  await msg("a_b", "m2", { from: "a", text: "two", createdAt: "2026-10-14T09:02:00Z", readAt: "2026-10-14T09:03:00Z" });
  await msg("a_b", "m3", { from: "b", text: "three", createdAt: "2026-10-14T09:04:00Z" });
  await msg("a_b", "m4", { from: "a", text: "four", createdAt: "2026-10-14T09:05:00Z" });

  // unread: changes straight away; only your own; not someone else's
  assert.deepEqual(await changeMessage(db, "a", "a_b", "m1", "edit", "one!", quiet, now, quiet), { done: true });
  let m = (await db.doc("conversations/a_b/messages/m1").get()).data()!; assert.equal(m.text, "one!"); assert.ok(m.editedAt);
  await rej(changeMessage(db, "b", "a_b", "m1", "edit", "hack", quiet, now, quiet), /own/);
  await rej(changeMessage(db, "c", "a_b", "m1", "edit", "x", quiet, now, quiet), /wasn't found/);
  // read: needs the reader's consent
  const r = await changeMessage(db, "a", "a_b", "m2", "edit", "two (fixed)", quiet, now, quiet);
  assert.equal(r.done, false); const reqId = (r as { requestId: string }).requestId;
  m = (await db.doc("conversations/a_b/messages/m2").get()).data()!; assert.equal(m.text, "two"); assert.equal(m.pendingRequest.kind, "edit");
  await rej(changeMessage(db, "a", "a_b", "m2", "delete", null, quiet, now, quiet), /already a request/);
  await rej(answerRequest(db, "a", reqId, "allow", quiet, now), /isn't for you/);
  assert.equal((await answerRequest(db, "b", reqId, "allow", quiet, now)).status, "applied");
  m = (await db.doc("conversations/a_b/messages/m2").get()).data()!; assert.equal(m.text, "two (fixed)"); assert.equal(m.pendingRequest, undefined);
  assert.equal((await db.doc("conversations/a_b").get()).data()!.lastMessage.text, "two (fixed)", "the inbox preview follows the edit");
  // a declined delete leaves it; a withdrawn one too
  const d1 = await changeMessage(db, "a", "a_b", "m2", "delete", null, quiet, now, quiet) as { requestId: string };
  assert.equal((await answerRequest(db, "b", d1.requestId, "decline", quiet, now)).status, "declined");
  assert.equal((await db.doc("conversations/a_b/messages/m2").get()).data()!.deleted, undefined);
  const d2 = await changeMessage(db, "a", "a_b", "m2", "delete", null, quiet, now, quiet) as { requestId: string };
  assert.equal((await answerRequest(db, "a", d2.requestId, "withdraw", quiet, now)).status, "withdrawn");
  // an unread delete happens at once
  assert.deepEqual(await changeMessage(db, "a", "a_b", "m4", "delete", null, quiet, now, quiet), { done: true });
  m = (await db.doc("conversations/a_b/messages/m4").get()).data()!; assert.ok(m.deleted); assert.equal(m.text, "");
  await rej(changeMessage(db, "a", "a_b", "m4", "edit", "back", quiet, now, quiet), /can't be changed/);
  console.log("edits ok");

  // groups: everyone whose read marker passed the message must agree
  await db.doc("conversations/g_1").set({ kind: "group", participants: ["a", "b", "c", "d"], adminUids: ["a"], readMarker: { b: "2026-10-14T09:10:00Z", c: "2026-10-14T09:10:00Z", d: "2026-10-14T09:00:00Z" } });
  await msg("g_1", "g1", { from: "a", text: "hello all", createdAt: "2026-10-14T09:05:00Z" });
  const g = await changeMessage(db, "a", "g_1", "g1", "edit", "hello everyone", quiet, now, quiet) as { requestId: string; waitingFor: number };
  assert.equal(g.waitingFor, 2);
  assert.equal((await answerRequest(db, "b", g.requestId, "allow", quiet, now)).status, "waiting");
  await rej(answerRequest(db, "d", g.requestId, "allow", quiet, now), /isn't for you/);
  assert.equal((await answerRequest(db, "c", g.requestId, "allow", quiet, now)).status, "applied");
  console.log("group consent ok");

  // pins: 3 messages per chat (admins only in a group), 3 chats per member
  for (const id of ["m1", "m2", "m3"]) await pinMessage(db, "b", "a_b", id, true, now);
  await rej(pinMessage(db, "a", "a_b", "m4", true, now), /not found|wasn't found/); // deleted
  await msg("a_b", "m5", { from: "b", text: "five", createdAt: "2026-10-14T09:06:00Z" });
  await rej(pinMessage(db, "a", "a_b", "m5", true, now), /up to 3/);
  assert.equal((await pinMessage(db, "a", "a_b", "m2", false, now)).pinned.length, 2);
  await rej(pinMessage(db, "b", "g_1", "g1", true, now), /admins/);
  assert.equal((await pinMessage(db, "a", "g_1", "g1", true, now)).pinned.length, 1);
  for (const n of [1, 2, 3]) await db.doc(`conversations/c${n}`).set({ participants: ["a", "z"] });
  await pinChat(db, "a", "c1", true); await pinChat(db, "a", "c2", true); await pinChat(db, "a", "c3", true);
  await rej(pinChat(db, "a", "a_b", true), /up to 3/);
  assert.deepEqual((await pinChat(db, "a", "c2", false)).pinnedChats, ["c1", "c3"]);
  await rej(pinChat(db, "c", "a_b", true), /wasn't found/);
  console.log("pins ok");

  // requests nobody answered are wiped after 30 days
  const old = await changeMessage(db, "a", "a_b", "m2", "edit", "late", quiet, now, quiet) as { requestId: string };
  assert.equal(await sweepMessageRequests(db, new Date(now.getTime() + 31 * 86_400_000)), 1);
  assert.equal((await db.doc(`messageRequests/${old.requestId}`).get()).exists, false);
  assert.equal((await db.doc("conversations/a_b/messages/m2").get()).data()!.pendingRequest, undefined);
  console.log("ALL OK");
})().catch((e) => { console.log("FAIL", e); process.exit(1); });
