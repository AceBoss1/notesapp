// Notes Life on NotesApp, server side (lib/life/social-server.ts), against the Firestore emulator. npm run test:life-social-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { feedCard, playsNotesLife, setLifePrivacy } from "../../lib/life/social-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
(async () => {
  const person = (uid: string, username: string, extra: object = {}) => db.doc(`users/${uid}`).set({ uid, username, displayName: username[0].toUpperCase() + username.slice(1), avatar: "", ...extra });
  const follow = (fromUid: string, toUsername: string) => db.doc(`follows/${fromUid}_${toUsername}`).set({ followerUid: fromUid, username: toUsername, followedAt: new Date().toISOString() });
  await person("u_me", "meme"); await person("u_amaka", "amaka"); await person("u_tola", "tola"); await person("u_kid", "kiddo", { teen: true }); await person("u_shy", "shy", { lifeShow: false });
  for (const u of ["u_amaka", "u_tola", "u_kid", "u_shy"]) await db.doc(`lifePlayers/${u}`).set({ netWorth: 1 });
  // I follow all four; amaka, kid and shy follow me back; tola doesn't
  for (const n of ["amaka", "tola", "kiddo", "shy"]) await follow("u_me", n);
  for (const u of ["u_amaka", "u_kid", "u_shy"]) await follow(u, "meme");

  assert.deepEqual(await playsNotesLife(db, "u_me", "u_amaka"), { plays: true, username: "amaka" });
  assert.equal((await playsNotesLife(db, "u_me", "u_tola")).plays, false, "tola doesn't follow back");
  assert.equal((await playsNotesLife(db, "u_me", "u_kid")).plays, false, "never about a teen");
  assert.equal((await playsNotesLife(db, "u_me", "u_shy")).plays, false, "shy's switch is off");
  assert.equal((await playsNotesLife(db, null, "u_amaka")).plays, false, "signed out");
  assert.equal((await playsNotesLife(db, "u_kid", "u_amaka")).plays, false, "not shown to a teen");

  const card = await feedCard(db, "u_me");
  assert.equal(card.show, true); assert.equal(card.playing, false);
  assert.deepEqual([card.friends.count, card.friends.sample[0].name], [1, "Amaka"], "only amaka: mutual, playing, switch on, not a teen");
  assert.equal((await feedCard(db, null)).friends.count, 0, "signed out: the card, no friends line");
  assert.equal((await feedCard(db, "u_kid")).show, false, "no card in teen mode");
  await setLifePrivacy(db, "u_me", { lifeCard: false });
  assert.equal((await feedCard(db, "u_me")).show, false, "switched off");
  assert.equal((await setLifePrivacy(db, "u_kid", { lifeShow: true })).lifeShow, false, "teen mode keeps it off");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
