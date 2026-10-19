import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { canActForSeller } from "./orders-server";
import { ensurePricing } from "./pricing-server";
import { currentPricing } from "./pricing";
import { effectiveTier, type UserProfile } from "./users";
import { notifyBell } from "./email";
import {
  addonExtendedUntil, cleanProfile, covers, providerAccess, quoteKobo, shippingCutKobo,
  type LogisticsAccount, type ProviderAccess, type ProviderProfile,
} from "./logistics";

// Server side of the logistics provider network (lib/logistics.ts). Server-written only (firestore.rules):
//   logisticsProviders/{uid}         a provider's listing: coverage, areas, services, rate card (public to read, through the API)
//   users/{uid}.logisticsAccount     { trialStartedAt?, addonUntil? }: the add-on on Free Basic and Pro (Business and Enterprise have it)
//   users/{storeUid}.deliveryPartner { providerUid, username, name, since }: the provider a store chose; its checkout prices delivery
export class LogisticsError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type ProviderDoc = ProviderProfile & { uid: string; username: string; name: string; avatar: string };
export type Partner = { providerUid: string; username: string; name: string; since: string };

const userOf = async (db: Firestore, uid: string) => (await db.doc(`users/${uid}`).get()).data() as (UserProfile & { logisticsAccount?: LogisticsAccount; deliveryPartner?: Partner }) | undefined;
const tierOf = (p: Pick<UserProfile, "username" | "role" | "accountTier">) => effectiveTier({ username: p.username ?? "", role: p.role ?? "reader", accountTier: p.accountTier ?? "standard" });

// May this account be a provider right now: on its plan, the add-on, or the add-on's free trial.
export async function accessOf(db: Firestore, p: UserProfile & { logisticsAccount?: LogisticsAccount }, now = new Date()): Promise<ProviderAccess> {
  await ensurePricing(db);
  if (p.suspended) return { ok: false, canTrial: false };
  return providerAccess(tierOf(p), p.logisticsAccount, now, currentPricing().logistics.trialDays);
}

// The add-on's free trial: once per account, Free Basic and Pro only, no card.
export async function startTrial(db: Firestore, uid: string, now = new Date()): Promise<ProviderAccess> {
  const p = await userOf(db, uid);
  if (!p) throw new LogisticsError("Account not found.", 404);
  const a = await accessOf(db, p, now);
  if (a.ok) throw new LogisticsError(a.via === "plan" ? "Your plan already includes the logistics tools." : "Your logistics add-on is already on.", 409);
  if (!a.canTrial) throw new LogisticsError(p.logisticsAccount?.trialStartedAt ? "You've had your free trial. Add the logistics add-on to carry on." : "The logistics add-on is for Free Basic and Pro accounts that publish.", 403);
  await db.doc(`users/${uid}`).update({ "logisticsAccount.trialStartedAt": now.toISOString() });
  return accessOf(db, { ...p, logisticsAccount: { ...p.logisticsAccount, trialStartedAt: now.toISOString() } }, now);
}

// A paid month of the add-on (inside fulfillPayment's transaction): runs on from what's left of the trial or the paid month.
export function extendAddon(t: Transaction, db: Firestore, uid: string, acc: LogisticsAccount | undefined, now: Date) {
  const until = addonExtendedUntil(acc, now, currentPricing().logistics.trialDays);
  t.set(db.doc(`users/${uid}`), { logisticsAccount: { ...(acc ?? {}), addonUntil: until } }, { merge: true });
  return until;
}

// A provider saves its listing (the owner, or a team member with store access in an organisation).
export async function saveProfile(db: Firestore, uid: string, providerUid: string, raw: unknown, now = new Date()): Promise<ProviderDoc> {
  const clean = cleanProfile(raw);
  if (!clean.ok) throw new LogisticsError(clean.error);
  if (!(await canActForSeller(uid, providerUid))) throw new LogisticsError("You can't manage this account's listing.", 403);
  const p = await userOf(db, providerUid);
  if (!p) throw new LogisticsError("Account not found.", 404);
  if (!(await accessOf(db, p, now)).ok) throw new LogisticsError("Listing in the network needs Business, Enterprise or the logistics add-on.", 403);
  const doc: ProviderDoc = { ...clean.value, uid: providerUid, username: p.username, name: p.displayName || p.username, avatar: p.avatar || "", updatedAt: now.toISOString() };
  await db.doc(`logisticsProviders/${providerUid}`).set(doc);
  return doc;
}

