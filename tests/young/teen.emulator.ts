// Teen protections on NotesApp (comments, moments) against the Firestore emulator. Run: npm run test:young-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { postComment } from "../../lib/comments-server";
import { listFeed, listForOwner, setMomentPrefs } from "../../lib/moments-server";

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
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
