// The logistics provider network (lib/logistics.ts): zones, rate cards and quotes, coverage, #NotesApp's cut, the add-on and its trial.
// Run: npm run test:logistics → "ALL OK".
import assert from "node:assert/strict";
import { GEO_ZONES, addonExtendedUntil, cleanProfile, coverageLabel, covers, itemKg, providerAccess, quoteKobo, shippingCutKobo, zoneFor, type RateCard } from "../../lib/logistics";
import { NIGERIAN_STATES } from "../../lib/merch";

// every state is in exactly one geopolitical zone
const all = Object.values(GEO_ZONES).flat();
assert.equal(all.length, 37); assert.deepEqual([...all].sort(), [...NIGERIAN_STATES].sort());

// zones from Ikeja, Lagos
const ikeja = { city: "Ikeja", state: "Lagos" };
assert.equal(zoneFor(ikeja, { city: " ikeja ", state: "Lagos" }), "city", "same city, any case or spacing");
assert.equal(zoneFor(ikeja, { city: "Lekki", state: "Lagos" }), "state");
assert.equal(zoneFor(ikeja, { city: "Ibadan", state: "Oyo" }), "region", "Oyo is in the South West too");
assert.equal(zoneFor(ikeja, { city: "Enugu", state: "Enugu" }), "national");

// a rate card: ₦1,500 to ₦6,000 in the city …
const n = (naira: number[]) => naira.map((x) => x * 100);
const card: RateCard = {
  base: ikeja,
  prices: { city: n([1500, 2000, 3000, 4500, 6000]), state: n([2000, 2500, 3500, 5000, 7000]), region: n([3000, 3500, 5000, 7000, 9000]), national: n([4500, 5000, 7000, 9500, 12000]) },
  extraPerKgKobo: { city: 20000, state: 25000, region: 30000, national: 40000 },
  sameDayKobo: 100000,
};
const cov = ["Lagos", "Oyo", "Enugu"];
assert.equal(quoteKobo(card, cov, { city: "Ikeja", state: "Lagos" }, 0.5), 150000, "under 1 kg: the first band");
assert.equal(quoteKobo(card, cov, { city: "Ikeja", state: "Lagos" }, 1), 150000, "exactly 1 kg");
assert.equal(quoteKobo(card, cov, { city: "Lekki", state: "Lagos" }, 1.2), 250000, "just over 1 kg: the 2 kg band");
assert.equal(quoteKobo(card, cov, { city: "Enugu", state: "Enugu" }, 20), 1200000);
assert.equal(quoteKobo(card, cov, { city: "Enugu", state: "Enugu" }, 22.5), 1200000 + 3 * 40000, "past 20 kg: per started kilo");
assert.equal(quoteKobo(card, cov, { city: "Kano", state: "Kano" }, 1), null, "not covered");
assert.equal(quoteKobo(card, ["all"], { city: "Kano", state: "Kano" }, 1), 450000, "nationwide covers everything");

assert.ok(covers(["all"], "Borno")); assert.ok(!covers(["Lagos"], "Ogun"));
assert.equal(coverageLabel(["all"]), "All of Nigeria");
assert.equal(coverageLabel(["Lagos", "Ogun"]), "Lagos, Ogun");
assert.equal(coverageLabel(["Lagos", "Ogun", "Oyo", "Osun", "Ondo"]), "Lagos, Ogun, Oyo and 2 more states");

// the settings form
const good = { listed: true, about: " Reliable movers ", areas: "Ikeja, Lekki, Jibowu park", coverage: ["Oyo", "Lagos", "Atlantis"], services: ["waybill", "delivery", "teleport"], rateCard: card };
const ok = cleanProfile(good);
assert.ok(ok.ok);
if (ok.ok) {
  assert.deepEqual(ok.value.coverage, ["Lagos", "Oyo"], "known states, in the list's order");
  assert.deepEqual(ok.value.services, ["delivery", "waybill"]); assert.equal(ok.value.about, "Reliable movers");
}
const okAll = cleanProfile({ ...good, coverage: ["Lagos", "all"] });
assert.ok(okAll.ok && okAll.value.coverage.length === 1 && okAll.value.coverage[0] === "all", "all of Nigeria wins");
const err = (v: Record<string, unknown>) => { const r = cleanProfile({ ...good, ...v }); return r.ok ? null : r.error; };
assert.match(err({ coverage: [] })!, /states/);
assert.match(err({ services: [] })!, /service/);
assert.match(err({ rateCard: { ...card, base: { city: "", state: "Lagos" } } })!, /based/);
assert.match(err({ rateCard: { ...card, prices: { ...card.prices, city: n([1500, 1000, 3000, 4500, 6000]) } } })!, /heavier/);
assert.match(err({ rateCard: { ...card, prices: { ...card.prices, state: n([50, 2500, 3500, 5000, 7000]) } } })!, /Same state/);
assert.match(err({ rateCard: { ...card, prices: { ...card.prices, region: [1, 2] } } })!, /Nearby states/);
assert.match(err({ rateCard: { ...card, sameDayKobo: -1 } })!, /same-day/);

// #NotesApp's cut: 10%, at least ₦100, never more than the fee
assert.equal(shippingCutKobo(250000, 0.1, 10000), 25000);
assert.equal(shippingCutKobo(50000, 0.1, 10000), 10000, "₦500 fee: the ₦100 minimum");
assert.equal(shippingCutKobo(5000, 0.1, 10000), 5000, "never more than the fee");

// who can be a provider
const now = new Date("2026-10-19T10:00:00Z");
assert.deepEqual(providerAccess("business", undefined, now, 30), { ok: true, via: "plan" });
assert.deepEqual(providerAccess("enterprise", undefined, now, 30), { ok: true, via: "plan" });
assert.deepEqual(providerAccess("pro", undefined, now, 30), { ok: false, canTrial: true });
assert.deepEqual(providerAccess("standard", undefined, now, 30), { ok: false, canTrial: false }, "Free Standard can't publish, so no trial");
const trial = providerAccess("basic", { trialStartedAt: "2026-10-01T10:00:00Z" }, now, 30);
assert.ok(trial.ok && trial.via === "trial" && trial.until === "2026-10-31T10:00:00.000Z");
assert.deepEqual(providerAccess("basic", { trialStartedAt: "2026-09-01T10:00:00Z" }, now, 30), { ok: false, canTrial: false }, "one trial only");
const paid = providerAccess("pro", { trialStartedAt: "2026-09-01T10:00:00Z", addonUntil: "2026-11-01T00:00:00Z" }, now, 30);
assert.ok(paid.ok && paid.via === "addon");

// paying for a month runs on from what's left (trial or paid month), never from today when that's later
assert.equal(addonExtendedUntil(undefined, now, 30), "2026-11-19T10:00:00.000Z");
assert.equal(addonExtendedUntil({ trialStartedAt: "2026-10-10T10:00:00Z" }, now, 30), "2026-12-09T10:00:00.000Z", "after the trial ends");
assert.equal(addonExtendedUntil({ addonUntil: "2026-11-05T00:00:00Z" }, now, 30), "2026-12-05T00:00:00.000Z");

assert.equal(itemKg(undefined), 1); assert.equal(itemKg("2.5"), 2.5); assert.equal(itemKg(-3), 1); assert.equal(itemKg(10_000), 1);
console.log("ALL OK");
