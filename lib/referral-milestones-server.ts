// Referral milestones on the server (lib/referral-milestones.ts has the rules). referralMilestones/{uid}: which milestones the member has
// claimed (server only, firestore.rules). Friends are counted fresh from referrals/{friendUid} (joined NotesApp through you) and
// lifePlayers/{friendUid} (joined Notes Life from your invite), each person once, and their accounts. settings/referralMilestones holds
// what an admin set (Admin → Limits → Referral milestones).
import type { Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "./firebase-admin";
import { notifyBell } from "./email";
import { grantBonus, walletDoc } from "./wallet-server";
import { ttlCache } from "./ttl-cache";
import { MILESTONES, cleanMilestoneSettings, isMilestoneId, milestoneStates, milestonesWith, type Milestone, type MilestoneSettings, type MilestoneState } from "./referral-milestones";

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

// The milestones in force: what an admin saved, else the defaults. Cached a minute; saving clears it.
let DB: Firestore;
const settingsCache = ttlCache(60_000, async () => milestonesWith((await DB.doc("settings/referralMilestones").get()).data()?.milestones as MilestoneSettings | undefined));
export const liveMilestones = (db: Firestore): Promise<Milestone[]> => { DB = db; return settingsCache(); };
export async function saveMilestoneSettings(db: Firestore, input: unknown, by: string): Promise<Milestone[]> {
  const clean = cleanMilestoneSettings(input);
  if (typeof clean === "string") throw new MilestoneError(400, clean);
  await db.doc("settings/referralMilestones").set({ milestones: clean, updatedBy: by, updatedAt: new Date().toISOString() });
  settingsCache.invalidate();
  return liveMilestones(db);
}
export async function resetMilestoneSettings(db: Firestore, by: string): Promise<Milestone[]> {
  await db.doc("settings/referralMilestones").set({ milestones: {}, updatedBy: by, updatedAt: new Date().toISOString(), resetToDefaults: true });
  settingsCache.invalidate();
  return liveMilestones(db);
}
// A member's claims, cleared (Admin → Limits → Referral milestones, by username): they can reach and claim each milestone again. The
// round goes up, so new claims never overwrite the wallet lines of the old ones.
export async function resetMemberMilestones(db: Firestore, username: unknown, by: string): Promise<{ uid: string; username: string }> {
  const u = String(username ?? "").trim().toLowerCase().replace(/^@/, "");
  const uid = /^[a-z0-9_-]{2,30}$/.test(u) ? String((await db.doc(`usernames/${u}`).get()).data()?.uid ?? "") : "";
  if (!uid) throw new MilestoneError(404, "No member with that username.");
  const ref = db.doc(`referralMilestones/${uid}`);
  const round = Number((await ref.get()).data()?.round ?? 0) + 1;
  await ref.set({ uid, claimed: {}, round, resetBy: by, resetAt: new Date().toISOString() });
  return { uid, username: u };
}

// Friends who are real members: joined NotesApp through this member, or Notes Life from their invite (each person once), with a verified
// email and a username, not a child, not suspended.
export async function qualifiedFriends(db: Firestore, uid: string, deps: MilestoneDeps = liveMilestoneDeps): Promise<number> {
  const [s, life] = await Promise.all([
    db.collection("referrals").where("referredBy", "==", uid).limit(MAX_COUNTED).get(),
    db.collection("lifePlayers").where("referredBy", "==", uid).limit(MAX_COUNTED).get(),
  ]);
  const ids = Array.from(new Set([...s.docs, ...life.docs].map((d) => d.id))).filter((id) => id !== uid).slice(0, MAX_COUNTED);
  if (!ids.length) return 0;
  const users = await db.getAll(...ids.map((id) => db.doc(`users/${id}`)));
  const ok = users.filter((u) => { const d = u.data(); return !!d && !!d.username && d.suspended !== true && d.kid !== true; }).map((u) => u.id);
  if (!ok.length) return 0;
  return (await deps.verified(ok)).size;
}

export async function myMilestones(db: Firestore, uid: string, deps: MilestoneDeps = liveMilestoneDeps): Promise<{ qualified: number; milestones: MilestoneState[] }> {
  const [qualified, claimed, list] = await Promise.all([qualifiedFriends(db, uid, deps), db.doc(`referralMilestones/${uid}`).get().then((d) => (d.data()?.claimed ?? {}) as Record<string, unknown>), liveMilestones(db)]);
  return { qualified, milestones: milestoneStates(qualified, claimed, list) };
}

// Claim a reached milestone: its Bonus Credits go into the wallet, once.
export async function claimMilestone(db: Firestore, me: { uid: string; emailVerified: boolean }, id: unknown, opts: { walletLive: boolean }, deps: MilestoneDeps = liveMilestoneDeps, now = new Date()): Promise<{ bonusKobo: number }> {
  if (!opts.walletLive) throw new MilestoneError(409, "NotesApp Credit isn't open yet, so milestones can't be claimed. They'll wait for you.");
  if (!me.emailVerified) throw new MilestoneError(403, "Verify your email first.");
  if (!isMilestoneId(id)) throw new MilestoneError(404, "Milestone not found.");
  const m = (await liveMilestones(db)).find((x) => x.id === id) ?? MILESTONES.find((x) => x.id === id)!;
  if (m.bonusKobo <= 0) throw new MilestoneError(409, `${m.name} pays nothing at the moment.`);
  const u = (await db.doc(`users/${me.uid}`).get()).data();
  if (!u || u.suspended === true || u.kid === true) throw new MilestoneError(403, "Your account can't do that right now.");
  const qualified = await qualifiedFriends(db, me.uid, deps);
  if (qualified < m.need) throw new MilestoneError(409, `${m.name} needs ${m.need} friend${m.need === 1 ? "" : "s"} who joined as real members. You have ${qualified}.`);
  const ref = db.doc(`referralMilestones/${me.uid}`);
  await db.runTransaction(async (t) => {
    const [d, w] = await Promise.all([t.get(ref), t.get(walletDoc(db, me.uid))]);
    if (d.data()?.claimed?.[m.id]) throw new MilestoneError(409, "You've already claimed this one.");
    const round = Number(d.data()?.round ?? 0);
    grantBonus(t, db, me.uid, w.data(), m.bonusKobo, `Referral milestone: ${m.name}`, `refms_${me.uid}_${m.id}${round ? `_r${round}` : ""}`, now, "referral_milestone");
    t.set(ref, { uid: me.uid, claimed: { [m.id]: now.toISOString() }, updatedAt: now.toISOString() }, { merge: true });
  });
  await notifyBell({ uid: me.uid, type: "referral", linkHref: "/profile/wallet", message: `${m.name} unlocked: ₦${(m.bonusKobo / 100).toLocaleString("en-NG")} in Bonus Credits added to your wallet.` }).catch(() => {});
  return { bonusKobo: m.bonusKobo };
}
