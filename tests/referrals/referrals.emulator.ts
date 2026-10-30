// Referrals and affiliates end to end on the Firestore and Auth emulators (lib/referrals-server.ts, lib/payments.ts): a friend is
// claimed and gets the first-month offer, plan payments earn 20% for 12 months, an affiliate's download sale comes out of the
// publisher's net, earnings are taken as cash or as Credit with 10% more, a refund takes one back, and a sudden jump is flagged.
// Run: npm run test:referrals-server → "REFERRALS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import {
  ReferralError, affiliateFor, alertIfJump, claimReferral, listOffers, offerIdFor, offerPercent, ownProducts, recordPlanEarning,
  referralByCode, referralOfferFor, referrerByUsername, reverseEarningsFor, setOffer, startReferralSubscription, summary, withdraw,
} from "../../lib/referrals-server";
import { creditEarnings } from "../../lib/wallet-server";
import { applyCode, saveCode } from "../../lib/discounts-server";
import { DiscountError } from "../../lib/discounts";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const DAY = 86_400_000;
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof ReferralError && re.test(e.message));
const wallet = { walletLive: true, creditWallet: (t: FirebaseFirestore.Transaction, uid: string, c: number, b: number, id: string, now: Date) => creditEarnings(t, db, uid, c, b, id, now) };

async function member(uid: string, username: string, extra: Record<string, unknown> = {}, verified = true) {
  await getAuth().createUser({ uid, email: `${uid}@x.ng`, emailVerified: verified }).catch(() => {});
  await db.doc(`usernames/${username}`).set({ uid });
  await db.doc(`users/${uid}`).set({ uid, username, displayName: username, role: "reader", accountTier: "standard", createdAt: new Date().toISOString(), ...extra });
}

