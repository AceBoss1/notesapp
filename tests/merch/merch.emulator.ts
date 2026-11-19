// Merch in 3D on the server, against the Firestore emulator: Admin saves merch settings through the pricing settings (logged), the
// store and checkout read them, a paid order with a custom shirt and a name is fulfilled into merchOrders and a parcel, and the print
// sheet groups paid orders of the batch.
// Run: npm run test:merch-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEFAULT_PRICING } from "../../lib/pricing";
import { ensurePricing, savePricing } from "../../lib/pricing-server";
import { MERCH_BATCH, currentMerch, merchBatchState, merchDeliveryKobo, merchOrderInfo, quoteMerch, type MerchOrder } from "../../lib/merch";
import { fulfillPayment, type PaymentRecord } from "../../lib/payments";
import { printCsv, printRows } from "../../components/merch/PrintSheet";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const owner = { uid: "u_owner", email: "owner@x.ng", owner: true, super: false };
const address = { fullName: "Ada Obi", phone: "08031234567", street: "12 Zik Avenue", city: "Enugu", state: "Enugu" };

(async () => {
  // Admin → Merch → Settings: Batch 2, a new delivery fee, the shirts' prices.
  const merch = { ...currentMerch(), batch: { label: "Batch 2", opensOn: "2026-11-18", closesOn: "2026-12-15", note: "Printed after 15 December." }, deliveryKobo: 3_500_00 };
  await assert.rejects(savePricing(db, { ...owner, owner: false }, { ...DEFAULT_PRICING, merch }), /owner and super admins/);
  const { changes } = await savePricing(db, owner, { ...DEFAULT_PRICING, merch });
  assert.ok(changes.includes("merch.deliveryKobo: 300000 → 350000"));
  assert.ok(changes.some((c) => c.startsWith("merch.batch.label")));
  const log = (await db.collection("pricingLog").get()).docs.map((d) => d.data());
  assert.ok(log.some((l) => l.byEmail === "owner@x.ng" && (l.changes as string[]).some((c) => c.startsWith("merch."))), "logged with who changed it");
  await ensurePricing(db, Date.now() + 60_000);
  assert.equal(MERCH_BATCH.label, "Batch 2");
  assert.equal(merchDeliveryKobo(), 3_500_00);
  assert.equal(merchBatchState(Date.parse("2026-11-20T10:00:00+01:00")), "open");

  // Checkout's quote and record for a custom shirt with a name, and a crimson T-shirt printed front and back.
  const shirt = quoteMerch({ product: "design:black-drip", size: "XL", name: "Ada 10", quantity: 2 });
  const tee = quoteMerch({ product: "item:tshirt", colour: "crimson", logoId: "core", place: "both", size: "M", quantity: 1 });
  const pay = (reference: string, q: ReturnType<typeof quoteMerch>): PaymentRecord => ({
    reference, kind: "merch", uid: "u_ada", email: "ada@x.ng", amountKobo: q.quote.subtotalKobo + q.quote.deliveryKobo, status: "pending",
    publisherUid: "u_ada", publisherUsername: "", commissionRate: 0, merch: merchOrderInfo(q, address), payWith: "wallet", createdAt: new Date().toISOString(),
  });
  assert.equal(pay("M1", shirt).amountKobo, 2 * 11_500_00 + 3_500_00);
  await db.doc("payments/M1").set(pay("M1", shirt));
  await db.doc("payments/M2").set(pay("M2", tee));
  assert.equal((await fulfillPayment("M1")).status, "paid");
  assert.equal((await fulfillPayment("M2")).status, "paid");

  const o1 = (await db.doc("merchOrders/M1").get()).data() as MerchOrder & { lines: unknown };
  assert.deepEqual([o1.itemName, o1.designId, o1.backName, o1.size, o1.quantity, o1.batchId, o1.status], ["Custom shirt: Black Drip", "black-drip", "ADA 10", "XL", 2, "batch-2", "preordered"]);
  assert.deepEqual(o1.lines, [{ label: "Custom shirt: Black Drip", kobo: 10_000_00 }, { label: "Name on the back: ADA 10", kobo: 1_500_00 }]);
  assert.equal((await db.doc(`parcels/${o1.parcelId}`).get()).exists, true, "the buyer can track it");
  const o2 = (await db.doc("merchOrders/M2").get()).data() as MerchOrder & { unitKobo: number };
  assert.deepEqual([o2.colour, o2.colourName, o2.place, o2.logoLabel, o2.unitKobo], ["crimson", "Crimson", "both", "Core Mark", 14_500_00]);
  assert.equal(((await db.doc("payments/M1").get()).data() as PaymentRecord).status, "paid");

  // The print sheet: one row per identical piece, only this batch's paid, unprinted orders.
  const orders = (await db.collection("merchOrders").get()).docs.map((d) => d.data() as MerchOrder);
  orders.push({ ...o2, reference: "OLD", batchId: "batch-1" }, { ...o2, reference: "M3", quantity: 3 }, { ...o2, reference: "DONE", status: "printed" });
  const rows = printRows(orders, MERCH_BATCH.id);
  assert.deepEqual(rows.map((r) => [r.item, r.text, r.size, r.name, r.count, r.refs.length]), [
    ["Custom shirt: Black Drip", "", "XL", "ADA 10", 2, 1],
    ["T-Shirt", "Crimson · Core Mark · Front and back", "M", "", 4, 2],
  ]);
  assert.ok(rows[0].picture.endsWith("black-drip.webp"));
  const csv = printCsv(rows).split("\n");
  assert.equal(csv[0], '"Item","Colour, logo and place","Size","Name on the back","How many","Orders"');
  assert.equal(csv[2], '"T-Shirt","Crimson · Core Mark · Front and back","M","","4","M2 M3"');

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
