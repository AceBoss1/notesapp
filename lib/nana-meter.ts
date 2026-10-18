import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { currentPricing } from "./pricing";
import { ensurePricing } from "./pricing-server";
import { effectiveTier, type AccountTier, type UserProfile } from "./users";
import {
  canStart, costKobo, effortsFor, gemsFor, nextReset, periodAllowance, periodKey, spend, standing,
  type Effort, type Gem, type NanaAccount, type Standing, type Usage,
} from "./nana-gems";

// Metering Nana on #NotesApp's AI account (the rules are in lib/nana-gems.ts). Server only.
//   nanaAccounts/{uid} → { period, usedKobo, creditKobo }: this period's allowance used, and bought credit (never expires)
//   nanaSpend/{YYYY-MM} → what allowances (and, separately, credit) cost the site this month, for the site-wide ceiling
// Members with their own AI key are never metered. Visitors (not signed in) use Pearl, count toward the site's month, and keep the
// daily caps they always had.

export type Meter = { uid?: string; tier: AccountTier; gem: Gem; effort: Effort };
export type NanaStatus = Standing & {
  tier: AccountTier; gems: Gem[]; efforts: Effort[]; resetEvery: "day" | "week" | "month"; resetsAt: string;
  allowanceGems: "all" | "pearl"; packs: { id: string; name: string; priceKobo: number; creditKobo: number }[];
};

const account = (db: Firestore, uid: string) => db.collection("nanaAccounts").doc(uid);
const month = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 7);

export async function memberTier(db: Firestore, uid: string): Promise<AccountTier> {
  const u = (await db.doc(`users/${uid}`).get()).data() as Partial<UserProfile> | undefined;
  return effectiveTier({ username: u?.username ?? "", role: u?.role ?? "reader", accountTier: u?.accountTier ?? "standard" });
}

const allowanceFor = (tier: AccountTier) => {
  const n = currentPricing().nana;
  return periodAllowance(n.budgets[tier] ?? n.budgets.standard, n.resetEvery);
};
const covers = (gem: Gem) => currentPricing().nana.allowanceGems === "all" || gem === "pearl";

export async function nanaStatus(db: Firestore, uid: string, now: Date, tier?: AccountTier): Promise<NanaStatus> {
  await ensurePricing(db);
  const t = tier ?? (await memberTier(db, uid));
  const n = currentPricing().nana;
  const s = standing((await account(db, uid).get()).data() as Partial<NanaAccount> | undefined, periodKey(now, n.resetEvery), allowanceFor(t));
  return { ...s, tier: t, gems: gemsFor(t), efforts: effortsFor(t), resetEvery: n.resetEvery, resetsAt: nextReset(now, n.resetEvery).toISOString(), allowanceGems: n.allowanceGems, packs: n.topUps };
}

export type Check = { ok: true } | { ok: false; reason: "allowance" | "ceiling"; notice: string };
// Before a call on our account: is there allowance (and room under the site's ceiling) or credit to pay for it?
export async function meterCheck(db: Firestore, m: Meter, now: Date): Promise<Check> {
  await ensurePricing(db); // an admin's change in Admin → Pricing reaches every server within 20 seconds
  const n = currentPricing().nana;
  const [spent, acc] = await Promise.all([db.collection("nanaSpend").doc(month(now)).get(), m.uid ? account(db, m.uid).get() : Promise.resolve(null)]);
  const ceilingHit = (Number(spent.data()?.allowanceKobo) || 0) >= n.siteCeilingKobo;
  const when = nextReset(now, n.resetEvery).toLocaleString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
  if (!m.uid) return ceilingHit ? { ok: false, reason: "ceiling", notice: "Nana's AI is resting until next month, so I answered from the help centre." } : { ok: true };
  const s = standing(acc?.data() as Partial<NanaAccount> | undefined, periodKey(now, n.resetEvery), allowanceFor(m.tier));
  const allowanceOk = covers(m.gem) && !ceilingHit;
  if (canStart(s, allowanceOk)) return { ok: true };
  if (ceilingHit && s.leftKobo > 0) return { ok: false, reason: "ceiling", notice: "Nana's free allowance is paused for everyone until next month. Nana credit still works: top up on the Nana page." };
  return { ok: false, reason: "allowance", notice: covers(m.gem)
    ? `You've used your free Nana allowance for now. It refreshes ${n.resetEvery === "month" ? "on the 1st" : when}; top up Nana credit on the Nana page to keep going.`
    : "Your free allowance covers Pearl. Emerald and Ruby use Nana credit: top up on the Nana page, or switch to Pearl." };
}

export type Charge = { costKobo: number; fromAllowance: number; fromCredit: number };
// After a call on our account: what it cost, taken from the allowance first, then credit.
export async function meterCharge(db: Firestore, m: Meter, usage: Usage | undefined, now: Date): Promise<Charge> {
  const n = currentPricing().nana;
  const cost = costKobo(usage ?? {}, n.rates[m.gem], n.usdKobo);
  const site = db.collection("nanaSpend").doc(month(now));
  if (!m.uid) {
    await site.set({ allowanceKobo: FieldValue.increment(cost), calls: FieldValue.increment(1), month: month(now) }, { merge: true });
    return { costKobo: cost, fromAllowance: cost, fromCredit: 0 };
  }
  const ref = account(db, m.uid), period = periodKey(now, n.resetEvery);
  return db.runTransaction(async (t) => {
    const [a, sp] = await Promise.all([t.get(ref), t.get(site)]);
    const ceilingHit = (Number(sp.data()?.allowanceKobo) || 0) >= n.siteCeilingKobo;
    const s = standing(a.data() as Partial<NanaAccount> | undefined, period, allowanceFor(m.tier));
    const out = spend(s, cost, covers(m.gem) && !ceilingHit);
    t.set(ref, { period, usedKobo: out.usedKobo, creditKobo: out.creditKobo, updatedAt: now.toISOString(), spentKobo: FieldValue.increment(cost) }, { merge: true });
    t.set(site, { allowanceKobo: FieldValue.increment(out.fromAllowance), creditKobo: FieldValue.increment(out.fromCredit), calls: FieldValue.increment(1), month: month(now) }, { merge: true });
    return { costKobo: cost, fromAllowance: out.fromAllowance, fromCredit: out.fromCredit };
  });
}

// A paid credit pack (lib/payments.ts fulfillPayment, inside its transaction). Credit never expires.
export function addNanaCredit(t: Transaction, db: Firestore, uid: string, kobo: number, reference: string, now: Date) {
  t.set(account(db, uid), { creditKobo: FieldValue.increment(kobo), lastTopUp: { reference, kobo, at: now.toISOString() }, updatedAt: now.toISOString() }, { merge: true });
}
