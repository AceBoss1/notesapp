import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { isKidUid } from "./kids";
import { notifyBell } from "./email";
import {
  campaignByCode, campaignById, campaignLive, claimCheck, emptyCounts, poolOf, promoSource, promoUntil, publicStatus, slotsLeft, tournamentOpen, venturesLeft,
  type Campaign, type PromoCounts, type PromoStatus, type PromoTier,
} from "./promos";

// Promo campaigns on the server (lib/promos.ts has the rules). Server only; every collection here is closed to browsers (firestore.rules).
//   promos/{campaignId}                 the counters: { plans: { pro, business, enterprise }, venturePicks, tournamentEntries }
//   promoClaims/{campaignId}_{uid}      one plan claim per account: { campaignId, uid, username, tier, until, claimedAt }
//   promoOrgClaims/{campaignId}_{rc}    one plan claim per organisation registration number
//   promoTournament/{campaignId}_{uid}  a tournament sign-up
// Every claim runs in one transaction with the counter, so two people can never take the last slot.

export class PromoError extends Error { constructor(public status: number, message: string) { super(message); } }

const countsOf = (d: FirebaseFirestore.DocumentData | undefined): PromoCounts => ({
  ...emptyCounts(),
  plans: { ...(d?.plans ?? {}) },
  venturePicks: Number(d?.venturePicks ?? 0),
  tournamentEntries: Number(d?.tournamentEntries ?? 0),
});

export async function promoCounts(db: Firestore, c: Campaign): Promise<PromoCounts> {
  return countsOf((await db.doc(`promos/${c.id}`).get()).data());
}

export async function promoStatus(db: Firestore, code: unknown, now = new Date()): Promise<PromoStatus> {
  const c = campaignByCode(code) ?? campaignById(code);
  if (!c) throw new PromoError(404, "That code isn't one of our offers. Check the spelling: DAVIDO-at-34.");
  return publicStatus(c, await promoCounts(db, c), now);
}

// The signed-in member's own claims across the campaign (for the offer page).
export async function myPromo(db: Firestore, uid: string, code: unknown) {
  const c = campaignByCode(code) ?? campaignById(code);
  if (!c) throw new PromoError(404, "That code isn't one of our offers.");
  const [claim, entry] = await Promise.all([db.doc(`promoClaims/${c.id}_${uid}`).get(), db.doc(`promoTournament/${c.id}_${uid}`).get()]);
  const cl = claim.data();
  return { plan: cl ? { tier: cl.tier as PromoTier, until: String(cl.until) } : null, tournament: entry.exists };
}

// Claim a free plan. The plan starts now and ends `days` later; the daily job in lib/tier-billing.ts moves the account back afterwards.
export async function claimPromoPlan(db: Firestore, me: { uid: string; emailVerified: boolean }, code: unknown, tier: unknown, now = new Date()) {
  const c = campaignByCode(code);
  if (!c) throw new PromoError(404, "That code isn't one of our offers. Check the spelling: DAVIDO-at-34.");
  if (!me.emailVerified) throw new PromoError(403, "Verify your email first (check your inbox), then claim.");
  if (isKidUid(me.uid)) throw new PromoError(403, "This offer is for publishers' accounts, not kids' accounts.");
  const userRef = db.doc(`users/${me.uid}`);
  const counterRef = db.doc(`promos/${c.id}`);
  const claimRef = db.doc(`promoClaims/${c.id}_${me.uid}`);
  const result = await db.runTransaction(async (t) => {
    const [user, counter, claim, sub] = await Promise.all([t.get(userRef), t.get(counterRef), t.get(claimRef), t.get(db.doc(`tierSubscriptions/${me.uid}`))]);
    const u = user.data();
    const paid = sub.data()?.status === "active" ? String(sub.data()?.tier) : null;
    // One per organisation too: the same registration number on another account counts as claimed.
    const rc = u?.accountKind === "organisation" && typeof u?.org?.rcNumber === "string" && u.org.rcNumber ? String(u.org.rcNumber) : null;
    const orgRef = rc ? db.doc(`promoOrgClaims/${c.id}_${rc.replace(/[^A-Za-z0-9-]/g, "")}`) : null;
    const orgClaimed = orgRef ? (await t.get(orgRef)).exists : false;
    const check = claimCheck(c, u, tier, now, paid, claim.exists || orgClaimed);
    if (!check.ok) throw new PromoError(check.status, check.message);
    const tr = tier as PromoTier;
    const counts = countsOf(counter.data());
    if (slotsLeft(c, counts, tr) <= 0) throw new PromoError(409, `All ${poolOf(c, tr)!.slots} ${poolOf(c, tr)!.label} slots have been claimed. Try another plan while they last.`);
    const until = promoUntil(c, tr, now);
    const at = now.toISOString();
    t.set(counterRef, { campaignId: c.id, plans: { [tr]: FieldValue.increment(1) }, updatedAt: at }, { merge: true });
    t.set(claimRef, { campaignId: c.id, uid: me.uid, username: String(u?.username ?? ""), tier: tr, until, claimedAt: at, ...(rc ? { rcNumber: rc } : {}) });
    if (orgRef) t.set(orgRef, { campaignId: c.id, uid: me.uid, rcNumber: rc, at });
    // The plan rides on the trial fields (so it ends by itself) but stays out of `trials`, the member's own free-trial history.
    t.set(userRef, { accountTier: tr, trialTier: tr, trialUntil: until, trialSource: promoSource(c), trialReminderSent: FieldValue.delete() }, { merge: true });
    return { tier: tr, until, left: slotsLeft(c, counts, tr) - 1, name: String(u?.displayName ?? u?.username ?? "") };
  });
  const pool = poolOf(c, result.tier)!;
  await notifyBell({ uid: me.uid, type: "plan", linkHref: "/pricing", message: `${c.code}: ${pool.label} is yours, until ${new Date(result.until).toDateString()}. Happy birthday from #NotesApp!` }).catch(() => {});
  return { tier: result.tier, until: result.until, left: result.left };
}

