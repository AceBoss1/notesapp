// Business books, the pure parts (lib/books.ts, lib/books-import.ts): kobo maths, periods, the P&L, cash in hand, the Free Basic caps,
// paying back oldest first, the debtors list, the WhatsApp messages, and CSV reading, column matching and duplicates.
// Run: npm run test:books → "ALL OK".
import assert from "node:assert/strict";
import {
  booksAccess, canAddDebtor, capState, cashInHand, changePct, countsTowardCap, debtors, firstName, footnote, isDay, lagosDay, linesCost, linesTotal,
  maskPhone, naira, periodOf, pnl, receiptText, reminderText, settleFifo, toKobo, usageFor, waLink, waPhone, whatOf, type Entry, type Party,
} from "../../lib/books";
import { FIELDS, PRESETS, csvOf, customerKey, dedupe, expenseKey, guessMapping, missingRequired, parseDay, parseMethod, readRows, readSheet, saleKey, templateCsv, cleanMapping, type Sheet } from "../../lib/books-import";
import { DEFAULT_PRICING } from "../../lib/pricing";

const caps = DEFAULT_PRICING.books;
let n = 0;
const entry = (e: Partial<Entry>): Entry => ({ id: `e${n++}`, ownerUid: "kemi", kind: "sale", source: "walkin", on: "2026-11-01", at: "2026-11-01T10:00:00.000Z", by: "kemi", lines: [], totalKobo: 0, paidKobo: 0, method: "cash", owesKobo: 0, settledKobo: 0, open: false, ...e });

// ---- Kobo: integers in and out, no float drift ----
assert.equal(naira(4_500_000), "₦45,000");
assert.equal(naira(50), "₦0.50");
assert.equal(naira(-1_800_000), "−₦18,000");
assert.equal(naira(123_456_789), "₦1,234,567.89");
assert.equal(toKobo("₦1,500"), 150_000);
assert.equal(toKobo("1500.5"), 150_050);
assert.equal(toKobo("0.1"), 10);
assert.equal(toKobo(" 12,800 "), 1_280_000);
assert.equal(toKobo("fifteen k"), null);
assert.equal(toKobo("-5"), null);
assert.equal(toKobo("1.234"), null, "kobo is two places at most");
assert.equal(toKobo(19.99), 1999, "a number is rounded to the kobo");
// 0.1 + 0.2 in naira would drift; in kobo it's exact.
assert.equal(linesTotal([{ qty: 3, unitKobo: 10 }, { qty: 1, unitKobo: 20 }]), 50);
assert.equal(linesTotal([{ qty: 3, unitKobo: 1_500_000 }, { qty: 2, unitKobo: 250_000 }]), 5_000_000);
assert.equal(linesCost([{ qty: 3, costKobo: 1_280_000 }, { qty: 2, costKobo: 0 }]), 3_840_000);

// ---- Lagos days and periods ----
assert.equal(lagosDay(new Date("2026-11-01T23:30:00Z")), "2026-11-02", "after 11 pm UTC it's tomorrow in Lagos");
assert.equal(lagosDay(new Date("2026-11-01T22:59:00Z")), "2026-11-01");
assert.ok(isDay("2026-02-28") && !isDay("2026-02-30") && !isDay("2026-2-1"));
assert.deepEqual(periodOf("day", "2026-11-01"), { kind: "day", start: "2026-11-01", end: "2026-11-01", label: "Sunday 1 November" });
assert.equal(periodOf("day", "2026-11-01", 7).start, "2026-10-25", "the same day last week");
const wk = periodOf("week", "2026-11-01"); // a Sunday: the week is Monday 26 Oct to Sunday 1 Nov
assert.equal(wk.start, "2026-10-26"); assert.equal(wk.end, "2026-11-01");
assert.equal(periodOf("week", "2026-11-02").start, "2026-11-02", "Monday starts a week");
assert.equal(periodOf("week", "2026-11-02", 1).start, "2026-10-26");
assert.deepEqual(periodOf("month", "2026-11-02", 1), { kind: "month", start: "2026-10-01", end: "2026-10-31", label: "October 2026" });
assert.equal(periodOf("month", "2026-01-15", 1).label, "December 2025", "back across a year");
assert.equal(periodOf("month", "2028-02-10").end, "2028-02-29", "a leap February");

