// Member analytics (lib/analytics.ts): what each plan sees, where visits came from, the totals and the change, customers, best sellers, stock,
// and the sales download. Run: npm run test:analytics → "ALL OK".
import assert from "node:assert/strict";
import { buildReport, canDownload, canSeeCustomers, canSeeVisitDetail, change, customersOf, rangesFor, salesCsv, sourceOf, type Inputs, type OrderRow } from "../../lib/analytics";

// Plans
assert.deepEqual(rangesFor("basic"), [7]); assert.deepEqual(rangesFor("standard"), [7]);
assert.deepEqual(rangesFor("pro"), [7, 30, 90]); assert.deepEqual(rangesFor("enterprise"), [7, 30, 90]);
assert.equal(canSeeCustomers("basic"), false); assert.equal(canSeeCustomers("pro"), true);
assert.equal(canDownload("pro"), true); assert.equal(canSeeVisitDetail("pro"), false); assert.equal(canSeeVisitDetail("business"), true);

// Where visits came from
const own = ["notesapp.name.ng", "apexglitz.com.ng"];
assert.equal(sourceOf("", "", own), "direct");
assert.equal(sourceOf("www.google.com", "", own), "search");
assert.equal(sourceOf("l.facebook.com", "", own), "facebook");
assert.equal(sourceOf("t.co", "", own), "x");
assert.equal(sourceOf("app.notesapp.name.ng", "", own), "inside");
assert.equal(sourceOf("apexglitz.com.ng", "", own), "inside", "the member's own domain");
assert.equal(sourceOf("", "WhatsApp", own), "whatsapp", "a utm tag wins");
assert.equal(sourceOf("nairaland.com", "", own), "other");
assert.equal(sourceOf("<script>", "", own), "other");
assert.equal(change(150, 100), "+50%"); assert.equal(change(50, 100), "−50%"); assert.equal(change(5, 0), "");

