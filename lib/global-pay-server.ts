import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { currencyInfo, formatMoney, isCurrency, providerFor, toMajor, toMinor, type Provider } from "./currency";
import {
  GLOBAL_HOLD_DAYS, GLOBAL_PERIOD_DAYS, GlobalPayError, canPayFrom, checkHomePrice, cleanRates, convert, earningOf, emptyPool, homeOffers,
  poolLine, ratesFresh, readerPrice, renewReminderDue, suggestConversions, type GlobalSettings, type Pool, type Rates,
} from "./global-pay";
import { SUB_TIERS, TIER_NAME, isSubTier, tierOffers, tierRate, type SubTier } from "./fans";
import { commissionRateFor } from "./tiers";
import type { AccountTier } from "./users";
import type { PublisherSettings } from "./booking-time";

// Server-only. Global subscriptions (lib/global-pay.ts): a reader pays in their currency through Stripe, Paystack or Flutterwave
// (lib/currency.ts); the publisher's earning is fixed in their own currency; each currency has a pool; Finance balances the pools and
// pays the earnings out. Every collection here is server-only (firestore.rules).
//   globalConfig/rates            exchange rates, margin and reserve (Finance)
//   publisherGlobal/{uid}         a publisher's home currency and, outside naira, their prices in it
//   globalPayoutAccounts/{uid}    where a publisher is paid outside naira (the number's last 4; the whole number encrypted, apart)
//   globalPayments/{ref}          one reader's payment (ref gp_…)
//   globalEarnings/{ref}          the publisher's earning from it, in their currency
//   treasuryPools/{CUR}           the pool in each currency
//   treasuryConversions/{id}      conversions Finance made between pools
//   treasuryPayouts/{id}          payouts to publishers

export type GlobalPayment = {
  reference: string; uid: string; email: string; publisherUid: string; publisherUsername: string; tier: SubTier;
  payCurrency: string; payMinor: number; provider: Provider; homeCurrency: string; homeMinor: number; earningMinor: number;
  commissionRate: number; rates: { pay: number; home: number }; status: "pending" | "paid" | "refunded";
  createdAt: string; paidAt?: string; providerRef?: string; refundedAt?: string;
};
export type GlobalEarning = {
  reference: string; publisherUid: string; publisherUsername: string; payerUid: string; currency: string; minor: number;
  status: "held" | "paying" | "paid_out" | "refunded"; releaseAfter: string; createdAt: string; payoutId?: string; paidAt?: string;
};

const newRef = () => `gp_${Date.now()}_${randomBytes(6).toString("hex")}`;

export async function getRates(db: Firestore): Promise<Rates | null> {
  const d = (await db.doc("globalConfig/rates").get()).data();
  return d ? (d as Rates) : null;
}
export async function setRates(db: Firestore, by: string, body: Record<string, unknown>, now = new Date()): Promise<Rates> {
  const r = { ...cleanRates(body, now), updatedBy: by };
  await db.doc("globalConfig/rates").set(r);
  return r;
}

async function publisherFor(db: Firestore, username: string) {
  const uid = (await db.doc(`usernames/${username}`).get()).data()?.uid as string | undefined;
  if (!uid) throw new GlobalPayError("Journal not found.", 404);
  const [u, s, g] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`publisherSettings/${uid}`).get(), db.doc(`publisherGlobal/${uid}`).get()]);
  const user = u.data();
  if (!user || user.suspended === true) throw new GlobalPayError("This journal isn't available.", 404);
  const settings = s.data() as PublisherSettings | undefined;
  const global = g.data() as GlobalSettings | undefined;
  return {
    uid, username, global,
    offers: homeOffers(tierOffers(settings?.subscription), global),
    commissionRate: commissionRateFor((user.accountTier as AccountTier) || "basic", user.customRates),
  };
}