// ---- Who has it, and the caps ----
assert.deepEqual(booksAccess("standard", caps).ok, false, "Free members who don't sell switch to Free Basic first");
const basic = booksAccess("basic", caps), pro = booksAccess("pro", caps);
assert.ok(basic.ok && !basic.unlimited && !basic.monthPnl && basic.importRows === 500);
assert.ok(pro.ok && pro.unlimited && pro.monthPnl && pro.importRows === 5000);
assert.ok(booksAccess("business", caps).ok && booksAccess("enterprise", caps).ok);
assert.equal(booksAccess("pro", caps, true).ok, false, "a suspended account can't");
assert.equal(usageFor({ month: "2026-10", entries: 150 }, "2026-11"), 0, "the count starts again on the 1st");
assert.equal(usageFor({ month: "2026-11", entries: 149 }, "2026-11"), 149);
assert.deepEqual(capState(basic, caps, 149), { unlimited: false, used: 149, limit: 150, left: 1, full: false });
assert.equal(capState(basic, caps, 150).full, true);
assert.equal(capState(pro, caps, 10_000).full, false, "Pro has no cap");
assert.equal(capState(basic, { ...caps, freeEntries: 200 }, 150).full, false, "the cap is whatever admin pricing says");
assert.ok(countsTowardCap({ kind: "sale", source: "walkin" }) && countsTowardCap({ kind: "expense", source: "walkin" }));
assert.ok(!countsTowardCap({ kind: "sale", source: "online" }), "online orders never count");
assert.ok(!countsTowardCap({ kind: "sale", source: "import" }) && !countsTowardCap({ kind: "payment", source: "walkin" }));
assert.equal(canAddDebtor(basic, caps, 19, false), true);
assert.equal(canAddDebtor(basic, caps, 20, false), false, "the 21st customer owing is refused on Free Basic");
assert.equal(canAddDebtor(basic, caps, 20, true), true, "someone already owing can owe more");
assert.equal(canAddDebtor(pro, caps, 500, false), true);