// Venture slots: a pitch to NotesApp Ventures can carry the code while slots are left. Picking it uses one of the campaign's slots instead of
// the quarter's (lib/ventures-server.ts calls these). Returns the campaign id to store on the pitch, or throws if the code can't be used.
export async function ventureCampaignFor(db: Firestore, code: unknown, now = new Date()): Promise<string | null> {
  if (code === undefined || code === null || String(code).trim() === "") return null;
  const c = campaignByCode(code);
  if (!c || !c.ventures) throw new PromoError(400, "That code isn't for NotesApp Ventures. Leave it empty, or check the spelling.");
  if (!campaignLive(c, now)) throw new PromoError(409, `The ${c.code} venture slots aren't open.`);
  if (venturesLeft(c, await promoCounts(db, c)) <= 0) throw new PromoError(409, `All ${c.ventures.slots} ${c.code} venture slots are filled. You can still pitch without the code.`);
  return c.id;
}

// Inside decidePitch's flow: mark a campaign pitch picked (or un-picked), keeping within the campaign's slots.
export function pickVentureSlot(t: Transaction, db: Firestore, counter: FirebaseFirestore.DocumentSnapshot, campaignId: string, picking: boolean) {
  const c = campaignById(campaignId);
  if (!c?.ventures) return;
  const counts = countsOf(counter.data());
  if (picking && venturesLeft(c, counts) <= 0) throw new PromoError(409, `All ${c.ventures.slots} ${c.code} venture slots are already picked. Un-pick one first.`);
  t.set(db.doc(`promos/${c.id}`), { campaignId: c.id, venturePicks: FieldValue.increment(picking ? 1 : -1), updatedAt: new Date().toISOString() }, { merge: true });
}

// The Arcade tournament: signed-in adults sign up on the day (Lagos date). Free entry, always (docs/ARCADE_TOURNAMENTS.md).
export async function joinPromoTournament(db: Firestore, me: { uid: string; emailVerified: boolean }, code: unknown, now = new Date()) {
  const c = campaignByCode(code);
  if (!c || !c.tournament) throw new PromoError(404, "That code isn't one of our offers.");
  if (!tournamentOpen(c, now)) throw new PromoError(409, `Sign-ups for the ${c.tournament.name} were on ${new Date(c.tournament.lagosDate + "T12:00:00+01:00").toDateString()} only.`);
  if (!me.emailVerified) throw new PromoError(403, "Verify your email first (check your inbox), then sign up.");
  if (isKidUid(me.uid)) throw new PromoError(403, "Prize tournaments are for members aged 18 and over.");
  const userRef = db.doc(`users/${me.uid}`);
  const entryRef = db.doc(`promoTournament/${c.id}_${me.uid}`);
  const counterRef = db.doc(`promos/${c.id}`);
  const entries = await db.runTransaction(async (t) => {
    const [user, entry, counter] = await Promise.all([t.get(userRef), t.get(entryRef), t.get(counterRef)]);
    const u = user.data();
    if (!u || !u.username) throw new PromoError(400, "Finish setting up your profile first.");
    if (u.suspended === true) throw new PromoError(403, "Your account can't do that right now.");
    if (u.teen === true) throw new PromoError(403, "Prize tournaments are for members aged 18 and over.");
    const n = countsOf(counter.data()).tournamentEntries;
    if (entry.exists) return n;
    t.set(entryRef, { campaignId: c.id, uid: me.uid, username: String(u.username), name: String(u.displayName ?? u.username), at: now.toISOString() });
    t.set(counterRef, { campaignId: c.id, tournamentEntries: FieldValue.increment(1), updatedAt: now.toISOString() }, { merge: true });
    return n + 1;
  });
  await notifyBell({ uid: me.uid, type: "announcement", linkHref: "/arcade", message: `You're signed up for the ${c.tournament.name}. Entry is free; it runs tonight from 10 PM, Lagos time.` }).catch(() => {});
  return { entries };
}

// Admin: everything the team needs to run the campaign.
export async function adminPromo(db: Firestore, id: unknown, now = new Date()) {
  const c = campaignById(id) ?? campaignByCode(id);
  if (!c) throw new PromoError(404, "No such campaign.");
  const [counts, claims, entries, pitches] = await Promise.all([
    promoCounts(db, c),
    db.collection("promoClaims").where("campaignId", "==", c.id).get(),
    db.collection("promoTournament").where("campaignId", "==", c.id).get(),
    db.collection("ventureApplications").where("campaign", "==", c.id).get(),
  ]);
  return {
    status: publicStatus(c, counts, now),
    claims: claims.docs.map((d) => d.data()).sort((a, b) => String(b.claimedAt).localeCompare(String(a.claimedAt))),
    tournament: entries.docs.map((d) => d.data()).sort((a, b) => String(a.at).localeCompare(String(b.at))),
    pitches: pitches.docs.map((d) => ({ id: d.id, title: d.data().title, username: d.data().username, status: d.data().status, createdAt: d.data().createdAt })),
  };
}
