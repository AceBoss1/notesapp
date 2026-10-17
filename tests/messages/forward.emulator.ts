// Forwarding, keeping, #NotesApp link cards and Nana's chat tasks (lib/message-forward.ts, lib/chat-cards-server.ts, lib/nana-assist.ts)
// against the Firestore emulator. Part of npm run test:messages → "FORWARD OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { forwardMessage, keepMessage, type ForwardDeps } from "../../lib/message-forward";
import { changeMessage } from "../../lib/message-edits";
import { wipeMessage } from "../../lib/groups-server";
import { cardFor } from "../../lib/chat-cards-server";
import { NanaError } from "../../lib/nana";
import { assist } from "../../lib/nana-assist";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const quiet = async () => {};
(async () => {
  for (const u of ["fa", "fb", "fc", "fd"]) await db.doc(`users/${u}`).set({ username: u, displayName: u.toUpperCase(), accountTier: "pro" });
  await db.doc("conversations/fa_fb").set({ participants: ["fa", "fb"], createdAt: "2026-10-17T09:00:00Z" });
  await db.doc("conversations/fa_fc").set({ participants: ["fa", "fc"], createdAt: "2026-10-17T09:00:00Z" });
  await db.doc("conversations/g_team").set({ kind: "group", title: "Team", participants: ["fa", "fc", "fd"], adminUids: ["fa"], createdAt: "2026-10-17T09:00:00Z" });
  await db.doc("conversations/fc_fd").set({ participants: ["fc", "fd"], createdAt: "2026-10-17T09:00:00Z" });
  const msg = (cid: string, id: string, data: object) => db.doc(`conversations/${cid}/messages/${id}`).set(data);
  await msg("fa_fb", "f1", { from: "fb", text: "The **launch** is on Friday", createdAt: "2026-10-17T09:01:00Z" });
  await msg("fa_fb", "f2", { from: "fb", text: "", attachments: [{ key: "messages/fb/x-plan.pdf", name: "plan.pdf", size: 1000, type: "application/pdf", kind: "document" }], createdAt: "2026-10-17T09:02:00Z" });
  await msg("fa_fb", "f3", { from: "fb", text: "", call: { kind: "audio", outcome: "missed", seconds: 0 }, createdAt: "2026-10-17T09:03:00Z" });

  // forward to a one-to-one chat and a group: marked, with the same words
  const r = await forwardMessage(db, "fa", "fa_fb", "f1", ["fa_fc", "g_team"], undefined, new Date("2026-10-17T10:00:00Z"), quiet);
  assert.deepEqual(r, { sent: ["fa_fc", "g_team"], failed: [] });
  for (const cid of ["fa_fc", "g_team"]) {
    const m = (await db.collection(`conversations/${cid}/messages`).get()).docs.map((d) => d.data());
    assert.equal(m.length, 1); assert.equal(m[0].text, "The **launch** is on Friday"); assert.equal(m[0].forwarded, true); assert.equal(m[0].from, "fa");
  }
  // not to chats you aren't in; not from chats you aren't in; not call lines; five at most; at least one
  const bad = await forwardMessage(db, "fa", "fa_fb", "f1", ["fc_fd"], undefined, new Date(), quiet);
  assert.deepEqual(bad.sent, []); assert.match(bad.failed[0].error, /wasn't found/);
  await assert.rejects(forwardMessage(db, "fc", "fa_fb", "f1", ["fa_fc"], undefined, new Date(), quiet), /wasn't found/);
  await assert.rejects(forwardMessage(db, "fa", "fa_fb", "f3", ["fa_fc"], undefined, new Date(), quiet), /wasn't found/);
  await assert.rejects(forwardMessage(db, "fa", "fa_fb", "f1", ["a", "b", "c", "d", "e", "f"], undefined, new Date(), quiet), /up to 5/);
  await assert.rejects(forwardMessage(db, "fa", "fa_fb", "f1", [], undefined, new Date(), quiet), /Choose who/);
  // a blocked person can't be reached by forwarding either
  await db.doc("dmBlocks/fc_fa").set({ blocker: "fc", blocked: "fa" });
  const blocked = await forwardMessage(db, "fa", "fa_fb", "f1", ["fa_fc"], undefined, new Date(), quiet);
  assert.deepEqual(blocked.sent, []); await db.doc("dmBlocks/fc_fa").delete();

  // files: each forward gets its own copy, sent as the forwarder's upload
  await assert.rejects(forwardMessage(db, "fa", "fa_fb", "f2", ["fa_fc"], undefined, new Date(), quiet), /can't be forwarded/);
  const copies: [string, string][] = [];
  const files: ForwardDeps = { copy: async (a, b) => { copies.push([a, b]); }, head: async () => ({ size: 1000 }) };
  const rf = await forwardMessage(db, "fa", "fa_fb", "f2", ["fa_fc", "g_team"], files, new Date("2026-10-17T10:05:00Z"), quiet);
  assert.equal(rf.sent.length, 2); assert.equal(copies.length, 2);
  assert.ok(copies.every(([from, to]) => from === "messages/fb/x-plan.pdf" && to.startsWith("messages/fa/") && to.endsWith("-plan.pdf")));
  assert.notEqual(copies[0][1], copies[1][1], "a separate copy for each chat");
  const sentFile = (await db.collection("conversations/fa_fc/messages").where("forwarded", "==", true).get()).docs.map((d) => d.data()).find((m) => m.attachments);
  assert.equal(sentFile!.attachments[0].name, "plan.pdf"); assert.notEqual(sentFile!.attachments[0].key, "messages/fb/x-plan.pdf");

  // keep: your own copy; let go; deleting or removing the message removes every kept copy
  assert.deepEqual(await keepMessage(db, "fa", "fa_fb", "f1", true, new Date("2026-10-17T11:00:00Z")), { kept: true });
  const k = (await db.doc("keptMessages/fa_f1").get()).data()!;
  assert.equal(k.text, "The launch is on Friday"); assert.equal(k.fromName, "FB"); assert.equal(k.chatTitle, "FB"); assert.equal(k.cid, "fa_fb");
  await keepMessage(db, "fb", "fa_fb", "f1", true);
  await keepMessage(db, "fa", "fa_fb", "f2", true);
  assert.deepEqual((await db.doc("keptMessages/fa_f2").get()).data()!.files, ["plan.pdf"]);
  await assert.rejects(keepMessage(db, "fc", "fa_fb", "f1", true), /wasn't found/);
  await keepMessage(db, "fa", "fa_fb", "f2", false);
  assert.equal((await db.doc("keptMessages/fa_f2").get()).exists, false);
  await changeMessage(db, "fb", "fa_fb", "f1", "delete", null, quiet, new Date(), quiet);
  assert.equal((await db.collection("keptMessages").where("messageId", "==", "f1").get()).size, 0, "deleted: kept copies gone");
  const gmsg = (await db.collection("conversations/g_team/messages").limit(1).get()).docs[0];
  await keepMessage(db, "fd", "g_team", gmsg.id, true);
  assert.equal((await db.doc(`keptMessages/fd_${gmsg.id}`).get()).data()!.chatTitle, "Team");
  await wipeMessage(db, "g_team", gmsg.id, "admin");
  assert.equal((await db.doc(`keptMessages/fd_${gmsg.id}`).get()).exists, false, "removed by an admin: kept copies gone");

  // link cards: only public things
  await db.collection("notes").add({ slug: "pay-gap", status: "published", title: "Minding the pay gap", author: "Chimdinma", featured_image: "/p.jpg" });
  await db.collection("notes").add({ slug: "secret", status: "draft", title: "Draft" });
  await db.doc("storeItems/it1").set({ title: "Solar lamp", price: "₦12,000", image: "/l.jpg", sellable: true });
  await db.doc("storeItems/it2").set({ title: "Hidden", sellable: false });
  await db.doc("courseSlugs/excel").set({ courseId: "c1" });
  await db.doc("courses/c1").set({ title: "Excel", status: "published", lessonCount: 3, ownerName: "Tola", cover: "" });
  await db.doc("usernames/fb").set({ uid: "fb" });
  assert.equal((await cardFor(db, { kind: "journal", id: "pay-gap" }))!.cta, "Read");
  assert.equal(await cardFor(db, { kind: "journal", id: "secret" }), null);
  assert.equal((await cardFor(db, { kind: "item", id: "it1" }))!.subtitle, "₦12,000");
  assert.equal(await cardFor(db, { kind: "item", id: "it2" }), null);
  assert.equal((await cardFor(db, { kind: "course", id: "excel" }))!.subtitle, "Free course · 3 lessons · Tola");
  assert.equal((await cardFor(db, { kind: "profile", id: "fb" }))!.title, "FB");
  await db.doc("users/fb").set({ suspended: true }, { merge: true });
  assert.equal(await cardFor(db, { kind: "profile", id: "fb" }), null);

  // Nana's chat tasks check what they're given before any AI account is used
  const why = async (input: Record<string, unknown>) => { try { await assist(db, "fa", input); return "ok"; } catch (e) { return e instanceof NanaError ? e.message : `other: ${e}`; } };
  assert.match(await why({ task: "translate", surface: "chat", text: "Hello" }), /Choose a language/);
  assert.match(await why({ task: "translate", surface: "chat", text: "Hello", language: "fr" }), /Choose a language/);
  assert.match(await why({ task: "translate", surface: "chat", text: "", language: "yo" }), /no text/);
  assert.match(await why({ task: "summarise", surface: "chat", context: "  " }), /nothing new to summarise/);
  assert.match(await why({ task: "summarise", surface: "draft", context: "Ada: hi" }), /isn't available here/);

  console.log("FORWARD OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
