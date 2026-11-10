// Selling in your local currency on the Firestore emulator (lib/global-sales-server.ts): a seller's currency, what a buyer pays in
// theirs, confirming with the provider (a stand-in), settling a sale (its ledger leaves the naira payout run and the seller's net is owed
// in their currency, once, with the pools told), a basket counted once, and the refund guards. Run inside npm run test:global.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  const S = await import("../../lib/global-pay-server");
  const G = await import("../../lib/global-sales-server");
  const { readerPrice } = await import("../../lib/global-pay");
  const pool = async (c: string) => (await db.doc(`treasuryPools/${c}`).get()).data() ?? {};
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  // A seller's currency: naira until they choose; shillings once they do.
  await db.doc("users/s_ke").set({ username: "wanjiku_shop", accountTier: "pro" });
  assert.equal(await G.sellerCurrency(db, "s_ke"), "NGN");
  await S.saveGlobal(db, "s_ke", { currency: "KES", tiers: {} });
  assert.equal(await G.sellerCurrency(db, "s_ke"), "KES");

  // What a buyer pays: exactly the price in the same currency; converted (with the margin, rounded up) otherwise; refused without rates.
  await db.doc("globalConfig/rates").set({ perUsd: { USD: 1, KES: 130 }, marginPct: 3, reservePct: 10, updatedAt: "2026-01-01T00:00:00.000Z" });
  await assert.rejects(G.saleQuote(db, "KES", "USD", 650_00), /paused/, "stale rates");
  await S.setRates(db, "finance", { perUsd: { KES: 130, NGN: 1600, GHS: 15 }, marginPct: 3 });
  const rates = (await S.getRates(db))!;
  const same = await G.saleQuote(db, "KES", "KES", 650_00);
  assert.equal(same.payMinor, 650_00); assert.equal(same.provider, "flutterwave"); assert.equal(same.marginPct, 0);
  const usd = await G.saleQuote(db, "KES", "USD", 650_00);
  assert.equal(usd.payMinor, readerPrice(650_00, "KES", "USD", rates)); assert.equal(usd.provider, "stripe");
  assert.ok(usd.payMinor >= 500 && usd.payMinor <= 600, `KSh 650 is about $5 (got ${usd.payMinor})`);
  assert.equal((await G.saleQuote(db, "NGN", "GHS", 5_000_00)).provider, "flutterwave");
  assert.equal((await G.saleQuote(db, "KES", "NGN", 650_00)).provider, "paystack", "a naira buyer pays through Paystack");

  // Confirming with the provider: the right currency and at least the amount, or it stays pending (and the mismatch is kept).
  const ref = "na_1700000000001_aaaaaaaaaaaa";
  const global = { ...usd, backUrl: "https://example.test/booking/confirm", providerRef: "cs_test_1" };
  await db.doc(`payments/${ref}`).set({ reference: ref, kind: "digital", uid: "b_us", email: "b@example.test", amountKobo: 650_00, status: "pending", publisherUid: "s_ke", publisherUsername: "wanjiku_shop", commissionRate: 0.1, payWith: "global", currency: "KES", global, createdAt: now.toISOString() });
  const p0 = (await db.doc(`payments/${ref}`).get()).data() as never;
  await assert.rejects(G.confirmSale(db, p0, async () => ({ paid: false, currency: "usd", minor: usd.payMinor })), /not successful/);
  await assert.rejects(G.confirmSale(db, p0, async () => ({ paid: true, currency: "usd", minor: usd.payMinor - 1 })), /does not match/);
  assert.ok((await db.doc(`payments/${ref}`).get()).data()?.mismatch, "the mismatch is kept");
  await assert.rejects(G.confirmSale(db, p0, async () => ({ paid: true, currency: "kes", minor: usd.payMinor })), /does not match/, "the wrong currency");
  await G.confirmSale(db, p0, async () => ({ paid: true, currency: "usd", minor: usd.payMinor, providerRef: "pi_1" }));
  assert.equal((await db.doc(`payments/${ref}`).get()).data()?.global.paymentRef, "pi_1", "the payment intent, for a refund");

  // Settling: not before it's paid; then the ledger leaves the naira payouts and the net is owed in shillings, once.
  await db.doc(`ledger/${ref}`).set({ reference: ref, kind: "digital", publisherUid: "s_ke", publisherUsername: "wanjiku_shop", payerUid: "b_us", grossKobo: 650_00, commissionKobo: 65_00, netKobo: 585_00, status: "held", releaseAfter: later, createdAt: now.toISOString() });
  assert.equal(await G.settleSale(db, ref), 0, "pending: nothing yet");
  // The pools may already hold amounts from the subscriptions test in this run: compare what changes.
  const n = (x: Record<string, unknown>, k: string) => Number(x[k] ?? 0);
  const kesDue0 = n(await pool("KES"), "dueMinor"), usdIn0 = n(await pool("USD"), "inMinor"), ghsIn0 = n(await pool("GHS"), "inMinor"), ngnDue0 = n(await pool("NGN"), "dueMinor");
  await db.doc(`payments/${ref}`).update({ status: "paid" });
  assert.equal(await G.settleSale(db, ref), 1);
  const led = (await db.doc(`ledger/${ref}`).get()).data()!;
  assert.equal(led.status, "global"); assert.equal(led.currency, "KES");
  const earn = (await db.doc(`globalEarnings/${ref}`).get()).data()!;
  assert.equal(earn.currency, "KES"); assert.equal(earn.minor, 585_00); assert.equal(earn.status, "held"); assert.equal(earn.publisherUid, "s_ke");
  assert.ok(earn.releaseAfter >= later, "held at least as long as the sale's own hold");
  assert.equal(n(await pool("KES"), "dueMinor") - kesDue0, 585_00); assert.equal(n(await pool("USD"), "inMinor") - usdIn0, usd.payMinor);
  assert.equal(await G.settleSale(db, ref), 0, "again: nothing more");
  assert.equal(n(await pool("USD"), "inMinor") - usdIn0, usd.payMinor, "the money came in once");
  // The treasury pays it out like any earning in shillings (here recorded by Finance).
  await db.doc(`treasuryPools/KES`).set({ inMinor: 1_000_000_00 }, { merge: true });
  await db.doc(`globalEarnings/${ref}`).update({ releaseAfter: new Date(now.getTime() - 1000).toISOString() });
  await S.payOut(db, "finance", { publisherUid: "s_ke", currency: "KES", via: "recorded", externalRef: "MPESA-123" });
  assert.equal((await db.doc(`globalEarnings/${ref}`).get()).data()?.status, "paid_out");

  // A basket: two orders, one card payment; the buyer's money is counted once, each order's net owed on its own.
  const cart = "na_1700000000002_bbbbbbbbbbbb";
  const gh = { ...(await G.saleQuote(db, "NGN", "GHS", 12_000_00)), backUrl: "https://example.test/booking/confirm" };
  await db.doc(`payments/${cart}`).set({ reference: cart, kind: "store_cart", uid: "b_gh", email: "g@example.test", amountKobo: 12_000_00, status: "paid", publisherUid: "s_ng", publisherUsername: "ada_shop", commissionRate: 0.1, payWith: "global", global: gh, cart: { orders: [`${cart}_1`, `${cart}_2`] }, createdAt: now.toISOString() });
  for (const [i, kobo] of [[1, 7_000_00], [2, 5_000_00]] as const) {
    const r = `${cart}_${i}`;
    await db.doc(`payments/${r}`).set({ reference: r, cartRef: cart, kind: "store", uid: "b_gh", email: "g@example.test", amountKobo: kobo, status: "paid", publisherUid: "s_ng", publisherUsername: "ada_shop", commissionRate: 0.1, payWith: "global", global: gh, createdAt: now.toISOString() });
    await db.doc(`ledger/${r}`).set({ reference: r, kind: "order", publisherUid: "s_ng", publisherUsername: "ada_shop", payerUid: "b_gh", grossKobo: kobo, commissionKobo: kobo / 10, netKobo: kobo - kobo / 10, status: "held", releaseAfter: later, createdAt: now.toISOString() });
    assert.equal(await G.settleSale(db, r), 1);
  }
  assert.equal(await G.settleSale(db, cart), 0, "the basket itself has no ledger of its own");
  assert.equal(n(await pool("GHS"), "inMinor") - ghsIn0, gh.payMinor, "the cedis came in once for the whole basket");
  assert.equal(n(await pool("NGN"), "dueMinor") - ngnDue0, 10_800_00, "a naira seller's net, owed in naira from the treasury");
  assert.equal((await db.doc(`globalEarnings/${cart}_1`).get()).data()?.currency, "NGN");

  // Refunds: never part of a basket or part of a payment here, and never once the seller is paid.
  const child = (await db.doc(`payments/${cart}_1`).get()).data() as never;
  await assert.rejects(G.refundSale(db, child, undefined), /basket/);
  const whole = (await db.doc(`payments/${ref}`).get()).data() as never;
  await assert.rejects(G.refundSale(db, whole, 100_00), /Part refunds/);
  await assert.rejects(G.refundSale(db, whole, undefined), /already been paid/);

  console.log("GLOBAL SALES OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
