// Referrals and affiliates: the pure rules (lib/referrals.ts). Run: npm run test:referrals → "REFERRALS OK".
import assert from "node:assert/strict";
import {
  CARD_CHECK_KOBO, MIN_CASH_KOBO, affiliateKobo, cleanAffiliatePercent, creditWithBonus, firstPeriodOffer, isAvailable, jumpAlert,
  planEarningKobo, referralLink, safeTarget, withinPlanWindow,
} from "../../lib/referrals";

// links, and where they may send someone
assert.equal(referralLink("https://notesapp.com.ng/", "amaka"), "https://notesapp.com.ng/r/amaka");
assert.equal(referralLink("https://notesapp.com.ng", "amaka", "/shop/dress"), "https://notesapp.com.ng/r/amaka?to=%2Fshop%2Fdress");
assert.equal(safeTarget("/shop/dress"), "/shop/dress");
assert.equal(safeTarget("/academy/intro?x=1"), "/academy/intro?x=1");
for (const bad of ["https://evil.com", "//evil.com", "/r/someone", "javascript:alert(1)", "", null, 5]) assert.equal(safeTarget(bad), "/signup", String(bad));

// plans: 20% for 12 months from the first real payment
assert.equal(planEarningKobo(1_000_000), 200_000);
const first = "2026-01-15T10:00:00.000Z";
assert.equal(withinPlanWindow(undefined, new Date()), true, "the first payment opens the window");
assert.equal(withinPlanWindow(first, new Date("2026-12-31T00:00:00Z")), true, "month 12");
assert.equal(withinPlanWindow(first, new Date("2027-01-15T10:00:01Z")), false, "after 12 months");

// the referred friend's first period
const m = firstPeriodOffer("monthly", 500_000, 5_000_000);
assert.deepEqual([m.chargeKobo, m.refundCheck], [CARD_CHECK_KOBO, true], "monthly: only a refundable card check");
const y = firstPeriodOffer("annually", 500_000, 5_000_000);
assert.deepEqual([y.chargeKobo, y.refundCheck], [4_500_000, false], "yearly: a month's value off, paid now");

// product shares
assert.equal(affiliateKobo(3_150_000, 10), 315_000);
assert.equal(affiliateKobo(999, 15), 149, "rounded down to the kobo");
assert.equal(cleanAffiliatePercent(""), 0);
assert.equal(cleanAffiliatePercent("25"), 25);
assert.throws(() => cleanAffiliatePercent(51));
assert.throws(() => cleanAffiliatePercent(2.5));

// taking earnings out
assert.deepEqual(creditWithBonus(MIN_CASH_KOBO), { creditKobo: 200_000, bonusKobo: 20_000 });
const now = new Date("2026-11-01T00:00:00Z");
assert.equal(isAvailable({ status: "held", releaseAfter: "2026-10-31T00:00:00Z" }, now), true);
assert.equal(isAvailable({ status: "held", releaseAfter: "2026-11-02T00:00:00Z" }, now), false);
assert.equal(isAvailable({ status: "withdrawn", releaseAfter: "2026-10-31T00:00:00Z" }, now), false);

// no cap, but an alert on a sudden jump
assert.equal(jumpAlert(4_000_000, [0, 0, 0, 0]), false, "under ₦50,000 is never flagged");
assert.equal(jumpAlert(6_000_000, [0, 0, 0, 0]), true, "₦60,000 from nothing");
assert.equal(jumpAlert(6_000_000, [2_500_000, 2_500_000, 2_500_000, 2_500_000]), false, "a usual week of ₦25,000: under 3×");
assert.equal(jumpAlert(8_000_000, [2_500_000, 2_500_000, 2_500_000, 2_500_000]), true, "3× a usual week");

console.log("REFERRALS OK");
