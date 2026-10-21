// Free trials (lib/trials.ts, owner's rule of 21 Oct 2026): 15 days, each plan once, a paid plan between two trials, only plans above the
// one you pay for. Run: npm run test:trials → "ALL OK".
import assert from "node:assert/strict";
import { TRIAL_DAYS, addonTrialDays, afterTrialTier, trialCheck, trialHistory } from "../../lib/trials";
import { cleanPricing, DEFAULT_PRICING } from "../../lib/pricing";

const now = new Date("2026-10-21T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const reason = (c: ReturnType<typeof trialCheck>) => (c.ok ? "ok" : c.reason);

assert.equal(TRIAL_DAYS, 15);
// A new Free Basic account can try Pro or Business, nothing else.
const fresh = { accountTier: "basic" };
assert.equal(reason(trialCheck(fresh, "pro", now, null)), "ok");
assert.equal(reason(trialCheck(fresh, "business", now, null)), "ok");
assert.equal(reason(trialCheck(fresh, "enterprise", now, null)), "not-a-plan");
// During a trial: no second one.
assert.equal(reason(trialCheck({ accountTier: "pro", trialTier: "pro", trialUntil: day(3), trials: [{ tier: "pro", startedAt: day(-12), until: day(3) }] }, "business", now, null)), "on-trial");
// After a Pro trial, without paying: stuck on Free Basic, even for Business.
const triedPro = { accountTier: "basic", trials: [{ tier: "pro", startedAt: day(-20), until: day(-5) }] };
assert.equal(reason(trialCheck(triedPro, "pro", now, null)), "tried");
assert.equal(reason(trialCheck(triedPro, "business", now, null)), "pay-first");
// Paid for Pro after the trial: may now try Business (above Pro), never Pro again.
const paidPro = { ...triedPro, accountTier: "pro", lastPaidAt: day(-4) };
assert.equal(reason(trialCheck(paidPro, "business", now, "pro")), "ok");
assert.equal(reason(trialCheck(paidPro, "pro", now, "pro")), "tried");
// Paid before the trial doesn't count as "in between".
assert.equal(reason(trialCheck({ ...triedPro, lastPaidAt: day(-30) }, "business", now, null)), "pay-first");
// Paying for Business: nothing to try.
assert.equal(reason(trialCheck({ accountTier: "business", lastPaidAt: day(-1) }, "pro", now, "business")), "has-plan");
assert.equal(reason(trialCheck({ accountTier: "enterprise" }, "business", now, null)), "has-plan", "an admin-set plan counts too");
// The old 30-day organisation trial counts as a Business trial.
const oldOrg = { accountTier: "basic", trialUsedAt: day(-60) };
assert.deepEqual(trialHistory(oldOrg).map((t) => t.tier), ["business"]);
assert.equal(reason(trialCheck(oldOrg, "business", now, null)), "tried");
assert.equal(reason(trialCheck(oldOrg, "pro", now, null)), "pay-first");
// Where an ended trial lands.
assert.equal(afterTrialTier(null), "basic"); assert.equal(afterTrialTier("pro"), "pro");
// Add-on trials are never longer than 15 days, including a saved 30.
assert.equal(addonTrialDays(30), 15); assert.equal(addonTrialDays(7), 7);
assert.equal(DEFAULT_PRICING.logistics.trialDays, 15);
assert.equal(cleanPricing({ ...DEFAULT_PRICING, logistics: { ...DEFAULT_PRICING.logistics, trialDays: 30 } }).logistics.trialDays, 15);
console.log("ALL OK");
