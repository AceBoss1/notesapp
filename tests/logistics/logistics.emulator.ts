// The logistics provider network against the Firestore emulator (lib/logistics-server.ts, lib/payments.ts, lib/orders-server.ts): the
// add-on's free trial and a paid month, a provider's listing, the network by state, a store choosing its delivery partner, the partner's
// quote, and a paid order split between the store (goods) and the partner (delivery, less our commission), released together.
// Run: npm run test:logistics-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LogisticsError, accessOf, listProviders, partnerQuote, saveProfile, setPartner, startTrial } from "../../lib/logistics-server";
import { shipmentBusiness } from "../../lib/shipments-server";
import { confirmOrder } from "../../lib/orders-server";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { creditTopup, payFromWallet } from "../../lib/wallet-server";
import type { RateCard } from "../../lib/logistics";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof Error && re.test(e.message)); };
const n = (naira: number[]) => naira.map((x) => x * 100);
const card: RateCard = {
  base: { city: "Ikeja", state: "Lagos" },
  prices: { city: n([1500, 2000, 3000, 4500, 6000]), state: n([2000, 2500, 3500, 5000, 7000]), region: n([3000, 3500, 5000, 7000, 9000]), national: n([4500, 5000, 7000, 9500, 12000]) },
  extraPerKgKobo: { city: 20000, state: 25000, region: 30000, national: 40000 }, sameDayKobo: 0,
};
const profile = { listed: true, about: "Reliable movers", areas: "Ikeja, Jibowu park", coverage: ["Lagos", "Enugu"], services: ["delivery", "waybill"], rateCard: card };
const wallet = async (uid: string, kobo: number) => {
  const top: PaymentRecord = { reference: `top_${uid}`, kind: "wallet_topup", uid, email: `${uid}@x.ng`, amountKobo: kobo, status: "paid", publisherUid: uid, publisherUsername: "", commissionRate: 0, topup: { bonusKobo: 0 }, createdAt: new Date().toISOString() };
  await db.runTransaction((t) => creditTopup(t, db, top, new Date()));
};

