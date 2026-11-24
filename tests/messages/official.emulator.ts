// Messages from #NotesApp's own account (lib/official-messages-server.ts, lib/messages-server.ts sendSystemMessage; owner, 24 Nov 2026:
// "telling winners in Messages") against the Firestore emulator. The system message skips only the member-to-member rules (follow-only
// messages, the sender's plan); everything else still holds. Then the default sender, the official account @na-notesapp (owner,
// 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp"): replies only, and Admin → #NotesApp inbox
// (lib/official-inbox-server.ts). Part of npm run test:messages → "OFFICIAL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { MessageError, OFFICIAL_UNREAD_MAX, getThread, listConversations, sendMessage, sendSystemMessage } from "../../lib/messages-server";
import { officialSender, sendOfficialMessage } from "../../lib/official-messages-server";
import { markOfficialRead, officialInbox, officialThread, replyAsOfficial } from "../../lib/official-inbox-server";
import { OFFICIAL_PERSON, messagePerson } from "../../lib/official-account";
import { NA_UID } from "../../lib/social-graph";
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

  // ---- The official account @na-notesapp (owner, 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp").
  // The default: no setting, empty, or any form of its name means the account itself, under its stand-in id NA_UID (no users doc).
  const na = { ok: true, uid: NA_UID, username: "na-notesapp" };
  delete process.env.OFFICIAL_MESSAGES_USERNAME;
  assert.deepEqual(await officialSender(db), na, "unset: @na-notesapp");
  process.env.OFFICIAL_MESSAGES_USERNAME = "  ";
  assert.deepEqual(await officialSender(db), na, "empty: @na-notesapp");
  for (const v of ["na-notesapp", "@na-notesapp", "naapp.tech/u/na-notesapp", "https://www.naapp.tech/u/na-notesapp/", "#NotesApp: naapp.tech/u/na-notesapp"]) {
    process.env.OFFICIAL_MESSAGES_USERNAME = v;
    assert.deepEqual(await officialSender(db), na, v);
  }
  // A real member's username still works (how it was first set up).
  process.env.OFFICIAL_MESSAGES_USERNAME = "@notesteam";
  assert.deepEqual(await officialSender(db), { ok: true, uid: "team", username: "notesteam" });
  delete process.env.OFFICIAL_MESSAGES_USERNAME;
  assert.ok(!(await db.doc(`users/${NA_UID}`).get()).exists, "the official account has no users doc");

  // A winner is told from it: the message is from NA_UID, the push names the channel, and Messages shows the channel's profile.
  const pushes: { to: string; body: string }[] = [];
  const watch = { email: async () => {}, push: async (to: string, p: { body: string }) => { pushes.push({ to, body: p.body }); return 1; } };
  await db.doc("users/w1").set({ username: "winner1", displayName: "Winner One", avatar: "/w1.png" });
  const told = await sendOfficialMessage(db, "w1", "Congratulations! Reply here to confirm your details.", { alerts: watch });
  const naCid = conversationId(NA_UID, "w1");
  assert.equal(told.conversationId, naCid);
  assert.equal((await db.doc(`conversations/${naCid}/messages/${told.messageId}`).get()).data()!.from, NA_UID);
  assert.deepEqual(pushes, [{ to: "w1", body: "NotesApp" }]);
  const rowsW1 = await listConversations(db, "w1");
  assert.equal(rowsW1[0].withUid, NA_UID); assert.equal(rowsW1[0].unread, 1);
  assert.deepEqual(messagePerson(NA_UID, undefined), { uid: NA_UID, username: "na-notesapp", displayName: "NotesApp", avatar: "/images/brand/notesapp-icon.webp", official: true });
  assert.deepEqual(messagePerson("w1", (await db.doc("users/w1").get()).data()), { uid: "w1", username: "winner1", displayName: "Winner One", avatar: "/w1.png" });
  assert.equal(OFFICIAL_PERSON.level, "verified"); assert.equal(OFFICIAL_PERSON.team, true);
  assert.equal((await getThread(db, "w1", naCid)).withUid, NA_UID);

  // The winner replies; it counts unread for the team, and nothing tries to reach NA_UID's (non-existent) phone, email or bell.
  pushes.length = 0;
  const bells: string[] = [];
  const bell = async (n: { uid: string }) => { bells.push(n.uid); };
  await sendMessage(db, "w1", NA_UID, { text: "Thanks! My name is Winner One." }, new Date(), bell, watch);
  await sendMessage(db, "w1", NA_UID, { text: "And my phone is 080…", sticker: undefined }, new Date(), bell, watch);
  assert.deepEqual(pushes, []); assert.deepEqual(bells, []);
  assert.equal((await db.doc(`conversations/${naCid}`).get()).data()!.unread[NA_UID], 2);
  // Replies only, in words: files aren't taken, and a member can't start a conversation with the official account.
  await rejects(sendMessage(db, "w1", NA_UID, { text: "file", attachmentIds: ["u1"] }, new Date(), bell, watch), 400, /Only written replies/);
  await rejects(sendMessage(db, "oc", NA_UID, { text: "Hello #NotesApp" }, new Date(), bell, watch), 403, /can't be messaged directly/);
  assert.ok(!(await db.doc(`conversations/${conversationId("oc", NA_UID)}`).get()).exists);
  // Nor flood it: at most OFFICIAL_UNREAD_MAX wait unread.
  for (let i = 2; i < OFFICIAL_UNREAD_MAX; i++) await sendMessage(db, "w1", NA_UID, { text: `more ${i}` }, new Date(), bell, watch);
  await rejects(sendMessage(db, "w1", NA_UID, { text: "one too many" }, new Date(), bell, watch), 429, /hasn't read/);
  // Nobody sends a system message *to* the official account, and a member who blocked it doesn't get it.
  await rejects(sendSystemMessage(db, "team", NA_UID, "Hi", new Date(), async () => {}, alerts), 404, /wasn't found/);
  await db.doc(`dmBlocks/oc_${NA_UID}`).set({ blocker: "oc", blocked: NA_UID });
  await rejects(sendOfficialMessage(db, "oc", "Hi", { alerts }), 403, /blocked/);
  await db.doc(`dmBlocks/oc_${NA_UID}`).delete();
  // A member who blocked it can't reply either (their own block).
  await db.doc(`dmBlocks/w1_${NA_UID}`).set({ blocker: "w1", blocked: NA_UID });
  await db.doc(`conversations/${naCid}`).update({ [`unread.${NA_UID}`]: 0 });
  await rejects(sendMessage(db, "w1", NA_UID, { text: "x" }, new Date(), bell, watch), 403, /blocked this member/);
  await db.doc(`dmBlocks/w1_${NA_UID}`).delete();
  await db.doc(`conversations/${naCid}`).update({ [`unread.${NA_UID}`]: OFFICIAL_UNREAD_MAX });

  // ---- Admin → #NotesApp inbox (lib/official-inbox-server.ts).
  await db.doc("users/w2").set({ username: "winner2", displayName: "Winner Two" });
  await db.doc("users/staff1").set({ username: "carla", displayName: "Carla (Customer care)" });
  const t0 = Date.now();
  await sendOfficialMessage(db, "w2", "You placed 2nd!", { alerts, now: new Date(t0 + 60_000) });
  const inbox = await officialInbox(db);
  assert.deepEqual(inbox.rows.map((r) => r.memberUid), ["w2", "w1"], "newest first");
  const r1 = inbox.rows.find((r) => r.memberUid === "w1")!;
  assert.equal(r1.unread, OFFICIAL_UNREAD_MAX); assert.equal(r1.member.username, "winner1"); assert.equal(r1.member.displayName, "Winner One");
  assert.equal(r1.lastFromMember, true); assert.match(r1.lastText, /more/);
  const r2 = inbox.rows.find((r) => r.memberUid === "w2")!;
  assert.equal(r2.unread, 0); assert.equal(r2.lastFromMember, false);
  assert.equal(inbox.unread, OFFICIAL_UNREAD_MAX);
  assert.ok(!inbox.rows.some((r) => r.memberUid === "team"), "only the official account's conversations");

  // Opening a thread reads every message and marks it read for the team (the member sees the double tick).
  const th = await officialThread(db, naCid);
  assert.equal(th.memberUid, "w1"); assert.equal(th.member.username, "winner1");
  assert.equal(th.messages.length, 1 + OFFICIAL_UNREAD_MAX);
  assert.equal(th.messages[0].fromOfficial, true); assert.equal(th.messages[1].text, "Thanks! My name is Winner One.");
  assert.equal(th.messages[0].sentByAdmin, undefined, "the tournament message wasn't written by a person");
  assert.equal((await db.doc(`conversations/${naCid}`).get()).data()!.unread[NA_UID], 0);
  assert.ok((await db.doc(`conversations/${naCid}/messages/${th.messages[1].id}`).get()).data()!.readAt, "read receipt");
  assert.equal((await officialInbox(db)).unread, 0);

  // Answering as @na-notesapp: the member gets it from NA_UID, with the usual bell; the team member is stamped server-side only.
  bells.length = 0;
  const ans = await replyAsOfficial(db, "staff1", naCid, "Got it, thank you! Your prize is on its way.", { notify: bell, alerts });
  const ansMsg = (await db.doc(`conversations/${naCid}/messages/${ans.messageId}`).get()).data()!;
  assert.equal(ansMsg.from, NA_UID); assert.equal(ansMsg.sentByAdmin, undefined, "never on the message members read");
  assert.equal((await db.doc(`officialReplies/${ans.messageId}`).get()).data()!.sentByAdmin, "staff1");
  assert.deepEqual(bells, ["w1"]);
  assert.equal((await db.doc(`conversations/${naCid}`).get()).data()!.unread.w1, 1);
  const th2 = await officialThread(db, naCid);
  assert.deepEqual(th2.messages.at(-1)!.sentByAdmin, { uid: "staff1", name: "Carla (Customer care)" });
  // The member's own view of the thread has no trace of who answered.
  assert.ok(!JSON.stringify(await getThread(db, "w1", naCid)).includes("staff1"));
  // The member can reply again now the team has read it.
  await sendMessage(db, "w1", NA_UID, { text: "Thank you!" }, new Date(), bell, watch);
  assert.equal((await officialInbox(db)).unread, 1);
  await markOfficialRead(db, naCid);
  assert.equal((await officialInbox(db)).unread, 0);
  // Only the official account's conversations, and only in words.
  await rejects(officialThread(db, conversationId("team", "ob")), 404, /isn't in #NotesApp's inbox/);
  await rejects(replyAsOfficial(db, "staff1", conversationId("team", "ob"), "Hi"), 404, /isn't in #NotesApp's inbox/);
  await rejects(replyAsOfficial(db, "staff1", "../users/x", "Hi"), 400, /Which conversation/);
  await rejects(replyAsOfficial(db, "staff1", naCid, "  ", { alerts }), 400, /Write a message/);
  await rejects(replyAsOfficial(db, "", naCid, "Hi", { alerts }), 403, /Sign in/);
  await db.doc("users/w2").update({ suspended: true });
  await rejects(replyAsOfficial(db, "staff1", conversationId(NA_UID, "w2"), "Hi", { alerts }), 404, /wasn't found/);

  console.log("OFFICIAL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
