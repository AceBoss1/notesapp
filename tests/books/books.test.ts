// Business books, the pure parts (lib/books.ts, lib/books-import.ts): kobo maths, periods, the P&L, cash in hand, the Free Basic caps,
// paying back oldest first, the debtors list, the WhatsApp messages, and CSV reading, column matching and duplicates. Then (v0.119.0)
// Nana entries (lib/books-nana.ts) read from sample phrases with a stubbed model answer and the stand-in reader, the offline outbox
// (lib/books-outbox.ts), staff roles, paying a debt online and the monthly summary (lib/books-report.ts).
// Run: npm run test:books → "ALL OK".
import assert from "node:assert/strict";
import {
  booksAccess, canAddDebtor, capState, cashInHand, changePct, countsTowardCap, debtors, firstName, footnote, isDay, lagosDay, linesCost, linesTotal,
  maskPhone, naira, periodOf, pnl, receiptText, reminderText, settleFifo, toKobo, usageFor, waLink, waPhone, whatOf, type Entry, type Party,
  can, debtAmount, debtCommissionKobo, staffSeats, type BooksAct,
} from "../../lib/books";
import {
  FIELDS, PRESETS, SOURCES, csvOf, customerKey, dedupe, detectSource, expenseKey, guessBankLine, guessMapping, missingRequired, parseDay, parseMethod, parseWhen, presetFor,
  readRows, readSheet, refKey, saleKey, saleStatus, signedKobo, statementFromPdfLines, templateCsv, cleanMapping, type ImportKind, type Sheet, type SaleRow, type SourceId,
} from "../../lib/books-import";
import { readFileSync } from "node:fs";
import { DEFAULT_PRICING } from "../../lib/pricing";
import { cleanDrafts, matchItem, nanaPrompt, parseDue, parseNaira, readReply, standInEntries, type NanaItem } from "../../lib/books-nana";
import { applyResults, backoff, badgeText, batchFailed, due, enqueue, prune, recordedAt, resultText, retry, waitingCount, type OutboxItem } from "../../lib/books-outbox";
import { inSendWindow, monthById, previousMonth, renderReportHtml, renderReportText, reportBell, reportFrom, reportMonth, reportSubject } from "../../lib/books-report";

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
for (const k of ["stock", "sales", "expenses", "customers", "bank"] as const) {
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

// ---- Nana entries (lib/books-nana.ts) ----
// Naija money: "5k", "₦45,000", "45 thousand", "1.5m", "N3,500"; words and nonsense are refused.
assert.equal(parseNaira("5k"), 500_000);
assert.equal(parseNaira("₦45,000"), 4_500_000);
assert.equal(parseNaira("45 thousand"), 4_500_000);
assert.equal(parseNaira("1.5m"), 150_000_000);
assert.equal(parseNaira("2 million"), 200_000_000);
assert.equal(parseNaira("N3,500"), 350_000);
assert.equal(parseNaira("NGN 3500"), 350_000);
assert.equal(parseNaira(45000), 4_500_000, "a model's plain number is naira");
assert.equal(parseNaira("five k"), 500_000);
assert.equal(parseNaira("plenty"), null);
assert.equal(parseNaira("-5k"), null);
// Dates from "today" (Monday 2 November 2026): "Friday" is the next Friday, "the 15th" the next 15th.
const mon = "2026-11-02";
assert.equal(parseDue("Friday", mon), "2026-11-06");
assert.equal(parseDue("monday", mon), "2026-11-09", "the same weekday means next week's");
assert.equal(parseDue("tomorrow", mon), "2026-11-03");
assert.equal(parseDue("on the 15th", mon), "2026-11-15");
assert.equal(parseDue("the 1st", mon), "2026-12-01", "a day already past this month is next month's");
assert.equal(parseDue("20 Jan", mon), "2027-01-20");
assert.equal(parseDue("end of the month", mon), "2026-11-30");
assert.equal(parseDue("2026-10-01", mon), null, "never a day already past");
assert.equal(parseDue("someday", mon), null);
// Matching items: words, then the price each when two items share a name ("₦15,000 a bag" is the 10kg rice).
const items: NanaItem[] = [
  { ref: "i:rice10:", title: "Rice 10kg (Mama Gold)", sku: "RICE-MG-10", priceKobo: 1_500_000 }, { ref: "i:rice50:", title: "Rice 50kg (Mama Gold)", priceKobo: 7_800_000 },
  { ref: "i:garri:", title: "Garri, white (50kg bag)", priceKobo: 4_200_000 }, { ref: "b:ank", title: "Ankara, Blue Lagoon (6 yards)", priceKobo: 1_800_000 },
];
const customersN = [{ id: "p1", name: "Mama Bisi (Bisi Adebayo)" }, { id: "p2", name: "Chinedu Okafor" }, { id: "p3", name: "Funke Alade" }, { id: "p4", name: "Funke Bello" }];
assert.equal(matchItem("rice", items, 1_500_000).ref, "i:rice10:");
assert.equal(matchItem("rice", items).match, "unsure", "two rice items and no price: Nana says so");
assert.deepEqual(matchItem("rice", items).options?.map((o) => o.ref), ["i:rice10:", "i:rice50:"]);
assert.equal(matchItem("RICE-MG-10", items).ref, "i:rice10:", "a SKU");
assert.equal(matchItem("ankara", items).ref, "b:ank");
assert.equal(matchItem("knotless braids", items).match, "typed");

// A stubbed model answer (what Pearl replies), read strictly and checked field by field.
const ctxN = { today: mon, items, customers: customersN };
const pearl = (o: unknown) => "```json\n" + JSON.stringify(o) + "\n```";
const entries = readReply(pearl({ entries: [
  { kind: "sale", items: [{ name: "rice", qty: 3, unit_price: null, total: 45000 }], amount: 45000, paid: 0, method: null, on_credit: true, customer: "Mama Bisi", due: "2026-11-06", category: null, note: null, unsure: [] },
  { kind: "expense", items: [], amount: "18k", paid: null, method: "cash", on_credit: false, customer: null, due: null, category: "power", note: "Diesel", unsure: [] },
  { kind: "payment", items: [], amount: 20000, paid: null, method: "transfer", on_credit: false, customer: "Chinedu", due: null, category: null, note: null, unsure: [] },
  { kind: "purchase", items: [{ name: "garri", qty: 10, unit_price: 52000, total: null }], amount: null, paid: null, method: null, on_credit: false, customer: null, due: null, category: null, note: null, unsure: [] },
  { kind: "refund", items: [], amount: 5000 }, // not a kind Books takes from Nana: dropped
  { kind: "sale", items: [{ name: "garri", qty: 2.5, total: 84000 }], amount: 84000, paid: "half", on_credit: true, customer: "Funke", due: "yesterday" },
] }));
assert.ok(entries);
const drafts = cleanDrafts(entries!, ctxN);
assert.equal(drafts.length, 5, "the refund is dropped");
assert.deepEqual(drafts[0], {
  kind: "sale", lines: [{ ref: "i:rice10:", title: "Rice 10kg (Mama Gold)", qty: 3, unitKobo: 1_500_000, match: "item" }], totalKobo: 4_500_000, paidKobo: 0, method: null, owes: true,
  customer: { name: "Mama Bisi (Bisi Adebayo)", partyId: "p1", match: "found" }, dueOn: "2026-11-06", unsure: [],
});
assert.deepEqual([drafts[1].kind, drafts[1].totalKobo, drafts[1].method, drafts[1].category, drafts[1].note], ["expense", 1_800_000, "cash", "power", "Diesel"]);
assert.deepEqual([drafts[2].kind, drafts[2].totalKobo, drafts[2].customer?.partyId], ["payment", 2_000_000, "p2"]);
assert.deepEqual([drafts[3].kind, drafts[3].lines[0].ref, drafts[3].lines[0].unitKobo, drafts[3].totalKobo, drafts[3].category], ["purchase", "i:garri:", 5_200_000, 52_000_000, "stock"]);
// A quantity that isn't whole, a "paid" Books can't read, two Funkes and a past due date: each one said on the card, nothing guessed silently.
const odd = drafts[4];
assert.equal(odd.lines[0].qty, 1); assert.equal(odd.customer?.match, "unsure"); assert.equal(odd.dueOn, undefined);
assert.ok(odd.unsure.some((u) => /quantity/.test(u)) && odd.unsure.some((u) => /More than one customer/.test(u)) && odd.unsure.some((u) => /due date/.test(u)), odd.unsure.join(" | "));
// Not JSON, or no entries array: nothing (the server says "couldn't read that").
assert.equal(readReply("Sure! Here are your entries."), null);
assert.equal(readReply('{"items":[]}'), null);
assert.deepEqual(cleanDrafts(readReply('{"entries":[]}')!, ctxN), []);
// A payment needs someone; a sale with no amount and no price is dropped rather than saved at ₦0.
assert.deepEqual(cleanDrafts([{ kind: "payment", amount: 5000 }, { kind: "sale", items: [{ name: "knotless braids", qty: 1 }] }], ctxN), []);
// What Pearl sees: item names, SKUs and prices, and first names only.
const prompt = nanaPrompt("Sold 3 rice", mon, items, customersN);
assert.ok(prompt.includes("TODAY: 2026-11-02 (Monday)") && prompt.includes("Rice 10kg (Mama Gold) [RICE-MG-10]: ₦15,000") && prompt.includes("Bisi, Chinedu, Funke"));
assert.ok(!prompt.includes("Okafor") && !prompt.includes("Adebayo"), "no surnames");

// The stand-in reader (development with no AI key) on the owner's own phrases, through the same checks.
const say = (t: string) => cleanDrafts(standInEntries(t, mon), ctxN);
const s1 = say("Sold 3 bags of rice ₦45,000 to Mama Bisi on credit, due Friday");
assert.deepEqual([s1[0].kind, s1[0].lines[0].ref, s1[0].lines[0].qty, s1[0].totalKobo, s1[0].paidKobo, s1[0].owes, s1[0].customer?.partyId, s1[0].dueOn], ["sale", "i:rice10:", 3, 4_500_000, 0, true, "p1", "2026-11-06"]);
const s2 = say("Bought diesel 18k cash");
assert.deepEqual([s2[0].kind, s2[0].totalKobo, s2[0].method, s2[0].category], ["expense", 1_800_000, "cash", "power"]);
const s3 = say("Chinedu paid 20k");
assert.deepEqual([s3[0].kind, s3[0].totalKobo, s3[0].customer?.partyId], ["payment", 2_000_000, "p2"]);
const s4 = say("Bought 10 bags garri at 52k each");
assert.deepEqual([s4[0].kind, s4[0].lines[0].qty, s4[0].lines[0].unitKobo, s4[0].totalKobo], ["purchase", 10, 5_200_000, 52_000_000]);
const s5 = say("Sold 1 rice 50kg 78k to Funke Alade, she paid half, balance on the 15th");
assert.deepEqual([s5[0].lines[0].ref, s5[0].totalKobo, s5[0].paidKobo, s5[0].owes, s5[0].customer?.partyId, s5[0].dueOn], ["i:rice50:", 7_800_000, 3_900_000, true, "p3", "2026-11-15"]);
const s6 = say("sold 2 garri 84k transfer. paid 3k for transport");
assert.deepEqual(s6.map((d) => [d.kind, d.totalKobo, d.method ?? "", d.category ?? ""]), [["sale", 8_400_000, "transfer", ""], ["expense", 300_000, "", "transport"]]);
const s7 = say("Sold 2 ankara 45 thousand to Ngozi on credit");
assert.deepEqual([s7[0].totalKobo, s7[0].customer?.match], [4_500_000, "new"]);
assert.ok(s7[0].unsure.some((u) => /isn't in your customers/.test(u)));
assert.deepEqual(say("Good morning, how far?"), [], "nothing in it is an entry");

// ---- The offline outbox (lib/books-outbox.ts) ----
const T0 = Date.parse("2026-11-02T10:00:00Z");
const q = (n: number, action: OutboxItem["action"] = "sale") => ({ clientId: `client-000${n}`, owner: "kemi", action, body: { method: "cash" }, at: new Date(T0 + n * 1000).toISOString(), label: `Sale ${n}`, totalKobo: 100_000 * n });
let box: OutboxItem[] = [];
box = enqueue(box, q(1)); box = enqueue(box, q(2, "expense")); box = enqueue(box, q(3, "payment"));
box = enqueue(box, q(1)); // a double tap: once
assert.equal(box.length, 3);
assert.deepEqual(box[0].body, { method: "cash", clientId: "client-0001", action: "sale" }, "the clientId travels with the entry");
assert.throws(() => enqueue(box, { ...q(4), action: "void" as OutboxItem["action"] }), /can't be saved offline/);
assert.throws(() => enqueue(box, { ...q(4), clientId: "x" }), /clientId/);
assert.equal(badgeText(box), "3 waiting to sync");
assert.equal(waitingCount(box, "someone-else"), 0, "per books");
assert.deepEqual(due(box, T0, 2).map((x) => x.clientId), ["client-0001", "client-0002"], "oldest first, a batch at a time");
// The server's answers: saved, already saved (sent twice), not saved (a payment bigger than what's owed now), busy (try later).
box = applyResults(box, [
  { clientId: "client-0001", status: "saved", notes: ["Item out of stock: Rice 10kg: only 2 were in stock. The sale is saved; count the shelf"] },
  { clientId: "client-0002", status: "duplicate", notes: [] },
  { clientId: "client-0003", status: "failed", notes: [], error: "Chinedu owes ₦5,000. Enter that or less." },
], T0);
assert.deepEqual(box.map((x) => x.state), ["done", "done", "stuck"]);
assert.equal(badgeText(box), "1 needs a look");
assert.equal(resultText(box[0].result!), "Saved. Item out of stock: Rice 10kg: only 2 were in stock. The sale is saved; count the shelf");
assert.equal(resultText(box[1].result!), "Already saved");
assert.equal(resultText({ clientId: "c", status: "saved", notes: ["Funke wasn't in your customers, so they were added"] }), "Saved. Funke wasn't in your customers, so they were added");
box = retry(box, "client-0003", { amountKobo: 500_000 });
assert.equal(box[2].state, "waiting"); assert.equal(box[2].body.amountKobo, 500_000);
// No connection (or a 5xx): the batch waits, longer each time, never more than 30 minutes.
box = batchFailed(box, ["client-0003"], "No connection.", T0);
assert.equal(box[2].tries, 1); assert.equal(box[2].nextTryAt, T0 + 15_000);
assert.deepEqual(due(box, T0 + 1000), [], "not before its time");
assert.equal(backoff(1), 15_000); assert.equal(backoff(3), 60_000); assert.equal(backoff(40), 30 * 60_000);
box = applyResults(box, [{ clientId: "client-0003", status: "failed", notes: [], error: "busy", retry: true }], T0 + 20_000);
assert.equal(box[2].state, "waiting"); assert.equal(box[2].tries, 2);
// Done entries stay three days, so the seller can see what happened, then go.
assert.equal(prune(box, T0 + 2 * 86_400_000).length, 3);
assert.equal(prune(box, T0 + 4 * 86_400_000).length, 1);
// The day an offline entry belongs to: when it was recorded, unless the phone's clock is in the future or it's too old.
const syncNow = new Date(T0);
assert.equal(recordedAt("2026-11-01T18:00:00Z", syncNow).toISOString(), "2026-11-01T18:00:00.000Z");
assert.equal(recordedAt("2026-11-09T18:00:00Z", syncNow).getTime(), T0, "a clock in the future");
assert.equal(recordedAt("2026-10-01T18:00:00Z", syncNow).getTime(), T0, "older than 14 days");
assert.equal(recordedAt("nonsense", syncNow).getTime(), T0);

// ---- Staff roles (lib/books.ts can, staffSeats) ----
const acts: BooksAct[] = ["home", "pnl", "sales", "expenses", "owed", "customers", "catalog", "costs", "imports", "export", "sale", "payment", "expense", "purchase", "void", "party", "supplier", "remind", "receipt", "photo", "import", "nana", "sync", "settings", "staff"];
const allowed = (r: Parameters<typeof can>[0]) => acts.filter((a) => can(r, a));
assert.deepEqual(allowed("owner"), acts);
assert.deepEqual(allowed("admin"), acts, "an organisation's admins keep the books like the owner");
assert.deepEqual(allowed("manager"), acts.filter((a) => a !== "settings" && a !== "staff"), "a manager: everything but settings and staff");
assert.deepEqual(allowed("cashier"), ["home", "sales", "customers", "catalog", "sale", "payment", "void", "party", "receipt", "nana", "sync"]);
for (const a of ["pnl", "expenses", "costs", "export", "import", "settings", "staff", "expense", "purchase", "owed"] as BooksAct[]) assert.equal(can("cashier", a), false, `a cashier can't ${a}`);
const seats = { staffSeatsPro: DEFAULT_PRICING.books.staffSeatsPro, staffSeatsBusiness: DEFAULT_PRICING.books.staffSeatsBusiness };
assert.equal(staffSeats("business", seats), 4); assert.equal(staffSeats("enterprise", seats), null);
assert.equal(staffSeats("pro", seats), 0, "Pro: none until open question 4 is answered");
assert.equal(staffSeats("pro", { ...seats, staffSeatsPro: 1 }), 1);
assert.equal(staffSeats("basic", seats), 0);

// ---- Paying a debt online ----
assert.deepEqual(debtAmount("20,000", 3_850_000), { ok: true, kobo: 2_000_000 });
assert.deepEqual(debtAmount(38_500, 3_850_000), { ok: true, kobo: 3_850_000 });
assert.equal(debtAmount("40000", 3_850_000).ok, false, "never more than owed");
assert.equal(debtAmount("50", 3_850_000).ok, false, "at least ₦100");
assert.deepEqual(debtAmount("50", 5_000), { ok: true, kobo: 5_000 }, "unless less is owed");
assert.equal(debtAmount("abc", 3_850_000).ok, false);
assert.equal(debtCommissionKobo(2_000_000, 0.05, "store"), 100_000);
assert.equal(debtCommissionKobo(2_000_000, 0.05, "none"), 0);

// ---- The monthly summary (lib/books-report.ts) ----
const rm = reportMonth(new Date("2026-11-01T07:30:00Z")); // 08:30 Lagos on the 1st
assert.deepEqual([rm.id, rm.label, rm.start, rm.end], ["2026-10", "October 2026", "2026-10-01", "2026-10-31"]);
assert.equal(new Date(rm.sendFrom).toISOString(), "2026-11-01T07:00:00.000Z", "08:00 Lagos on the 1st");
assert.equal(inSendWindow(rm, new Date("2026-11-01T06:59:00Z")), false);
assert.equal(inSendWindow(rm, new Date("2026-11-03T12:00:00Z")), true, "a missed run catches up");
assert.equal(inSendWindow(rm, new Date("2026-11-04T07:00:00Z")), false, "three days at most");
assert.equal(reportMonth(new Date("2026-01-01T09:00:00Z")).id, "2025-12");
assert.equal(previousMonth(monthById("2026-01")!).id, "2025-12");
const octP = pnl([entry({ kind: "sale", totalKobo: 900_000, paidKobo: 900_000, lines: [{ title: "Rice", qty: 6, unitKobo: 150_000, costKobo: 128_000 }] }), entry({ kind: "sale", source: "online", totalKobo: 300_000, feeKobo: 15_000, lines: [{ title: "Ankara", qty: 1, unitKobo: 300_000, costKobo: 200_000 }] }), entry({ kind: "expense", totalKobo: 100_000, category: "power" })]);
const rep = reportFrom(octP, null, {
  name: "Kemi", shop: "Kemi's Store & Salon", month: { id: "2026-10", label: "October 2026" }, asOf: "1 November 2026", entries: 3,
  owed: { totalKobo: 6_000_000, overdueKobo: 3_850_000, people: 2, late: [{ name: "Chinedu Okafor", kobo: 3_850_000, daysLate: 6 }] }, low: [{ title: "Garri, white (50kg bag)", stock: 2 }],
  pnlUrl: "https://naapp.tech/profile/books?tab=pnl&period=month&back=1", booksUrl: "https://naapp.tech/profile/books", settingsUrl: "s", unsubscribeUrl: "u", site: "https://naapp.tech", company: "Adams Consults",
});
assert.deepEqual([rep.sales.totalKobo, rep.sales.walkinKobo, rep.sales.onlineKobo, rep.expensesKobo, rep.profitKobo], [1_200_000, 900_000, 300_000, 115_000, 1_200_000 - 768_000 - 200_000 - 115_000]);
assert.equal(rep.owed.late[0].name, "Chinedu", "first names only");
assert.equal(reportSubject(rep), "Kemi's Store & Salon's books for October 2026: ₦12,000 in sales, ₦1,170 profit");
assert.equal(reportBell(rep), "Your books for October 2026: ₦12,000 in sales, ₦1,170 profit, ₦38,500 owed is late.");
const html = renderReportHtml(rep), text = renderReportText(rep);
for (const want of ["Walk-in", "Online store", "BEST SELLERS", "MONEY OWED TO YOU", "RUNNING LOW", "profit and loss", "Turn off the monthly books email"]) assert.ok(html.includes(want), want);
assert.ok(text.includes("- Walk-in: ₦9,000") && text.includes("Chinedu: ₦38,500, 6 days late") && text.includes("Garri, white (50kg bag): 2 left"));
assert.ok(!html.includes("<script"), "no scripts in an email");
// A seller who turned "show profit in emails" off: no profit anywhere in it.
const noProfit = reportFrom(octP, null, { ...rep, owed: rep.owed, low: rep.low }, false);
assert.equal(noProfit.profitKobo, null);
assert.ok(!renderReportHtml(noProfit).includes("PROFIT IN") && !reportSubject(noProfit).includes("profit"));

// ---- Sources: Shopify, WooCommerce, Selar, Bumpa, Paystack, bank statements (fixtures in tests/books/fixtures, made up to match each
// export's headings: verified ones from the source's help pages, guessed ones as lib/books-import.ts says) ----
const fixture = (name: string) => readSheet(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as Sheet;
const TODAY = "2026-11-02";
const load = <K extends ImportKind>(name: string, source: SourceId, kind: K) => {
  const s = fixture(name), p = presetFor(source, kind);
  const m = guessMapping(s.headers, kind, p);
  assert.deepEqual(missingRequired(m, kind), [], `${name}: every needed column is matched`);
  return { s, m, ...readRows(s, m, kind, TODAY, p) };
};
// Every source in the wizard has steps, and every preset belongs to a source that lists its kind.
for (const src of SOURCES) assert.ok(src.steps.length >= 2 && src.kinds.length, `${src.id} has export steps`);
for (const p of PRESETS) assert.ok(SOURCES.find((x) => x.id === p.source)?.kinds.includes(p.kind), `${p.id} is offered by its source`);
assert.ok(!SOURCES.find((x) => x.id === "selar")!.kinds.includes("stock"), "Selar sells digital items: no stock list");

// Detection from the headings.
const det = (n: string) => detectSource(fixture(n).headers)?.id ?? null;
assert.equal(det("shopify-products.csv"), "shopify-stock"); assert.equal(det("shopify-products-new.csv"), "shopify-stock");
assert.equal(det("shopify-orders.csv"), "shopify-sales"); assert.equal(det("woo-products.csv"), "woo-stock");
assert.equal(det("woo-orders.csv"), "woo-sales"); assert.equal(det("woo-orders-advanced.csv"), "woo-sales");
assert.equal(det("paystack-transactions.csv"), "paystack-sales");
for (const b of ["bank-gtbank.csv", "bank-kuda.csv", "bank-signed.csv"]) assert.equal(det(b), "bank-statement", b);
assert.equal(detectSource(["Product Name", "Category", "Cost Price", "Selling Price", "Stock Quantity", "Unit"])?.id, "tralo-stock");
assert.equal(detectSource(["name", "phone", "owes"]), null, "a plain sheet isn't any app's");
assert.equal(det("selar-sales.csv"), null, "Selar's headings aren't verified, so it isn't guessed from them");

// Shopify products: each option its own item, the image-only row skipped, "Default Title" dropped, negative stock as 0.
const shp = load("shopify-products.csv", "shopify", "stock");
assert.deepEqual(shp.rows.map((r) => [r.name, r.sku, r.priceKobo, r.costKobo, r.stock]), [
  ["Ankara Gown (S)", "ANK-GWN-S", 1_850_000, 1_100_000, 4], ["Ankara Gown (M)", "ANK-GWN-M", 1_850_000, 1_100_000, 6],
  ["Ankara Gown (L)", "ANK-GWN-L", 1_950_000, 1_150_000, 0], ["Shea Butter 250g", "SHEA-250", 350_000, 210_000, 30]]);
assert.equal(shp.problems.length, 0); assert.match(shp.notes[0].message, /stock was -1/);
assert.equal(shp.m[shp.s.headers.indexOf("Variant Compare At Price")], "", "Shopify's other columns are left out, not guessed");
assert.deepEqual(load("shopify-products-new.csv", "shopify", "stock").rows.map((r) => r.name), ["Adire Shirt (M / Blue)", "Adire Shirt (L / Blue)"], "today's Shopify headings too");

// Shopify orders: lines grouped by order, only paid ones, refunds, part paid, Lagos time.
const sho = load("shopify-orders.csv", "shopify", "sales");
assert.deepEqual(sho.rows.map((r) => r.ref), ["#1001", "#1002", "#1003", "#1004"]);
const o1 = sho.rows[0];
assert.deepEqual(o1.lines, [{ title: "Ankara Gown - S", qty: 2, unitKobo: 1_850_000 }, { title: "Shea Butter 250g", qty: 1, unitKobo: 350_000 }]);
assert.equal(o1.totalKobo, 4_300_000, "the order's total, with delivery"); assert.equal(o1.at, "2026-10-12T13:05:00.000Z"); assert.equal(o1.method, "card");
assert.equal(o1.customer, "Bisi Adebayo"); assert.equal(o1.email, "bisi@example.com"); assert.equal(o1.phone, "2348031110001");
assert.equal(sho.rows[1].refundKobo, 350_000, "refunded: the whole order comes back");
assert.equal(sho.rows[2].refundKobo, 1_850_000, "partially refunded: the refunded amount");
assert.equal(sho.rows[3].paidKobo, 1_000_000, "partially paid: the outstanding balance is owed");
assert.deepEqual(sho.skipped.map((x) => x.row), [7, 8]); assert.match(sho.skipped[0].message, /pending/);
// Currency: a store in dollars is refused, with a clear message.
const usd = load("shopify-orders-usd.csv", "shopify", "sales");
assert.equal(usd.rows.length, 0); assert.match(usd.problems[0].message, /is in USD\. Books keeps naira only/);

// WooCommerce: the variable product is skipped and its variations come in; orders from either plugin.
const wp = load("woo-products.csv", "woo", "stock");
assert.deepEqual(wp.rows.map((r) => [r.name, r.sku, r.stock]), [["Garri, white (5 litre)", "GARRI-5L", 40], ["Hoodie - Blue", "HOODIE-BLU", 7], ["Hoodie (Black)", "HOODIE-BLK", 0]]);
assert.equal(wp.rows[0].category, "Foodstuff", "the top category of 'Foodstuff > Grains'"); assert.equal(wp.rows[0].lowAt, 5);
assert.match(wp.skipped[0].message, /has options/);
const wo = load("woo-orders.csv", "woo", "sales");
assert.deepEqual(wo.rows.map((r) => [r.ref, r.totalKobo, r.customer, r.refundKobo ?? 0]), [["501", 670_000, "Femi Ade", 0], ["502", 2_200_000, "Halima Musa", 0], ["504", 250_000, "Sade", 250_000]]);
assert.equal(wo.rows[1].lines?.length, 2, "one row per item, one sale"); assert.equal(wo.rows[1].lines?.[1].unitKobo, 1_000_000, "price each from the line total");
assert.equal(wo.m[wo.s.headers.indexOf("fee_total")], "", "Woo's fee_total isn't a payment fee");
assert.match(wo.skipped[0].message, /cancelled/);
const wa = load("woo-orders-advanced.csv", "woo", "sales");
assert.deepEqual([wa.rows[0].ref, wa.rows[0].customer, wa.rows[0].method, wa.rows[0].totalKobo], ["610", "Ifeoma Nwosu", "transfer", 500_000]);

// Selar: sales and buyers; failed ones out; cedis refused.
const se = load("selar-sales.csv", "selar", "sales");
assert.deepEqual(se.rows.map((r) => [r.ref, r.email, r.totalKobo]), [["SEL-88231", "yemi@example.com", 500_000], ["SEL-88234", "bola@example.com", 1_500_000]]);
assert.match(se.problems[0].message, /cedis/); assert.match(se.skipped[0].message, /failed/);

// Bumpa: options as items, part-paid and unpaid orders owed, customers with what they owe.
assert.deepEqual(load("bumpa-products.csv", "bumpa", "stock").rows.map((r) => r.name), ["Hair Cream", "Lace Wig (14 inches)", "Lace Wig (18 inches)"]);
const bo = load("bumpa-orders.csv", "bumpa", "sales");
assert.deepEqual(bo.rows.map((r) => [r.ref, r.totalKobo - r.paidKobo]), [["BMP-1001", 2_500_000], ["BMP-1002", 1_000_000], ["BMP-1003", 0]]);
const bc = load("bumpa-customers.csv", "bumpa", "customers");
assert.deepEqual(bc.rows.map((r) => [r.name, r.owesKobo, r.email ?? ""]), [["Mama Bisi", 2_500_000, ""], ["Zainab", 0, "zainab@example.com"], ["Kola Stores", 1_200_000, "kola@example.com"]]);
assert.equal(bc.m[bc.s.headers.indexOf("Total Spent")], "", "what they spent isn't what they owe");

// Paystack: only successful ones; our own references skipped; fees kept for the expense line; transfer and card channels.
const ps = load("paystack-transactions.csv", "paystack", "sales");
assert.deepEqual(ps.rows.map((r) => r.ref), ["T812345678901", "T812345678902", "ORDER-REF-ONLINE", "T812345678906"], "the server skips ORDER-REF-ONLINE if it's an online_ entry");
assert.deepEqual(ps.rows.map((r) => r.method), ["card", "transfer", "card", "transfer"]);
assert.deepEqual(ps.rows.map((r) => r.feeKobo), [15_000, 37_500, 10_500, 4_500]);
assert.equal(ps.rows[0].title, "Paystack payment T812345678901", "no item: named by its reference");
assert.deepEqual(ps.skipped.map((x) => x.row), [4, 5, 6, 7]);
assert.match(ps.skipped[3].message, /#NotesApp order/); assert.match(ps.skipped[2].message, /reversed/);
assert.equal(saleStatus("processing", true), "skip", "Paystack: only success"); assert.equal(saleStatus("processing"), "sale", "Woo: processing is paid");
assert.equal(saleStatus("wc-completed"), "sale"); assert.equal(saleStatus("Partially Paid"), "part"); assert.equal(saleStatus("unpaid"), "credit"); assert.equal(saleStatus("authorized"), "skip");

// Re-importing: matched by the order number first, then a refund since only adds the refund.
const srcKey = (r: SaleRow) => (r.ref ? refKey("shopify", r.ref) : saleKey(r.on, r.totalKobo, r.title));
const inBooks = new Set(sho.rows.map(srcKey));
assert.equal(dedupe(sho.rows, srcKey, inBooks).fresh.length, 0, "the same Shopify export twice adds nothing");
assert.equal(refKey("shopify", "#1001 "), refKey("shopify", "#1001"));
assert.notEqual(refKey("shopify", "1001"), refKey("woo", "1001"), "the same number from two shops are two orders");
// Two orders on the same day for the same amount and item are both kept when they have their own numbers.
const twin = dedupe([{ ...o1, ref: "#9" }, { ...o1, ref: "#10" }] as SaleRow[], srcKey, new Set());
assert.equal(twin.fresh.length, 2);

// Bank statements: the account heading lines and the totals row are left out; credits, debits, signed amounts, CR/DR.
const gt = load("bank-gtbank.csv", "bank", "bank");
assert.equal(gt.rows.length, 6); assert.equal(gt.problems.length, 0);
assert.deepEqual(gt.rows.map((r) => [r.inKobo, r.outKobo, r.as, r.category, r.tick]), [
  [4_500_000, 0, "sale", "", true], [0, 1_800_000, "expense", "transport", true], [0, 4_000, "expense", "bank", true],
  [0, 500_000, "expense", "data", true], [10_000_000, 0, "skip", "", false], [0, 2_500_000, "expense", "power", true]]);
const kd = load("bank-kuda.csv", "bank", "bank");
assert.deepEqual(kd.rows.map((r) => [r.on, r.inKobo, r.outKobo, r.category]), [["2026-10-10", 1_250_000, 0, ""], ["2026-10-10", 0, 6_000_000, "rent"]]);
const sg = load("bank-signed.csv", "bank", "bank");
assert.deepEqual(sg.rows.map((r) => [r.inKobo, r.outKobo]), [[1_500_000, 0], [0, 1_200_000]]);
assert.equal(signedKobo("5,000.00 DR"), -500_000); assert.equal(signedKobo("(1,200)"), -120_000); assert.equal(signedKobo("₦45,000.00 CR"), 4_500_000); assert.equal(signedKobo("-"), undefined);
assert.deepEqual([guessBankLine("NEPA BILL", false).category, guessBankLine("STAMP DUTY", false).category, guessBankLine("TRF TO JOHN", false).tick, guessBankLine("REVERSAL OF FT123", true).as], ["power", "bank", false, "skip"]);
// A text PDF statement: lines with a date and two amounts; which way the money went from the balance.
const pdf = statementFromPdfLines(["GUARANTY TRUST BANK", "Opening Balance 107,000.00", "12/10/2026 12/10/2026 TRF FROM BISI ADEBAYO 45,000.00 152,000.00", "12/10/2026 12/10/2026 POS PURCHASE FUEL 18,000.00 134,000.00", "Page 1 of 1"]);
assert.ok(pdf);
const pr = readRows(readSheet(pdf!) as Sheet, guessMapping((readSheet(pdf!) as Sheet).headers, "bank"), "bank", TODAY);
assert.deepEqual(pr.rows.map((r) => [r.narration, r.inKobo, r.outKobo]), [["TRF FROM BISI ADEBAYO", 4_500_000, 0], ["POS PURCHASE FUEL", 0, 1_800_000]]);
assert.equal(statementFromPdfLines(["A scanned page", "no text here"]), null, "a scan: ask for CSV");
// Dates and times as apps write them.
assert.deepEqual(parseWhen("2026-10-12 14:05:33 +0100"), { on: "2026-10-12", hm: "14:05" });
assert.deepEqual(parseWhen("2026-10-12T23:30:00.000Z"), { on: "2026-10-13", hm: "00:30" }, "UTC late at night is the next Lagos day");
assert.deepEqual(parseWhen("Oct 12, 2026, 2:05 PM"), { on: "2026-10-12", hm: "14:05" });
assert.equal(parseDay("12-OCT-26"), "2026-10-12");
assert.equal(parseMethod("Credit card"), "pos", "a credit card isn't a sale on credit");
assert.equal(customerKey("", "Bisi", "Bisi@Example.com"), "e:bisi@example.com");

console.log("ALL OK");
