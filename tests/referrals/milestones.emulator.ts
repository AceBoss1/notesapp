// Referral milestones on the emulator (lib/referral-milestones-server.ts): only real members count (verified email, a username, not a
// child, not suspended), a milestone is claimed once and pays its Bonus Credits into the wallet, and one not reached is refused.
// Run inside npm run test:referrals-server.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const M = await import("../../lib/referral-milestones-server");
  const { MILESTONES } = await import("../../lib/referral-milestones");
  const verifiedSet = new Set(["f1", "f2", "f3", "f4", "f5", "f6"]);
  const deps = { verified: async (uids: string[]) => new Set(uids.filter((u) => verifiedSet.has(u))) };
  const ME = { uid: "inv", emailVerified: true };
  await db.doc("users/inv").set({ username: "inviter" });
  const friend = async (id: string, extra: Record<string, unknown> = {}) => {
    await db.doc(`users/${id}`).set({ username: id, ...extra });
    await db.doc(`referrals/${id}`).set({ uid: id, referredBy: "inv", referredByUsername: "inviter", referredAt: new Date().toISOString() });
  };

  // Nobody yet: nothing reached, nothing to claim.
  let st = await M.myMilestones(db, "inv", deps);
  assert.equal(st.qualified, 0); assert.ok(st.milestones.every((m) => !m.reached));
  await assert.rejects(M.claimMilestone(db, ME, "first", { walletLive: true }, deps), /needs 1 friend/);

  // Only real members count.
  await friend("f1");
  await friend("f7"); // not verified
  await friend("f2", { username: "" }); // no username yet
  await friend("f3", { suspended: true });
  await friend("f4", { kid: true });
  st = await M.myMilestones(db, "inv", deps);
  assert.equal(st.qualified, 1, "only f1");
  assert.equal(st.milestones[0].reached, true); assert.equal(st.milestones[1].progress, 1);

  // Claim once: Bonus Credits in the wallet, with a line in its history.
  await assert.rejects(M.claimMilestone(db, ME, "first", { walletLive: false }, deps), /isn't open/);
  await assert.rejects(M.claimMilestone(db, { uid: "inv", emailVerified: false }, "first", { walletLive: true }, deps), /Verify/);
  await assert.rejects(M.claimMilestone(db, ME, "nope", { walletLive: true }, deps), /not found/);
  const r = await M.claimMilestone(db, ME, "first", { walletLive: true }, deps);
  assert.equal(r.bonusKobo, MILESTONES[0].bonusKobo);
  const w = (await db.doc("wallets/inv").get()).data()!;
  assert.equal(w.bonusLots.reduce((n: number, l: { kobo: number }) => n + l.kobo, 0), MILESTONES[0].bonusKobo);
  assert.equal((await db.doc("walletTx/refms_inv_first").get()).data()?.kind, "referral_milestone");
  await assert.rejects(M.claimMilestone(db, ME, "first", { walletLive: true }, deps), /already claimed/);
  st = await M.myMilestones(db, "inv", deps);
  assert.equal(st.milestones[0].claimed, true);

  // Squad: five real friends.
  await assert.rejects(M.claimMilestone(db, ME, "squad", { walletLive: true }, deps), /You have 1/);
  for (const id of ["f5", "f6"]) await friend(id);
  await db.doc("users/f2").update({ username: "f2" }); await db.doc("users/f3").update({ suspended: false });
  assert.equal(await M.qualifiedFriends(db, "inv", deps), 5);
  await M.claimMilestone(db, ME, "squad", { walletLive: true }, deps);
  const lots = (await db.doc("wallets/inv").get()).data()!.bonusLots as { kobo: number }[];
  assert.equal(lots.reduce((n, l) => n + l.kobo, 0), MILESTONES[0].bonusKobo + MILESTONES[1].bonusKobo);

  // Notes Life invites count too, each friend once: g1 joined Notes Life from the invite only; f1 joined both ways (counted once).
  verifiedSet.add("g1");
  await db.doc("users/g1").set({ username: "g1" });
  await db.doc("lifePlayers/g1").set({ referredBy: "inv" });
  await db.doc("lifePlayers/f1").set({ referredBy: "inv" });
  assert.equal(await M.qualifiedFriends(db, "inv", deps), 6, "five NotesApp friends plus one Notes Life friend; f1 once");

  // Admin → Limits: change a milestone, refuse a bad order, reset to the defaults.
  await assert.rejects(M.saveMilestoneSettings(db, { first: { need: 1, bonusNaira: 200 }, squad: { need: 1, bonusNaira: 1 }, crowd: { need: 25, bonusNaira: 1 }, viral: { need: 100, bonusNaira: 1 } }, "admin"), /more friends/);
  const saved = await M.saveMilestoneSettings(db, { first: { need: 1, bonusNaira: 200 }, squad: { need: 5, bonusNaira: 1100 }, crowd: { need: 6, bonusNaira: 700 }, viral: { need: 100, bonusNaira: 25000 } }, "admin");
  assert.equal(saved[2].need, 6); assert.equal(saved[2].bonusKobo, 700_00);
  const r6 = await M.claimMilestone(db, ME, "crowd", { walletLive: true }, deps);
  assert.equal(r6.bonusKobo, 700_00, "pays what the admin set");
  const back = await M.resetMilestoneSettings(db, "admin");
  assert.deepEqual(back.map((m) => [m.need, m.bonusKobo]), MILESTONES.map((m) => [m.need, m.bonusKobo]), "back to the defaults");

  // A member's claims, reset by an admin: they can claim again, without overwriting the old wallet lines.
  await assert.rejects(M.resetMemberMilestones(db, "@nobody", "admin"), /No member/);
  await db.doc("usernames/inviter").set({ uid: "inv" });
  await M.resetMemberMilestones(db, "@Inviter", "admin");
  assert.equal((await M.myMilestones(db, "inv", deps)).milestones[0].claimed, false);
  await M.claimMilestone(db, ME, "first", { walletLive: true }, deps);
  assert.ok((await db.doc("walletTx/refms_inv_first").get()).exists && (await db.doc("walletTx/refms_inv_first_r1").get()).exists, "both claims in the history");

  console.log("MILESTONES OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
