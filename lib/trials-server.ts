import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { TRIAL_DAYS, trialCheck, type TrialTier } from "./trials";

// Starting a free trial (lib/trials.ts has the rules). Server-only; the client can't write any of these fields (firestore.rules).
export class TrialError extends Error { constructor(public status: number, message: string) { super(message); } }

// The plan the account pays for right now (an active tierSubscriptions record), if any.
export async function paidTierOf(db: Firestore, uid: string): Promise<string | null> {
  const s = (await db.doc(`tierSubscriptions/${uid}`).get()).data();
  return s && s.status === "active" ? (s.tier as string) : null;
}

export async function startTrial(db: Firestore, uid: string, tier: unknown, opts: { emailVerified: boolean }, now = new Date()): Promise<{ tier: TrialTier; until: string }> {
  if (!opts.emailVerified) throw new TrialError(403, "Verify your email first (check your inbox), then start the trial.");
  const ref = db.doc(`users/${uid}`);
  return db.runTransaction(async (t) => {
    const user = (await t.get(ref)).data();
    if (!user) throw new TrialError(404, "Profile not found.");
    if (user.suspended === true) throw new TrialError(403, "This account is suspended.");
    if (user.role === "reader" || user.accountTier === "standard") throw new TrialError(403, "Free trials are for publishers: switch to Free Basic first.");
    const sub = (await t.get(db.doc(`tierSubscriptions/${uid}`))).data();
    const paid = sub && sub.status === "active" ? (sub.tier as string) : null;
    const check = trialCheck(user, tier, now, paid);
    if (!check.ok) throw new TrialError(409, check.message);
    const tr = tier as TrialTier;
    // Organisations: Business once per registration number, whichever account it's on.
    const rc = user.accountKind === "organisation" && tr === "business" ? (user.org?.rcNumber as string | undefined) : undefined;
    if (user.accountKind === "organisation" && tr === "business" && user.org?.rcStatus === "rejected") throw new TrialError(403, "Fix your registration number first.");
    if (rc && (await t.get(db.doc(`orgTrials/${rc}`))).exists) throw new TrialError(409, "The free Business trial has already been used for this organisation.");
    const startedAt = now.toISOString();
    const until = new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
    if (rc) t.set(db.doc(`orgTrials/${rc}`), { uid, rcNumber: rc, startedAt, until });
    t.set(ref, { accountTier: tr, trialTier: tr, trialUntil: until, trials: FieldValue.arrayUnion({ tier: tr, startedAt, until }), trialReminderSent: FieldValue.delete() }, { merge: true });
    return { tier: tr, until };
  });
}
