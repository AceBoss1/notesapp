// Merch in 3D: the pure rules (lib/merch.ts) and the merch section of the pricing settings (lib/pricing.ts).
// Run: npm run test:merch → "ALL OK".
import assert from "node:assert/strict";
import {
  DEFAULT_MERCH, MERCH_BATCH, MERCH_DESIGNS, MERCH_ITEMS, MerchError, applyMerch, choiceText, cleanBackName, cleanMerch, currentMerch,
  merchBatchOpen, merchBatchState, merchDeliveryKobo, placesFor, printKey, quoteMerch,
} from "../../lib/merch";
import { DEFAULT_PRICING, PricingError, applyPricing, cleanPricing, currentPricing, describeChanges } from "../../lib/pricing";

const throwsMerch = (f: () => unknown, re: RegExp) => assert.throws(f, (e: unknown) => e instanceof MerchError && re.test(e.message));

// ── The owner's custom shirts: ₦10,000, a name on the back ₦4,000 ──
assert.equal(MERCH_DESIGNS.length, 4);
const plain = quoteMerch({ product: "design:black-drip", size: "L", quantity: 1 });
assert.equal(plain.quote.eachKobo, 10_000_00);
assert.deepEqual(plain.quote.lines.map((l) => l.label), ["Custom shirt: Black Drip"]);
const named = quoteMerch({ product: "design:maroon-stripes", size: "M", name: "  ada  obi ", quantity: 2 });
assert.equal(named.name, "ADA OBI");
assert.deepEqual(named.quote.lines, [{ label: "Custom shirt: Maroon Stripes", kobo: 10_000_00 }, { label: "Name on the back: ADA OBI", kobo: 4_000_00 }]);
assert.equal(named.quote.eachKobo, 14_000_00);
assert.equal(named.quote.subtotalKobo, 28_000_00);
assert.equal(named.quote.deliveryKobo, merchDeliveryKobo());
// A design ignores colour, logo and place: it's printed all over.
assert.equal(quoteMerch({ product: "design:ivory-drip", size: "S", colour: "navy", place: "both", quantity: 1 }).quote.eachKobo, 10_000_00);
throwsMerch(() => quoteMerch({ product: "design:ivory-drip", quantity: 1 }), /size/);
throwsMerch(() => quoteMerch({ product: "design:nope", size: "M", quantity: 1 }), /isn't on offer/);

// ── A blank item: colour, logo, where it's printed, extras ──
const tee = quoteMerch({ product: "item:tshirt", colour: "crimson", logoId: "core", place: "both", size: "XXL", name: "Tolu", quantity: 2 });
assert.deepEqual(tee.quote.lines.map((l) => [l.label, l.kobo]), [["T-Shirt", 12_000_00], ["Front and back", 2_500_00], ["XXL", 1_000_00], ["Name on the back: TOLU", 4_000_00]]);
assert.equal(tee.quote.eachKobo, 19_500_00);
assert.equal(tee.quote.subtotalKobo, 39_000_00);
const mug = quoteMerch({ product: "item:mug", colour: "white", logoId: "christmas", place: "wrap", quantity: 1 });
assert.deepEqual(mug.quote.lines.map((l) => l.kobo), [6_500_00, 1_000_00]);
assert.equal(mug.size, undefined);
assert.equal(quoteMerch({ product: "item:mug", colour: "white", name: "ADA", quantity: 1 }).name, "", "only shirts carry a name");
assert.equal(quoteMerch({ product: "item:cap", quantity: 1 }).r.kind === "item" && (quoteMerch({ product: "item:cap", quantity: 1 }).r as { colour: { id: string } }).colour.id, "crimson", "the first colour by default");
throwsMerch(() => quoteMerch({ product: "item:cap", colour: "sand", quantity: 1 }), /doesn't come in that colour/);
throwsMerch(() => quoteMerch({ product: "item:cap", place: "wrap", quantity: 1 }), /can't be printed there/);
throwsMerch(() => quoteMerch({ product: "item:mug", logoId: "nope", quantity: 1 }), /logo/);
throwsMerch(() => quoteMerch({ product: "item:tshirt", size: "M", quantity: 11 }), /1 to 10/);
throwsMerch(() => quoteMerch({ product: "item:tshirt", size: "M", quantity: 0 }), /1 to 10/);
throwsMerch(() => quoteMerch({ product: "tshirt", quantity: 1 }), /Choose an item/);
assert.deepEqual(placesFor("tshirt"), ["front", "chest", "both"]);
assert.deepEqual(placesFor("coffeecup"), ["front", "wrap"]);
assert.deepEqual(placesFor("laptopbag"), ["front"]);

// ── Names on the back ──
assert.equal(cleanBackName(""), "");
assert.equal(cleanBackName("o'neil-jr."), "O'NEIL-JR.");
assert.equal(cleanBackName("No 10"), "NO 10");
throwsMerch(() => cleanBackName("ABCDEFGHIJKLM"), /12 characters/);
throwsMerch(() => cleanBackName("ADA 🔥"), /letters/);
throwsMerch(() => cleanBackName("<b>"), /letters/);

// ── Admin's settings ──
const saved = cleanMerch({
  batch: { label: "Batch 2", opensOn: "2026-12-01", closesOn: "2026-12-15", note: "" },
  deliveryKobo: 3_500_00,
  items: [{ id: "tshirt", priceKobo: 11_000_00, on: true, colours: ["black", "black", "grey", "pink"] }, { id: "laptopbag", priceKobo: 25_000_00, on: false, colours: ["black"] }, { id: "spaceship", priceKobo: 1 }],
  designs: [{ id: "black-drip", priceKobo: 9_000_00, on: true }],
  extras: { backKobo: 2_000_00, xxlKobo: 0, wrapKobo: 1_000_00, nameKobo: 4_000_00 },
});
assert.equal(saved.batch.id, "batch-2");
assert.equal(saved.batch.note, DEFAULT_MERCH.batch.note, "an empty note keeps the default");
assert.deepEqual(saved.items.find((i) => i.id === "tshirt")!.colours, ["black", "grey"], "unknown and repeated colours dropped");
assert.equal(saved.items.find((i) => i.id === "laptopbag")!.on, false);
assert.equal(saved.items.find((i) => i.id === "cap")!.priceKobo, 8_000_00, "items not sent keep their settings");
assert.equal(saved.items.length, MERCH_ITEMS.length);
assert.equal(saved.designs.find((d) => d.id === "ivory-drip")!.priceKobo, 10_000_00);
throwsMerch(() => cleanMerch({ ...saved, batch: { ...saved.batch, label: "" } }), /name/);
throwsMerch(() => cleanMerch({ ...saved, batch: { ...saved.batch, opensOn: "2026-12-20" } }), /closes before it opens/);
throwsMerch(() => cleanMerch({ ...saved, batch: { ...saved.batch, closesOn: "soon" } }), /last day/);
throwsMerch(() => cleanMerch({ ...saved, items: [{ id: "cap", priceKobo: 8_000_00, colours: [] }] }), /Cap: choose at least one colour/);
throwsMerch(() => cleanMerch({ ...saved, items: [{ id: "cap", priceKobo: 50, colours: ["black"] }] }), /Cap price/);
throwsMerch(() => cleanMerch({ ...saved, extras: { ...saved.extras, nameKobo: -1 } }), /Name on the back/);

// Applied: the store, checkout and campus rewards read the live values.
applyMerch(saved);
assert.equal(MERCH_BATCH.label, "Batch 2");
assert.equal(merchDeliveryKobo(), 3_500_00);
assert.equal(MERCH_ITEMS.find((i) => i.id === "tshirt")!.priceKobo, 11_000_00);
assert.equal(quoteMerch({ product: "design:black-drip", size: "XXL", quantity: 1 }).quote.eachKobo, 9_000_00, "XXL is free when set to 0");
throwsMerch(() => quoteMerch({ product: "item:laptopbag", quantity: 1 }), /isn't on offer/);
throwsMerch(() => quoteMerch({ product: "item:tshirt", colour: "white", size: "M", quantity: 1 }), /colour/);
// The batch: not open before it opens, open on its days, closed after.
const at = (s: string) => Date.parse(s);
assert.equal(merchBatchState(at("2026-11-20T12:00:00+01:00")), "soon");
assert.equal(merchBatchOpen(at("2026-12-01T00:30:00+01:00")), true);
assert.equal(merchBatchOpen(at("2026-12-15T23:30:00+01:00")), true);
assert.equal(merchBatchState(at("2026-12-16T00:30:00+01:00")), "closed");
applyMerch(DEFAULT_MERCH);
assert.deepEqual(currentMerch(), DEFAULT_MERCH);
assert.equal(merchBatchState(at("2026-11-19T12:00:00+01:00")), "closed", "Batch 1 closed on 15 Nov");

// ── Inside the pricing settings: saved, applied and logged like any price ──
assert.deepEqual(DEFAULT_PRICING.merch, DEFAULT_MERCH);
const { merch: _m, ...older } = DEFAULT_PRICING;
assert.deepEqual(cleanPricing(older).merch, DEFAULT_MERCH, "a config saved before merch existed keeps the defaults");
const next = cleanPricing({ ...DEFAULT_PRICING, merch: saved });
assert.ok(describeChanges(DEFAULT_PRICING, next).includes("merch.deliveryKobo: 300000 → 350000"));
assert.ok(describeChanges(DEFAULT_PRICING, next).some((c) => c.startsWith("merch.designs.black-drip.priceKobo")));
assert.throws(() => cleanPricing({ ...DEFAULT_PRICING, merch: { ...saved, deliveryKobo: "lots" } }), (e: unknown) => e instanceof PricingError && /Delivery/.test((e as Error).message));
applyPricing(next);
assert.equal(currentPricing().merch.batch.label, "Batch 2");
assert.equal(merchDeliveryKobo(), 3_500_00);
applyPricing(DEFAULT_PRICING);
assert.equal(merchDeliveryKobo(), 3_000_00);

// ── Words and the print sheet ──
assert.equal(choiceText({ colourName: "Crimson", logoLabel: "Core Mark", place: "both", size: "XL", backName: "ADA" }), "Crimson · Core Mark · Front and back · XL · Name: ADA");
assert.equal(choiceText({ colourName: "White", logoLabel: "Core Mark", place: "front" }), "White · Core Mark");
const k = (o: Record<string, string>) => printKey({ itemName: "T-Shirt", logoLabel: "Core Mark", size: "M", ...o });
assert.equal(k({ colourName: "Black" }), k({ colourName: "Black", place: "front" }));
assert.notEqual(k({ colourName: "Black" }), k({ colourName: "Black", backName: "ADA" }));

console.log("ALL OK");
