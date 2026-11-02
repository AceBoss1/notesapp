// Business books against the emulators (lib/books-server.ts): who may keep a seller's books, a walk-in sale with its receipt and the
// stock it lowers, an expense, customers owing and paying back, reminders (email and bell for members, WhatsApp for others, one a day),
// online orders flowing in (and refunds), the Free Basic caps, an import with its dry run and duplicates, and undo.
// Run: npm run test:books-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  BooksError, applyImport, bookOnlineOrder, canUseBooks, catalog, context, entriesView, exportAll, homeView, importsView, owedView, planImport, pnlView,
  publicReceipt, publicStatement, recordExpense, recordPayment, recordSale, remind, saveParty, shareReceipt, stopReminders, supplierPaid, undoImport, voidEntry,
} from "../../lib/books-server";
import { lagosDay } from "../../lib/books";
import { templateCsv } from "../../lib/books-import";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const fails = async (p: Promise<unknown>, status: number, code?: string) => {
  await assert.rejects(p, (e: unknown) => e instanceof BooksError && e.status === status && (!code || e.code === code));
};
const now = new Date();
const today = lagosDay(now);
const later = new Date(Date.parse(`${today}T00:00:00Z`) + 10 * 86_400_000).toISOString().slice(0, 10);

(async () => {
  // Kemi (Free Basic, with the inventory trial), a Pro seller without inventory, an organisation on Business with an admin and a
  // teammate who only runs its store, a stranger, a Free (Standard) member, and Bisi, a customer who is a member.
  const day = 86_400_000;
  await db.doc("users/kemi").set({ uid: "kemi", username: "kemi", displayName: "Kemi's Store & Salon", role: "publisher", accountTier: "basic", avatar: "", inventoryAccount: { trialStartedAt: new Date(now.getTime() - day).toISOString() } });
  await db.doc("users/prox").set({ uid: "prox", username: "prox", displayName: "Pro shop", role: "publisher", accountTier: "pro" });
  await db.doc("users/org").set({ uid: "org", username: "org", displayName: "Org", role: "publisher", accountTier: "business" });
  await db.doc("users/admin1").set({ uid: "admin1", username: "admin1", displayName: "A", role: "publisher", accountTier: "basic" });
  await db.doc("users/staff1").set({ uid: "staff1", username: "staff1", displayName: "S", role: "publisher", accountTier: "basic" });
  await db.doc("users/stranger").set({ uid: "stranger", username: "stranger", displayName: "X", role: "publisher", accountTier: "pro" });
  await db.doc("users/free").set({ uid: "free", username: "free", displayName: "F", role: "reader", accountTier: "standard" });
  await db.doc("users/bisi").set({ uid: "bisi", username: "bisi", displayName: "Bisi", role: "reader", accountTier: "standard" });
  await getAuth().createUser({ uid: "bisi", email: "bisi@example.com" }).catch(() => {});
  await db.doc("orgMembers/org_admin1").set({ orgUid: "org", memberUid: "admin1", role: "admin" });
  await db.doc("orgMembers/org_staff1").set({ orgUid: "org", memberUid: "staff1", role: "member", store: true });
  await db.doc("storeItems/rice").set({ ownerUid: "kemi", title: "Rice 10kg (Mama Gold)", sellable: true, kind: "physical", stock: 18, priceKobo: 1_500_000 });
  await db.doc("storeItems/garri").set({ ownerUid: "kemi", title: "Garri, white (paint bucket)", sellable: true, kind: "physical", stock: 40, priceKobo: 250_000 });
  await db.doc("inventory/rice").set({ ownerUid: "kemi", sku: "RICE-MG-10", variantSku: {}, costKobo: 1_280_000, lowAt: 3 });

  // ---- Permissions: the seller, and an organisation's admins; nobody else ----
  assert.equal(await canUseBooks(db, "kemi", "kemi"), true);
  assert.equal(await canUseBooks(db, "stranger", "kemi"), false);
  assert.equal(await canUseBooks(db, "admin1", "org"), true, "an organisation's admin");
  assert.equal(await canUseBooks(db, "staff1", "org"), false, "a teammate who only runs the store doesn't see the books");
  await fails(context(db, "stranger", "kemi"), 403);
  await fails(context(db, "free", "free"), 402);
  await db.doc("users/org").update({ accountTier: "basic" });
  assert.equal(await canUseBooks(db, "admin1", "org"), false, "only while the organisation is on a team plan");
  await db.doc("users/org").update({ accountTier: "business" });
  const orgCtx = await context(db, "admin1", "org");
  assert.equal(orgCtx.access.unlimited, true);

  // ---- A walk-in sale: inventory items and a typed one, part paid, the rest owed ----
  const k = await context(db, "kemi", "kemi", now);
  assert.equal(k.inventory, true); assert.equal(k.access.unlimited, false);
  const cat = await catalog(k);
  assert.deepEqual(cat.map((x) => [x.ref, x.stock]), [["i:garri:", 40], ["i:rice:", 18]]);
  const sale = await recordSale(k, {
    clientId: "sale-0001", method: "cash", owes: true, paidKobo: 1_300_000, dueOn: later,
    party: { name: "Alhaji Musa Danladi", phone: "0803 123 4417" },
    lines: [{ ref: "i:rice:", qty: 2, unitKobo: 1_500_000 }, { ref: "i:garri:", qty: 2, unitKobo: 250_000 }, { title: "Knotless braids", qty: 1, unitKobo: 0 }],
  });
  assert.equal(sale.entry.totalKobo, 3_500_000); assert.equal(sale.entry.owesKobo, 2_200_000); assert.equal(sale.entry.open, true);
  assert.equal(sale.entry.lines[0].costKobo, 1_280_000); assert.equal(sale.entry.lines[1].noCost, true, "garri has no cost price yet");
  assert.match(sale.receiptUrl, /\/receipt\/[2-9A-HJKMNP-Z]{10}$/);
  // Stock went down through Inventory's moves (reason sale, with the entry's reference).
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, 16);
  assert.equal((await db.doc("storeItems/garri").get()).data()!.stock, 38);
  const moves = await db.collection("inventoryMoves").where("bookRef", "==", sale.entry.id).get();
  assert.deepEqual(moves.docs.map((d) => [d.data().reason, d.data().delta]).sort(), [["sale", -2], ["sale", -2]]);
  // The same sale sent twice (a double tap, or a phone retrying) is saved once.
  const again = await recordSale(k, { clientId: "sale-0001", method: "cash", lines: [{ title: "x", qty: 1, unitKobo: 100 }] });
  assert.equal(again.duplicate, true); assert.equal(again.entry.id, sale.entry.id);
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, 16, "not twice");
  // The receipt: the shop, the lines, what's owed; never a phone number.
  const code = sale.receiptUrl.split("/").pop()!;
  const r = await publicReceipt(db, code);
  assert.equal(r!.shopName, "Kemi's Store & Salon"); assert.equal(r!.owesKobo, 2_200_000); assert.equal(r!.customer, "Musa");
  assert.ok(!/0803|4417|234803/.test(JSON.stringify(r)), "no phone numbers on the receipt");
  assert.equal(await publicReceipt(db, "NOTACODE00"), null);
  // Bad sales are refused with a reason.
  await fails(recordSale(k, { method: "cash", lines: [] }), 400);
  await fails(recordSale(k, { method: "cheque", lines: [{ title: "x", qty: 1, unitKobo: 100 }] }), 400);
  await fails(recordSale(k, { method: "cash", lines: [{ title: "x", qty: 1.5, unitKobo: 100 }] }), 400);
  await fails(recordSale(k, { method: "cash", owes: true, paidKobo: 0, lines: [{ title: "x", qty: 1, unitKobo: 100 }] }), 400, undefined);
  await fails(recordSale(k, { method: "cash", lines: [{ ref: "i:nope:", qty: 1, unitKobo: 100 }] }), 400);

  // ---- An expense ----
  const exp = await recordExpense(k, { clientId: "exp-00001", amountKobo: 1_800_000, method: "cash", category: "power", note: "Diesel for the generator" });
  assert.equal(exp.kind, "expense"); assert.equal(exp.category, "power");
  const exp2 = await recordExpense(k, { amountKobo: 50_000, method: "transfer", category: "Generator repairs" });
  assert.equal(exp2.category, "generator repairs");
  assert.ok(((await db.doc("bookSettings/kemi").get()).data()!.categories as { label: string }[]).some((c) => c.label === "Generator repairs"), "a new category is kept");
  await fails(recordExpense(k, { amountKobo: 0, method: "cash" }), 400);
  await fails(recordExpense(k, { amountKobo: 100, method: "cash", on: later }), 400);

  // ---- Online orders flow in: one sale per paid order, a refund next to it, never twice ----
  await db.doc("storeOrders/NA-4821").set({ reference: "NA-4821", sellerUid: "kemi", itemId: "rice", itemTitle: "Rice 10kg (Mama Gold)", quantity: 1, unitKobo: 1_500_000, deliveryKobo: 200_000, amountKobo: 1_700_000, commissionKobo: 75_000, status: "paid", paidAt: now.toISOString() });
  assert.equal(await bookOnlineOrder(db, "NA-4821"), 1);
  assert.equal(await bookOnlineOrder(db, "NA-4821"), 0, "idempotent");
  const online = (await db.doc("bookEntries/online_NA-4821").get()).data()!;
  assert.equal(online.source, "online"); assert.equal(online.totalKobo, 1_700_000); assert.equal(online.feeKobo, 75_000); assert.equal(online.counts, false);
  assert.equal(online.lines[0].costKobo, 1_280_000);
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, 16, "the order moved its own stock; Books doesn't move it again");
  // An order from before Books was opened comes in when the home screen loads; a refund too.
  await db.doc("storeOrders/NA-4700").set({ reference: "NA-4700", sellerUid: "kemi", itemId: "garri", itemTitle: "Garri", quantity: 2, unitKobo: 250_000, amountKobo: 500_000, commissionKobo: 25_000, carrier: { uid: "x" }, deliveryKobo: 0, status: "refunded", paidAt: now.toISOString() });
  const home = await homeView(k);
  assert.ok((await db.doc("bookEntries/online_NA-4700").get()).exists && (await db.doc("bookEntries/online_NA-4700_refund").get()).exists);
  // Today: 3,500 walk-in + 17,000 + 5,000 online − 5,000 refunded; costs 2×12,800 + 12,800; expenses 18,000 + 500; commission 750 (+250 − 250).
  assert.equal(home.pnl.salesKobo, 3_500_000 + 1_700_000 + 500_000);
  assert.equal(home.pnl.refundsKobo, 500_000);
  assert.equal(home.pnl.costKobo, 3 * 1_280_000);
  assert.equal(home.pnl.expensesKobo, 1_850_000); assert.equal(home.pnl.commissionKobo, 75_000);
  assert.equal(home.pnl.netKobo, 5_700_000 - 500_000 - 3_840_000 - 1_850_000 - 75_000);
  assert.equal(home.cash.inKobo, 1_300_000, "only the cash paid now"); assert.equal(home.cash.outKobo, 1_800_000);
  assert.equal(home.owed.totalKobo, 2_200_000); assert.equal(home.owed.people, 1);
  assert.equal(home.cap.used, 3, "two expenses and one walk-in sale; online orders don't count");
  assert.equal(home.noCostItems, 1);
  assert.equal(home.entries.length, 6);
  assert.ok(home.entries.every((e) => (e.files ?? []).every((f) => !("key" in f))), "no private file keys in the page");

  // ---- Money owed: pay back in part, then reminders ----
  const musa = (await owedView(k)).debtors[0];
  assert.equal(musa.openKobo, 2_200_000); assert.equal(musa.party.phoneMasked, "0803 ··· 4417");
  assert.ok(!("phone" in musa.party && musa.party.phone), "the page gets the masked number only");
  await fails(recordPayment(k, { partyId: musa.party.id, amountKobo: 9_000_000, method: "cash" }), 400);
  const pay = await recordPayment(k, { clientId: "pay-00001", partyId: musa.party.id, amountKobo: 1_000_000, method: "transfer" });
  assert.equal(pay.kind, "payment");
  assert.equal((await db.doc(`bookEntries/${sale.entry.id}`).get()).data()!.settledKobo, 1_000_000);
  assert.equal((await db.doc(`bookParties/${musa.party.id}`).get()).data()!.balanceKobo, 1_200_000);
  assert.equal((await publicReceipt(db, code))!.owesKobo, 1_200_000, "the receipt shows what's still owed");
  await fails(voidEntry(k, sale.entry.id, "mistake"), 409);
  // WhatsApp for a customer who isn't a member: the link, with the #NotesApp line; recorded as "WhatsApp opened".
  const wa = await remind(k, musa.party.id, "whatsapp");
  assert.ok(wa.url!.startsWith("https://wa.me/2348031234417?text="));
  assert.match(decodeURIComponent(wa.url!.split("text=")[1]), /₦12,000 [\s\S]*\n\nSent with #NotesApp Business books\. Keep your own books free: [a-z.]+\/books$/);
  await fails(remind(k, musa.party.id, "whatsapp"), 429, "daily");
  await fails(remind(k, musa.party.id, "email"), 429, "daily");
  const rems = await db.collection("bookReminders").where("partyId", "==", musa.party.id).get();
  assert.deepEqual(rems.docs.map((d) => d.data().channel), ["whatsapp_link"]);
  // A member: email and the bell. A non-member can't get email.
  const bisi = await saveParty(k, { kind: "customer", name: "Mama Bisi", username: "@bisi" });
  assert.equal(bisi.memberUid, "bisi");
  await recordSale(k, { method: "cash", owes: true, paidKobo: 0, partyId: bisi.id, lines: [{ ref: "i:rice:", qty: 3, unitKobo: 1_500_000 }] });
  const em = await remind(k, bisi.id, "email");
  assert.equal(em.channel, "email");
  const bell = await db.collection("notifications").where("recipientUid", "==", "bisi").get();
  assert.ok(bell.docs.some((d) => d.data().type === "books" && /₦45,000/.test(d.data().message)));
  await fails(saveParty(k, { kind: "customer", name: "X", username: "nobody-here" }), 400);
  assert.equal((await saveParty(k, { kind: "customer", name: "Musa D.", phone: "+234 803 123 4417" })).id, musa.party.id, "the same number is the same customer");
  // The customer stops reminders from the statement link: email stops, WhatsApp asks the seller first.
  const bisiParty = (await db.doc(`bookParties/${bisi.id}`).get()).data()!;
  const st = await publicStatement(db, bisiParty.statementCode);
  assert.equal(st!.customer, "Bisi"); assert.equal(st!.owesKobo, 4_500_000);
  assert.equal(await stopReminders(db, bisiParty.statementCode), true);
  await db.doc(`bookParties/${bisi.id}`).update({ lastRemindedOn: "" });
  await fails(remind(k, bisi.id, "email"), 409, "reminders_off");
  // Receipt by WhatsApp to a number typed for a walk-in customer.
  const walk = await recordSale(k, { method: "pos", lines: [{ title: "Knotless braids, medium", qty: 1, unitKobo: 2_500_000 }] });
  const rcpt = await shareReceipt(k, walk.entry.id, "whatsapp", "08099998888");
  assert.ok(rcpt.url!.startsWith("https://wa.me/2348099998888?text=Thank%20you"));
  assert.ok(decodeURIComponent(rcpt.url!).includes("/receipt/"));
  // Suppliers: a simple list of what you owe.
  const sup = await saveParty(k, { kind: "supplier", name: "Alhaji Sani Rice Depot", balanceKobo: 26_500_000, dueOn: later });
  assert.equal((await supplierPaid(k, sup.id, 6_500_000)).balanceKobo, 20_000_000);
  // Void: a walk-in sale goes back on the shelf.
  await voidEntry(k, walk.entry.id, "entered twice");
  const riceBefore = (await db.doc("storeItems/rice").get()).data()!.stock;
  const quick = await recordSale(k, { method: "cash", lines: [{ ref: "i:rice:", qty: 1, unitKobo: 1_500_000 }] });
  await voidEntry(k, quick.entry.id, "wrong item");
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, riceBefore, "stock back after a void");
  assert.equal((await publicReceipt(db, quick.receiptUrl.split("/").pop()!))!.voided, true);
  await fails(voidEntry(k, "online_NA-4821", "x"), 400);

  // ---- P&L: day and week on Free Basic, the month on Pro ----
  const wk = await pnlView(k, "week", 0);
  assert.equal(wk.bars.length, 7);
  assert.equal(wk.separate.stockCounted, true);
  assert.ok(wk.separate.stockKobo > 0 && wk.pnl.netKobo !== wk.pnl.netKobo + wk.separate.stockKobo, "stock value is its own number");
  await fails(pnlView(k, "month", 0), 402, "month_pnl");
  const pro = await context(db, "prox", "prox");
  assert.equal((await pnlView(pro, "month", 0)).kind, "month");
  assert.equal(pro.inventory, false);
  assert.equal((await catalog(pro)).length, 0);
  const sales = await entriesView(k, "sale", "day", 0);
  assert.ok(sales.entries.every((e) => e.kind === "sale" || e.kind === "refund"));

  // ---- The Free Basic caps (from lib/pricing.ts): entries a month, customers owing ----
  await db.doc("bookSettings/kemi").set({ usage: { month: today.slice(0, 7), entries: 149 } }, { merge: true });
  const k2 = await context(db, "kemi", "kemi");
  await recordExpense(k2, { amountKobo: 100, method: "cash", category: "other" });
  await fails(recordExpense(k2, { amountKobo: 100, method: "cash", category: "other" }), 402, "entries_cap");
  await fails(recordSale(k2, { method: "cash", lines: [{ title: "x", qty: 1, unitKobo: 100 }] }), 402, "entries_cap");
  // Customers paying back and online orders still go in when the cap is reached.
  await recordPayment(k2, { partyId: musa.party.id, amountKobo: 100_000, method: "cash" });
  await db.doc("storeOrders/NA-5000").set({ reference: "NA-5000", sellerUid: "kemi", itemId: "garri", itemTitle: "Garri", quantity: 1, unitKobo: 250_000, amountKobo: 250_000, commissionKobo: 0, status: "paid", paidAt: now.toISOString() });
  assert.equal(await bookOnlineOrder(db, "NA-5000"), 1);
  // Last month's count doesn't carry over.
  await db.doc("bookSettings/kemi").set({ usage: { month: "2000-01", entries: 150 } }, { merge: true });
  const k3 = await context(db, "kemi", "kemi");
  // 20 customers owing at most on Free Basic: two owe now; make it 20, then the 21st is refused.
  for (let i = 0; i < 18; i++) await db.collection("bookParties").add({ ownerUid: "kemi", kind: "customer", name: `C${i}`, balanceKobo: 100, createdAt: "" });
  await fails(recordSale(k3, { method: "cash", owes: true, paidKobo: 0, party: { name: "Customer 21" }, lines: [{ title: "x", qty: 1, unitKobo: 100 }] }), 402, "customers_cap");
  await recordSale(k3, { method: "cash", owes: true, paidKobo: 0, partyId: musa.party.id, lines: [{ title: "x", qty: 1, unitKobo: 100 }] });
  for (const d of (await db.collection("bookParties").where("ownerUid", "==", "kemi").get()).docs) if (/^C\d+$/.test(d.data().name)) await d.ref.delete();

  // ---- Import: dry run, duplicates, import, undo ----
  // Sales (a Tralo export): one is already in the books, one was on credit.
  const tralo = `date,time,product_name,quantity,unit_price,customer_name,customer_phone,payment_method,amount_paid,apply_taxes,notes
2026-10-12,14:05,Rice 10kg (Mama Gold),3,15000,Chinedu Okafor,08030000001,credit,10000,no,
2026-10-12,09:00,Garri,2,2500,,,cash,5000,no,
2026-10-12,09:00,Garri,2,2500,,,cash,5000,no,
2026-10-13,10:00,Ankara,1,18000,,,mobile money,18000,no,`;
  const dry = await planImport(k3, { kind: "sales", csv: tralo, preset: "tralo-sales" });
  assert.deepEqual(dry.plan.counts, { fresh: 3, updates: 0, dupes: 1, problems: 0 });
  assert.ok(dry.plan.notes.some((n) => /goes to Money owed to you/.test(n.message)));
  assert.equal((await db.collection("bookEntries").where("importId", "!=", "").get()).size, 0, "a dry run saves nothing");
  const imp = await applyImport(k3, { kind: "sales", csv: tralo, preset: "tralo-sales", fileName: "tralo-sales.csv" });
  assert.equal(imp.created.entries, 3); assert.equal(imp.created.parties, 1);
  const chinedu = (await db.collection("bookParties").where("ownerUid", "==", "kemi").where("name", "==", "Chinedu Okafor").get()).docs[0];
  assert.equal(chinedu.data().balanceKobo, 3_500_000);
  const imported = await db.collection("bookEntries").where("importId", "==", imp.importId).get();
  assert.ok(imported.docs.every((d) => d.data().counts === false && d.data().source === "import"), "imports never count toward the cap and send nothing");
  assert.equal(imported.docs.find((d) => d.data().lines[0].title.startsWith("Rice"))!.data().lines[0].costKobo, 1_280_000, "matched to the item's cost");
  const again2 = await planImport(k3, { kind: "sales", csv: tralo, preset: "tralo-sales" });
  assert.equal(again2.plan.counts.dupes, 4, "importing the same file again finds every row already there");
  // Undo: the entries and the customer it made go; balances are worked out again.
  assert.equal((await importsView(k3))[0].canUndo, true);
  await undoImport(k3, imp.importId);
  assert.equal((await db.collection("bookEntries").where("importId", "==", imp.importId).get()).size, 0);
  assert.equal((await db.doc(`bookParties/${chinedu.id}`).get()).exists, false);
  await fails(undoImport(k3, imp.importId), 409);
  // Stock list: the store item by SKU (through Inventory), a Books-only item for the new one; undo puts the count back.
  const stockCsv = `Product Name,Barcode,Category,Cost Price,Selling Price,Stock Quantity,Unit
Rice 10kg Mama Gold,RICE-MG-10,Foodstuff,12800,15000,30,bag
Ofada rice (paint bucket),OFADA-PB,Foodstuff,7000,9500,9,bucket
Ofada rice (paint bucket),OFADA-PB,Foodstuff,7000,9500,9,bucket
Bad row,,Foodstuff,7000,9500,-2,bag`;
  const sp = await planImport(k3, { kind: "stock", csv: stockCsv, preset: "tralo-stock" });
  assert.equal(sp.plan.counts.problems, 1);
  await fails(applyImport(k3, { kind: "stock", csv: stockCsv }), 400);
  const fixed = stockCsv.split("\n").slice(0, 4).join("\n");
  const sp2 = await planImport(k3, { kind: "stock", csv: fixed });
  assert.deepEqual(sp2.plan.counts, { fresh: 1, updates: 1, dupes: 1, problems: 0 });
  const riceNow = (await db.doc("storeItems/rice").get()).data()!.stock;
  const si = await applyImport(k3, { kind: "stock", csv: fixed, fileName: "stock.csv" });
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, 30);
  const ofada = (await db.collection("bookItems").where("ownerUid", "==", "kemi").get()).docs[0];
  assert.equal(ofada.data().stock, 9); assert.equal(ofada.data().priceKobo, 950_000);
  assert.ok((await catalog(k3)).some((x) => x.bookItemId === ofada.id), "a Books-only item can be sold from Record a sale");
  // Sold from Books: its own stock goes down.
  await recordSale(k3, { method: "cash", lines: [{ ref: `b:${ofada.id}`, qty: 2, unitKobo: 950_000 }] });
  assert.equal((await db.doc(`bookItems/${ofada.id}`).get()).data()!.stock, 7);
  await undoImport(k3, si.importId);
  assert.equal((await db.doc("storeItems/rice").get()).data()!.stock, riceNow, "the count goes back");
  assert.equal((await db.collection("bookItems").where("ownerUid", "==", "kemi").get()).size, 0);
  // Stock lists need Inventory; a Pro seller without it can still import expenses and customers.
  await fails(planImport(pro, { kind: "stock", csv: fixed }), 402, "inventory");
  const ci = await applyImport(pro, { kind: "customers", csv: templateCsv("customers") });
  assert.equal(ci.created.parties, 1); assert.equal(ci.created.entries, 1, "an opening balance");
  assert.equal((await owedView(pro)).totals.owedKobo, 3_850_000);
  const ei = await applyImport(pro, { kind: "expenses", csv: templateCsv("expenses") });
  assert.equal(ei.created.entries, 1);
  assert.equal((await planImport(pro, { kind: "expenses", csv: templateCsv("expenses") })).plan.counts.dupes, 1);
  // Free Basic: 500 rows a file at most.
  const big = "date,amount\n" + Array.from({ length: 501 }, (_, i) => `2026-10-01,${i + 1}`).join("\n");
  await fails(planImport(k3, { kind: "expenses", csv: big }), 402, "import_rows");
  assert.equal((await planImport(pro, { kind: "expenses", csv: big })).plan.counts.fresh, 501);

  // ---- Export: everything, as CSV ----
  const files = await exportAll(k3);
  assert.deepEqual(files.map((f) => f.name), ["sales.csv", "expenses.csv", "payments-received.csv", "money-owed-to-you.csv", "money-you-owe.csv", "stock.csv"]);
  assert.ok(files[0].csv.includes("Knotless braids") && files[4].csv.includes("Alhaji Sani Rice Depot"));

  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