// ---- P&L ----
const rice = { itemId: "rice", title: "Rice 10kg", qty: 3, unitKobo: 1_500_000, costKobo: 1_280_000 };
const garri = { itemId: "garri", title: "Garri", qty: 2, unitKobo: 250_000, costKobo: 0, noCost: true };
const day = [
  entry({ lines: [rice], totalKobo: 4_500_000, paidKobo: 2_000_000, owesKobo: 2_500_000, open: true, partyId: "bisi", dueOn: "2026-11-15" }),
  entry({ lines: [garri], totalKobo: 500_000, paidKobo: 500_000 }),
  entry({ lines: [{ title: "Knotless braids", qty: 1, unitKobo: 2_500_000, costKobo: 0 }], totalKobo: 2_500_000, paidKobo: 2_500_000, method: "pos" }),
  entry({ source: "online", lines: [{ itemId: "ankara", title: "Ankara", qty: 1, unitKobo: 1_800_000, costKobo: 1_200_000 }], totalKobo: 1_800_000, paidKobo: 1_800_000, method: "card", feeKobo: 90_000, orderRef: "NA-1" }),
  entry({ kind: "expense", totalKobo: 1_800_000, paidKobo: 1_800_000, category: "power", note: "Diesel" }),
  entry({ kind: "expense", totalKobo: 300_000, paidKobo: 300_000, category: "transport", method: "transfer" }),
  entry({ kind: "payment", totalKobo: 1_000_000, paidKobo: 1_000_000, partyId: "chinedu" }),
  entry({ kind: "sale", lines: [rice], totalKobo: 4_500_000, paidKobo: 4_500_000, voidedAt: "2026-11-01T11:00:00Z" }),
];
const p = pnl(day);
assert.equal(p.salesKobo, 9_300_000); assert.equal(p.walkinKobo, 7_500_000); assert.equal(p.onlineKobo, 1_800_000);
assert.equal(p.sales, 4, "a voided sale isn't counted"); assert.equal(p.onlineSales, 1);
assert.equal(p.costKobo, 3 * 1_280_000 + 1_200_000);
assert.equal(p.grossKobo, 9_300_000 - 5_040_000);
assert.equal(p.expensesKobo, 2_100_000); assert.equal(p.commissionKobo, 90_000);
assert.equal(p.netKobo, 9_300_000 - 5_040_000 - 2_100_000 - 90_000);
assert.equal(p.marginPct, 45.8);
assert.deepEqual(p.byCategory.map((c) => c.id), ["power", "transport", "commission"]);
assert.equal(p.byCategory[2].label, "#NotesApp commission (online orders)");
assert.equal(p.noCostItems, 1, "garri has no cost price yet (the braids are a service, typed in, so they don't count)");
assert.equal(p.best[0].title, "Rice 10kg"); assert.equal(p.best[0].profitKobo, 3 * (1_500_000 - 1_280_000));
// A refund takes the sale, its cost and our commission back out.
const refunded = pnl([day[3], entry({ kind: "refund", source: "online", lines: day[3].lines, totalKobo: 1_800_000, feeKobo: 90_000, orderRef: "NA-1" })]);
assert.equal(refunded.netKobo, 0); assert.equal(refunded.refundsKobo, 1_800_000); assert.equal(refunded.commissionKobo, 0);
assert.equal(pnl([]).marginPct, null);
assert.equal(changePct(11_200, 10_000), 12); assert.equal(changePct(5, 0), null);

// ---- Cash in hand: honest about where the money is ----
const cash = cashInHand(day, 500_000);
assert.equal(cash.inKobo, 2_000_000 + 500_000 + 1_000_000, "cash paid now on sales, and a customer paying back in cash");
assert.equal(cash.outKobo, 1_800_000, "only cash expenses leave the drawer");
assert.equal(cash.drawerKobo, 500_000 + 3_500_000 - 1_800_000);
assert.equal(cash.posKobo, 2_500_000); assert.equal(cash.onlineKobo, 1_800_000, "online money is paid out by #NotesApp, not in the drawer");

// ---- Paying back, oldest first ----
const open = [{ id: "b", at: "2026-10-20T10:00:00Z", openKobo: 500_000 }, { id: "a", at: "2026-10-12T10:00:00Z", openKobo: 3_000_000 }];
assert.deepEqual(settleFifo(open, 3_200_000), { applied: [{ id: "a", kobo: 3_000_000 }, { id: "b", kobo: 200_000 }], overKobo: 0 });
assert.deepEqual(settleFifo(open, 4_000_000).overKobo, 500_000);
assert.deepEqual(settleFifo(open, 0).applied, []);

