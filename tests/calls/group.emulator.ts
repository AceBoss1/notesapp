// Group calls against the Firestore emulator (lib/group-calls-server.ts): starting rings the others and marks the group, a second start
// joins instead, 4 people fill a video call, the heartbeat, someone whose app closed is dropped, and the last one out ends it with a line
// in the chat. Run: npm run test:calls-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { beatGroupCall, joinGroupCall, leaveGroupCall, startGroupCall } from "../../lib/group-calls-server";
import type { GroupCallDoc } from "../../lib/group-calls";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof Error && re.test(e.message)); };
const pushes: { uid: string; url: string }[] = [];
const deps = { push: async (uid: string, p: { url?: string }) => { pushes.push({ uid, url: String(p.url) }); return 1; } };
const t0 = Date.parse("2026-10-19T10:00:00Z");
const T = (s: number) => new Date(t0 + s * 1000);
const get = async (id: string) => (await db.doc(`groupCalls/${id}`).get()).data() as GroupCallDoc;

(async () => {
  const people = ["a", "b", "c", "d", "e", "f"];
  for (const u of [...people, "x"]) await db.doc(`users/${u}`).set({ uid: u, username: `user_${u}`, displayName: `User ${u.toUpperCase()}`, avatar: "" });
  await db.doc("conversations/g_choir").set({ kind: "group", scope: "public", title: "Choir", participants: people, adminUids: ["a"], createdAt: T(0).toISOString() });

  await fails(startGroupCall(db, "x", "g_choir", "video", T(0), deps), /wasn't found/);
  await fails(startGroupCall(db, "a", "g_choir", "radio", T(0), deps), /voice or video/);
  const { id } = await startGroupCall(db, "a", "g_choir", "video", T(0), deps);
  assert.deepEqual(pushes.map((p) => p.uid).sort(), ["b", "c", "d", "e", "f"], "everyone else is rung");
  assert.ok(pushes[0].url.endsWith(`?join=${id}`));
  assert.deepEqual((await db.doc("conversations/g_choir").get()).data()!.liveCall, { id, kind: "video" });
  // A second start in the same group joins the call that's going.
  const again = await startGroupCall(db, "b", "g_choir", "audio", T(5), deps);
  assert.equal(again.id, id);
  assert.deepEqual((await joinGroupCall(db, "c", id, T(6))).others.sort(), ["a", "b"]);
  await joinGroupCall(db, "d", id, T(7));
  await fails(joinGroupCall(db, "e", id, T(8)), /full: 4 people/);
  await fails(joinGroupCall(db, "x", id, T(8)), /wasn't found/);
  assert.equal((await get(id)).peak, 4);
  console.log("start and join ok");

  // Heartbeats: a, b and c keep checking in; d's app closed. Past a minute, d is dropped as e joins.
  for (const u of ["a", "b", "c"]) assert.deepEqual(await beatGroupCall(db, u, id, T(60)), { live: true });
  assert.deepEqual(await beatGroupCall(db, "e", id, T(60)), { live: false }, "not in the call");
  const r = await joinGroupCall(db, "e", id, T(75));
  assert.deepEqual(r.others.sort(), ["a", "b", "c"]);
  assert.deepEqual(Object.keys((await get(id)).joined).sort(), ["a", "b", "c", "e"]);
  console.log("heartbeat ok");

  // Leaving; the last one out ends it, with a line in the chat.
  for (const u of ["b", "c", "e"]) assert.deepEqual(await leaveGroupCall(db, u, id, T(100)), { ended: false });
  assert.deepEqual(await leaveGroupCall(db, "a", id, T(723)), { ended: true });
  const done = await get(id);
  assert.equal(done.status, "ended"); assert.equal(done.seconds, 723); assert.deepEqual(done.joined, {});
  const conv = (await db.doc("conversations/g_choir").get()).data()!;
  assert.equal(conv.liveCall, undefined, "the group no longer shows Join");
  assert.equal(conv.lastMessage.text, "📞 Group video call · 12:03 · 4 people");
  const lines = await db.collection("conversations/g_choir/messages").get();
  assert.deepEqual(lines.docs.map((d) => d.data().call), [{ kind: "video", outcome: "ended", seconds: 723, group: true, peak: 4 }]);
  await fails(joinGroupCall(db, "b", id, T(730)), /has ended/);
  assert.deepEqual(await leaveGroupCall(db, "a", id, T(731)), { ended: false }, "leaving twice is harmless");

  // A call everyone silently left is closed when someone starts a new one.
  const { id: id2 } = await startGroupCall(db, "b", "g_choir", "audio", T(1000), deps);
  const { id: id3 } = await startGroupCall(db, "c", "g_choir", "audio", T(1200), deps);
  assert.notEqual(id3, id2);
  assert.equal((await get(id2)).status, "ended");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