export async function providerDoc(db: Firestore, uid: string): Promise<ProviderDoc | null> {
  return ((await db.doc(`logisticsProviders/${uid}`).get()).data() as ProviderDoc | undefined) ?? null;
}

// Is this provider open for business: listed, still on a plan or the add-on, not suspended, able to be paid.
async function usable(db: Firestore, d: ProviderDoc, now: Date): Promise<boolean> {
  if (!d.listed) return false;
  const p = await userOf(db, d.uid);
  if (!p || !(await accessOf(db, p, now)).ok) return false;
  return !!(await db.doc(`payoutAccounts/${d.uid}`).get()).data()?.recipientCode;
}

// The network stores browse: listed providers, optionally only those covering a state. Busiest first would need data we don't keep
// yet, so it's alphabetical.
export async function listProviders(db: Firestore, state?: string, now = new Date()): Promise<ProviderDoc[]> {
  const snap = await db.collection("logisticsProviders").where("listed", "==", true).limit(300).get();
  const all = snap.docs.map((d) => d.data() as ProviderDoc).filter((d) => !state || covers(d.coverage, state));
  const ok = await Promise.all(all.map((d) => usable(db, d, now)));
  return all.filter((_, i) => ok[i]).sort((a, b) => a.name.localeCompare(b.name));
}

// A store chooses (or stops using) its delivery partner. Only a store that sells physical goods (not Free Standard) can.
export async function setPartner(db: Firestore, uid: string, storeUid: string, providerUid: string | null, now = new Date()): Promise<Partner | null> {
  if (!(await canActForSeller(uid, storeUid))) throw new LogisticsError("You can't change this store's delivery.", 403);
  const store = await userOf(db, storeUid);
  if (!store || store.suspended) throw new LogisticsError("Store not found.", 404);
  if (tierOf(store) === "standard") throw new LogisticsError("Selling physical items starts on Free Basic.", 403);
  if (!providerUid) {
    await db.doc(`users/${storeUid}`).update({ deliveryPartner: FieldValue.delete() });
    return null;
  }
  if (providerUid === storeUid) throw new LogisticsError("Choose another business as your delivery partner.");
  const d = await providerDoc(db, providerUid);
  if (!d || !(await usable(db, d, now))) throw new LogisticsError("That provider isn't taking stores right now.", 409);
  const partner: Partner = { providerUid, username: d.username, name: d.name, since: now.toISOString() };
  await db.doc(`users/${storeUid}`).update({ deliveryPartner: partner });
  await notifyBell({ uid: providerUid, type: "order", linkHref: "/shipments", message: `${store.displayName || store.username} chose you as their delivery partner. Their orders will come to your Shipments.` });
  return partner;
}

export type Carrier = { uid: string; username: string; name: string; feeKobo: number; cutKobo: number };
// What the store's delivery partner charges for this parcel, and our cut of it; null when the store has no partner, the partner isn't
// usable or doesn't cover the address (the store's own delivery fee applies then).
export async function partnerQuote(db: Firestore, storeUid: string, to: { city: string; state: string }, weightKg: number, now = new Date()): Promise<Carrier | null> {
  const store = await userOf(db, storeUid);
  const partner = store?.deliveryPartner;
  if (!partner) return null;
  const d = await providerDoc(db, partner.providerUid);
  if (!d || !(await usable(db, d, now))) return null;
  const fee = quoteKobo(d.rateCard, d.coverage, to, weightKg);
  if (fee === null) return null;
  const l = currentPricing().logistics;
  return { uid: d.uid, username: d.username, name: d.name, feeKobo: fee, cutKobo: shippingCutKobo(fee, l.cutRate, l.cutMinKobo) };
}

// What a store's own page shows about its delivery partner (no prices: those depend on the buyer's address).
export async function partnerOf(db: Firestore, storeUid: string): Promise<Partner | null> {
  return (await userOf(db, storeUid))?.deliveryPartner ?? null;
}
