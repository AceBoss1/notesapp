// A basket (lib/cart.ts) settled against the Firestore emulator (lib/payments.ts fulfillPayment, lib/refunds.ts): each line becomes its
// own store order, parcel and held ledger entry; delivery sits on the first; the basket is marked paid once; running it again changes
// nothing; one message goes to the buyer (and at most one to the seller); and the basket itself can't be refunded in one go.
// Run: npm run test:cart-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { refundPayment } from "../../lib/refunds";
import { cartAmounts, cartChildRef } from "../../lib/cart";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

(async () => {
  await db.doc("users/shop").set({ uid: "shop", username: "stylebyamaka", displayName: "Style by Amaka", role: "publisher", accountTier: "pro" });
  await db.doc("users/buyer").set({ uid: "buyer", username: "ada", displayName: "Ada", role: "reader", accountTier: "standard" });
  // stock as it is after checkout reserved it: 5 − 2 dresses, and 3 − 1 sandals in size 40
  await db.doc("storeItems/dress").set({ ownerUid: "shop", title: "Ankara dress", price: "₦35,000", priceKobo: 3_500_000, deliveryKobo: 250_000, stock: 3, sellable: true, image: "", link: "", cta: "Buy" });
  await db.doc("storeItems/sandal").set({ ownerUid: "shop", title: "Sandals", price: "₦22,000", priceKobo: 2_200_000, deliveryKobo: 150_000, stock: 2, variantStock: { "40": 2 }, options: [{ name: "Size", choices: ["39", "40"] }], sellable: true, image: "", link: "", cta: "Buy" });
  const address = { fullName: "Ada Obi", phone: "08031234567", street: "12 Allen Avenue", city: "Ikeja", state: "Lagos" };
  const ref = "CART1";
  const amounts = cartAmounts([{ unitKobo: 3_500_000, quantity: 2 }, { unitKobo: 2_200_000, quantity: 1 }], 250_000);
  const now = new Date().toISOString();
  const orders: PaymentRecord[] = [
    { reference: cartChildRef(ref, 0), cartRef: ref, kind: "store", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[0], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka", commissionRate: 0.06,
      store: { itemId: "dress", itemTitle: "Ankara dress", itemImage: "", quantity: 2, unitKobo: 3_500_000, deliveryKobo: 250_000, address }, reservedUntil: now, createdAt: now },
    { reference: cartChildRef(ref, 1), cartRef: ref, kind: "store", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[1], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka", commissionRate: 0.06,
      store: { itemId: "sandal", itemTitle: "Sandals", itemImage: "", quantity: 1, variant: "40", variantLabel: "Size: 40", unitKobo: 2_200_000, deliveryKobo: 0, address }, reservedUntil: now, createdAt: now },
  ];
  for (const o of orders) await db.doc(`payments/${o.reference}`).set(o);
  // payWith "wallet" here only stands in for "the card payment was checked" (it skips asking Paystack); real baskets are paid by card.
  const basket: PaymentRecord = { reference: ref, kind: "store_cart", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[0] + amounts[1], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka", commissionRate: 0.06, cart: { orders: orders.map((o) => o.reference) }, payWith: "wallet", createdAt: now };
  await db.doc(`payments/${ref}`).set(basket);
  assert.equal(basket.amountKobo, 2 * 3_500_000 + 2_200_000 + 250_000, "goods plus one delivery");

  // an order can only be settled through its own basket
  await assert.rejects(fulfillPayment(cartChildRef(ref, 0), { cartRef: "OTHER" }), /isn't part of this basket/);

  const paid = await fulfillPayment(ref);
  assert.equal(paid.status, "paid");
  for (const [i, o] of orders.entries()) {
    assert.equal((await db.doc(`payments/${o.reference}`).get()).data()!.status, "paid", `order ${i + 1} paid`);
    const so = (await db.doc(`storeOrders/${o.reference}`).get()).data()!;
    assert.equal(so.cartRef, ref); assert.equal(so.status, "paid"); assert.equal(so.amountKobo, amounts[i]);
    assert.ok((await db.doc(`parcels/${so.parcelId}`).get()).exists, "each order has its parcel");
    const led = (await db.doc(`ledger/${o.reference}`).get()).data()!;
    assert.equal(led.status, "held"); assert.equal(led.grossKobo, amounts[i]);
  }
  assert.equal((await db.doc(`storeOrders/${cartChildRef(ref, 0)}`).get()).data()!.deliveryKobo, 250_000, "delivery on the first order");
  assert.equal((await db.doc(`storeOrders/${cartChildRef(ref, 1)}`).get()).data()!.deliveryKobo, 0);
  assert.equal((await db.doc(`storeOrders/${cartChildRef(ref, 1)}`).get()).data()!.variantLabel, "Size: 40");
  assert.equal((await db.doc(`ledger/${ref}`).get()).exists, false, "the basket itself holds no money");
  // sales in the inventory history, one per order
  const sales = await db.collection("inventoryMoves").where("orderRef", "in", orders.map((o) => o.reference)).get();
  assert.equal(sales.size, 2);
  console.log("settled ok");

  // again: nothing changes
  const before = (await db.collection("storeOrders").get()).size;
  assert.equal((await fulfillPayment(ref)).status, "paid");
  assert.equal((await db.collection("storeOrders").get()).size, before);

  // one bell each for the buyer and the seller, for the whole basket
  const bells = async (uid: string) => (await db.collection("notifications").where("recipientUid", "==", uid).get()).docs.filter((d) => d.data().type === "order");
  assert.equal((await bells("buyer")).length, 1, "one confirmation for the buyer");
  // The seller's message needs their email from Auth, which this Firestore-only run doesn't have: never more than one, and never one per item.
  assert.ok((await bells("shop")).length <= 1, "at most one new-order message for the seller");

  // the basket can't be refunded whole; its orders are refunded one by one
  await assert.rejects(refundPayment(ref), /one by one/);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
