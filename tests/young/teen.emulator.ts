// Teen protections on NotesApp (comments, moments, Notes Life lists) against the Firestore emulator. Run: npm run test:young-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { postComment } from "../../lib/comments-server";
import { createMoment, listFeed, listForOwner, replyToMoment, reshare, setMomentPrefs } from "../../lib/moments-server";
import { notifyMentions } from "../../lib/mentions-server";
import { invites, richList } from "../../lib/life/server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const deps = { publicUrl: (k: string) => `https://cdn.test/${k}`, remove: async () => {} };
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));

(async () => {
  const person = (uid: string, username: string, extra: object = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username[0].toUpperCase() + username.slice(1), avatar: "", ...extra });
  const follow = (fromUid: string, toUsername: string) => db.doc(`follows/${fromUid}_${toUsername}`).set({ followerUid: fromUid, username: toUsername, followedAt: "x" });
  await person("u_tobi", "tobi", { teen: true }); await person("u_ada", "ada"); await person("u_stranger", "stranger"); await person("u_mod", "moddy");
  await db.doc("usernames/tobi").set({ uid: "u_tobi" });
  await follow("u_tobi", "ada"); await follow("u_ada", "tobi"); await follow("u_stranger", "tobi"); // tobi follows ada back, not the stranger

  // Replies on a teen's journal: only from people they follow (and moderators)
  await db.doc("notes/n1").set({ status: "published", title: "My JAMB maths plan", slug: "jamb-plan", authorUid: "u_tobi" });
  await postComment(db, "u_ada", { noteId: "n1", content: "Nice plan" }, false);
  await rejects(postComment(db, "u_stranger", { noteId: "n1", content: "hi" }, false), /Only people Tobi follows can reply/);
  await postComment(db, "u_mod", { noteId: "n1", content: "Moderator note" }, true);
  // ...and under a teen's comment on someone else's journal
  await db.doc("notes/n2").set({ status: "published", title: "Ada's post", slug: "ada-post", authorUid: "u_ada" });
  const { id: c } = await postComment(db, "u_tobi", { noteId: "n2", content: "Agreed" }, false);
  await postComment(db, "u_stranger", { noteId: "n2", content: "Top-level is fine" }, false);
  await rejects(postComment(db, "u_stranger", { noteId: "n2", content: "@tobi", parentCommentId: c }, false), /Only people Tobi follows/);

  // Moments: a teen's are for mutual follows only, and can't be made public
  const future = new Date(Date.now() + 86_400_000).toISOString();
  await db.doc("moments/m1").set({ ownerUid: "u_tobi", ownerUsername: "tobi", kind: "text", text: "Mock tomorrow", hours: 24, createdAt: new Date().toISOString(), expiresAt: future, likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: true });
  await rejects(setMomentPrefs(db, "u_tobi", true), /follow back/);
  await setMomentPrefs(db, "u_tobi", false);
  await db.doc("userPrefs/u_tobi").set({ momentsPublic: true }, { merge: true }); // even if it were on somehow
  assert.equal((await listForOwner(db, "u_ada", "tobi", deps)).length, 1);
  assert.equal((await listForOwner(db, "u_stranger", "tobi", deps)).length, 0, "follows tobi, but tobi doesn't follow back");
  assert.equal((await listForOwner(db, "u_mod", "tobi", deps)).length, 0, "public setting ignored for a teen");
  assert.equal((await listFeed(db, { uid: "u_ada", username: "ada" }, deps)).filter((g) => g.ownerUid === "u_tobi").length, 1);
  assert.equal((await listFeed(db, { uid: "u_stranger", username: "stranger" }, deps)).filter((g) => g.ownerUid === "u_tobi").length, 0);

  // Moments (v0.121.0): replies and @mentions only from people the teen follows; no reshares of a teen's moment
  await rejects(replyToMoment(db, "u_stranger", "m1", "hi"), /isn't available/);
  await rejects(createMoment(db, { uid: "u_stranger", username: "stranger" }, { kind: "text", text: "Good luck @tobi" }, deps), /@tobi only hears from people they follow/);
  await createMoment(db, { uid: "u_ada", username: "ada" }, { kind: "text", text: "Good luck @tobi" }, deps);
  await rejects(reshare(db, { uid: "u_ada", username: "ada" }, "m1", deps), /can't be reshared/);
  // A reshare made before the rule keeps to the teen's audience: the stranger follows ada but still doesn't see it
  await follow("u_stranger", "ada");
  await db.doc("moments/rs_u_ada_m1").set({ ownerUid: "u_ada", ownerUsername: "ada", kind: "text", text: "Mock tomorrow", hours: 24, createdAt: new Date().toISOString(), expiresAt: future, likeCount: 0, reshareCount: 0, viewCount: 0, ownsMedia: false, resharedFrom: { momentId: "m1", ownerUsername: "tobi", rootMomentId: "m1", rootOwnerUid: "u_tobi" } });
  assert.ok(!(await listForOwner(db, "u_stranger", "ada", deps)).some((m) => m.id === "rs_u_ada_m1"));
  assert.ok((await listForOwner(db, "u_stranger", "ada", deps)).length >= 1, "ada's own moments still show");
  assert.ok(!(await listFeed(db, { uid: "u_stranger", username: "stranger" }, deps)).flatMap((g) => g.moments).some((m) => m.id === "rs_u_ada_m1"));
  assert.ok((await listForOwner(db, "u_tobi", "ada", deps)).some((m) => m.id === "rs_u_ada_m1"), "the teen sees it");
  // Mention bells anywhere: none for a teen from someone they don't follow
  const bell = (uid: string, username: string, sourceId: string) => notifyMentions(db, { kind: "comment", sourceId, text: "@tobi look", author: { uid, name: username, username }, where: "in a comment", linkHref: "/" });
  assert.equal((await bell("u_stranger", "stranger", "c-s")).sent, 0);
  assert.equal((await bell("u_ada", "ada", "c-a")).sent, 1);

  // Notes Life: the Billionaires List and invite list keep a teen to people they follow back
  await person("u_kemi", "kemi", { teen: true }); await follow("u_kemi", "ada");
  const player = (uid: string, username: string, netWorth: number, referredBy: string | null) => db.doc(`lifePlayers/${uid}`).set({ username, name: username, avatar: "", netWorth, referredBy, startedAt: Date.now(), shifts: 0 });
  await player("u_tobi", "tobi", 900_000, "u_stranger"); await player("u_kemi", "kemi", 800_000, "u_ada");
  await player("u_ada", "ada", 700_000, null); await player("u_stranger", "stranger", 600_000, null);
  const realRows = async (uid: string) => (await richList(db, uid, 20, true)).rows.map((r) => r.uid);
  assert.deepEqual(await realRows("u_stranger"), ["u_ada", "u_stranger"], "no teens for a stranger");
  assert.deepEqual(await realRows("u_ada"), ["u_tobi", "u_ada", "u_stranger"], "tobi follows ada back; kemi doesn't");
  assert.deepEqual(await realRows("u_kemi"), ["u_kemi", "u_ada", "u_stranger"], "a teen sees themselves");
  const inv = (await invites(db, "u_stranger")).invites;
  assert.equal(inv.length, 1); assert.equal(inv[0].name, "A friend in teen mode"); assert.equal(inv[0].username, ""); assert.notEqual(inv[0].uid, "u_tobi");
  assert.equal((await invites(db, "u_ada")).invites[0].username, "kemi", "kemi follows ada");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