// What a reader would pay for each tier in their currency. domestic: a naira reader and a naira publisher, who use the usual Paystack
// plans (lib/payments.ts), not this.
export async function quote(db: Firestore, username: string, payCurrency: string, now = new Date()) {
  if (!isCurrency(payCurrency)) throw new GlobalPayError("Choose a currency.");
  const pub = await publisherFor(db, username);
  const home = pub.offers.premium.currency;
  const domestic = home === "NGN" && payCurrency === "NGN";
  const rates = await getRates(db);
  const ready = home === payCurrency || ratesFresh(rates, now);
  const tiers = SUB_TIERS.filter((t) => pub.offers[t].enabled).map((t) => ({
    tier: t, homeMinor: pub.offers[t].minor,
    payMinor: ready ? readerPrice(pub.offers[t].minor, home, payCurrency, rates ?? { perUsd: {}, marginPct: 0 }) : null,
  }));
  return { home, payCurrency, provider: providerFor(payCurrency), domestic, ready, tiers };
}

export async function startCheckout(
  db: Firestore,
  me: { uid: string; email: string; name?: string },
  b: { username: string; tier: unknown; currency: unknown },
  deps: { checkout: (p: GlobalPayment, title: string) => Promise<string> },
  now = new Date(),
): Promise<{ url: string; reference: string }> {
  if (!me.email) throw new GlobalPayError("Add an email address to your account first.");
  const tier: SubTier = isSubTier(b.tier) ? b.tier : "premium";
  if (!isCurrency(b.currency)) throw new GlobalPayError("Choose a currency.");
  const pay = b.currency;
  const pub = await publisherFor(db, b.username);
  if (pub.uid === me.uid) throw new GlobalPayError("You can't subscribe to yourself.");
  const offer = pub.offers[tier];
  if (!offer.enabled) throw new GlobalPayError(`${TIER_NAME[tier]} isn't offered by this creator.`, 409);
  if (offer.currency === "NGN" && pay === "NGN") throw new GlobalPayError("Pay in naira with the usual checkout.", 409);
  const existing = (await db.doc(`subscriptions/${me.uid}_${b.username}`).get()).data();
  if (existing?.planCode && existing.status === "active" && Date.parse(String(existing.currentPeriodEnd)) > now.getTime()) {
    throw new GlobalPayError("You already subscribe with a monthly card plan. Cancel it first, then subscribe in another currency.", 409);
  }
  const rates = await getRates(db);
  if (offer.currency !== pay && !ratesFresh(rates, now)) throw new GlobalPayError("Paying in this currency is paused for a moment while we update exchange rates. Please try again later.", 503);
  const r = rates ?? { perUsd: { [pay]: 1 }, marginPct: 0, reservePct: 0, updatedAt: now.toISOString() };
  const commissionRate = tierRate(pub.commissionRate, tier);
  const payment: GlobalPayment = {
    reference: newRef(), uid: me.uid, email: me.email, publisherUid: pub.uid, publisherUsername: b.username, tier,
    payCurrency: pay, payMinor: readerPrice(offer.minor, offer.currency, pay, r), provider: providerFor(pay),
    homeCurrency: offer.currency, homeMinor: offer.minor, earningMinor: earningOf(offer.minor, commissionRate), commissionRate,
    rates: { pay: r.perUsd[pay] ?? 1, home: r.perUsd[offer.currency] ?? 1 }, status: "pending", createdAt: now.toISOString(),
  };
  await db.doc(`globalPayments/${payment.reference}`).set(payment);
  const url = await deps.checkout(payment, `@${b.username} ${TIER_NAME[tier]}, one month`);
  return { url, reference: payment.reference };
}

// The provider's word on a payment: paid in full, in the right currency? providerRef: its own id (for refunds).
export type Confirmation = { paid: boolean; currency: string; minor: number; providerRef?: string };