// ---- Debtors: late first ----
const party = (id: string, name: string, extra: Partial<Party> = {}): Party => ({ id, ownerUid: "kemi", kind: "customer", name, balanceKobo: 0, createdAt: "", ...extra });
const owedEntries = [
  entry({ partyId: "chinedu", on: "2026-10-12", lines: [{ title: "Ankara (6 yards)", qty: 1, unitKobo: 3_850_000, costKobo: 0 }], totalKobo: 3_850_000, owesKobo: 3_850_000, open: true, dueOn: "2026-10-27" }),
  entry({ partyId: "bisi", on: "2026-11-01", lines: [rice], totalKobo: 4_500_000, owesKobo: 4_500_000, settledKobo: 500_000, open: true, dueOn: "2026-11-15" }),
  entry({ partyId: "funke", on: "2026-10-13", lines: [{ title: "Braids", qty: 1, unitKobo: 950_000, costKobo: 0 }], totalKobo: 950_000, owesKobo: 950_000, open: true, dueOn: "2026-10-20" }),
];
const rows = debtors([party("chinedu", "Chinedu Okafor"), party("bisi", "Mama Bisi"), party("funke", "Funke Alade"), party("sup", "Alhaji Sani", { kind: "supplier", balanceKobo: 9 })], owedEntries, "2026-11-01");
assert.deepEqual(rows.map((r) => r.party.id), ["funke", "chinedu", "bisi"], "the longest late first, then due soonest");
assert.equal(rows[0].daysLate, 12); assert.equal(rows[1].daysLate, 5);
assert.equal(rows[2].openKobo, 4_000_000, "what's been paid back comes off");
assert.equal(rows[1].overdueKobo, 3_850_000); assert.equal(rows[2].overdueKobo, 0);

// ---- WhatsApp: the number, the link and the messages, each ending with the #NotesApp line ----
assert.equal(waPhone("0803 123 4417"), "2348031234417");
assert.equal(waPhone("+234 803 123 4417"), "2348031234417");
assert.equal(waPhone("2340803 123 4417"), "2348031234417", "a 0 after the country code is dropped");
assert.equal(waPhone("8031234417"), "2348031234417");
assert.equal(waPhone("+44 7700 900123"), "447700900123");
assert.equal(waPhone("12345"), null); assert.equal(waPhone(""), null);
assert.equal(maskPhone("2348031234417"), "0803 ··· 4417");
assert.equal(firstName("Alhaji Musa Danladi"), "Musa"); assert.equal(firstName("Mama Bisi (Bisi Adebayo)"), "Bisi"); assert.equal(firstName("Chinedu Okafor"), "Chinedu");
assert.equal(footnote("naapp.tech"), "Sent with #NotesApp Business books. Keep your own books free: naapp.tech/books");
const rem = reminderText({ customer: "Chinedu Okafor", shop: "Kemi's Store & Salon", amountKobo: 3_850_000, what: "Ankara (6 yards) and garri", since: "2026-10-12", dueOn: "2026-10-27", today: "2026-11-01", link: "https://www.naapp.tech/statement/K7Q2M9ABCD", domain: "naapp.tech" });
assert.equal(rem, "Hello Chinedu, a friendly reminder from Kemi's Store & Salon: ₦38,500 for Ankara (6 yards) and garri, since 12 Oct, was due on 27 Oct. See the details: https://www.naapp.tech/statement/K7Q2M9ABCD\n\nSent with #NotesApp Business books. Keep your own books free: naapp.tech/books");
assert.ok(reminderText({ customer: "Bisi", shop: "S", amountKobo: 1, what: "x", since: "2026-11-01", dueOn: "2026-11-15", today: "2026-11-01", link: "L", domain: "notesapp.name.ng" }).includes("is due on 15 Nov"));
assert.ok(reminderText({ customer: "Bisi", shop: "S", amountKobo: 1, what: "x", since: "2026-11-01", today: "2026-11-01", link: "L", domain: "notesapp.name.ng" }).endsWith("Keep your own books free: notesapp.name.ng/books"), "the domain is whatever the primary domain is");
const rec = receiptText({ customer: "Alhaji Musa Danladi", shop: "Kemi's", totalKobo: 3_500_000, what: whatOf([{ title: "Rice 10kg", qty: 2 }, { title: "Garri", qty: 2 }]), paidKobo: 1_300_000, method: "cash", owesKobo: 2_200_000, dueOn: "2026-11-03", link: "https://x/receipt/ABC", domain: "naapp.tech" });
assert.equal(rec, "Hello Musa, thank you for buying from Kemi's. Your receipt: ₦35,000 for Rice 10kg × 2 and Garri × 2, ₦13,000 paid, ₦22,000 still to pay by 3 Nov. https://x/receipt/ABC\n\nSent with #NotesApp Business books. Keep your own books free: naapp.tech/books");
assert.ok(receiptText({ shop: "K", totalKobo: 500_000, what: "Garri", paidKobo: 500_000, method: "transfer", owesKobo: 0, link: "L", domain: "d" }).startsWith("Thank you for buying from K. Your receipt: ₦5,000 for Garri, paid by transfer."));
assert.ok(!/\d{4} ?\d{3} ?\d{4}|234\d{10}/.test(rem + rec), "no phone numbers in the message itself");
const link = waLink("2348031234417", rem);
assert.ok(link.startsWith("https://wa.me/2348031234417?text=Hello%20Chinedu"));
assert.equal(decodeURIComponent(link.split("?text=")[1]), rem);
assert.equal(whatOf([{ title: "A", qty: 1 }, { title: "B", qty: 1 }, { title: "C", qty: 1 }, { title: "D", qty: 1 }]), "A, B and 2 more");

