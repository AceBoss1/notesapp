// Inventory against the emulators (lib/inventory-server.ts): who may use it, the trial, stock changes with their history, an import, the
// sale and refund records, and the low-stock alert. Run: npm run test:inventory-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { InventoryError, adjustStock, applyImport, historyOf, lowStockAlert, readInventory, recordReturn, recordSale, saveDetails, startInventoryTrial } from "../../lib/inventory-server";
import { planImport } from "../../lib/inventory";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number) => { await assert.rejects(p, (e: unknown) => e instanceof InventoryError && e.status === status); };

(async () => {
  await db.doc("users/pro").set({ uid: "pro", username: "shop", displayName: "Shop", role: "publisher", accountTier: "business" });
  await db.doc("users/prox").set({ uid: "prox", username: "prox", displayName: "Pro shop", role: "publisher", accountTier: "pro" });
  await db.doc("users/fb").set({ uid: "fb", username: "fb", displayName: "FB", role: "publisher", accountTier: "basic" });
  await db.doc("users/stranger").set({ uid: "stranger", username: "x", displayName: "X", role: "publisher", accountTier: "pro" });
  await db.doc("storeItems/bag").set({ ownerUid: "pro", title: "Tote bag", sellable: true, kind: "physical", stock: 5, priceKobo: 1_000_000 });
  await db.doc("storeItems/tee").set({ ownerUid: "pro", title: "T-shirt", sellable: true, kind: "physical", options: [{ name: "Size", values: ["M", "L"] }], variantStock: { M: 2, L: 3 }, stock: 5, priceKobo: 500_000 });
  await db.doc("storeItems/ebook").set({ ownerUid: "pro", title: "E-book", sellable: true, kind: "digital", priceKobo: 100_000 });
  await db.doc("storeItems/fbitem").set({ ownerUid: "fb", title: "Cap", sellable: true, kind: "physical", stock: 1, priceKobo: 300_000 });

  // Business: on the plan; digital items aren't stock; someone else's store is off limits.
  const r = await readInventory(db, "pro", "pro");
  assert.equal(r.access.ok, true); assert.deepEqual(r.lines.map((l) => `${l.itemId}${l.variant ? `:${l.variant}` : ""}=${l.stock}`).sort(), ["bag=5", "tee:L=3", "tee:M=2"]);
  await fails(readInventory(db, "stranger", "pro"), 403);
  // Free Basic: needs the trial or the add-on; the trial is once.
  await fails(readInventory(db, "fb", "fb"), 402);
  assert.equal((await startInventoryTrial(db, "fb")).ok, true);
  assert.equal((await readInventory(db, "fb", "fb")).lines.length, 1);
  await fails(startInventoryTrial(db, "fb"), 409);
  await fails(startInventoryTrial(db, "pro"), 409);
  // Pro: the add-on too.
  await fails(readInventory(db, "prox", "prox"), 402);
  assert.equal((await startInventoryTrial(db, "prox")).ok, true);

  // Details and stock changes, with the history.
  await saveDetails(db, "pro", "pro", "bag", { sku: "tote-1", costKobo: 600_000, lowAt: 2 });
  assert.equal((await db.doc("inventory/bag").get()).data()!.sku, "TOTE-1");
  assert.equal((await adjustStock(db, "pro", "pro", "bag", { mode: "add", amount: 10, reason: "restock", note: "Invoice 42" })).stock, 15);
  assert.equal((await adjustStock(db, "pro", "pro", "bag", { mode: "add", amount: -100, reason: "damaged" })).stock, 0, "never below 0");
  await adjustStock(db, "pro", "pro", "bag", { mode: "set", amount: 4 });
  await fails(adjustStock(db, "pro", "pro", "tee", { mode: "add", amount: 1 }), 400);
  assert.equal((await adjustStock(db, "pro", "pro", "tee", { variant: "M", mode: "add", amount: 3 })).stock, 5);
  assert.equal((await db.doc("storeItems/tee").get()).data()!.stock, 8, "the item's total follows its options");
  await fails(adjustStock(db, "pro", "pro", "ebook", { mode: "add", amount: 1 }), 404);
  const h = await historyOf(db, "pro", "pro", "bag");
  assert.deepEqual(h.map((m) => [m.reason, m.delta, m.after]), [["count", 4, 4], ["damaged", -15, 0], ["restock", 10, 15]]);
  assert.equal(h[2].note, "Invoice 42");

  // An import: plan, then apply.
  const { lines } = await readInventory(db, "pro", "pro");
  const plan = planImport("item_id,option,stock,cost_naira\nbag,,9,6500\ntee,L,1,\n", lines);
  assert.equal(plan.problems.length, 0);
  assert.equal(await applyImport(db, "pro", "pro", plan.changes), 2);
  assert.equal((await db.doc("storeItems/bag").get()).data()!.stock, 9);
  assert.equal((await db.doc("inventory/bag").get()).data()!.costKobo, 650_000);
  assert.equal((await db.doc("storeItems/tee").get()).data()!.variantStock.L, 1);

  // A sale (as fulfillPayment does: stock already taken at checkout), the alert, and a refund.
  await db.doc("storeItems/bag").update({ stock: 2 });
  await db.runTransaction(async (t) => { recordSale(t, db, { ownerUid: "pro", itemId: "bag", quantity: 7, after: 2, buyerUid: "buyer", orderRef: "ref1", at: new Date().toISOString() }); });
  assert.equal(await lowStockAlert(db, { ownerUid: "pro", itemId: "bag", quantity: 7 }), true, "9 → 2 crosses the low level of 2");
  const bell = await db.collection("notifications").where("recipientUid", "==", "pro").get();
  assert.ok(bell.docs.some((d) => /running low: 2 left/.test(d.data().message)));
  await db.doc("storeItems/bag").update({ stock: 1 });
  assert.equal(await lowStockAlert(db, { ownerUid: "pro", itemId: "bag", quantity: 1 }), false, "already low: no second alert");
  await recordReturn(db, { ownerUid: "pro", itemId: "bag", quantity: 1, by: "refund", orderRef: "ref1" });
  const all = await historyOf(db, "pro", "pro");
  assert.equal(all[0].reason, "return"); assert.equal(all[1].reason, "sale"); assert.equal(all[1].delta, -7);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
