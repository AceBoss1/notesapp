// @mention bells (lib/mentions-server.ts) against the Firestore emulator. Run: npm run test:mentions → prints "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mentionedUsernames, notifyMentions, snippetAround, flatten } from "../../lib/mentions-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).where("type", "==", "mention").get()).docs.map((d) => d.data());

(async () => {
  // reading mentions
  assert.deepEqual(mentionedUsernames("Thanks @Ada and @chef_adams, and @ada again. Mail ada@gmail.com"), ["ada", "chef_adams"]);
  assert.deepEqual(mentionedUsernames("See `@notme` and [@ada](/u/ada) **@bola**", true), ["ada", "bola"]);
  assert.equal(flatten("<p>Hi <b>@chef_adams</b></p>"), "Hi @chef_adams");
  assert.ok(snippetAround("x".repeat(200) + " hello @ada how are you " + "y".repeat(200), "ada").includes("@ada"));

  // people
  const people = [["author", "writer"], ["u_ada", "ada"], ["u_bola", "bola"], ["u_cee", "cee"], ["u_dee", "dee"]];
  for (const [uid, username] of people) {
    await db.doc(`usernames/${username}`).set({ uid });
    await db.doc(`users/${uid}`).set({ username, displayName: username.toUpperCase(), ...(uid === "u_dee" ? { suspended: true } : {}) });
  }
  await db.doc("dmBlocks/u_cee_author").set({ blocker: "u_cee", blocked: "author" }); // cee blocked the author

  const src = { kind: "comment" as const, sourceId: "n1_c1", where: "in a comment on “Pay gap”", linkHref: "/journals/pay-gap#comments", author: { uid: "author", name: "Writer", username: "writer" } };
  const r1 = await notifyMentions(db, { ...src, text: "Hi @ada @bola @cee @dee @writer @nobody @na-notesapp" });
  assert.equal(r1.sent, 2, "ada and bola only: cee blocked the author, dee is suspended, self and unknown skipped");
  const a = await bells("u_ada");
  assert.equal(a.length, 1); assert.match(a[0].message, /^Writer mentioned you in a comment on “Pay gap”: “Hi @ada/); assert.equal(a[0].linkHref, "/journals/pay-gap#comments");
  assert.equal((await bells("u_cee")).length, 0); assert.equal((await bells("u_dee")).length, 0); assert.equal((await bells("author")).length, 0);

  // editing the same comment: only the newly mentioned
  await db.doc("usernames/eve").set({ uid: "u_eve" }); await db.doc("users/u_eve").set({ username: "eve", displayName: "Eve" });
  const r2 = await notifyMentions(db, { ...src, text: "Hi @ada @bola and now @eve" });
  assert.equal(r2.sent, 1); assert.equal((await bells("u_ada")).length, 1); assert.equal((await bells("u_eve")).length, 1);

  // people who get their own bell are skipped; a different comment notifies again
  const r3 = await notifyMentions(db, { ...src, sourceId: "n1_c2", text: "@ada @bola", skipUids: ["u_bola"] });
  assert.equal(r3.sent, 1); assert.equal((await bells("u_ada")).length, 2); assert.equal((await bells("u_bola")).length, 1);

  // at most 10 people per thing
  for (let i = 0; i < 12; i++) { await db.doc(`usernames/p${i}x`).set({ uid: `u_p${i}` }); await db.doc(`users/u_p${i}`).set({ username: `p${i}x` }); }
  const r4 = await notifyMentions(db, { ...src, sourceId: "n1_c3", text: Array.from({ length: 12 }, (_, i) => `@p${i}x`).join(" ") });
  assert.equal(r4.sent, 10);

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
