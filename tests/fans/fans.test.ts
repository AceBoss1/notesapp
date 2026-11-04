// Fan levels and subscription tiers (lib/fans.ts): the settings Admin saves, the tier prices and commission share (the owner's 8%
// example), creators' settings from before tiers, who can read what, the rank badges, the next band and the live entrances.
// Run: npm run test:fans → "FANS OK".
import assert from "node:assert/strict";
import * as F from "../../lib/fans";

// ── Settings ──
assert.deepEqual(F.FAN_DEFAULTS, { premiumMin: 1_000, premiumMax: 100_000, vipMin: 5_000, vipMax: 200_000, vvipMin: 10_000, vvipMax: 500_000, vipUpliftPct: 10, vvipUpliftPct: 20 }, "the owner's ranges and shares");
assert.deepEqual(F.cleanFanOverrides({ vipMin: 6_000, vvipUpliftPct: 25, premiumMax: 100_000 }), { vipMin: 6_000, vvipUpliftPct: 25 }, "defaults aren't stored");
assert.throws(() => F.cleanFanOverrides({ vipUpliftPct: 101 }), /VIP: #NotesApp takes/);
assert.throws(() => F.cleanFanOverrides({ premiumMin: 50 }), /Premium: lowest/);
assert.throws(() => F.cleanFanOverrides({ vipMin: 300_000 }), /VIP: the lowest price is above the highest/);
assert.deepEqual(F.cleanFanOverrides(undefined), {});
assert.equal(F.fanSettings({ vvipMin: 900_000, vvipMax: 1_000 }).vvipMin, 10_000, "a range the wrong way round falls back");
assert.deepEqual(F.tierRangeKobo("vip"), { minKobo: 500_000, maxKobo: 20_000_000 });

// ── Commission: the creator's rate plus a share of it (8% → Premium 8%, VIP 8.8%, VVIP 9.6%) ──
assert.equal(F.tierRate(0.08, "premium"), 0.08);
assert.equal(F.tierRate(0.08, "vip"), 0.088);
assert.equal(F.tierRate(0.08, "vvip"), 0.096);
assert.equal(F.tierRate(0.9, "vvip", F.fanSettings({ vvipUpliftPct: 100 })), 1, "never over 100%");

// ── A creator's tiers, and settings from before tiers ──
const legacy = F.tierOffers({ enabled: true, priceKobo: 250_000, planCode: "PLN_old" });
assert.deepEqual(legacy, { premium: { enabled: true, priceKobo: 250_000, planCode: "PLN_old" }, vip: { enabled: false, priceKobo: 0 }, vvip: { enabled: false, priceKobo: 0 } }, "the one price is Premium");
assert.deepEqual(F.openTiers(legacy), ["premium"]);
const three = F.tierOffers({ enabled: true, priceKobo: 250_000, planCode: "P", tiers: { premium: { enabled: true, priceKobo: 250_000, planCode: "P" }, vip: { enabled: true, priceKobo: 750_000, planCode: "V" }, vvip: { enabled: true, priceKobo: 2_500_000 } } });
assert.deepEqual(F.openTiers(three), ["premium", "vip"], "a tier without a plan isn't open");
assert.deepEqual(F.tierOffers(null).premium, { enabled: false, priceKobo: 0 });
assert.equal(F.tierOf({}), "premium", "a subscription from before tiers is Premium");
assert.equal(F.tierOf({ tier: "vvip" }), "vvip");

// ── Who can read what ──
assert.equal(F.noteAudience({ premium: true }), "premium", "an old premium post is Premium and up");
assert.equal(F.noteAudience({ premium: true, minTier: "vip" }), "vip");
assert.equal(F.noteAudience({}), "everyone");
assert.ok(F.canSee("everyone", null));
assert.ok(!F.canSee("premium", null));
assert.ok(F.canSee("vip", "vvip") && F.canSee("vip", "vip") && !F.canSee("vip", "premium"));
assert.ok(F.canSee("vvip", "vvip") && !F.canSee("vvip", "vip"));

// ── Points and badges ──
assert.equal(F.moneyPoints(250_000), 25, "₦2,500 → 25 points");
assert.equal(F.moneyPoints(9_999), 0);
assert.deepEqual(F.FAN_ACTIONS.share, { points: 10, perDay: 5, label: "Share of their post, item, course or Media" });
assert.deepEqual([F.FAN_ACTIONS.comment.points, F.FAN_ACTIONS.comment.perDay, F.FAN_ACTIONS.reaction.points, F.FAN_ACTIONS.reaction.perDay], [3, 10, 1, 20]);
assert.deepEqual(F.rankBadge(1, "Emmanuel"), { emoji: "🥇", tone: "gold", label: "Emmanuel's Top Fan" });
assert.equal(F.rankBadge(2, "E")!.emoji, "🥈"); assert.equal(F.rankBadge(3, "E")!.emoji, "🥉");
assert.equal(F.rankBadge(4, "E")!.emoji, "🏅"); assert.equal(F.rankBadge(10, "E")!.emoji, "🏅");
assert.equal(F.rankBadge(11, "E")!.emoji, "🎖"); assert.equal(F.rankBadge(99, "E")!.emoji, "🎖");
assert.equal(F.rankBadge(100, "E"), null); assert.equal(F.rankBadge(null, "E"), null);
assert.equal(F.firstName("Emmanuel Adams"), "Emmanuel");
const pts = [9000, 7000, 6000, 5000, 4000, 3000, 2000, 1500, 1200, 1000];
const at = (p: number) => pts[p - 1] ?? null;
assert.deepEqual(F.nextBand(34, 910, at), { place: 10, needed: 91 }, "to the top 10");
assert.deepEqual(F.nextBand(5, 4000, at), { place: 3, needed: 2001 });
assert.deepEqual(F.nextBand(2, 7000, at), { place: 1, needed: 2001 });
assert.equal(F.nextBand(1, 9000, at), null, "#1 has nowhere to go");

// ── Live entrances ──
assert.deepEqual(F.entranceChoices(1, "vvip"), ["yacht", "jet"]);
assert.equal(F.entranceChoices(1, "vip"), null, "#1 needs VVIP");
assert.deepEqual(F.entranceChoices(2, "premium"), ["suv", "sports"]);
assert.deepEqual(F.entranceChoices(3, "vip"), ["ebike", "bicycle"]);
assert.equal(F.entranceChoices(2, null), null, "#2 and #3 need a subscription");
assert.equal(F.entranceChoices(4, "vvip"), null);
assert.equal(F.entranceVehicle(1, "vvip", { "1": "jet" }), "jet", "their pick");
assert.equal(F.entranceVehicle(1, "vvip", { "1": "suv" }), "yacht", "a pick that isn't theirs falls back");
assert.equal(F.entranceVehicle(3, "premium"), "ebike");

console.log("FANS OK");