// ---- CSV: reading, matching columns, presets ----
assert.deepEqual(readSheet("a,b\n\"x, y\",\"say \"\"hi\"\"\"\n"), { headers: ["a", "b"], rows: [["x, y", 'say "hi"']] });
assert.ok("error" in readSheet(""));
assert.ok("error" in readSheet("a\n" + "1\n".repeat(5001)), "5,000 rows at most");
assert.ok("error" in readSheet("x".repeat(5 * 1024 * 1024 + 1)), "5 MB at most");
assert.ok(!("error" in readSheet("a\n" + "1\n".repeat(5000))));
assert.deepEqual(guessMapping(["Product Name", "Barcode", "Category", "Cost Price", "Selling Price", "Stock Quantity", "Unit", "Supplier"], "stock"), ["name", "sku", "category", "cost", "price", "stock", "unit", ""]);
const traloSales = ["date", "time", "product_name", "quantity", "unit_price", "customer_name", "customer_phone", "payment_method", "amount_paid", "apply_taxes", "notes"];
const tm = guessMapping(traloSales, "sales", PRESETS.find((x) => x.id === "tralo-sales"));
assert.deepEqual(tm, ["date", "time", "item", "qty", "unitPrice", "customer", "phone", "method", "paid", "", "note"]);
assert.deepEqual(guessMapping(["Product Name", "Category", "Cost Price", "Selling Price", "Stock Quantity", "Unit"], "stock", PRESETS[0]), ["name", "category", "cost", "price", "stock", "unit"]);
assert.deepEqual(guessMapping(["Date", "Amount", "Narration"], "expenses"), ["date", "amount", "description"]);
assert.deepEqual(missingRequired(["date", "", ""], "expenses"), ["Amount (₦)"]);
assert.deepEqual(cleanMapping(["name", "name", "bogus"], ["a", "b", "c"], "stock"), ["name", "", ""], "each field once, and only real fields");
for (const k of ["stock", "sales", "expenses", "customers"] as const) {
  const s = readSheet(templateCsv(k)) as Sheet;
  const m = guessMapping(s.headers, k);
  assert.deepEqual(missingRequired(m, k), [], `the ${k} template matches by itself`);
  const r = readRows(s, m, k, "2026-11-02");
  assert.equal(r.problems.length, 0, `the ${k} template's example row reads cleanly`); assert.equal(r.rows.length, 1);
  assert.ok(FIELDS[k].length > 0);
}
assert.equal(parseDay("2026-10-12"), "2026-10-12"); assert.equal(parseDay("12/10/2026"), "2026-10-12", "day first");
assert.equal(parseDay("12/10/26"), "2026-10-12"); assert.equal(parseDay("12 Oct 2026"), "2026-10-12"); assert.equal(parseDay("Oct 12, 2026"), "2026-10-12");
assert.equal(parseDay("12th October 2026"), "2026-10-12"); assert.equal(parseDay("31/02/2026"), null); assert.equal(parseDay("yesterday"), null);
assert.equal(parseMethod("Mobile Money"), "transfer"); assert.equal(parseMethod("bank transfer"), "transfer"); assert.equal(parseMethod("POS"), "pos");
assert.equal(parseMethod("Credit"), "credit"); assert.equal(parseMethod("cash"), "cash"); assert.equal(parseMethod("barter"), null);

