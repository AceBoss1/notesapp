// Kids mode server (lib/kids-server.ts) against the Firestore and Auth emulators. Run: npm run test:kids-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { addKid, enterKid, exitKid, kidMe, lifeGate, listKids, removeKid, sendKidReports, updateKid } from "../../lib/kids-server";
import { richList } from "../../lib/life/server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const auth = getAuth();
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));

(async () => {
  await auth.createUser({ uid: "u_mum", email: "mum@family.test", emailVerified: true });
  await auth.createUser({ uid: "u_other", email: "other@family.test", emailVerified: true });
  const mum = { uid: "u_mum", emailVerified: true };
  const base = { nickname: "Ada-Star", birthMonth: 3, birthYear: 2015, pin: "2580", consent: true, allow: { prep: true, academy: true, reading: false, life: true }, playMinutes: 15 };
  await rejects(addKid(db, { uid: "u_mum", emailVerified: false }, base), /Confirm your email/);
  const kid = await addKid(db, mum, base, new Date("2026-10-23T10:00:00Z"));
  const kuid = `kid_${kid.id}`;
  assert.equal((await auth.getUser(kuid)).customClaims?.kid, true);
  const pub = (await db.doc(`users/${kuid}`).get()).data()!;
  assert.deepEqual([pub.displayName, pub.kid, pub.teen, "parentUid" in pub, "username" in pub], ["Ada-Star", true, true, false, false], "nothing about the parent on the public doc");
  assert.equal((await listKids(db, "u_mum")).length, 1); assert.equal((await listKids(db, "u_other")).length, 0);
  await rejects(addKid(db, { uid: kuid, emailVerified: true }, base), /parent's account/);

  // Opening: only the parent who owns it; leaving: the PIN, five tries then a wait
  await rejects(enterKid(db, "u_other", kid.id), /wasn't found/);
  assert.ok((await enterKid(db, "u_mum", kid.id)).token.length > 20);
  await rejects(exitKid(db, kuid, "1111"), /isn't right/);
  const back = await exitKid(db, kuid, "2580");
  assert.ok(back.token.length > 20, "a sign-in for the parent");
  for (let i = 0; i < 4; i++) await rejects(exitKid(db, kuid, "0000"), /isn't right/);
  await rejects(exitKid(db, kuid, "0000"), /Wait 15 minutes/);
  await rejects(exitKid(db, kuid, "2580"), /Too many wrong PINs/, );
  await updateKid(db, "u_mum", kid.id, { pin: "3691" }); // the parent resets it, which also lifts the wait
  assert.ok((await exitKid(db, kuid, "3691")).token);

  // Notes Life: only if switched on, within the day's play time; a child is on nobody's list and sees only residents and themselves
  const t0 = Date.parse("2026-10-23T09:00:00Z");
  await lifeGate(db, kuid, t0);
  for (let m = 2; m <= 14; m += 2) await lifeGate(db, kuid, t0 + m * 60_000);
  await lifeGate(db, kuid, t0 + 14.5 * 60_000);
  await rejects(lifeGate(db, kuid, t0 + 16 * 60_000), /today's play time/);
  assert.equal((await kidMe(db, kuid, new Date(t0 + 16 * 60_000))).playLeftMs, 0);
  await updateKid(db, "u_mum", kid.id, { allow: { ...base.allow, life: false } });
  await rejects(lifeGate(db, kuid, t0 + 20 * 60_000), /isn't switched on/);
  await db.doc(`lifePlayers/${kuid}`).set({ uid: kuid, name: "Ada-Star", netWorth: 999_999_999_999, naira: 0, owned: [] });
  await db.doc("lifePlayers/u_other").set({ uid: "u_other", name: "Other Grown-up", username: "other", netWorth: 5_000_000, naira: 0, owned: [] });
  const grownUp = await richList(db, "u_other", 20, true);
  assert.equal(grownUp.rows.some((r) => r.uid === kuid), false, "never on a grown-up's list");
  const kids = await richList(db, kuid, 20, false, true);
  assert.equal(kids.rows.some((r) => r.uid === "u_other"), false, "no real players for a child");
  assert.ok(kids.rows.some((r) => r.uid === kuid) && kids.rows.some((r) => r.npc), "themselves and the residents");

  // The weekly email to the parent, Sunday from 5 pm, once
  await db.doc(`prepProgress/${kuid}`).set({ v: 1, byQuestion: { q1: { c: "A", ok: true, at: "2026-10-22T10:00:00Z", n: 1, t: "jamb/maths/Indices" }, q2: { c: "B", ok: false, at: "2026-10-23T10:00:00Z", n: 1, t: "jamb/maths/Indices" } }, mocks: [], days: [], updatedAt: "" });
  const mails: { to: string; text: string }[] = [];
  const send = async (m: { to: string; subject: string; text: string }) => { mails.push(m); return true; };
  assert.equal(await sendKidReports(db, new Date("2026-10-25T15:00:00Z"), send), 0, "Sunday 4 pm Lagos: not yet");
  assert.equal(await sendKidReports(db, new Date("2026-10-25T16:30:00Z"), send), 1);
  assert.equal(await sendKidReports(db, new Date("2026-10-25T19:00:00Z"), send), 0, "once");
  assert.equal(mails[0].to, "mum@family.test"); assert.match(mails[0].text, /Ada-Star answered 2 questions this week and got 1 right/);

  // Deleting the profile deletes everything in it
  await removeKid(db, "u_mum", kid.id);
  assert.equal((await db.doc(`users/${kuid}`).get()).exists, false); assert.equal((await db.doc(`prepProgress/${kuid}`).get()).exists, false);
  assert.equal((await db.doc(`lifePlayers/${kuid}`).get()).exists, false);
  await rejects(auth.getUser(kuid), /no user record|not found/i);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
