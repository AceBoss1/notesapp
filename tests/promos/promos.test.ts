// Promo campaigns, the pure rules (lib/promos.ts): matching the code, who may claim which plan, slots, the tournament day.
// Run: npx -y tsx tests/promos/promos.test.ts → "promos: ok".
import assert from "node:assert/strict";
import {
  DAVIDO_AT_34 as C, campaignByCode, campaignLive, claimCheck, emptyCounts, isPromoSource, lagosDate, normCode, poolOf, promoSource, promoUntil,
  publicStatus, slotsLeft, tournamentOpen, venturesLeft,
} from "../../lib/promos";
import { trialCheck } from "../../lib/trials";

const now = new Date("2026-11-21T12:00:00Z");
const pub = { role: "publisher", accountTier: "basic" };

// The code, however it's typed.
for (const c of ["DAVIDO-at-34", "davido-at-34", "Davido at 34", " DAVIDO_AT_34 ", "davidoat34"]) assert.equal(campaignByCode(c)?.id, "davido-at-34", c);
for (const c of ["DAVIDO-at-33", "", null, undefined, "davido"]) assert.equal(campaignByCode(c), null, String(c));
assert.equal(normCode("Da-vi do"), "DAVIDO");

// The pools on the poster: 34 Enterprise and 34 Business for a month, 1,000 Pro for a year; 4 venture slots up to ₦5m; ₦10m tournament.
assert.deepEqual(C.plans.map((p) => [p.tier, p.slots, p.days]), [["enterprise", 34, 30], ["business", 34, 30], ["pro", 1000, 365]]);
assert.equal(C.ventures!.slots, 4); assert.equal(C.ventures!.maxKoboPerVenture, 500_000_000); assert.equal(C.ventures!.totalKobo, 2_000_000_000);
assert.equal(C.tournament!.sponsorshipKobo, 1_000_000_000);
// Total potential value on the poster: ₦82.72m+ = ₦20m ventures + ₦1.87m Enterprise + ₦850k Business + ₦50m Pro + ₦10m tournament.
assert.equal(20_000_000 + 1_870_000 + 850_000 + 50_000_000 + 10_000_000, 82_720_000);

// Live from launch, until the slots run out.
assert.equal(campaignLive(C, now), true);
assert.equal(campaignLive(C, new Date("2026-11-20T22:00:00Z")), false, "before Lagos midnight on the 21st");
assert.equal(campaignLive(C, new Date("2027-06-01T00:00:00Z")), true, "no end date");

// Slots.
const counts = { ...emptyCounts(), plans: { enterprise: 33, pro: 1000 }, venturePicks: 4 };
assert.equal(slotsLeft(C, counts, "enterprise"), 1);
assert.equal(slotsLeft(C, counts, "business"), 34);
assert.equal(slotsLeft(C, counts, "pro"), 0);
assert.equal(venturesLeft(C, counts), 0);
const st = publicStatus(C, counts, now);
assert.deepEqual(st.plans.map((p) => p.left), [1, 34, 0]);
assert.equal(st.ventures!.left, 0);

// Who may claim.
const ok = (p: object, tier: string, paid: string | null = null, claimed = false) => claimCheck(C, p, tier, now, paid, claimed);
assert.deepEqual(ok(pub, "pro"), { ok: true });
assert.deepEqual(ok(pub, "enterprise"), { ok: true });
assert.match((ok(pub, "gold") as { message: string }).message, /Enterprise, Business or Pro/);
assert.match((ok({ role: "reader", accountTier: "standard" }, "pro") as { message: string }).message, /switch to Free Basic/);
assert.match((ok({ ...pub, suspended: true }, "pro") as { message: string }).message, /can't do that/);
assert.match((ok(pub, "pro", null, true) as { message: string }).message, /one per account/);
assert.equal(ok(undefined as never, "pro").ok, false);
// Already has the plan (paid, or given for good): no slot wasted. A higher plan is fine.
assert.match((ok({ role: "publisher", accountTier: "pro" }, "pro", "pro") as { message: string }).message, /already has Pro/);
assert.match((ok({ role: "publisher", accountTier: "business" }, "pro", "business") as { message: string }).message, /already has Pro/);
assert.deepEqual(ok({ role: "publisher", accountTier: "pro" }, "business", "pro"), { ok: true });
assert.match((ok({ role: "publisher", accountTier: "enterprise" }, "business") as { message: string }).message, /already has Business/);
// On a 15-day Pro trial: a year of Pro is worth claiming, and so is Business; on a Business trial, Pro isn't.
const trialPro = { ...pub, accountTier: "pro", trialTier: "pro", trialUntil: "2026-11-30T00:00:00Z" };
assert.deepEqual(ok(trialPro, "pro"), { ok: true });
assert.deepEqual(ok(trialPro, "business"), { ok: true });
assert.equal(ok({ ...pub, accountTier: "business", trialTier: "business", trialUntil: "2026-11-30T00:00:00Z" }, "pro").ok, false);
// …but a running Business plan that lasts longer than a month isn't replaced by a month of Business.
assert.equal(ok({ ...pub, accountTier: "business", trialTier: "business", trialUntil: "2027-01-30T00:00:00Z" }, "business").ok, false);
// An ended trial doesn't count.
assert.deepEqual(ok({ ...pub, trialTier: "business", trialUntil: "2026-11-01T00:00:00Z" }, "pro"), { ok: true });

// The plan's end and its marker.
assert.equal(promoUntil(C, "pro", now), "2027-11-21T12:00:00.000Z");
assert.equal(promoUntil(C, "business", now), "2026-12-21T12:00:00.000Z");
assert.equal(poolOf(C, "enterprise")!.days, 30);
assert.equal(promoSource(C), "promo:davido-at-34");
assert.equal(isPromoSource("promo:davido-at-34"), true); assert.equal(isPromoSource(undefined), false);

// A promo plan doesn't use up the member's own free trial: it isn't in `trials`, so after it ends they can still try a plan.
const afterPromo = { accountTier: "basic", trials: [] };
assert.deepEqual(trialCheck(afterPromo, "business", new Date("2027-01-01T00:00:00Z"), null), { ok: true });
// While it runs, the trial check says "plan", not "trial".
const during = trialCheck({ accountTier: "pro", trialTier: "pro", trialUntil: "2027-11-21T12:00:00Z", trialSource: "promo:davido-at-34" }, "business", now, null);
assert.equal(during.ok, false); assert.match((during as { message: string }).message, /free Pro plan until/);

// The tournament: sign-ups on 21 Nov 2026, Lagos time, only.
assert.equal(lagosDate(new Date("2026-11-20T23:30:00Z")), "2026-11-21", "00:30 in Lagos");
assert.equal(lagosDate(new Date("2026-11-21T22:59:00Z")), "2026-11-21");
assert.equal(lagosDate(new Date("2026-11-21T23:00:00Z")), "2026-11-22");
assert.equal(tournamentOpen(C, new Date("2026-11-21T08:00:00Z")), true);
assert.equal(tournamentOpen(C, new Date("2026-11-21T23:00:00Z")), false, "midnight in Lagos");
assert.equal(tournamentOpen(C, new Date("2026-11-22T10:00:00Z")), false);

console.log("promos: ok");