// A Tralo sales export: a credit sale (amount_paid below the total) becomes money owed; bad rows come back as problems, not saved.
const traloCsv = [traloSales.join(","),
  "2026-10-12,14:05,Rice 10kg,3,15000,Mama Bisi,08031234567,credit,20000,no,",
  "12/10/2026,09:00,Garri,2,2500,,,cash,5000,no,",
  "2026-10-13,10:00,Ankara,1,fifteen k,,,cash,,no,",
  "2026-10-14,10:00,Lace,1,9000,,,credit,0,no,",
  "2026-10-15,10:00,Rice,1,GH₵150,,,cash,,no,",
  "2027-01-01,10:00,Rice,1,100,,,cash,,no,"].join("\n");
const ts = readSheet(traloCsv) as Sheet;
const tr = readRows(ts, tm, "sales", "2026-11-02");
assert.equal(tr.rows.length, 2);
assert.deepEqual({ ...tr.rows[0] }, { row: 2, on: "2026-10-12", at: "2026-10-12T13:05:00.000Z", title: "Rice 10kg", qty: 3, unitKobo: 1_500_000, totalKobo: 4_500_000, paidKobo: 2_000_000, method: "cash", customer: "Mama Bisi", phone: "2348031234567", note: "" });
assert.equal(tr.rows[1].totalKobo, 500_000); assert.equal(tr.rows[1].paidKobo, 500_000);
assert.deepEqual(tr.problems.map((x) => x.row), [4, 5, 6, 7]);
assert.match(tr.problems[0].message, /isn't an amount in naira/);
assert.match(tr.problems[1].message, /needs the customer's name/);
assert.match(tr.problems[2].message, /cedis/);
assert.match(tr.problems[3].message, /future/);
// Stock rows: stock below 0 is refused.
const st = readRows(readSheet("name,stock\nRice,-2\nGarri,40\n") as Sheet, ["name", "stock"], "stock", "2026-11-02");
assert.equal(st.rows.length, 1); assert.match(st.problems[0].message, /Stock is -2/);

// ---- Duplicates ----
const existing = new Set([saleKey("2026-10-12", 4_500_000, "Rice 10kg")]);
const d = dedupe(tr.rows, (r) => saleKey(r.on, r.totalKobo, r.title), existing);
assert.equal(d.fresh.length, 1); assert.equal(d.dupes.length, 1, "already in the books: same day, amount and item");
const twice = dedupe([{ on: "2026-10-01", a: 5, t: "Diesel" }, { on: "2026-10-01", a: 5, t: " diesel " }], (r) => expenseKey(r.on, r.a, r.t), new Set());
assert.equal(twice.dupes.length, 1, "a row twice in the same file");
const cust = dedupe([{ phone: "2348031234567", name: "Bisi" }, { phone: "", name: "Chinedu" }, { phone: "", name: "chinedu " }], (r) => [r.phone ? customerKey(r.phone, "") : "", customerKey("", r.name)], new Set([customerKey("2348031234567", "")]));
assert.deepEqual(cust.fresh.map((r) => r.name), ["Chinedu"]);
// Exports escape what a spreadsheet would run.
assert.equal(csvOf([["=SUM(A1)", "-5", "a,b", "ok"]]), "'=SUM(A1),'-5,\"a,b\",ok\n");

console.log("ALL OK");
