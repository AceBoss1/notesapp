// Global subscriptions end to end on the Firestore emulator (lib/global-pay-server.ts): a US reader subscribes to a Kenyan creator in
// dollars and a Kenyan reader to a Nigerian creator in shillings; earnings are fixed in the creator's currency; the pools, the
// suggested conversion, a recorded conversion, payouts (recorded and through Flutterwave), a refund and the renewal reminder.
// Providers are stand-ins. Run: npm run test:global → "GLOBAL SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
process.env.ACCOUNT_DATA_KEY = Buffer.alloc(32, 7).toString("base64");

(async () => {
  const S = await import("../../lib/global-pay-server");
  const { GlobalPayError, readerPrice, earningOf } = await import("../../lib/global-pay");
  const { commissionRateFor } = await import("../../lib/tiers");
  const refused = async (p: Promise<unknown>, status: number, re?: RegExp) =>
    assert.rejects(p, (e: unknown) => e instanceof GlobalPayError && e.status === status && (!re || re.test(e.message)));
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.map((d) => String(d.data().message));
  const t0 = new Date();
  const day = (n: number) => new Date(t0.getTime() + n * 86_400_000);

  // a Kenyan creator (earns in shillings, Premium KSh 650), a Nigerian creator (₦5,000 Premium on a Paystack plan), three readers
  await db.doc("usernames/wanjiku").set({ uid: "p_ke" }); await db.doc("users/p_ke").set({ username: "wanjiku", accountTier: "pro" });
  await db.doc("usernames/ada").set({ uid: "p_ng" }); await db.doc("users/p_ng").set({ username: "ada", accountTier: "pro" });
  await db.doc("publisherSettings/p_ng").set({ subscription: { enabled: true, priceKobo: 500000, planCode: "PLN_ada", tiers: { premium: { enabled: true, priceKobo: 500000, planCode: "PLN_ada" } } } });
  for (const u of ["r_us", "r_ke", "r_ng"]) await db.doc(`users/${u}`).set({ username: u });
  await S.saveGlobal(db, "p_ke", { currency: "KES", tiers: { premium: { enabled: true, price: 650 } } });
  const rate = commissionRateFor("pro");
  const fake = { urls: [] as string[], checkout: async (p: { reference: string }) => { const u = `https://pay.test/${p.reference}`; fake.urls.push(u); return u; } };
  const paid = (minor: number, currency: string) => async () => ({ paid: true, currency, minor, providerRef: "prov_1" });

  // no exchange rates yet: a dollar quote isn't ready and checkout waits; a shilling reader of the shilling creator needs none
  assert.equal((await S.quote(db, "wanjiku", "USD", t0)).ready, false);
  await refused(S.startCheckout(db, { uid: "r_us", email: "us@x.test" }, { username: "wanjiku", tier: "premium", currency: "USD" }, fake, t0), 503);
  assert.equal((await S.quote(db, "wanjiku", "KES", t0)).tiers[0].payMinor, 65000);
  await S.setRates(db, "fin", { perUsd: { NGN: 1500, KES: 129, GBP: 0.79 }, marginPct: 3, reservePct: 10 }, t0);

  // a US reader: $5.50 through Stripe; the creator earns 80%-ish of KSh 650, fixed in shillings
  const q = await S.quote(db, "wanjiku", "USD", t0);
  assert.equal(q.provider, "stripe"); assert.equal(q.home, "KES"); assert.equal(q.tiers[0].payMinor, 550);
  const us = await S.startCheckout(db, { uid: "r_us", email: "us@x.test" }, { username: "wanjiku", tier: "premium", currency: "USD" }, fake, t0);
  assert.ok(us.url.endsWith(us.reference) && us.reference.startsWith("gp_"));
  await refused(S.fulfilGlobal(db, us.reference, async () => ({ paid: false, currency: "", minor: 0 }), t0), 402);
  await refused(S.fulfilGlobal(db, us.reference, paid(450, "usd"), t0), 409, /doesn't match/); // paid too little: Finance is told
  assert.equal((await db.doc(`globalPayments/${us.reference}`).get()).data()!.status, "pending");
  const p1 = await S.fulfilGlobal(db, us.reference, paid(550, "usd"), t0);
  assert.equal(p1.status, "paid"); assert.equal(p1.earningMinor, earningOf(65000, rate));
  assert.equal((await S.fulfilGlobal(db, us.reference, async () => { throw new Error("not asked twice"); }, t0)).status, "paid", "idempotent");
  const sub = (await db.doc("subscriptions/r_us_wanjiku").get()).data()!;
  assert.equal(sub.status, "active"); assert.equal(sub.tier, "premium"); assert.equal(sub.global.currency, "USD"); assert.ok(!sub.planCode);
  assert.ok((await bells("p_ke")).some((m) => m.includes("paying in USD") && m.includes("KSh")));

  // a Kenyan reader of the Nigerian creator pays shillings through Flutterwave; a Nigerian reader keeps the usual naira checkout
  const kq = await S.quote(db, "ada", "KES", t0);
  assert.equal(kq.provider, "flutterwave"); const kesPrice = readerPrice(500000, "NGN", "KES", { perUsd: { NGN: 1500, KES: 129 }, marginPct: 3 });
  assert.equal(kq.tiers[0].payMinor, kesPrice);
  assert.equal((await S.quote(db, "ada", "NGN", t0)).domestic, true);
  await refused(S.startCheckout(db, { uid: "r_ng", email: "ng@x.test" }, { username: "ada", tier: "premium", currency: "NGN" }, fake, t0), 409, /usual checkout/);
  await refused(S.startCheckout(db, { uid: "p_ng", email: "a@x.test" }, { username: "ada", tier: "premium", currency: "KES" }, fake, t0), 400);
  await refused(S.startCheckout(db, { uid: "r_ke", email: "ke@x.test" }, { username: "ada", tier: "vip", currency: "KES" }, fake, t0), 409);
  const ke = await S.startCheckout(db, { uid: "r_ke", email: "ke@x.test" }, { username: "ada", tier: "premium", currency: "KES" }, fake, t0);
  const p2 = await S.fulfilGlobal(db, ke.reference, paid(kesPrice, "KES"), t0);
  assert.equal(p2.homeCurrency, "NGN"); assert.equal(p2.earningMinor, earningOf(500000, rate));

  // the pools: USD has $5.50 and owes nothing; KES took the Kenyan reader's shillings but owes Wanjiku more; NGN owes Ada with no cash
  let tr = await S.treasury(db, t0);
  const line = (c: string) => tr.lines.find((l) => l.currency === c)!;
  assert.equal(line("USD").cashMinor, 550); assert.equal(line("KES").cashMinor, kesPrice); assert.equal(line("KES").dueMinor, p1.earningMinor);
  assert.equal(line("NGN").dueMinor, p2.earningMinor); assert.ok(line("NGN").shortMinor > 0);
  assert.ok(tr.suggestions.some((s) => s.to === "NGN"), JSON.stringify(tr.suggestions));
  assert.equal(tr.due.length, 0, "earnings are held 7 days first");
  await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "recorded", externalRef: "BANK1" }, {}, t0), 409, /Nothing is due/);

  // after the hold: Wanjiku's KES is due, but the KES pool is short; Finance converts dollars into shillings, then pays
  tr = await S.treasury(db, day(8));
  assert.deepEqual(tr.due.map((d) => [d.publisherUsername, d.currency, d.minor]).sort(), [["ada", "NGN", p2.earningMinor], ["wanjiku", "KES", p1.earningMinor]].sort());
  if (kesPrice < p1.earningMinor) await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "recorded", externalRef: "BANK1" }, {}, day(8)), 409, /Convert into KES/);
  await S.recordConversion(db, "fin", { from: "USD", to: "KES", fromAmount: 4, toAmount: 516, note: "test bank" }, day(8));
  await refused(S.recordConversion(db, "fin", { from: "USD", to: "USD", fromAmount: 1, toAmount: 1 }), 400);
  // through Flutterwave: needs her shilling payout details; the transfer gets the full number, decrypted only for the transfer
  await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "flutterwave" }, { transfer: async () => ({}) }, day(8)), 409, /payout details/);
  await refused(S.savePayoutAccount(db, "p_ke", { currency: "NGN", method: "bank" }), 400);
  const shown = await S.savePayoutAccount(db, "p_ke", { currency: "KES", method: "mobile_money", accountBank: "mps", accountNumber: "+254 712 345 678", accountName: "Wanjiku Kamau" });
  assert.equal(shown.last4, "5678"); assert.equal(shown.accountBank, "MPS"); assert.ok(!JSON.stringify(shown).includes("712345"));
  assert.ok(!String((await db.doc("globalPayoutSecrets/p_ke").get()).data()!.accountNumber).includes("712345"), "stored encrypted");
  // a transfer that fails with an unknown outcome leaves the earnings on hold as "paying", never paid twice
  await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "flutterwave" }, { transfer: async () => { throw new Error("timeout"); } }, day(8)), 502, /Check it on Flutterwave/);
  assert.equal((await db.doc(`globalEarnings/${us.reference}`).get()).data()!.status, "paying");
  await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "recorded", externalRef: "BANK2" }, {}, day(8)), 409, /Nothing is due/);
  await db.doc(`globalEarnings/${us.reference}`).update({ status: "held" }); // Finance checked Flutterwave: nothing was sent
  const sent: { accountNumber: string; amountMajor: number; currency: string }[] = [];
  const po = await S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "flutterwave" }, { transfer: async (t) => { sent.push(t); return {}; } }, day(8));
  assert.equal(po.minor, p1.earningMinor); assert.deepEqual(sent.map((s) => [s.accountNumber, s.currency, s.amountMajor]), [["+254712345678", "KES", p1.earningMinor / 100]]);
  assert.equal((await db.doc(`globalEarnings/${us.reference}`).get()).data()!.status, "paid_out");
  assert.ok((await bells("p_ke")).some((m) => m.includes("on its way")));
  tr = await S.treasury(db, day(8));
  assert.equal(line("KES").dueMinor, 0); assert.equal(line("KES").cashMinor, kesPrice + 51600 - p1.earningMinor);
  await refused(S.payOut(db, "fin", { publisherUid: "p_ke", currency: "KES", via: "recorded", externalRef: "X" }, {}, day(8)), 409, /Nothing is due/);
  // naira through Flutterwave is refused (naira payouts are recorded)
  await refused(S.payOut(db, "fin", { publisherUid: "p_ng", currency: "NGN", via: "flutterwave" }, { transfer: async () => ({}) }, day(8)), 409);

  // a refund of the Kenyan reader's payment: back through the provider, the earning cancelled, the month taken off, the pools put back
  const refunds: string[] = [];
  await S.refundGlobal(db, ke.reference, { refund: async (p) => { refunds.push(p.reference); } }, day(8));
  assert.deepEqual(refunds, [ke.reference]);
  assert.equal((await db.doc(`globalEarnings/${ke.reference}`).get()).data()!.status, "refunded");
  assert.ok(Date.parse(String((await db.doc("subscriptions/r_ke_ada").get()).data()!.currentPeriodEnd)) <= day(8).getTime() + 1000);
  tr = await S.treasury(db, day(8));
  assert.equal(line("NGN").dueMinor, 0); assert.equal(line("KES").cashMinor, 51600 - p1.earningMinor);
  await refused(S.refundGlobal(db, ke.reference, { refund: async () => {} }), 409);
  await refused(S.refundGlobal(db, us.reference, { refund: async () => {} }), 409, /already been paid/);

  // renewal reminder: once, three days before the month ends
  const end = String((await db.doc("subscriptions/r_us_wanjiku").get()).data()!.currentPeriodEnd);
  assert.equal(await S.sendRenewReminders(db, day(20)), 0);
  assert.equal(await S.sendRenewReminders(db, new Date(Date.parse(end) - 2 * 86_400_000)), 1);
  assert.equal(await S.sendRenewReminders(db, new Date(Date.parse(end) - 86_400_000)), 0, "once per month");
  assert.ok((await bells("r_us")).some((m) => m.includes("Renew to keep reading")));
  // renewing adds a month on top (Finance has updated the rates since)
  await S.setRates(db, "fin", { perUsd: { NGN: 1500, KES: 129, GBP: 0.79 }, marginPct: 3, reservePct: 10 }, day(20));
  const again = await S.startCheckout(db, { uid: "r_us", email: "us@x.test" }, { username: "wanjiku", tier: "premium", currency: "USD" }, fake, day(20));
  await S.fulfilGlobal(db, again.reference, paid(550, "usd"), day(20));
  assert.ok(Date.parse(String((await db.doc("subscriptions/r_us_wanjiku").get()).data()!.currentPeriodEnd)) > Date.parse(end) + 30 * 86_400_000);

  // someone already on a monthly Paystack plan is asked to cancel it first; stale rates pause cross-currency checkouts
  await db.doc("subscriptions/r_ng_ada").set({ subscriberUid: "r_ng", username: "ada", planCode: "PLN_ada", status: "active", currentPeriodEnd: day(10).toISOString() });
  await refused(S.startCheckout(db, { uid: "r_ng", email: "ng@x.test" }, { username: "ada", tier: "premium", currency: "GBP" }, fake, t0), 409, /Cancel it first/);
  await refused(S.startCheckout(db, { uid: "r_us", email: "us@x.test" }, { username: "ada", tier: "premium", currency: "USD" }, fake, day(23)), 503);
  // a price under 50 cents is refused
  await refused(S.saveGlobal(db, "p_ke", { currency: "KES", tiers: { premium: { enabled: true, price: 20 } } }), 400, /under \$0\.50/);

  // Finance's nudge: 36 hours after the rates were saved, once; at 48, the pause notice, once; saving new rates starts again
  const told: string[] = [];
  const nudge = { recipients: async () => [{ uid: "fin_1", email: "fin@x.test" }], bell: async (_u: string, m: string) => { told.push(`bell:${m}`); }, email: async (_t: string, subj: string) => { told.push(`mail:${subj}`); } };
  const saved = Date.parse(String((await db.doc("globalConfig/rates").get()).data()!.updatedAt));
  const h = (n: number) => new Date(saved + n * 3_600_000);
  assert.equal(await S.sendRatesReminder(db, h(30), nudge), null);
  assert.equal(await S.sendRatesReminder(db, h(37), nudge), "soon");
  assert.equal(await S.sendRatesReminder(db, h(38), nudge), null, "once");
  assert.equal(await S.sendRatesReminder(db, h(49), nudge), "paused");
  assert.equal(await S.sendRatesReminder(db, h(50), nudge), null);
  assert.ok(told.some((m) => m.startsWith("bell:Exchange rates are 36 hours old")) && told.includes("mail:Paying in other currencies is paused"));
  await S.setRates(db, "fin", { perUsd: { NGN: 1500 } }, h(50));
  assert.equal(await S.sendRatesReminder(db, h(50 + 37), nudge), "soon", "new rates, new reminders");

  console.log("GLOBAL SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