(async () => {
  await member("amaka", "amaka");
  await member("ada", "ada");
  await member("old", "oldtimer", { createdAt: new Date(Date.now() - 30 * DAY).toISOString() });
  await member("unverified", "newbie", {}, false);
  await member("shop", "stylebyamaka", { role: "publisher", accountTier: "pro" });

  // who can refer: verified, and never yourself
  assert.equal(await referrerByUsername(db, "newbie"), null, "an unverified email can't earn");
  assert.equal(await referrerByUsername(db, "amaka", "amaka"), null, "nor refer themselves");
  assert.deepEqual(await referrerByUsername(db, "AMAKA"), { uid: "amaka", username: "amaka" });

  // a new member is claimed once; an old account isn't
  assert.deepEqual(await claimReferral(db, "ada", "amaka"), { claimed: true });
  assert.equal((await claimReferral(db, "ada", "stylebyamaka")).reason, "already", "the first link wins");
  assert.equal((await claimReferral(db, "old", "amaka")).reason, "too-old");
  assert.equal((await db.doc("users/ada").get()).data()?.referredBy, undefined, "never on the public profile");
  assert.deepEqual(await referralOfferFor(db, "ada"), { referrerUid: "amaka", referrerUsername: "amaka" });

  // the friend's first month: Paystack's subscription starts when it ends, and the card check is given back
  const periodEnd = new Date(Date.now() + 30 * DAY).toISOString();
  await db.doc("tierSubscriptions/ada").set({ uid: "ada", tier: "pro", interval: "monthly", status: "active", currentPeriodEnd: periodEnd, referralFirst: true, subscriptionPending: true });
  await db.doc("payments/CHECK1").set({ reference: "CHECK1", uid: "ada", kind: "tier", amountKobo: 10_000, status: "paid" });
  const calls: string[] = [];
  const started = await startReferralSubscription(db, { reference: "CHECK1", uid: "ada", tier: { interval: "monthly", planCode: "PLN_pro_m", referralFirst: true } },
    { authorization: { authorization_code: "AUTH_x", reusable: true }, customer: { customer_code: "CUS_x" } },
    { create: (async (a: { startDate: string }) => { calls.push(`sub@${a.startDate}`); return { subscription_code: "SUB_1" }; }) as never, refund: (async (r: string) => { calls.push(`refund:${r}`); return {}; }) as never });
  assert.equal(started, "started");
  assert.deepEqual(calls, [`sub@${periodEnd}`, "refund:CHECK1"]);
  assert.equal((await db.doc("tierSubscriptions/ada").get()).data()?.subscriptionCode, "SUB_1");
  assert.equal((await db.doc("payments/CHECK1").get()).data()?.cardCheckRefunded, true);
  await db.doc("referrals/ada").set({ offerUsed: true }, { merge: true });
  assert.equal(await referralOfferFor(db, "ada"), null, "the offer is used once");

  // plan payments: 20% to the referrer for 12 months from the first real one, once per payment
  const t0 = new Date();
  const e1 = await recordPlanEarning(db, "ada", "PLAN1", 500_000, "Pro plan", t0);
  assert.equal(e1?.kobo, 100_000); assert.equal(e1?.uid, "amaka"); assert.equal(e1?.percent, 20);
  assert.equal(await recordPlanEarning(db, "ada", "PLAN1", 500_000, "Pro plan", t0), null, "the same payment twice earns once");
  assert.equal(await recordPlanEarning(db, "ada", "PLAN13", 500_000, "Pro plan", new Date(t0.getTime() + 370 * DAY)), null, "after 12 months, nothing");
  assert.equal(await recordPlanEarning(db, "old", "PLANX", 500_000, "Pro plan", t0), null, "nobody brought them");

  // a publisher opens a download to affiliates at 15%; someone else's product can't be changed
  await db.doc("storeItems/ebook").set({ ownerUid: "shop", title: "Ankara pattern book", priceKobo: 1_000_000, sellable: true, kind: "digital", image: "" });
  await db.doc("storeItems/draft").set({ ownerUid: "shop", title: "Draft", priceKobo: 500_000, sellable: false });
  const yes = async () => true, no = async () => false;
  await rejects(setOffer(db, "amaka", "item", "ebook", 15, no), /your own products/);
  await rejects(setOffer(db, "shop", "item", "draft", 15, yes), /on sale here/);
  await rejects(setOffer(db, "shop", "item", "ebook", 60, yes), /0 to 50/);
  const offer = await setOffer(db, "shop", "item", "ebook", 15, yes);
  assert.equal(offer?.path, "/shop/ebook"); assert.equal(offer?.kind, "digital");
  assert.equal((await listOffers(db)).length, 1);
  assert.deepEqual((await ownProducts(db, "shop")).map((p) => p.itemId), ["ebook"], "only what's on sale");
  assert.equal(await offerPercent(db, offerIdFor("item", "ebook"), "shop"), 15);
  assert.equal(await offerPercent(db, offerIdFor("item", "ebook"), "someone-else"), 0);

  // Ada buys it through Amaka's link, with a code: ₦9,000 paid, Amaka earns 15% of that, out of the publisher's net
  const aff = affiliateFor(await referrerByUsername(db, "amaka", "ada"), { buyerUid: "ada", sellerUid: "shop", percent: 15, paidKobo: 900_000 });
  assert.equal(aff?.kobo, 135_000);
  assert.equal(affiliateFor({ uid: "shop", username: "stylebyamaka" }, { buyerUid: "ada", sellerUid: "shop", percent: 15, paidKobo: 900_000 }), null, "a seller can't earn on their own sale");
  const now = new Date().toISOString();
  await db.doc("payments/DIG1").set({
    reference: "DIG1", kind: "digital", uid: "ada", email: "ada@x.ng", amountKobo: 900_000, status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka",
    commissionRate: 0.1, digital: { itemId: "ebook", itemTitle: "Ankara pattern book", itemImage: "" }, affiliate: aff!, payWith: "wallet", createdAt: now,
  } satisfies PaymentRecord);
  assert.equal((await fulfillPayment("DIG1")).status, "paid");
  const ledger = (await db.doc("ledger/DIG1").get()).data()!;
  assert.deepEqual([ledger.grossKobo, ledger.commissionKobo, ledger.affiliateKobo, ledger.netKobo], [900_000, 90_000, 135_000, 675_000]);
  const pe = (await db.doc("referralEarnings/prod_DIG1").get()).data()!;
  assert.deepEqual([pe.uid, pe.kobo, pe.source, pe.status], ["amaka", 135_000, "digital", "held"]);

  // a refund takes back an earning that hasn't been taken
  await db.doc("referralEarnings/plan_REF9").set({ id: "plan_REF9", uid: "amaka", source: "plan", paymentReference: "REF9", buyerUid: "ada", title: "Pro plan", baseKobo: 500_000, percent: 20, kobo: 100_000, status: "held", releaseAfter: now, createdAt: now });
  assert.equal(await reverseEarningsFor(db, "REF9"), 1);
  assert.equal((await db.doc("referralEarnings/plan_REF9").get()).data()?.status, "reversed");

  // taking it out, after the hold: ₦2,350 is ready (plan ₦1,000 + download ₦1,350)
  const later = new Date(Date.now() + 8 * DAY);
  let s = await summary(db, "amaka", later);
  assert.deepEqual([s.availableKobo, s.pendingKobo, s.friendsJoined, s.payingFriends], [235_000, 0, 1, 1]);
  assert.ok(s.earnings.every((e) => !("buyerUid" in e)), "buyers are never named");
  await rejects(withdraw(db, "amaka", "cash", later, wallet), /bank account/);
  await rejects(withdraw(db, "amaka", "credit", later, { ...wallet, walletLive: false }), /isn't open yet/);
  await db.doc("payoutAccounts/amaka").set({ recipientCode: "RCP_1", bankName: "GTBank", accountLast4: "1234" });
  const cash = await withdraw(db, "amaka", "cash", later, wallet);
  assert.equal(cash.kobo, 235_000);
  const rw = (await db.doc(`ledger/${cash.withdrawalId}`).get()).data()!;
  assert.deepEqual([rw.kind, rw.publisherUid, rw.netKobo, rw.status], ["affiliate", "amaka", 235_000, "held"], "paid by the usual payout run");
  await rejects(withdraw(db, "amaka", "cash", later, wallet), /Nothing is ready/);

  // under ₦2,000: cash waits, Credit doesn't, with 10% more
  await recordPlanEarning(db, "ada", "PLAN2", 500_000, "Pro plan", new Date(t0.getTime() + 31 * DAY));
  const after = new Date(t0.getTime() + 40 * DAY);
  await rejects(withdraw(db, "amaka", "cash", after, wallet), /from ₦2,000/);
  const credit = await withdraw(db, "amaka", "credit", after, wallet);
  assert.deepEqual([credit.kobo, credit.bonusKobo], [100_000, 10_000]);
  const w = (await db.doc("wallets/amaka").get()).data();
  assert.equal(w?.creditKobo, 100_000); assert.equal(w?.bonusLots?.[0]?.kobo, 10_000);
  s = await summary(db, "amaka", after);
  assert.equal(s.paidOutKobo, 335_000); assert.equal(s.withdrawals.length, 2);

  // no cap: a week far past the usual is flagged once
  const sent: string[] = [];
  for (let i = 0; i < 4; i++) await db.doc(`referralEarnings/big_${i}`).set({ id: `big_${i}`, uid: "shop", source: "store", paymentReference: `BIG${i}`, buyerUid: "ada", title: "x", baseKobo: 0, percent: 10, kobo: 2_000_000, status: "held", releaseAfter: now, createdAt: now });
  assert.equal(await alertIfJump(db, "shop", new Date(), async (subject) => { sent.push(subject); }), true);
  assert.equal(await alertIfJump(db, "shop", new Date(), async (subject) => { sent.push(subject); }), false, "once a week");
  assert.deepEqual(sent, ["Referral earnings jumped: @stylebyamaka"]);

  // Step 3: codes typed at a plan's checkout.
  // A member's referral code is their username; it records the referral like their link, for new accounts only.
  await member("bola", "bola");
  await member("chi", "chi");
  await rejects(referralByCode(db, "bola", "nobody-here"), /isn't valid here/);
  assert.deepEqual(await referralByCode(db, "bola", "@AMAKA"), { uid: "amaka", username: "amaka" });
  assert.equal((await db.doc("referrals/bola").get()).data()?.referredBy, "amaka");
  assert.deepEqual(await referralByCode(db, "bola", "amaka"), { uid: "amaka", username: "amaka" }, "the same code again is fine");
  await rejects(referralByCode(db, "bola", "stylebyamaka"), /someone else's invitation/);
  await rejects(referralByCode(db, "old", "amaka"), /first week/);
  await rejects(referralByCode(db, "chi", "chi"), /isn't valid here/);
  // A #NotesApp code on plans: the first payment at its price.
  await saveCode(db, "notesapp", "admin", { create: true, code: "LAUNCH50", kind: "percent", percent: 50, targets: ["plan"] });
  const half = await applyCode(db, "notesapp", "launch50", "chi", { target: "plan", subtotalKobo: 500_000, itemId: "pro" });
  assert.equal(half.discountKobo, 250_000);
  await assert.rejects(applyCode(db, "notesapp", "LAUNCH50", "chi", { target: "boost", subtotalKobo: 500_000 }), (e: unknown) => e instanceof DiscountError && /doesn't work on this/.test(e.message));
  // ...and its subscription starts after that month, on the card, and the payment is never given back (only a card check is).
  const end2 = new Date(Date.now() + 30 * DAY).toISOString();
  await db.doc("tierSubscriptions/chi").set({ uid: "chi", tier: "pro", interval: "monthly", status: "active", currentPeriodEnd: end2, couponFirst: true, subscriptionPending: true });
  await db.doc("payments/COUP1").set({ reference: "COUP1", uid: "chi", kind: "tier", amountKobo: 250_000, status: "paid" });
  const calls2: string[] = [];
  assert.equal(await startReferralSubscription(db, { reference: "COUP1", uid: "chi", tier: { interval: "monthly", planCode: "PLN_pro_m" } },
    { authorization: { authorization_code: "AUTH_y", reusable: true }, customer: { customer_code: "CUS_y" } },
    { create: (async (a: { startDate: string }) => { calls2.push(`sub@${a.startDate}`); return { subscription_code: "SUB_2" }; }) as never, refund: (async (r: string) => { calls2.push(`refund:${r}`); return {}; }) as never }), "started");
  assert.deepEqual(calls2, [`sub@${end2}`], "no refund of a real payment");

  console.log("REFERRALS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