// Idempotent: the return page and the webhook may both call it, in either order.
export async function fulfilGlobal(db: Firestore, reference: string, confirm: (p: GlobalPayment) => Promise<Confirmation>, now = new Date()): Promise<GlobalPayment> {
  const ref = db.doc(`globalPayments/${reference}`);
  const first = (await ref.get()).data() as GlobalPayment | undefined;
  if (!first) throw new GlobalPayError("Payment not found.", 404);
  if (first.status !== "pending") return first;
  const c = await confirm(first);
  if (!c.paid) throw new GlobalPayError("The payment hasn't gone through.", 402);
  if (c.currency.toUpperCase() !== first.payCurrency || c.minor < first.payMinor) {
    await ref.update({ mismatch: { currency: c.currency, minor: c.minor, at: now.toISOString() } });
    throw new GlobalPayError("The amount paid doesn't match. Finance has been told.", 409);
  }
  const at = now.toISOString();
  const done = await db.runTransaction(async (t) => {
    const p = (await t.get(ref)).data() as GlobalPayment;
    if (p.status !== "pending") return { p, fresh: false };
    const subRef = db.doc(`subscriptions/${p.uid}_${p.publisherUsername}`);
    const prev = (await t.get(subRef)).data();
    // Renewing adds a month to the end; changing tier starts the new one now with the days left added on (like lib/payments.ts).
    const left = prev?.currentPeriodEnd ? Math.max(0, Date.parse(String(prev.currentPeriodEnd)) - now.getTime()) : 0;
    t.set(subRef, {
      subscriberUid: p.uid, subscriberEmail: p.email, username: p.publisherUsername, tier: p.tier, status: "active",
      subscribedAt: prev?.subscribedAt ?? at,
      currentPeriodEnd: new Date(now.getTime() + left + GLOBAL_PERIOD_DAYS * 86_400_000).toISOString(),
      global: { currency: p.payCurrency, provider: p.provider, reference: p.reference },
    });
    const earning: GlobalEarning = {
      reference: p.reference, publisherUid: p.publisherUid, publisherUsername: p.publisherUsername, payerUid: p.uid,
      currency: p.homeCurrency, minor: p.earningMinor, status: "held",
      releaseAfter: new Date(now.getTime() + GLOBAL_HOLD_DAYS * 86_400_000).toISOString(), createdAt: at,
    };
    t.set(db.doc(`globalEarnings/${p.reference}`), earning);
    t.set(db.doc(`treasuryPools/${p.payCurrency}`), { currency: p.payCurrency, inMinor: FieldValue.increment(p.payMinor) }, { merge: true });
    t.set(db.doc(`treasuryPools/${p.homeCurrency}`), { currency: p.homeCurrency, dueMinor: FieldValue.increment(p.earningMinor) }, { merge: true });
    const paid = { ...p, status: "paid" as const, paidAt: at, ...(c.providerRef ? { providerRef: c.providerRef } : {}) };
    t.set(ref, paid);
    return { p: paid, fresh: true };
  });
  if (done.fresh) {
    const { notifyBell } = await import("./email");
    await notifyBell({ uid: done.p.publisherUid, type: "plan", linkHref: "/profile/publishing#global", message: `New ${TIER_NAME[done.p.tier]} subscriber paying in ${done.p.payCurrency}: you earn ${formatMoney(done.p.earningMinor, done.p.homeCurrency)}.` });
    await notifyBell({ uid: done.p.uid, type: "plan", linkHref: `/u/${done.p.publisherUsername}`, message: `You're subscribed to @${done.p.publisherUsername} (${TIER_NAME[done.p.tier]}) for a month. We'll remind you before it ends.` });
  }
  return done.p;
}

// ── A publisher's global settings ──
export async function myGlobal(db: Firestore, uid: string) {
  const [g, a, rates] = await Promise.all([db.doc(`publisherGlobal/${uid}`).get(), db.doc(`globalPayoutAccounts/${uid}`).get(), getRates(db)]);
  const due = await db.collection("globalEarnings").where("publisherUid", "==", uid).where("status", "==", "held").get();
  const owed: Record<string, number> = {};
  for (const d of due.docs) { const e = d.data() as GlobalEarning; owed[e.currency] = (owed[e.currency] ?? 0) + e.minor; }
  return { settings: (g.data() as GlobalSettings | undefined) ?? { currency: "NGN", acceptGlobal: true }, payout: a.data() ?? null, owed, ratesReady: ratesFresh(rates) };
}

