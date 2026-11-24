// Messages from #NotesApp's own account (lib/official-messages-server.ts, lib/messages-server.ts sendSystemMessage; owner, 24 Nov 2026:
// "telling winners in Messages") against the Firestore emulator. The system message skips only the member-to-member rules (follow-only
// messages, the sender's plan); everything else still holds. Part of npm run test:messages → "OFFICIAL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MessageError, sendMessage, sendSystemMessage } from "../../lib/messages-server";
import { officialSender, sendOfficialMessage } from "../../lib/official-messages-server";
import { conversationId } from "../../lib/messages-rules";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const alerts = { email: async () => {}, push: async () => 0 };
const rejects = (p: Promise<unknown>, status: number, re: RegExp) =>
  assert.rejects(p, (e: unknown) => e instanceof MessageError && e.status === status && re.test(e.message) ? true : (console.error(e), false));

(async () => {
  await db.doc("users/team").set({ username: "notesteam", displayName: "#NotesApp" });
  await db.doc("usernames/notesteam").set({ uid: "team" });
  await db.doc("users/ob").set({ username: "ob", displayName: "Ob", keepDmFollowers: true }); // takes messages only from people they follow
  await db.doc("users/oc").set({ username: "oc", displayName: "Oc" });
  await db.doc("users/os").set({ username: "os", suspended: true });
  await db.doc("users/member").set({ username: "member", displayName: "A member" });

  // Who the messages come from: the configured account, or a reason.
  assert.deepEqual(await officialSender(db, "@NotesTeam"), { ok: true, uid: "team", username: "notesteam" });
  const unset = await officialSender(db, "");
  assert.ok(!unset.ok && /OFFICIAL_MESSAGES_USERNAME/.test(unset.error));
  const missing = await officialSender(db, "nobody");
  assert.ok(!missing.ok && /no such account/.test(missing.error));
  await rejects(sendOfficialMessage(db, "oc", "Hi", { sender: unset, alerts }), 503, /OFFICIAL_MESSAGES_USERNAME/);

  // A member still can't message someone who takes messages only from people they follow...
  await assert.rejects(sendMessage(db, "member", "ob", { text: "Hi" }, new Date(), async () => {}, alerts), /only gets messages from people they follow/);
  // ...but #NotesApp's system message reaches them, with no generic "New message" bell (the caller sends its own).
  const sender = await officialSender(db, "notesteam");
  const sent = await sendOfficialMessage(db, "ob", "Congratulations! Reply here to confirm your details.", { sender, alerts });
  assert.equal(sent.conversationId, conversationId("team", "ob"));
  const msgs = await db.collection(`conversations/${sent.conversationId}/messages`).get();
  assert.equal(msgs.size, 1); assert.equal(msgs.docs[0].data().from, "team");
  const conv = (await db.doc(`conversations/${sent.conversationId}`).get()).data()!;
  assert.deepEqual(conv.participants, ["ob", "team"]); assert.equal(conv.unread.ob, 1);
  assert.equal((await db.collection("notifications").where("recipientUid", "==", "ob").get()).size, 0, "no generic bell");
  // The winner's reply goes back to the team's inbox like any message.
  await sendMessage(db, "ob", "team", { text: "Thanks! My details..." }, new Date(), async () => {}, alerts);
  assert.equal((await db.doc(`conversations/${sent.conversationId}`).get()).data()!.unread.team, 1);

  // What still holds: a missing or suspended recipient, a block, a suspended sender, an empty or too-long message, yourself.
  await rejects(sendSystemMessage(db, "team", "ghost", "Hi", new Date(), async () => {}, alerts), 404, /wasn't found/);
  await rejects(sendSystemMessage(db, "team", "os", "Hi", new Date(), async () => {}, alerts), 404, /wasn't found/);
  await db.doc("dmBlocks/oc_team").set({ blocker: "oc", blocked: "team" });
  await rejects(sendSystemMessage(db, "team", "oc", "Hi", new Date(), async () => {}, alerts), 403, /blocked/);
  await db.doc("dmBlocks/oc_team").delete();
  await rejects(sendSystemMessage(db, "team", "oc", "   ", new Date(), async () => {}, alerts), 400, /Write a message/);
  await rejects(sendSystemMessage(db, "team", "oc", "x".repeat(2001), new Date(), async () => {}, alerts), 413, /up to/);
  await rejects(sendSystemMessage(db, "team", "team", "Hi", new Date(), async () => {}, alerts), 400, /someone else/);
  await db.doc("users/team").update({ suspended: true });
  await rejects(sendSystemMessage(db, "team", "oc", "Hi", new Date(), async () => {}, alerts), 503, /can't send/);
  assert.ok(!(await officialSender(db, "notesteam")).ok, "a suspended messaging account isn't used");
  await db.doc("users/team").update({ suspended: false });
  await sendSystemMessage(db, "team", "oc", "Hi", new Date(), async () => {}, alerts);

  console.log("OFFICIAL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
