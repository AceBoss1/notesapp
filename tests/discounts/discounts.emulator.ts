// Discount codes end to end on the Firestore emulator (lib/discounts-server.ts, lib/payments.ts): an owner makes a code, a buyer's
// basket is priced with it, the orders carry their share, commission is worked out on what was paid, and the code's totals move once.
// Run: npm run test:discounts-server → "DISCOUNTS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { cartAmounts, cartChildRef } from "../../lib/cart";
import { DiscountError, spreadDiscount } from "../../lib/discounts";
import { applyCode, listCodes, paymentDiscount, recentUses, saveCode, setCodeActive } from "../../lib/discounts-server";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof DiscountError && re.test(e.message));

(async () => {
  await db.doc("users/shop").set({ uid: "shop", username: "stylebyamaka", displayName: "Style by Amaka", role: "publisher", accountTier: "pro" });
  await db.doc("users/buyer").set({ uid: "buyer", username: "ada", displayName: "Ada", role: "reader", accountTier: "standard" });
  await db.doc("storeItems/dress").set({ ownerUid: "shop", title: "Ankara dress", priceKobo: 3_500_000, deliveryKobo: 250_000, stock: 3, sellable: true, image: "", link: "", cta: "Buy" });
  await db.doc("storeItems/bag").set({ ownerUid: "shop", title: "Bag", priceKobo: 2_200_000, deliveryKobo: 0, stock: 2, sellable: true, image: "", link: "", cta: "Buy" });

  // the owner makes a code; the same code twice is refused on create
  const c = await saveCode(db, "shop", "shop", { create: true, code: "amaka10", kind: "percent", percent: 10, targets: ["store", "digital"], maxUses: 3 });
  assert.equal(c.id, "shop_AMAKA10"); assert.equal(c.uses, 0);
  await rejects(saveCode(db, "shop", "shop", { create: true, code: "AMAKA10", kind: "percent", percent: 5, targets: ["store"] }), /already have that code/);
  await saveCode(db, "shop", "shop", { code: "AMAKA10", kind: "percent", percent: 10, targets: ["store", "digital"], maxUses: 3, perBuyer: 1 });
  assert.equal((await listCodes(db, "shop")).length, 1, "an edit keeps one code");

  // where it can't be used
  await rejects(applyCode(db, "shop", "AMAKA10", "shop", { target: "store", subtotalKobo: 3_500_000 }), /your own code/);
  await rejects(applyCode(db, "notesapp", "AMAKA10", "buyer", { target: "boost", subtotalKobo: 500_000 }), /from a store on #NotesApp/);
  await rejects(applyCode(db, "shop", "NOPE", "buyer", { target: "store", subtotalKobo: 3_500_000 }), /isn't valid here/);
  await rejects(applyCode(db, "shop", "AMAKA10", "buyer", { target: "course", subtotalKobo: 3_500_000 }), /doesn't work on this/);

  // a basket: 2 dresses and a bag, ₦92,000 of goods, ₦2,500 delivery; 10% off the goods only
  const goods = [2 * 3_500_000, 2_200_000];
  const a = await applyCode(db, "shop", "amaka10", "buyer", { target: "store", subtotalKobo: goods[0] + goods[1], itemIds: ["dress", "bag"], extraKobo: 250_000 });
  assert.equal(a.discountKobo, 920_000);
  const lineOff = spreadDiscount(goods, a.discountKobo);
  const full = cartAmounts([{ unitKobo: 3_500_000, quantity: 2 }, { unitKobo: 2_200_000, quantity: 1 }], 250_000);
  const amounts = full.map((x, i) => x - lineOff[i]);
  const address = { fullName: "Ada Obi", phone: "08031234567", street: "12 Allen Avenue", city: "Ikeja", state: "Lagos" };
  const ref = "DISC1"; const now = new Date().toISOString();
  const orders: PaymentRecord[] = [
    { reference: cartChildRef(ref, 0), cartRef: ref, kind: "store", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[0], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka", commissionRate: 0.05,
      store: { itemId: "dress", itemTitle: "Ankara dress", itemImage: "", quantity: 2, unitKobo: 3_500_000, discountKobo: lineOff[0], deliveryKobo: 250_000, address }, reservedUntil: now, createdAt: now },
    { reference: cartChildRef(ref, 1), cartRef: ref, kind: "store", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[1], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka", commissionRate: 0.05,
      store: { itemId: "bag", itemTitle: "Bag", itemImage: "", quantity: 1, unitKobo: 2_200_000, discountKobo: lineOff[1], deliveryKobo: 0, address }, reservedUntil: now, createdAt: now },
  ];
  for (const o of orders) await db.doc(`payments/${o.reference}`).set(o);
  // payWith "wallet" only stands in for "the card payment was checked" (it skips asking Paystack), as in tests/cart.
  await db.doc(`payments/${ref}`).set({
    reference: ref, kind: "store_cart", uid: "buyer", email: "ada@x.ng", amountKobo: amounts[0] + amounts[1], status: "pending", publisherUid: "shop", publisherUsername: "stylebyamaka",
    commissionRate: 0.05, cart: { orders: orders.map((o) => o.reference) }, payWith: "wallet", discount: paymentDiscount(a, full[0] + full[1]), createdAt: now,
  } satisfies PaymentRecord);
  assert.equal((await fulfillPayment(ref)).status, "paid");

  for (const [i, o] of orders.entries()) {
    const so = (await db.doc(`storeOrders/${o.reference}`).get()).data()!;
    assert.equal(so.amountKobo, amounts[i], `order ${i + 1}: the lower price`);
    assert.equal(so.commissionKobo, Math.round((goods[i] - lineOff[i]) * 0.05), `order ${i + 1}: commission on what was paid for the goods`);
  }
  const red = (await db.doc(`discountRedemptions/${ref}`).get()).data()!;
  assert.deepEqual([red.code, red.owner, red.uid, red.discountKobo, red.paidKobo], ["AMAKA10", "shop", "buyer", 920_000, amounts[0] + amounts[1]]);
  let code = (await listCodes(db, "shop"))[0];
  assert.deepEqual([code.uses, code.discountGivenKobo, code.revenueKobo], [1, 920_000, amounts[0] + amounts[1]], "the code's totals move once");
  assert.equal((await fulfillPayment(ref)).status, "paid");
  code = (await listCodes(db, "shop"))[0];
  assert.equal(code.uses, 1, "settling again counts nothing twice");
  const uses = await recentUses(db, "shop");
  assert.equal(uses.length, 1); assert.equal("uid" in uses[0], false, "owners never see who used it");

  // once per member; used up; paused
  await rejects(applyCode(db, "shop", "AMAKA10", "buyer", { target: "store", subtotalKobo: 3_500_000, itemId: "dress" }), /already used/);
  await db.doc("users/b2").set({ uid: "b2", username: "bola", displayName: "Bola" });
  assert.equal((await applyCode(db, "shop", "AMAKA10", "b2", { target: "digital", subtotalKobo: 1_000_000 })).discountKobo, 100_000);
  await db.doc("discountCodes/shop_AMAKA10").update({ uses: 3 });
  await rejects(applyCode(db, "shop", "AMAKA10", "b2", { target: "store", subtotalKobo: 3_500_000 }), /used up/);
  await db.doc("discountCodes/shop_AMAKA10").update({ uses: 1 });
  await setCodeActive(db, "shop", "amaka10", false);
  await rejects(applyCode(db, "shop", "AMAKA10", "b2", { target: "store", subtotalKobo: 3_500_000 }), /isn't active/);

  // first order only: Ada has now paid this shop
  await saveCode(db, "shop", "shop", { create: true, code: "NEWHERE", kind: "amount", amountKobo: 200_000, targets: ["store"], firstOrderOnly: true });
  await rejects(applyCode(db, "shop", "NEWHERE", "buyer", { target: "store", subtotalKobo: 3_500_000 }), /first order/);
  assert.equal((await applyCode(db, "shop", "NEWHERE", "b2", { target: "store", subtotalKobo: 3_500_000 })).discountKobo, 200_000);

  // #NotesApp's own codes work only on our products
  await saveCode(db, "notesapp", "staff", { create: true, code: "BOOST20", kind: "percent", percent: 20, targets: ["boost", "nana_credit"] });
  assert.equal((await applyCode(db, "notesapp", "boost20", "buyer", { target: "boost", subtotalKobo: 500_000 })).discountKobo, 100_000);
  await rejects(applyCode(db, "shop", "BOOST20", "buyer", { target: "store", subtotalKobo: 500_000 }), /#NotesApp coupon, for #NotesApp's own products\. Input a coupon from this store/);
  console.log("DISCOUNTS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