export async function saveGlobal(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()): Promise<GlobalSettings> {
  const currency = isCurrency(b.currency) ? b.currency : "NGN";
  const rates = await getRates(db);
  const tiersIn = (b.tiers && typeof b.tiers === "object" ? b.tiers : {}) as Record<string, { enabled?: unknown; price?: unknown }>;
  const tiers: GlobalSettings["tiers"] = {};
  if (currency !== "NGN") {
    for (const t of SUB_TIERS) {
      const on = tiersIn[t]?.enabled === true;
      const minor = toMinor(Number(tiersIn[t]?.price) || 0, currency);
      if (on) { const bad = checkHomePrice(minor, currency, rates); if (bad) throw new GlobalPayError(`${TIER_NAME[t]}: ${bad}`); }
      tiers[t] = { enabled: on, minor: on ? minor : 0 };
    }
  }
  const g: GlobalSettings = { currency, acceptGlobal: b.acceptGlobal !== false, ...(currency !== "NGN" ? { tiers } : {}) };
  await db.doc(`publisherGlobal/${uid}`).set({ ...g, updatedAt: now.toISOString() });
  return g;
}

// Where a publisher is paid outside naira: a bank account, or mobile money (M-Pesa and the like). Flutterwave's bank or network code.
export async function savePayoutAccount(db: Firestore, uid: string, b: Record<string, unknown>, now = new Date()) {
  const currency = isCurrency(b.currency) && b.currency !== "NGN" ? b.currency : null;
  if (!currency) throw new GlobalPayError("Choose the currency you're paid in (naira payouts use your bank account above).");
  const method = b.method === "mobile_money" ? "mobile_money" : "bank";
  const accountBank = String(b.accountBank ?? "").trim().toUpperCase();
  const accountNumber = String(b.accountNumber ?? "").replace(/[\s-]/g, "");
  const accountName = String(b.accountName ?? "").trim().slice(0, 80);
  if (!/^[A-Z0-9]{2,12}$/.test(accountBank)) throw new GlobalPayError(method === "bank" ? "Enter your bank's code." : "Enter the mobile money network (for M-Pesa, MPS).");
  if (!/^[A-Z0-9+]{6,34}$/i.test(accountNumber)) throw new GlobalPayError(method === "bank" ? "Enter the account number (or IBAN)." : "Enter the phone number, with the country code.");
  if (accountName.length < 3) throw new GlobalPayError("Enter the name on the account.");
  const { accountCryptoConfigured, encryptAccountNumber } = await import("./account-crypto");
  if (!accountCryptoConfigured()) throw new GlobalPayError("Payouts outside naira aren't open yet.", 503);
  const shown = { currency, method, accountBank, accountName, last4: accountNumber.slice(-4), updatedAt: now.toISOString() };
  await db.doc(`globalPayoutAccounts/${uid}`).set(shown);
  await db.doc(`globalPayoutSecrets/${uid}`).set({ accountNumber: encryptAccountNumber(accountNumber), updatedAt: now.toISOString() });
  return shown;
}

