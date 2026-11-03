// Prices an admin can change (lib/pricing.ts): the certificate late claim fee and the Nana allowances. Run: npm run test:pricing → "ALL OK".
import assert from "node:assert/strict";
import { DEFAULT_PRICING, PricingError, certificatePrice, cleanPricing, mergeCells } from "../../lib/pricing";

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
assert.deepEqual(DEFAULT_PRICING.nana.rates.ruby, { inUsd: 4, outUsd: 20 }); assert.deepEqual(DEFAULT_PRICING.nana.rates.pearl, { inUsd: 0.1, outUsd: 0.5 });
const before = clone(); delete before.nana.resetEvery; delete before.nana.allowanceGems; delete before.nana.usdKobo; delete before.nana.rates; delete before.nana.budgets.standard;
assert.deepEqual(cleanPricing(before).nana, DEFAULT_PRICING.nana);
const daily = clone(); daily.nana.resetEvery = "day"; daily.nana.allowanceGems = "pearl"; daily.nana.rates.emerald.outUsd = 16.5;
assert.equal(cleanPricing(daily).nana.resetEvery, "day"); assert.equal(cleanPricing(daily).nana.rates.emerald.outUsd, 16.5);
const hourly = clone(); hourly.nana.resetEvery = "hour";
assert.throws(() => cleanPricing(hourly), PricingError);
const pricey = clone(); pricey.nana.rates.pearl.inUsd = -1;
assert.throws(() => cleanPricing(pricey), PricingError);
// the logistics network: the add-on (₦4,500, a 15-day trial: every trial is 15 days, lib/trials.ts) and the cut on shipping (10%, at least ₦100); added later, so an older
// config keeps these defaults
assert.deepEqual(DEFAULT_PRICING.logistics, { addonMonthlyKobo: 4_500 * 100, trialDays: 15, cutRate: 0.1, cutMinKobo: 100 * 100 });
const noLogistics = clone(); delete noLogistics.logistics;
assert.deepEqual(cleanPricing(noLogistics).logistics, DEFAULT_PRICING.logistics);
const greedy = clone(); greedy.logistics.cutRate = 0.9;
assert.throws(() => cleanPricing(greedy), PricingError, "the cut is at most 50%");
const forever = clone(); forever.logistics.trialDays = 400;
assert.throws(() => cleanPricing(forever), PricingError);
const weekly = clone(); weekly.certificateLate.weeklyRate = 0.5;
assert.throws(() => cleanPricing(weekly), PricingError, "at most 25% a week");
const grace = clone(); grace.certificateLate.graceDays = -1;
assert.throws(() => cleanPricing(grace), PricingError);
// Business books (option A, 2 Nov 2026): 150 entries a month, 20 customers owing and 500 rows an import on Free Basic; added later, so an
// older config keeps the defaults; an admin can change them within limits.
assert.deepEqual(DEFAULT_PRICING.books, { freeEntries: 150, freeCustomers: 20, freeImportRows: 500, staffSeatsPro: 0, staffSeatsBusiness: 4, debtCommission: "store", debtHoldDays: 7 });
const noBooks = clone(); delete noBooks.books;
assert.deepEqual(cleanPricing(noBooks).books, DEFAULT_PRICING.books);
const moreBooks = clone(); moreBooks.books.freeEntries = 200;
assert.equal(cleanPricing(moreBooks).books.freeEntries, 200);
const noEntries = clone(); noEntries.books.freeEntries = 0;
assert.throws(() => cleanPricing(noEntries), PricingError, "at least 10 entries");
const hugeImport = clone(); hugeImport.books.freeImportRows = 9_000;
assert.throws(() => cleanPricing(hugeImport), PricingError, "a file is never more than 5,000 rows");
// Staff seats and paying a debt online (v0.119.0): added later still, so a config saved before them keeps the defaults (Business 4
// seats, Pro none until open question 4 is answered; a debt paid online takes the store's commission and is held 7 days).
const oldBooks = clone(); oldBooks.books = { freeEntries: 150, freeCustomers: 20, freeImportRows: 500 };
assert.deepEqual(cleanPricing(oldBooks).books, DEFAULT_PRICING.books);
const proSeat = clone(); proSeat.books.staffSeatsPro = 1;
assert.equal(cleanPricing(proSeat).books.staffSeatsPro, 1, "an admin can give Pro a helper seat");
const noDebtCut = clone(); noDebtCut.books.debtCommission = "none";
assert.equal(cleanPricing(noDebtCut).books.debtCommission, "none");
const badCut = clone(); badCut.books.debtCommission = "half";
assert.throws(() => cleanPricing(badCut), PricingError, "the store's commission or none");
const longHold = clone(); longHold.books.debtHoldDays = 90;
assert.throws(() => cleanPricing(longHold), PricingError, "60 days at most");
const manySeats = clone(); manySeats.books.staffSeatsPro = -1;
assert.throws(() => cleanPricing(manySeats), PricingError);
// The compare table shows a repeated cell once, spanning the plans that share it, and only neighbours merge.
assert.deepEqual(mergeCells(["a", "a", "a", "a", "a"]), [{ text: "a", span: 5, from: 0 }]);
assert.deepEqual(mergeCells(["—", "x", "x", "x", "x"]), [{ text: "—", span: 1, from: 0 }, { text: "x", span: 4, from: 1 }]);
assert.deepEqual(mergeCells(["a", "b", "a", "a", "c"]).map((c) => c.span), [1, 1, 2, 1]);
assert.deepEqual(mergeCells([]), []);
console.log("ALL OK");
