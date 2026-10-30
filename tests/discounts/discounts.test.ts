// Discount codes (lib/discounts.ts): what a code takes off, when it can't be used, and how a basket shares it.
// Run: npm run test:discounts → "DISCOUNTS OK".
import assert from "node:assert/strict";
import { DiscountError, MIN_PAYABLE_KOBO, cleanCodeInput, codeId, describeCode, discountFor, normalizeCode, spreadDiscount, type DiscountCode, type DiscountTarget } from "../../lib/discounts";

const base: DiscountCode = {
  id: "shop_SAVE10", owner: "shop", code: "SAVE10", kind: "percent", percent: 10, targets: ["store", "digital"], itemIds: [],
  maxUses: null, perBuyer: 1, startsAt: null, endsAt: null, minOrderKobo: null, firstOrderOnly: false, active: true,
  uses: 0, discountGivenKobo: 0, revenueKobo: 0, createdAt: "2026-10-01T00:00:00Z", createdBy: "shop", updatedAt: "2026-10-01T00:00:00Z",
};
const now = new Date("2026-10-30T12:00:00Z");
const use = { target: "store" as DiscountTarget, subtotalKobo: 2_000_000, now, buyerUses: 0, buyerHasPaidOwner: false };
const off = (c: Partial<DiscountCode>, u: Partial<typeof use> & Record<string, unknown> = {}) => discountFor({ ...base, ...c }, { ...use, ...u });

assert.deepEqual(off({}), { ok: true, discountKobo: 200_000 }, "10% of ₦20,000");
assert.deepEqual(off({ percent: 15 }, { subtotalKobo: 333_300 }), { ok: true, discountKobo: 49_900 }, "rounded down to whole naira");
assert.deepEqual(off({ kind: "amount", amountKobo: 500_000, percent: undefined }), { ok: true, discountKobo: 500_000 }, "a fixed amount");
assert.deepEqual(off({ kind: "amount", amountKobo: 5_000_000, percent: undefined }), { ok: true, discountKobo: 2_000_000 - MIN_PAYABLE_KOBO }, "never under ₦100");
assert.deepEqual(off({ kind: "amount", amountKobo: 5_000_000, percent: undefined }, { extraKobo: 300_000 }), { ok: true, discountKobo: 2_000_000 }, "the delivery counts towards the ₦100, but the goods can't go below ₦0");
assert.equal((off({}, { subtotalKobo: MIN_PAYABLE_KOBO }) as { reason: string }).reason, "This is already at the lowest price a code can take it to.");

const why = (c: Partial<DiscountCode>, u: Partial<typeof use> & Record<string, unknown> = {}) => { const r = off(c, u); assert.equal(r.ok, false); return (r as { reason: string }).reason; };
assert.match(why({ active: false }), /isn't active/);
assert.match(why({ startsAt: "2026-11-01T00:00:00Z" }), /isn't open yet/);
assert.match(why({ endsAt: "2026-10-30T11:59:59Z" }), /has ended/);
assert.match(why({}, { target: "course" }), /doesn't work on this/);
assert.match(why({ itemIds: ["dress"] }, { itemId: "shoe" }), /doesn't work on this item/);
assert.equal(off({ itemIds: ["dress"] }, { itemIds: ["shoe", "dress"] }).ok, true, "a basket with the item in it");
assert.match(why({ maxUses: 5, uses: 5 }), /used up/);
assert.match(why({}, { buyerUses: 1 }), /already used/);
assert.equal(off({ perBuyer: 3 }, { buyerUses: 2 }).ok, true);
assert.match(why({ perBuyer: 3 }, { buyerUses: 3 }), /3 times already/);
assert.match(why({ firstOrderOnly: true }, { buyerHasPaidOwner: true }), /first order/);
assert.match(why({ minOrderKobo: 5_000_000 }), /₦50,000 or more/);

assert.deepEqual(spreadDiscount([7_000_000, 2_200_000], 920_000), [700_000 + 0, 220_000], "in proportion to the goods");
const parts = spreadDiscount([100, 100, 100], 100);
assert.equal(parts.reduce((a, b) => a + b, 0), 100, "the whole discount, to the kobo"); assert.deepEqual(parts, [34, 33, 33]);
assert.deepEqual(spreadDiscount([500, 500], 0), [0, 0]);

assert.equal(normalizeCode("  save 10 "), "SAVE10");
assert.equal(codeId("shop", "save10"), "shop_SAVE10");
assert.equal(describeCode({ kind: "amount", amountKobo: 250_000 }), "₦2,500 off");
const ok = cleanCodeInput({ code: "welcome-10", kind: "percent", percent: 10, targets: ["store", "boost", "course"], perBuyer: "2", maxUses: "", endsAt: "2026-12-31" }, false);
assert.deepEqual([ok.code, ok.targets, ok.perBuyer, ok.maxUses], ["WELCOME-10", ["store", "course"], 2, null], "a publisher's code keeps only publisher products");
assert.deepEqual(cleanCodeInput({ code: "NANA5", kind: "amount", amountKobo: 50_000, targets: ["nana_credit", "store"] }, true).targets, ["nana_credit"], "#NotesApp's codes keep only #NotesApp products");
const bad = (raw: Record<string, unknown>, re: RegExp) => assert.throws(() => cleanCodeInput({ code: "OK1", kind: "percent", percent: 10, targets: ["store"], ...raw }, false), (e: unknown) => e instanceof DiscountError && re.test(e.message));
bad({ code: "ab" }, /3 to 20/);
bad({ code: "-AB" }, /starting with a letter/);
bad({ percent: 95 }, /from 1 to 90/);
bad({ kind: "amount", amountKobo: 5_050, percent: undefined }, /whole naira/);
bad({ targets: ["boost"] }, /what the code works on/);
bad({ startsAt: "2026-12-01", endsAt: "2026-11-01" }, /after the start/);
console.log("DISCOUNTS OK");