// ── Treasury (Finance) ──
export async function treasury(db: Firestore, now = new Date()) {
  const [rates, pools, held, conversions, payouts] = await Promise.all([
    getRates(db),
    db.collection("treasuryPools").get(),
    db.collection("globalEarnings").where("status", "==", "held").get(),
    db.collection("treasuryConversions").orderBy("at", "desc").limit(20).get(),
    db.collection("treasuryPayouts").orderBy("at", "desc").limit(20).get(),
  ]);
  const reserve = rates?.reservePct ?? 10;
  const lines = pools.docs.map((d) => poolLine({ ...emptyPool(d.id), ...(d.data() as Partial<Pool>) }, reserve)).sort((a, b) => a.currency.localeCompare(b.currency));
  // What's due now, by publisher and currency (held past its hold).
  const dueMap = new Map<string, { publisherUid: string; publisherUsername: string; currency: string; minor: number; count: number }>();
  for (const d of held.docs) {
    const e = d.data() as GlobalEarning;
    if (Date.parse(e.releaseAfter) > now.getTime()) continue;
    const k = `${e.publisherUid}_${e.currency}`;
    const cur = dueMap.get(k) ?? { publisherUid: e.publisherUid, publisherUsername: e.publisherUsername, currency: e.currency, minor: 0, count: 0 };
    cur.minor += e.minor; cur.count += 1; dueMap.set(k, cur);
  }
  return {
    rates, ratesFresh: ratesFresh(rates, now), lines,
    suggestions: rates ? suggestConversions(lines, rates) : [],
    due: [...dueMap.values()].sort((a, b) => b.minor - a.minor),
    conversions: conversions.docs.map((d) => ({ id: d.id, ...d.data() })),
    payouts: payouts.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

// Finance records a conversion done with a bank or provider: fromMinor left the "from" pool, toMinor arrived in the "to" pool.
export async function recordConversion(db: Firestore, by: string, b: Record<string, unknown>, now = new Date()) {
  const from = String(b.from ?? ""), to = String(b.to ?? "");
  if (!isCurrency(from) || !isCurrency(to) || from === to) throw new GlobalPayError("Choose two different currencies.");
  const fromMinor = toMinor(Number(b.fromAmount), from), toMinorV = toMinor(Number(b.toAmount), to);
  if (!(fromMinor > 0) || !(toMinorV > 0)) throw new GlobalPayError("Enter both amounts.");
  const note = String(b.note ?? "").trim().slice(0, 200);
  const id = `cv_${now.getTime()}_${randomBytes(3).toString("hex")}`;
  const batch = db.batch();
  batch.set(db.doc(`treasuryConversions/${id}`), { from, to, fromMinor, toMinor: toMinorV, note, by, at: now.toISOString() });
  batch.set(db.doc(`treasuryPools/${from}`), { currency: from, convOutMinor: FieldValue.increment(fromMinor) }, { merge: true });
  batch.set(db.doc(`treasuryPools/${to}`), { currency: to, convInMinor: FieldValue.increment(toMinorV) }, { merge: true });
  await batch.commit();
  return { id };
}

// Pays a publisher everything due in one currency: through Flutterwave when they have payout details for it and the currency is one
// Flutterwave pays; otherwise Finance pays it themselves and records it here with the bank's reference. Only when the pool can cover it.
export type TransferInput = { reference: string; currency: string; amountMajor: number; accountBank: string; accountNumber: string; beneficiaryName: string; narration: string };
export async function payOut(
  db: Firestore, by: string, b: { publisherUid: string; currency: string; via: "flutterwave" | "recorded"; externalRef?: string },
  deps: { transfer?: (p: TransferInput) => Promise<unknown> } = {},
  now = new Date(),
) {
  if (!isCurrency(b.currency)) throw new GlobalPayError("Choose a currency.");
  const rates = await getRates(db);
  const held = await db.collection("globalEarnings").where("publisherUid", "==", b.publisherUid).where("status", "==", "held").get();
  const due = held.docs.map((d) => d.data() as GlobalEarning).filter((e) => e.currency === b.currency && Date.parse(e.releaseAfter) <= now.getTime());
  if (!due.length) throw new GlobalPayError("Nothing is due to this publisher in that currency.", 409);
  const minor = due.reduce((n, e) => n + e.minor, 0);
  const pool = poolLine({ ...emptyPool(b.currency), ...((await db.doc(`treasuryPools/${b.currency}`).get()).data() as Partial<Pool>) }, rates?.reservePct ?? 10);
  if (!canPayFrom(pool, minor)) throw new GlobalPayError(`The ${b.currency} pool has ${formatMoney(Math.max(0, pool.cashMinor), b.currency)}; this payout needs ${formatMoney(minor, b.currency)}. Convert into ${b.currency} first.`, 409);
  const id = `po_${now.getTime()}_${randomBytes(3).toString("hex")}`;
  let externalRef = String(b.externalRef ?? "").trim().slice(0, 100);
  if (b.via === "recorded" && externalRef.length < 3) throw new GlobalPayError("Enter the transfer's reference from the bank or provider.");
  // Claim the earnings first ("paying"), so a second click, or a refund, can't touch them while the money moves.
  await db.runTransaction(async (t) => {
    const fresh = await Promise.all(due.map((e) => t.get(db.doc(`globalEarnings/${e.reference}`))));
    if (fresh.some((d) => d.data()?.status !== "held")) throw new GlobalPayError("Someone is already paying this out. Reload the page.", 409);
    for (const d of fresh) t.update(d.ref, { status: "paying", payoutId: id });
  });
  const release = () => Promise.all(due.map((e) => db.doc(`globalEarnings/${e.reference}`).update({ status: "held", payoutId: FieldValue.delete() })));
  if (b.via === "flutterwave") try {
    if (currencyInfo(b.currency).provider === "stripe" || b.currency === "NGN") throw new GlobalPayError(`${b.currency} payouts aren't sent through Flutterwave here; pay it and record it.`);
    const acct = (await db.doc(`globalPayoutAccounts/${b.publisherUid}`).get()).data();
    const secret = (await db.doc(`globalPayoutSecrets/${b.publisherUid}`).get()).data();
    if (!acct || acct.currency !== b.currency || !secret?.accountNumber) throw new GlobalPayError(`This publisher hasn't added ${b.currency} payout details.`, 409);
    if (!deps.transfer) throw new GlobalPayError("Flutterwave isn't set up.", 503);
    const { decryptAccountNumber } = await import("./account-crypto");
    await deps.transfer({ reference: id, currency: b.currency, amountMajor: toMajor(minor, b.currency), accountBank: String(acct.accountBank), accountNumber: decryptAccountNumber(String(secret.accountNumber)), beneficiaryName: String(acct.accountName), narration: "#NotesApp earnings" });
    externalRef = id;
  } catch (e) {
    if (e instanceof GlobalPayError) { await release(); throw e; } // stopped before any money moved
    // The transfer's outcome is unknown (a timeout, an error after sending): the earnings stay "paying" so they can't be paid twice.
    await db.doc(`treasuryPayouts/${id}`).set({ publisherUid: b.publisherUid, publisherUsername: due[0].publisherUsername, currency: b.currency, minor, count: due.length, via: b.via, status: "unconfirmed", error: String(e instanceof Error ? e.message : e).slice(0, 200), by, at: now.toISOString() });
    throw new GlobalPayError("Flutterwave didn't confirm the transfer. Check it on Flutterwave before anything else; these earnings stay on hold so they can't be paid twice.", 502);
  }
  const at = now.toISOString();
  const batch = db.batch();
  for (const e of due) batch.update(db.doc(`globalEarnings/${e.reference}`), { status: "paid_out", payoutId: id, paidAt: at });
  batch.set(db.doc(`treasuryPayouts/${id}`), { publisherUid: b.publisherUid, publisherUsername: due[0].publisherUsername, currency: b.currency, minor, count: due.length, via: b.via, externalRef, by, at });
  batch.set(db.doc(`treasuryPools/${b.currency}`), { currency: b.currency, outMinor: FieldValue.increment(minor), dueMinor: FieldValue.increment(-minor) }, { merge: true });
  await batch.commit();
  const { notifyBell } = await import("./email");
  await notifyBell({ uid: b.publisherUid, type: "plan", linkHref: "/profile/publishing#global", message: `${formatMoney(minor, b.currency)} of subscription earnings is on its way to you.` });
  return { id, minor, count: due.length };
}

// Refund a global payment: back to the reader through the provider, the month taken off, the earning cancelled (if not yet paid out).
export async function refundGlobal(db: Firestore, reference: string, deps: { refund: (p: GlobalPayment) => Promise<unknown> }, now = new Date()) {
  const ref = db.doc(`globalPayments/${reference}`);
  const p = (await ref.get()).data() as GlobalPayment | undefined;
  if (!p) throw new GlobalPayError("Payment not found.", 404);
  if (p.status !== "paid") throw new GlobalPayError("Only a paid payment can be refunded.", 409);
  const e = (await db.doc(`globalEarnings/${reference}`).get()).data() as GlobalEarning | undefined;
  if (e?.status === "paid_out" || e?.status === "paying") throw new GlobalPayError("The publisher has already been paid for this one (or is being paid); refund it by hand and record it.", 409);
  await deps.refund(p);
  const at = now.toISOString();
  await db.runTransaction(async (t) => {
    const subRef = db.doc(`subscriptions/${p.uid}_${p.publisherUsername}`);
    const sub = (await t.get(subRef)).data();
    t.update(ref, { status: "refunded", refundedAt: at });
    if (e) t.update(db.doc(`globalEarnings/${reference}`), { status: "refunded" });
    t.set(db.doc(`treasuryPools/${p.payCurrency}`), { currency: p.payCurrency, inMinor: FieldValue.increment(-p.payMinor) }, { merge: true });
    if (e) t.set(db.doc(`treasuryPools/${p.homeCurrency}`), { currency: p.homeCurrency, dueMinor: FieldValue.increment(-p.earningMinor) }, { merge: true });
    if (sub?.global?.reference === reference) t.update(subRef, { currentPeriodEnd: new Date(Math.max(now.getTime(), Date.parse(String(sub.currentPeriodEnd)) - GLOBAL_PERIOD_DAYS * 86_400_000)).toISOString() });
  });
  return { refunded: true };
}

// The daily job: a bell a few days before a month paid this way runs out (each month once).
export async function sendRenewReminders(db: Firestore, now = new Date()): Promise<number> {
  const subs = await db.collection("subscriptions").where("global.currency", ">", "").get();
  const { notifyBell } = await import("./email");
  let n = 0;
  for (const d of subs.docs) {
    const s = d.data();
    if (s.status !== "active" || !renewReminderDue(String(s.currentPeriodEnd), s.global?.remindedFor, now)) continue;
    await d.ref.update({ "global.remindedFor": s.currentPeriodEnd });
    const day = new Date(String(s.currentPeriodEnd)).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    await notifyBell({ uid: String(s.subscriberUid), type: "plan", linkHref: `/u/${s.username}`, message: `Your subscription to @${s.username} ends on ${day}. Renew to keep reading.` });
    n++;
  }
  return n;
}

// The provider for a payment, wired to the real clients (the routes use this; tests pass their own).
export function liveDeps(siteUrl: string) {
  return {
    checkout: async (p: GlobalPayment, title: string): Promise<string> => {
      const back = `${siteUrl}/api/global/return?ref=${encodeURIComponent(p.reference)}`;
      if (p.provider === "stripe") {
        const { createCheckoutSession } = await import("./stripe");
        const s = await createCheckoutSession({ reference: p.reference, email: p.email, currency: p.payCurrency, amountMinor: p.payMinor, name: title, successUrl: `${back}&session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${siteUrl}/u/${p.publisherUsername}` });
        if (!s.url) throw new Error("Stripe didn't return a checkout link.");
        await (await import("./firebase-admin")).getAdminDb().doc(`globalPayments/${p.reference}`).update({ providerRef: s.id });
        return s.url;
      }
      if (p.provider === "flutterwave") {
        const { createPayment } = await import("./flutterwave");
        return (await createPayment({ reference: p.reference, email: p.email, name: p.email, currency: p.payCurrency, amountMajor: toMajor(p.payMinor, p.payCurrency), redirectUrl: back, title })).link;
      }
      const { initializeTransaction } = await import("./paystack");
      return (await initializeTransaction({ email: p.email, amountKobo: p.payMinor, reference: p.reference, callbackUrl: back, metadata: { global: true, username: p.publisherUsername, tier: p.tier } })).authorization_url;
    },
    confirm: async (p: GlobalPayment): Promise<Confirmation> => {
      if (p.provider === "stripe") {
        if (!p.providerRef) return { paid: false, currency: "", minor: 0 };
        const { getCheckoutSession } = await import("./stripe");
        const s = await getCheckoutSession(p.providerRef);
        return { paid: s.payment_status === "paid" && s.client_reference_id === p.reference, currency: String(s.currency ?? ""), minor: Number(s.amount_total ?? 0), providerRef: s.payment_intent ?? s.id };
      }
      if (p.provider === "flutterwave") {
        const { verifyByReference } = await import("./flutterwave");
        const tx = await verifyByReference(p.reference);
        return { paid: tx.status === "successful" && tx.tx_ref === p.reference, currency: tx.currency, minor: toMinor(tx.amount, tx.currency), providerRef: String(tx.id) };
      }
      const { verifyTransaction, pricePaidKobo } = await import("./paystack");
      const tx = await verifyTransaction(p.reference);
      return { paid: tx.status === "success", currency: tx.currency, minor: pricePaidKobo(tx), providerRef: p.reference };
    },
    refund: async (p: GlobalPayment) => {
      if (p.provider === "stripe") return (await import("./stripe")).refundPaymentIntent(String(p.providerRef), p.reference);
      if (p.provider === "flutterwave") return (await import("./flutterwave")).refundTransaction(Number(p.providerRef));
      return (await import("./paystack")).refundTransaction(p.reference);
    },
    transfer: async (t: TransferInput) => (await import("./flutterwave")).createTransfer(t),
  };
}

export { convert };