(async () => {
  await db.doc("users/frazo").set({ uid: "frazo", username: "frazo", displayName: "Frazo Logistics", role: "publisher", accountTier: "pro" });
  await db.doc("users/apex").set({ uid: "apex", username: "apexglitz", displayName: "Apex Glitz", role: "publisher", accountTier: "basic" });
  await db.doc("users/reader").set({ uid: "reader", username: "reader1", displayName: "Reader", role: "reader", accountTier: "standard" });
  await db.doc("users/big").set({ uid: "big", username: "bigco", displayName: "Big Co", role: "publisher", accountTier: "business" });

  // the add-on's trial: Pro and Free Basic only, once, no card; Business has it on the plan
  assert.deepEqual(await accessOf(db, (await db.doc("users/frazo").get()).data() as never), { ok: false, canTrial: true });
  await fails(saveProfile(db, "frazo", "frazo", profile), /add-on/);
  await fails(shipmentBusiness(db, "frazo", "frazo"), /add-on/);
  const t1 = await startTrial(db, "frazo");
  assert.ok(t1.ok && t1.via === "trial");
  await fails(startTrial(db, "frazo"), /already on/);
  await fails(startTrial(db, "reader"), /Free Basic and Pro/);
  await fails(startTrial(db, "big"), /plan already includes/);
  assert.equal((await shipmentBusiness(db, "frazo", "frazo")).uid, "frazo", "on the trial, Shipments opens");
  console.log("trial ok");

  // the listing, and the network by state (a provider that can't be paid isn't shown)
  const saved = await saveProfile(db, "frazo", "frazo", { ...profile, coverage: ["Enugu", "Lagos", "Mars"] });
  assert.deepEqual(saved.coverage, ["Enugu", "Lagos"]); assert.equal(saved.username, "frazo");
  await fails(saveProfile(db, "apex", "frazo", profile), /can't manage/);
  await fails(saveProfile(db, "frazo", "frazo", { ...profile, coverage: [] }), /states/);
  assert.equal((await listProviders(db, "Enugu")).length, 0, "no payout account yet: not listed");
  await db.doc("payoutAccounts/frazo").set({ recipientCode: "RCP_frazo" });
  assert.deepEqual((await listProviders(db, "Enugu")).map((p) => p.uid), ["frazo"]);
  assert.deepEqual((await listProviders(db, "Kano")).map((p) => p.uid), [], "doesn't cover Kano");
  assert.deepEqual((await listProviders(db)).map((p) => p.uid), ["frazo"]);
  console.log("network ok");

  // a store chooses its delivery partner; the partner's quote for an address
  await fails(setPartner(db, "reader", "reader", "frazo"), /Free Basic/);
  await fails(setPartner(db, "frazo", "apex", "frazo"), /can't change/);
  await fails(setPartner(db, "apex", "apex", "nobody"), /isn't taking stores/);
  const partner = await setPartner(db, "apex", "apex", "frazo");
  assert.equal(partner?.providerUid, "frazo");
  const bells = await db.collection("notifications").where("recipientUid", "==", "frazo").get();
  assert.ok(bells.docs.some((d) => /chose you as their delivery partner/.test(String(d.data().message))));
  const q = await partnerQuote(db, "apex", { city: "Enugu", state: "Enugu" }, 2);
  assert.deepEqual(q, { uid: "frazo", username: "frazo", name: "Frazo Logistics", feeKobo: 500000, cutKobo: 50000 }, "₦5,000 to Enugu for 2 kg; 10% commission from Frazo's earnings");
  assert.equal(await partnerQuote(db, "apex", { city: "Kano", state: "Kano" }, 1), null, "not covered: the store's own fee applies");
  assert.equal((await partnerQuote(db, "apex", { city: "Ikeja", state: "Lagos" }, 0.4))?.cutKobo, 15000, "₦1,500 in the city: 10% is ₦150");
  console.log("partner ok");

  // a paid order: the store gets the goods (less its commission), Frazo the delivery (less ours), both held until delivery is confirmed
  await db.doc("storeItems/bag1").set({ ownerUid: "apex", title: "Tote bag", price: "₦10,000", priceKobo: 1_000_000, deliveryKobo: 150_000, stock: 5, sellable: true, weightKg: 2, image: "", link: "https://x", cta: "Buy now" });
  await wallet("buyer", 5_000_000);
  const address = { fullName: "Ada Obi", phone: "08031234567", street: "12 Allen Avenue", city: "Enugu", state: "Enugu" };
  const order: PaymentRecord = {
    reference: "ord1", kind: "store", uid: "buyer", email: "buyer@x.ng", amountKobo: 1_000_000 + q!.feeKobo, status: "pending", publisherUid: "apex", publisherUsername: "apexglitz",
    commissionRate: 0.06, store: { itemId: "bag1", itemTitle: "Tote bag", itemImage: "", quantity: 1, unitKobo: 1_000_000, deliveryKobo: q!.feeKobo, address, carrier: q! },
    createdAt: new Date().toISOString(),
  };
  await payFromWallet(db, order); await fulfillPayment("ord1");
  const store = (await db.doc("ledger/ord1").get()).data()!;
  assert.equal(store.grossKobo, 1_000_000, "the store's entry is the goods only"); assert.equal(store.commissionKobo, 60_000); assert.equal(store.netKobo, 940_000);
  const ship = (await db.doc("ledger/ord1_ship").get()).data()!;
  assert.equal(ship.kind, "shipping"); assert.equal(ship.publisherUid, "frazo"); assert.equal(ship.paymentReference, "ord1");
  assert.equal(ship.grossKobo, 500_000); assert.equal(ship.commissionKobo, 50_000); assert.equal(ship.netKobo, 450_000);
  assert.equal(store.status, "held"); assert.equal(ship.status, "held");
  const so = (await db.doc("storeOrders/ord1").get()).data()!;
  assert.equal(so.carrier.uid, "frazo"); assert.equal(so.amountKobo, 1_500_000);
  const parcel = (await db.doc(`parcels/${so.parcelId}`).get()).data()!;
  assert.equal(parcel.carrierUid, "frazo"); assert.equal(parcel.sellerUsername, "apexglitz", "tracked on the store's own Track page");
  // delivered and confirmed: both entries are released
  await db.doc("storeOrders/ord1").update({ status: "delivered" });
  await confirmOrder("ord1", "buyer");
  const now = Date.now() + 1000;
  assert.ok(new Date((await db.doc("ledger/ord1").get()).data()!.releaseAfter).getTime() <= now);
  assert.ok(new Date((await db.doc("ledger/ord1_ship").get()).data()!.releaseAfter).getTime() <= now, "the partner is paid with the store");
  console.log("order ok");

  // a month of the add-on, paid from the wallet: it runs on from the end of the trial
  await wallet("frazo", 1_000_000);
  const addon: PaymentRecord = { reference: "addon1", kind: "logistics_addon", uid: "frazo", email: "frazo@x.ng", amountKobo: 450_000, status: "pending", publisherUid: "frazo", publisherUsername: "", commissionRate: 0, createdAt: new Date().toISOString() };
  await payFromWallet(db, addon); await fulfillPayment("addon1");
  const acc = (await db.doc("users/frazo").get()).data()!.logisticsAccount;
  const trialEnd = new Date(acc.trialStartedAt).getTime() + 15 * 86_400_000;
  const until = new Date(acc.addonUntil).getTime();
  assert.ok(until > trialEnd + 27 * 86_400_000 && until < trialEnd + 32 * 86_400_000, "a month after the trial ends");
  const after = await accessOf(db, (await db.doc("users/frazo").get()).data() as never, new Date(trialEnd + 86_400_000));
  assert.ok(after.ok && after.via === "addon", "still a provider after the trial, on the paid month");
  // stopping: a store can go back to its own delivery
  assert.equal(await setPartner(db, "apex", "apex", null), null);
  assert.equal(await partnerQuote(db, "apex", { city: "Enugu", state: "Enugu" }, 2), null);
  assert.ok(LogisticsError);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
