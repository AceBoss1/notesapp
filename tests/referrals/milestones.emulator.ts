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

  console.log("MILESTONES OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
