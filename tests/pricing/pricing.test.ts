// Prices an admin can change (lib/pricing.ts): the certificate late claim fee and the Nana allowances. Run: npm run test:pricing → "ALL OK".
import assert from "node:assert/strict";
import { DEFAULT_PRICING, PricingError, certificatePrice, cleanPricing } from "../../lib/pricing";

const done = "2026-10-01T10:00:00Z";
const at = (days: number) => new Date(Date.parse(done) + days * 86_400_000);
const start = 1_499 * 100; // ₦999 + a ₦500 margin
// free for 7 days, then 1% of the starting price a full week, not compounding
assert.deepEqual(certificatePrice(start, done, at(0)), { kobo: start, lateKobo: 0, weeksLate: 0, capped: false });
assert.equal(certificatePrice(start, done, at(7)).kobo, start, "the 7th day is still free");
assert.equal(certificatePrice(start, done, at(13)).kobo, start, "less than a full week late");
assert.deepEqual(certificatePrice(start, done, at(14)), { kobo: start + 1_500, lateKobo: 1_500, weeksLate: 1, capped: false }, "1% of ₦1,499 = ₦14.99 → ₦15");
assert.equal(certificatePrice(start, done, at(7 + 7 * 10)).lateKobo, Math.ceil(start * 0.1 / 100) * 100, "10 weeks = 10%, not compounding");
const year = certificatePrice(start, done, at(400));
assert.equal(year.lateKobo, Math.ceil(start * 0.5 / 100) * 100); assert.equal(year.capped, true, "capped at +50%");
assert.equal(certificatePrice(start, done, at(-3)).kobo, start, "a clock behind the completion charges nothing extra");
assert.equal(certificatePrice(start, done, at(30), { graceDays: 0, weeklyRate: 0.02, capRate: 0 }).lateKobo, 0, "a cap of 0 means no late fee");

// defaults, and the admin form's checks
assert.deepEqual(DEFAULT_PRICING.certificateLate, { graceDays: 7, weeklyRate: 0.01, capRate: 0.5 });
assert.equal(DEFAULT_PRICING.nana.budgets.basic, 50 * 100); assert.equal(DEFAULT_PRICING.nana.budgets.business, 3_000 * 100);
assert.ok(DEFAULT_PRICING.nana.topUps.every((t) => t.creditKobo < t.priceKobo), "top-ups keep a margin");
const clone = () => structuredClone(DEFAULT_PRICING) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
assert.deepEqual(cleanPricing(clone()), DEFAULT_PRICING, "the defaults pass their own checks");
const old = clone(); delete old.certificateLate; delete old.nana;
assert.deepEqual(cleanPricing(old).certificateLate, DEFAULT_PRICING.certificateLate, "a config saved before these existed keeps the defaults");
const free = clone(); free.nana.topUps[0].creditKobo = free.nana.topUps[0].priceKobo + 100;
assert.throws(() => cleanPricing(free), PricingError, "a top-up can't give more than it costs");
// Nana's timer, gems and model prices came later: a nana section saved before them keeps their defaults.
assert.equal(DEFAULT_PRICING.nana.resetEvery, "week"); assert.equal(DEFAULT_PRICING.nana.allowanceGems, "all"); assert.equal(DEFAULT_PRICING.nana.budgets.standard, 50 * 100);
assert.deepEqual(DEFAULT_PRICING.nana.rates.ruby, { inUsd: 5, outUsd: 25 });
const before = clone(); delete before.nana.resetEvery; delete before.nana.allowanceGems; delete before.nana.usdKobo; delete before.nana.rates; delete before.nana.budgets.standard;
assert.deepEqual(cleanPricing(before).nana, DEFAULT_PRICING.nana);
const daily = clone(); daily.nana.resetEvery = "day"; daily.nana.allowanceGems = "pearl"; daily.nana.rates.emerald.outUsd = 16.5;
assert.equal(cleanPricing(daily).nana.resetEvery, "day"); assert.equal(cleanPricing(daily).nana.rates.emerald.outUsd, 16.5);
const hourly = clone(); hourly.nana.resetEvery = "hour";
assert.throws(() => cleanPricing(hourly), PricingError);
const pricey = clone(); pricey.nana.rates.pearl.inUsd = -1;
assert.throws(() => cleanPricing(pricey), PricingError);
const weekly = clone(); weekly.certificateLate.weeklyRate = 0.5;
assert.throws(() => cleanPricing(weekly), PricingError, "at most 25% a week");
const grace = clone(); grace.certificateLate.graceDays = -1;
assert.throws(() => cleanPricing(grace), PricingError);
console.log("ALL OK");
