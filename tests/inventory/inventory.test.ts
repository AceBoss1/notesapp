// Inventory (lib/inventory.ts): who has it, the numbers, the low-stock alert and the spreadsheet. Run: npm run test:inventory → "ALL OK".
import assert from "node:assert/strict";
import { addonExtendedUntil, cleanSku, crossedLow, inventoryAccess, inventoryDocOf, parseCsv, planImport, stockLines, stockState, summary, toCsv } from "../../lib/inventory";
import { DEFAULT_PRICING, cleanPricing } from "../../lib/pricing";

const now = new Date("2026-10-21T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
// Who has it: Business and above on the plan; Free Basic and Pro by the add-on or a one-time 15-day trial; nobody else.
assert.deepEqual(inventoryAccess("business", undefined, now, 15), { ok: true, via: "plan" });
assert.deepEqual(inventoryAccess("pro", undefined, now, 15), { ok: false, canTrial: true }, "Pro adds it too");
assert.deepEqual(inventoryAccess("enterprise", undefined, now, 15), { ok: true, via: "plan" });
assert.deepEqual(inventoryAccess("basic", undefined, now, 15), { ok: false, canTrial: true });
assert.equal(inventoryAccess("basic", { trialStartedAt: day(-10) }, now, 15).ok, true);
assert.deepEqual(inventoryAccess("basic", { trialStartedAt: day(-16) }, now, 15), { ok: false, canTrial: false }, "the trial is once");
assert.equal(inventoryAccess("basic", { trialStartedAt: day(-20) }, now, 30).ok, false, "never longer than 15 days");
assert.equal(inventoryAccess("basic", { addonUntil: day(3) }, now, 15).ok, true);
assert.deepEqual(inventoryAccess("standard", undefined, now, 15), { ok: false, canTrial: false });
assert.equal(addonExtendedUntil({ trialStartedAt: day(-5) }, now, 15), new Date(new Date(day(10)).getTime() + 31 * 86_400_000).toISOString(), "a paid month runs on from the trial");
assert.equal(DEFAULT_PRICING.inventory.addonMonthlyKobo, 150_000); assert.equal(DEFAULT_PRICING.inventory.trialDays, 15);
const { inventory: _, ...older } = DEFAULT_PRICING;
assert.deepEqual(cleanPricing(older).inventory, DEFAULT_PRICING.inventory, "a config saved before inventory keeps the default");

// Cleaning and the numbers
assert.equal(cleanSku(" tote bag/blk!! "), "TOTE-BAG/BLK-");
assert.deepEqual(inventoryDocOf({ sku: "a1", costKobo: -5, lowAt: "x" }, "u"), { ownerUid: "u", sku: "A1", variantSku: {}, costKobo: 0, lowAt: 3 });
const items = [
  { id: "bag", title: "Tote bag", stock: 2, priceKobo: 1_000_000 },
  { id: "tee", title: "T-shirt", stock: 9, variantStock: { "M|Black": 0, "L|Black": 9 }, priceKobo: 500_000 },
];
const lines = stockLines(items, { bag: { ownerUid: "u", sku: "TOTE", variantSku: {}, costKobo: 600_000, lowAt: 3 }, tee: { ownerUid: "u", sku: "TEE", variantSku: { "L|Black": "TEE-L" }, costKobo: 200_000, lowAt: 2 } });
assert.deepEqual(lines.map((l) => [l.variant ?? "", l.sku, l.stock]), [["", "TOTE", 2], ["M|Black", "TEE-M-BLACK", 0], ["L|Black", "TEE-L", 9]]);
assert.deepEqual(summary(lines), { lines: 3, units: 11, costKobo: 2 * 600_000 + 9 * 200_000, retailKobo: 2 * 1_000_000 + 9 * 500_000, low: 1, out: 1 });
assert.equal(stockState(0, 3), "out"); assert.equal(stockState(3, 3), "low"); assert.equal(stockState(4, 3), "ok");
assert.equal(crossedLow(5, 3, 3), true); assert.equal(crossedLow(3, 2, 3), false, "already low: one alert, not one per sale"); assert.equal(crossedLow(2, 0, 3), true, "sold out always");

// The spreadsheet: out, and back in with changes; formulas can't run; problems are listed, not saved.
const csv = toCsv(lines);
assert.ok(csv.startsWith("item_id,title,option,sku,stock,low_stock_at,cost_naira,price_naira\n"));
assert.ok(!toCsv([{ ...lines[0], title: "=HYPERLINK(1)" }]).includes(",=HYPERLINK"));
assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,2,3'), [["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
const edited = csv.replace("bag,Tote bag,,TOTE,2,3,6000.00", "bag,Tote bag,,TOTE-NEW,12,5,6500.00").replace("tee,T-shirt,M|Black,TEE-M-BLACK,0", "tee,T-shirt,M|Black,TEE-M-BLACK,4");
const plan = planImport(edited + "nope,Ghost,,,1,1,1\ntee,T-shirt,L|Black,TEE-L,-3,2,2000\n", lines);
assert.deepEqual(plan.changes, [{ itemId: "bag", stock: 12, sku: "TOTE-NEW", lowAt: 5, costKobo: 650_000 }, { itemId: "tee", variant: "M|Black", stock: 4 }]);
assert.equal(plan.problems.length, 2);
assert.match(plan.problems[0], /no item with id nope/); assert.match(plan.problems[1], /stock should be a whole number/);
assert.deepEqual(planImport("sku,stock\nTEE-L,7\n", lines).changes, [{ itemId: "tee", variant: "L|Black", stock: 7 }], "matched by SKU alone");
assert.match(planImport("title,stock\nx,1\n", lines).problems[0], /item_id or sku/);
console.log("ALL OK");
