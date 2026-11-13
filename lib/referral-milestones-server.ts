// Referral milestones on the server (lib/referral-milestones.ts has the rules). referralMilestones/{uid}: which milestones the member has
// claimed (server only, firestore.rules). Friends are counted fresh from referrals/{friendUid} (referredBy) and their accounts.
import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { notifyBell } from "./email";
import { grantBonus, walletDoc } from "./wallet-server";
import { MILESTONES, isMilestoneId, milestoneStates, type MilestoneState } from "./referral-milestones";

export class MilestoneError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const MAX_COUNTED = 500;

export type MilestoneDeps = { verified: (uids: string[]) => Promise<Set<string>> };
export const liveMilestoneDeps: MilestoneDeps = {
  verified: async (uids) => {
    const out = new Set<string>();
    for (let i = 0; i < uids.length; i += 100) {
      const r = await getAuth(getAdminApp()).getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
      for (const u of r.users) if (u.emailVerified) out.add(u.uid);
    }
    return out;
  },
};

// Friends who are real members: joined through this member, verified email, a username, not a child, not suspended.
export async function qualifiedFriends(db: Firestore, uid: string, deps: MilestoneDeps = liveMilestoneDeps): Promise<number> {
  const s = await db.collection("referrals").where("referredBy", "==", uid).limit(MAX_COUNTED).get();
  const ids = s.docs.map((d) => d.id).filter((id) => id !== uid);
  if (!ids.length) return 0;
  const users = await db.getAll(...ids.map((id) => db.doc(`users/${id}`)));
  const ok = users.filter((u) => { const d = u.data(); return !!d && !!d.username && d.suspended !== true && d.kid !== true; }).map((u) => u.id);
  if (!ok.length) return 0;
  return (await deps.verified(ok)).size;
}

export async function myMilestones(db: Firestore, uid: string, deps: MilestoneDeps = liveMilestoneDeps): Promise<{ qualified: number; milestones: MilestoneState[] }> {
  const [qualified, claimed] = await Promise.all([qualifiedFriends(db, uid, deps), db.doc(`referralMilestones/${uid}`).get().then((d) => (d.data()?.claimed ?? {}) as Record<string, unknown>)]);
  return { qualified, milestones: milestoneStates(qualified, claimed) };
}

// Claim a reached milestone: its Bonus Credits go into the wallet, once.
export async function claimMilestone(db: Firestore, me: { uid: string; emailVerified: boolean }, id: unknown, opts: { walletLive: boolean }, deps: MilestoneDeps = liveMilestoneDeps, now = new Date()): Promise<{ bonusKobo: number }> {
  if (!opts.walletLive) throw new MilestoneError(409, "NotesApp Credit isn't open yet, so milestones can't be claimed. They'll wait for you.");
  if (!me.emailVerified) throw new MilestoneError(403, "Verify your email first.");
  if (!isMilestoneId(id)) throw new MilestoneError(404, "Milestone not found.");
  const m = MILESTONES.find((x) => x.id === id)!;
  const u = (await db.doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true || u.kid === true) throw new MilestoneError(403, "Your account can't do that right now.");
  const qualified = await qualifiedFriends(db, me.uid, deps);
  if (qualified < m.need) throw new MilestoneError(409, `${m.name} needs ${m.need} friend${m.need === 1 ? "" : "s"} who joined as real members. You have ${qualified}.`);
  const ref = db.doc(`referralMilestones/${me.uid}`);
  await db.runTransaction(async (t) => {
    const [d, w] = await Promise.all([t.get(ref), t.get(walletDoc(db, me.uid))]);
    if (d.data()?.claimed?.[m.id]) throw new MilestoneError(409, "You've already claimed this one.");
    grantBonus(t, db, me.uid, w.data(), m.bonusKobo, `Referral milestone: ${m.name}`, `refms_${me.uid}_${m.id}`, now, "referral_milestone");
    t.set(ref, { uid: me.uid, claimed: { [m.id]: now.toISOString() }, updatedAt: now.toISOString() }, { merge: true });
  });
  await notifyBell({ uid: me.uid, type: "referral", linkHref: "/profile/wallet", message: `${m.name} unlocked: ₦${(m.bonusKobo / 100).toLocaleString("en-NG")} in Bonus Credits added to your wallet.` }).catch(() => {});
  return { bonusKobo: m.bonusKobo };
}
