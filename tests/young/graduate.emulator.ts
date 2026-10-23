// Turning 18 (lib/young-server.ts) against the Firestore emulator. Run: npm run test:young-server (with teen.emulator.ts) → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { birthdayBells, exportMine, graduate, graduationStatus } from "../../lib/young-server";
import { postComment } from "../../lib/comments-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: Error) => re.test(e.message));

(async () => {
  await db.doc("users/u_kemi").set({ uid: "u_kemi", username: "kemi", displayName: "Kemi Ade", teen: true });
  await db.doc("prepTeens/u_kemi").set({ uid: "u_kemi", parentEmail: "mum@family.test", birth: "2008-11", askedAt: "x", confirmedAt: "y" });
  await db.doc("prepBoard/u_kemi").set({ joined: true, nickname: "StarMath" });
  await db.doc("prepAttempts/u_kemi_2026-10-20").set({ ids: ["q1"], day: "2026-10-20" });
  await db.doc("users/u_stranger").set({ uid: "u_stranger", username: "stranger", displayName: "Stranger" });

  assert.equal((await graduationStatus(db, "u_kemi", new Date("2026-10-31T12:00:00Z"))).due, false, "17 until November");
  await rejects(graduate(db, "u_kemi", { consent: true }, new Date("2026-10-31T12:00:00Z")), /18th birthday/);
  const bells: string[] = [];
  const notify = async (n: { uid: string; message: string }) => { bells.push(`${n.uid}:${n.message}`); };
  assert.equal(await birthdayBells(db, new Date("2026-10-31T12:00:00Z"), notify), 0);
  assert.equal(await birthdayBells(db, new Date("2026-11-01T08:00:00Z"), notify), 1);
  assert.equal(await birthdayBells(db, new Date("2026-11-02T08:00:00Z"), notify), 0, "once");
  const nov = new Date("2026-11-01T12:00:00Z");
  assert.equal((await graduationStatus(db, "u_kemi", nov)).due, true);
  assert.equal((await exportMine(db, "u_kemi")).teenMode?.parentEmail, "mum@family.test", "their data, to keep");
  await rejects(graduate(db, "u_kemi", { search: true }, nov), /Terms and Privacy/);

  const mails: { to: string; subject: string }[] = [];
  await graduate(db, "u_kemi", { consent: true, search: true, realName: true, deleteChildhood: true }, nov, async (m) => { mails.push(m); return true; });
  const u = (await db.doc("users/u_kemi").get()).data()!;
  assert.deepEqual([u.teen, u.keepHidden, u.keepDmFollowers, u.keepRepliesFollowers, u.consent.own], [false, false, true, true, true]);
  assert.equal((await db.doc("prepTeens/u_kemi").get()).exists, false, "the parent's email and the birth month are gone");
  assert.equal(mails[0].to, "mum@family.test"); assert.match(mails[0].subject, /now their own/);
  assert.equal((await db.doc("emailPrefs/u_kemi").get()).data()?.weeklyDigest, false, "offers left off");
  assert.equal((await db.doc("prepBoard/u_kemi").get()).data()?.realName, true);
  assert.equal((await db.doc("prepAttempts/u_kemi_2026-10-20").get()).exists, false, "the day-by-day log, deleted on request");
  assert.equal((await graduationStatus(db, "u_kemi", nov)).due, false, "once");
  // Replies left to people they follow stay that way after 18
  await db.doc("notes/n9").set({ status: "published", title: "First adult post", slug: "first", authorUid: "u_kemi" });
  await db.doc("usernames/kemi").set({ uid: "u_kemi" });
  await rejects(postComment(db, "u_stranger", { noteId: "n9", content: "hi" }, false), /Only people Kemi Ade follows/);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