// A report
const now = new Date("2026-10-20T12:00:00Z");
const order = (id: string, paidAt: string, o: Partial<OrderRow> = {}): OrderRow => ({
  id, itemId: "bag", itemTitle: "Tote bag", quantity: 1, unitKobo: 1_000_000, deliveryKobo: 150_000, amountKobo: 1_150_000, status: "paid", paidAt,
  buyerUid: "ada", buyerEmail: "ada@x.ng", name: "Ada Obi", phone: "0803", city: "Enugu", state: "Enugu", ...o,
});
const x: Inputs = {
  ledger: [
    { id: "o1", kind: "order", grossKobo: 1_000_000, netKobo: 940_000, status: "held", createdAt: "2026-10-19T10:00:00Z" },
    { id: "b1", kind: "booking", grossKobo: 500_000, netKobo: 450_000, status: "paid_out", createdAt: "2026-10-15T10:00:00Z" },
    { id: "r1", kind: "order", grossKobo: 200_000, netKobo: 190_000, status: "refunded", createdAt: "2026-10-16T10:00:00Z" },
    { id: "old", kind: "order", grossKobo: 300_000, netKobo: 280_000, status: "paid_out", createdAt: "2026-10-10T10:00:00Z" }, // the week before
  ],
  orders: [
    order("o1", "2026-10-19T10:00:00Z", { quantity: 2, amountKobo: 2_150_000 }),
    order("o2", "2026-10-18T10:00:00Z", { buyerUid: "", buyerEmail: "Bayo@x.ng", name: "=HYPERLINK(1)", itemId: "cap", itemTitle: "Cap", unitKobo: 300_000, amountKobo: 450_000 }),
    order("o3", "2026-10-17T10:00:00Z", { status: "refunded" }),
    order("o0", "2026-09-01T10:00:00Z"), // long ago: a customer, not this week
  ],
  checkouts: [{ status: "paid", createdAt: "2026-10-19T09:00:00Z" }, { status: "pending", createdAt: "2026-10-19T09:30:00Z" }, { status: "paid", createdAt: "2026-10-18T09:00:00Z" }],
  items: [
    { id: "bag", title: "Tote bag", kind: "physical", stock: 2, sellable: true, views: 40, priceKobo: 1_000_000 },
    { id: "cap", title: "Cap", kind: "physical", stock: 10, sellable: true, views: 9, priceKobo: 300_000 },
    { id: "pdf", title: "Guide", kind: "digital", stock: 0, sellable: true, views: 3, priceKobo: 200_000 },
    { id: "off", title: "Old", kind: "physical", stock: 0, sellable: false, views: 0, priceKobo: 1 },
  ],
  bookings: [{ status: "confirmed", amountKobo: 500_000, createdAt: "2026-10-15T10:00:00Z", startsAt: "2026-10-22T10:00:00Z" }, { status: "cancelled_by_client", amountKobo: 1, createdAt: "2026-10-16T10:00:00Z", startsAt: "" }],
  visits: [
    { day: "2026-10-19", count: 12, pages: { "item:bag": 8, "profile:apex": 4 }, src: { whatsapp: 7, search: 5 } },
    { day: "2026-10-12", count: 5, pages: { "item:bag": 5 }, src: { direct: 5 } }, // the week before
  ],
  promos: [],
};
const basic = buildReport(x, { days: 7, tier: "basic", now });
assert.equal(basic.from, "2026-10-14"); assert.equal(basic.to, "2026-10-20"); assert.equal(basic.series.length, 7);
assert.equal(basic.totals.earnedKobo, 940_000 + 450_000, "refunded entries don't count as earned; last week's neither");
assert.equal(basic.totals.refundedKobo, 200_000);
assert.equal(basic.totals.ordersPaid, 2, "the refunded order isn't a paid order");
assert.equal(basic.totals.salesKobo, 2_600_000); assert.equal(basic.totals.avgOrderKobo, 1_300_000);
assert.equal(basic.totals.checkouts, 3); assert.equal(basic.totals.bookings, 1); assert.equal(basic.totals.visits, 12);
assert.equal(basic.before.earnedKobo, 280_000); assert.equal(basic.before.visits, 5);
assert.deepEqual(basic.bestSellers.map((b) => [b.itemId, b.sold]), [["bag", 2], ["cap", 1]]);
assert.deepEqual(basic.lowStock.map((i) => i.itemId), ["bag"], "physical, on sale, 3 or fewer; not downloads or items off sale");
assert.equal(basic.series.find((s) => s.day === "2026-10-19")!.earnedKobo, 940_000);
assert.equal(basic.customers, null, "Free Basic doesn't see customers");
assert.equal(basic.pages, null); assert.equal(basic.sources, null);
assert.deepEqual(basic.byKind, [{ kind: "order", netKobo: 940_000 }, { kind: "booking", netKobo: 450_000 }]);

const pro = buildReport(x, { days: 7, tier: "pro", now });
assert.deepEqual(pro.customers!.map((c) => [c.key, c.orders, c.spentKobo]), [["ada", 2, 3_300_000], ["bayo@x.ng", 1, 450_000]], "all-time, most valuable first; email when there's no account");
assert.equal(pro.pages, null, "visits by page are Business");
const biz = buildReport(x, { days: 7, tier: "business", now });
assert.deepEqual(biz.sources, [{ source: "whatsapp", visits: 7 }, { source: "search", visits: 5 }]);
assert.deepEqual(biz.pages!.map((p) => [p.key, p.visits]), [["item:bag", 8], ["profile:apex", 4]]);

// The download: one line per order, formulas made harmless
const csv = salesCsv(pro).split("\n");
assert.equal(csv.length, 4, "a header and the three orders in the period (the refunded one shows as refunded)");
assert.ok(csv.some((l) => l.includes("'=HYPERLINK(1)")), "a name that looks like a formula is made plain");
assert.ok(csv[1].startsWith("2026-10-19 10:00,o1,Tote bag,2,20000.00,1500.00,21500.00,paid,Ada Obi"));
assert.equal(customersOf([order("z", "2026-10-01T00:00:00Z", { status: "refunded" })]).length, 0);
console.log("ALL OK");
