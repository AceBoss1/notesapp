// Reactions and the inbox's Bookings / Orders lookup (lib/message-edits.ts, lib/messages-server.ts) against the Firestore emulator.
// Part of npm run test:messages → "REACTIONS OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { changeMessage, hideMessages, reactToMessage } from "../../lib/message-edits";
import { chatContexts, getPrefs, setPrefs } from "../../lib/messages-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const quiet = async () => {};
(async () => {
  const bells: { uid: string; message: string }[] = [];
  const notify = async (n: { uid?: string | null; message: string }) => { bells.push({ uid: String(n.uid), message: n.message }); };
  for (const u of ["ra", "rb", "rc"]) await db.doc(`users/${u}`).set({ username: u, displayName: u.toUpperCase() });
  await db.doc("conversations/ra_rb").set({ participants: ["ra", "rb"], createdAt: "2026-10-17T09:00:00Z" });
  const msg = (id: string, data: object) => db.doc(`conversations/ra_rb/messages/${id}`).set(data);
  await msg("r1", { from: "ra", text: "Lunch at 1?", createdAt: "2026-10-17T09:01:00Z" });
  await msg("r2", { from: "rb", text: "", call: { kind: "audio", outcome: "missed", seconds: 0 }, createdAt: "2026-10-17T09:02:00Z" });
  const reactions = async (id: string) => (await db.doc(`conversations/ra_rb/messages/${id}`).get()).data()!.reactions ?? {};

  // one each; another replaces it; "" takes it off; the sender gets one bell
  assert.deepEqual(await reactToMessage(db, "rb", "ra_rb", "r1", "👍", notify), { reaction: "👍" });
  assert.deepEqual(await reactions("r1"), { rb: "👍" });
  assert.equal(bells.length, 1); assert.equal(bells[0].uid, "ra"); assert.match(bells[0].message, /RB reacted 👍 to your message: “Lunch at 1\?”/);
  await reactToMessage(db, "rb", "ra_rb", "r1", "❤️", notify);
  await reactToMessage(db, "ra", "ra_rb", "r1", "😂", notify);
  assert.deepEqual(await reactions("r1"), { rb: "❤️", ra: "😂" });
  assert.equal(bells.length, 2, "no bell for reacting to your own message");
  await reactToMessage(db, "rb", "ra_rb", "r1", "❤️", notify);
  assert.equal(bells.length, 2, "the same reaction again changes nothing");
  await reactToMessage(db, "rb", "ra_rb", "r1", "", notify);
  assert.deepEqual(await reactions("r1"), { ra: "😂" });

  // any emoji, and ours (the bell names ours in words)
  await reactToMessage(db, "rb", "ra_rb", "r1", "🔥", notify);
  await reactToMessage(db, "rb", "ra_rb", "r1", ":na:", notify);
  assert.deepEqual(await reactions("r1"), { rb: ":na:", ra: "😂" });
  assert.match(bells.at(-1)!.message, /RB reacted #NotesApp to your message/);
  await reactToMessage(db, "rb", "ra_rb", "r1", "", notify);
  bells.length = 2;

  // one emoji only, only members, not on call lines, not when blocked, not when muted (no bell)
  await assert.rejects(reactToMessage(db, "rb", "ra_rb", "r1", "hi", notify), /one emoji/);
  await assert.rejects(reactToMessage(db, "rb", "ra_rb", "r1", "🔥🔥", notify), /one emoji/);
  await assert.rejects(reactToMessage(db, "rc", "ra_rb", "r1", "👍", notify), /wasn't found/);
  await assert.rejects(reactToMessage(db, "ra", "ra_rb", "r2", "👍", notify), /wasn't found/);
  await assert.rejects(reactToMessage(db, "ra", "ra_rb", "../x", "👍", notify), /Choose a message/);
  await db.doc("convMutes/ra_ra_rb").set({ uid: "ra", cid: "ra_rb" });
  await reactToMessage(db, "rb", "ra_rb", "r1", "🙏", notify);
  assert.equal(bells.length, 2, "muted: no bell");
  await db.doc("dmBlocks/ra_rb").set({ blocker: "ra", blocked: "rb" });
  await assert.rejects(reactToMessage(db, "rb", "ra_rb", "r1", "👍", notify), /can't react/);
  await db.doc("dmBlocks/ra_rb").delete();

  // deleting for yourself: anyone's message, members only, kept per member and per chat
  assert.deepEqual(await hideMessages(db, "rb", "ra_rb", ["r1", "r2", "r1"]), { hidden: 2 });
  await hideMessages(db, "rb", "ra_rb", ["r2"]);
  assert.deepEqual((await db.doc("chatHidden/rb/chats/ra_rb").get()).data()!.ids, ["r1", "r2"]);
  assert.equal((await db.doc("chatHidden/ra/chats/ra_rb").get()).exists, false, "the other person still sees them");
  assert.ok((await db.doc("conversations/ra_rb/messages/r1").get()).data()!.text, "the message itself is untouched");
  await assert.rejects(hideMessages(db, "rc", "ra_rb", ["r1"]), /wasn't found/);
  await assert.rejects(hideMessages(db, "rb", "ra_rb", []), /Choose/);
  await assert.rejects(hideMessages(db, "rb", "ra_rb", Array.from({ length: 101 }, (_, i) => `m${i}`)), /up to 100/);

  // your quick reactions: saved on your account; a wrong set is refused; null puts the default back
  await setPrefs(db, "ra", { quickReactions: ["🔥", "❤️", "😂", "😮", "😢", "🙏", ":academy:"] });
  assert.deepEqual((await getPrefs(db, "ra")).quickReactions, ["🔥", "❤️", "😂", "😮", "😢", "🙏", ":academy:"]);
  await assert.rejects(setPrefs(db, "ra", { quickReactions: ["🔥", "🔥"] }), /different emojis/);
  await setPrefs(db, "ra", { quickReactions: null });
  assert.equal((await getPrefs(db, "ra")).quickReactions, null);
  assert.equal((await getPrefs(db, "rb")).quickReactions, null, "nothing saved: the default");

  // deleting a message takes its reactions with it
  await changeMessage(db, "ra", "ra_rb", "r1", "delete", null, quiet, new Date(), quiet);
  const gone = (await db.doc("conversations/ra_rb/messages/r1").get()).data()!;
  assert.ok(gone.deleted); assert.equal(gone.reactions, undefined);

  // Bookings and Orders: the other person in each, either side
  await db.collection("bookings").add({ publisherUid: "ra", clientUid: "rb" });
  await db.collection("bookings").add({ publisherUid: "rc", clientUid: "ra" });
  await db.collection("storeOrders").add({ sellerUid: "rb", buyerUid: "ra" });
  const ctx = await chatContexts(db, "ra");
  assert.deepEqual(ctx.bookings.sort(), ["rb", "rc"]); assert.deepEqual(ctx.orders, ["rb"]);
  assert.deepEqual(await chatContexts(db, "nobody"), { bookings: [], orders: [] });

  console.log("REACTIONS OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
