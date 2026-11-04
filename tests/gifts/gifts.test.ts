// Animated gifts and daily gift targets (lib/gift-catalogue.ts): the catalogue an admin saves, the price a sender pays (and the
// verified-sender rule), the daily totals across Lagos midnight, the target (amount and different senders) and the shelf's order.
// Run: npm run test:gifts → "GIFTS OK".
import assert from "node:assert/strict";
import * as G from "../../lib/gift-catalogue";
import { DEFAULT_PRICING, applyPricing, cleanPricing, currentPricing, describeChanges, PricingError } from "../../lib/pricing";
import { UNVERIFIED_GIFT_CAP_KOBO } from "../../lib/giving";

const clone = <T>(x: T): T => structuredClone(x);
const throwsMsg = (f: () => unknown, re: RegExp) => assert.throws(f, (e: unknown) => e instanceof G.GiftSettingsError && re.test(e.message));

// ── The built-in catalogue ───────────────────────────────────────────────────────────────────────────────────────────────────────
const D = G.DEFAULT_CATALOGUE;
assert.equal(D.length, 14, "the owner's fourteen gifts");
assert.deepEqual(D.map((g) => g.id), [...G.GIFT_MOTIFS], "one per drawing");
assert.ok(D.every((g, i) => i === 0 || g.priceKobo > D[i - 1].priceKobo), "smallest first");
assert.equal(D[0].priceKobo, 200 * 100);
// The owner's list of 3 November 2026, names and prices.
assert.deepEqual(D.map((g) => [g.name, g.priceKobo / 100]), [
  ["Garden Egg", 200], ["Kola Nut", 1_000], ["Zobo Bottle", 2_000], ["Jollof Plate", 5_000], ["Talking Drum", 10_000], ["Adire Fan", 20_000],
  ["Golden Gele", 25_000], ["Kente Crown", 50_000], ["Baobab of Blessings", 100_000], ["Circova Champagne", 150_000], ["Argungu Fishing", 250_000],
  ["Durbar Horse", 500_000], ["Ijele Masquerade", 750_000], ["Kilimanjaro Sunrise", 1_000_000],
]);
// Every gift plays with some or all of the five effects; the biggest with all of them.
for (const id of G.GIFT_MOTIFS) {
  const fx = G.MOTIF_EFFECTS[id];
  assert.ok(fx.length >= 2 && fx.every((f) => (G.GIFT_EFFECTS as readonly string[]).includes(f)), `${id}: a mix of effects`);
}
assert.deepEqual([...G.MOTIF_EFFECTS.sunrise].sort(), [...G.GIFT_EFFECTS].sort());
const SET0 = { catalogue: D, daily: G.DEFAULT_DAILY, grand: G.DEFAULT_GRAND, uplift: G.DEFAULT_UPLIFT };
assert.deepEqual(G.DEFAULT_UPLIFT, { premiumPct: 10, vipPct: 20 });
assert.deepEqual(G.DEFAULT_GRAND, { fromKobo: 25_000 * 100, announce: true });
assert.deepEqual(G.cleanGiftSettings(undefined), SET0, "a config saved before gifts keeps the defaults");
assert.deepEqual(G.cleanGiftSettings(clone(SET0)), SET0);
assert.deepEqual(G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY }), SET0, "a config saved before grand gifts gets the default line");
assert.deepEqual(G.DEFAULT_DAILY, { targetKobo: 5_000_000, slots: 6, basis: "gross", minSenders: 3 });

// ── Admin edits: rename, reprice, switch off, reorder ───────────────────────────────────────────────────────────────────────────
const edited = clone(D).reverse();
edited[0].name = "  Sunrise   over Kili "; edited[0].priceKobo = 2_000_000 * 100; edited[1].enabled = false;
const ok = G.cleanGiftSettings({ catalogue: edited, daily: { targetKobo: 75_000 * 100, slots: 4, basis: "net", minSenders: 5 } });
assert.deepEqual(ok.catalogue.map((g) => g.id), [...G.GIFT_MOTIFS].reverse(), "the order is kept");
assert.equal(ok.catalogue[0].name, "Sunrise over Kili", "spaces tidied");
assert.equal(ok.catalogue[0].priceKobo, 200_000_000);
assert.equal(ok.catalogue[1].enabled, false);
assert.deepEqual(ok.daily, { targetKobo: 7_500_000, slots: 4, basis: "net", minSenders: 5 });
// A gift left out of an older form is kept, at the end, switched off.
const missing = G.cleanGiftSettings({ catalogue: D.slice(0, 12), daily: G.DEFAULT_DAILY });
assert.deepEqual(missing.catalogue.slice(12).map((g) => [g.id, g.enabled]), [["ijele", false], ["sunrise", false]]);
// Refused.
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], id: "lion" }] }), /isn't one of the gift drawings/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [D[0], D[0]] }), /listed twice/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], name: "K" }] }), /name of 2 to 30/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], name: "x".repeat(31) }] }), /name of 2 to 30/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], priceKobo: 100 * 100 }] }), /₦200 to ₦5,000,000/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], priceKobo: 6_000_000 * 100 }] }), /price in whole naira/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0], priceKobo: 25_050 }] }), /whole naira/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: [{ ...D[0] }, { ...D[1], name: "garden egg" }] }), /two gifts are called/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D.map((g) => ({ ...g, enabled: false })) }), /at least one gift/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: { ...G.DEFAULT_DAILY, targetKobo: 500 * 100 } }), /₦1,000 to/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: { ...G.DEFAULT_DAILY, slots: 0 } }), /places/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: { ...G.DEFAULT_DAILY, slots: 21 } }), /places/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: { ...G.DEFAULT_DAILY, minSenders: 0 } }), /different senders/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: { ...G.DEFAULT_DAILY, basis: "half" } }), /gross/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, grand: { fromKobo: 100 * 100, announce: true } }), /Grand gifts/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, grand: { fromKobo: 25_000_50, announce: true } }), /whole naira/);
assert.deepEqual(G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, grand: { fromKobo: 50_000 * 100, announce: false } }).grand, { fromKobo: 5_000_000, announce: false });
assert.deepEqual(G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, uplift: { premiumPct: 12.5, vipPct: 0 } }).uplift, { premiumPct: 12.5, vipPct: 0 });
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, uplift: { premiumPct: -1, vipPct: 20 } }), /Premium gifts, extra commission/);
throwsMsg(() => G.cleanGiftSettings({ catalogue: D, daily: G.DEFAULT_DAILY, uplift: { premiumPct: 10, vipPct: 101 } }), /VIP gifts, extra commission/);

// ── Commission on animated gifts: the normal rate plus 10% of it (premium) or 20% of it (VIP), the owner's example ──────────────
assert.deepEqual(D.map((g) => G.giftClass(g.priceKobo)), [...Array(6).fill("premium"), ...Array(8).fill("vip")], "6 premium, 8 VIP");
assert.equal(G.giftUplift(200 * 100), 0.1); assert.equal(G.giftUplift(25_000 * 100), 0.2);
assert.equal(G.upliftedRate(0.08, 0.2), 0.096, "8% rate, VIP: 9.6%");
assert.equal(G.upliftedRate(0.08, 0.1), 0.088, "8% rate, premium: 8.8%");
assert.equal(G.upliftedRate(0.15, 0), 0.15);
assert.equal(G.upliftedRate(0.9, 1), 1, "never over 100%");

// ── Saved with the pricing config, applied live ──────────────────────────────────────────────────────────────────────────────────
assert.deepEqual(DEFAULT_PRICING.gifts, SET0);
const { gifts: _old, ...beforeGifts } = clone(DEFAULT_PRICING);
assert.deepEqual(cleanPricing(beforeGifts).gifts, DEFAULT_PRICING.gifts, "a saved config from before v0.133.0 still loads");
const cfg = clone(DEFAULT_PRICING);
cfg.gifts.catalogue[7].priceKobo = 60_000 * 100; cfg.gifts.catalogue[3].enabled = false; cfg.gifts.daily.targetKobo = 80_000 * 100;
assert.deepEqual(cleanPricing(clone(cfg)), cfg);
const changes = describeChanges(DEFAULT_PRICING, cfg);
assert.ok(changes.includes("gifts.catalogue.kente.priceKobo: 5000000 → 6000000"), "a price change is logged");
assert.ok(changes.includes("gifts.catalogue.jollof.enabled: true → false"), "switching one off is a change");
assert.ok(changes.includes("gifts.daily.targetKobo: 5000000 → 8000000"));
cfg.gifts.grand.fromKobo = 30_000 * 100;
assert.ok(describeChanges(DEFAULT_PRICING, cfg).includes("gifts.grand.fromKobo: 2500000 → 3000000"), "the grand line is logged");
assert.throws(() => cleanPricing({ ...clone(DEFAULT_PRICING), gifts: { catalogue: [] , daily: G.DEFAULT_DAILY } }), (e: unknown) => e instanceof PricingError && /at least one/.test((e as Error).message), "as a pricing error");
applyPricing(cfg);
assert.equal(G.findGift("kente")!.priceKobo, 6_000_000, "applied live");
assert.equal(G.enabledGifts().some((g) => g.id === "jollof"), false);
assert.equal(G.GIFT_SETTINGS.daily.targetKobo, 8_000_000);
assert.equal(G.GIFT_SETTINGS.grand.fromKobo, 3_000_000);
assert.deepEqual(currentPricing().gifts, cfg.gifts);
applyPricing(DEFAULT_PRICING);
assert.equal(G.findGift("kente")!.priceKobo, 5_000_000);
assert.equal(G.GIFT_SETTINGS.grand.fromKobo, 2_500_000, "back to the default line");

// ── What a sender pays, and the verified-sender rule ─────────────────────────────────────────────────────────────────────────────
assert.deepEqual(G.animatedGiftPrice("jollof", false), { ok: true, gift: D[3] });
assert.equal(UNVERIFIED_GIFT_CAP_KOBO, 2_000_000);
assert.ok(G.animatedGiftPrice("adire", false).ok, "₦20,000 Adire Fan: anyone");
const gele = G.animatedGiftPrice("gele", false); // ₦25,000: the first grand gift, verified senders only
assert.ok(!gele.ok && gele.status === 403 && /Golden Gele is for verified senders/.test(gele.error) && gele.error.includes("from ₦25,000"), "the owner's ₦25,000 line");
const kente = G.animatedGiftPrice("kente", false);
assert.ok(!kente.ok && kente.status === 403);
assert.equal(G.verifiedRuleText(), "from ₦25,000");
assert.ok(G.isGrand(25_000 * 100) && !G.isGrand(20_000 * 100));
assert.equal(G.playMs(200 * 100), 3_800); assert.equal(G.playMs(25_000 * 100), 5_500); assert.equal(G.playMs(1_000_000 * 100), 7_000);
// An admin can move the line; the cap for unverified senders still applies above ₦20,000.
const lower = clone(G.GIFT_SETTINGS); lower.grand.fromKobo = 10_000 * 100;
assert.equal(G.animatedGiftPrice("drum", false, lower).ok, false, "moved down: the ₦10,000 drum needs a ✔");
assert.equal(G.verifiedRuleText(lower), "from ₦10,000");
const higher = clone(G.GIFT_SETTINGS); higher.grand.fromKobo = 100_000 * 100;
assert.equal(G.animatedGiftPrice("gele", false, higher).ok, false, "moved up: still over the unverified cap");
assert.ok(G.animatedGiftPrice("sunrise", true).ok, "a verified sender can send the ₦1,000,000 gift");
assert.deepEqual(G.animatedGiftPrice("lion", true), { ok: false, status: 404, error: "That gift isn't available any more. Choose another." });
const off = clone(G.GIFT_SETTINGS); off.catalogue[0].enabled = false;
assert.equal(G.animatedGiftPrice("gardenegg", true, off).ok, false, "a gift switched off can't be sent");
assert.equal(G.needsVerified(D[5]), false); assert.equal(G.needsVerified(D[6]), true);
assert.deepEqual(D.filter((g) => G.needsVerified(g)).map((g) => g.id), ["gele", "kente", "baobab", "champagne", "argungu", "durbar", "ijele", "sunrise"], "the eight for verified senders");
// Who counts as verified (the ✔ or gold): the same as hasVerifiedBadge, plus gold.
const future = new Date(Date.now() + 86_400_000).toISOString(), past = new Date(Date.now() - 86_400_000).toISOString();
assert.equal(G.senderVerified({ accountTier: "basic" }), false);
assert.equal(G.senderVerified({ accountTier: "business" }), true);
assert.equal(G.senderVerified({ accountTier: "pro", badgeUntil: future }), true);
assert.equal(G.senderVerified({ accountTier: "pro", badgeUntil: past }), false);
assert.equal(G.senderVerified({ verified: true }), true);
assert.equal(G.senderVerified({ goldBadge: { kind: "identity" } }), true);
assert.equal(G.senderVerified({ role: "staff" }), true);
assert.equal(G.senderVerified({ accountTier: "business", accountKind: "organisation", org: { rcStatus: "pending" } }), false, "an organisation needs its registration confirmed");
assert.equal(G.senderVerified({ accountTier: "business", accountKind: "organisation", org: { rcStatus: "verified" } }), true);
assert.equal(G.senderVerified({ verified: true, suspended: true }), false);
assert.equal(G.senderVerified(null), false);

// ── Lagos days ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(G.lagosDayOf("2026-11-03T22:59:59.999Z"), "2026-11-03", "23:59 in Lagos");
assert.equal(G.lagosDayOf("2026-11-03T23:00:00.000Z"), "2026-11-04", "midnight in Lagos is 23:00 UTC");
assert.equal(G.lagosDayOf("2026-12-31T23:30:00Z"), "2027-01-01", "new year in Lagos");
assert.equal(G.lagosDayEnds("2026-11-03T10:00:00Z").toISOString(), "2026-11-03T23:00:00.000Z");
assert.equal(G.dailyId("2026-11-03", "ada"), "2026-11-03_ada");

// ── Daily totals, target, distinct senders ──────────────────────────────────────────────────────────────────────────────────────
const S: G.DailyTargetSettings = { targetKobo: 50_000 * 100, slots: 3, basis: "gross", minSenders: 3 };
const gift = (fromUid: string, naira: number, at: string, rate = 0.35) => ({ uid: "ada", fromUid, grossKobo: naira * 100, netKobo: naira * 100 - Math.round(naira * 100 * rate), at });
let t = G.addGift(null, gift("bisi", 30_000, "2026-11-03T08:00:00Z"), S);
assert.deepEqual([t.day, t.grossKobo, t.netKobo, t.count, t.senders, t.reachedAt], ["2026-11-03", 3_000_000, 1_950_000, 1, ["bisi"], undefined]);
t = G.addGift(t, gift("bisi", 30_000, "2026-11-03T09:00:00Z"), S);
assert.equal(t.grossKobo, 6_000_000); assert.deepEqual(t.senders, ["bisi"], "the same sender counts once");
assert.equal(G.targetReached(t, S), false, "₦60,000 from one person isn't enough");
t = G.addGift(t, gift("chidi", 200, "2026-11-03T10:00:00Z"), S);
assert.equal(G.targetReached(t, S), false, "two senders");
const before = t;
t = G.addGift(t, gift("ada", 100_000, "2026-11-03T10:30:00Z"), S);
assert.deepEqual(t, before, "a gift to yourself never counts");
t = G.addGift(t, gift("dayo", 500, "2026-11-03T11:00:00Z"), S);
assert.equal(t.reachedAt, "2026-11-03T11:00:00Z", "reached with the third different sender");
assert.equal(t.count, 4);
assert.equal(G.addGift(t, gift("eko", 200, "2026-11-03T12:00:00Z"), S).reachedAt, "2026-11-03T11:00:00Z", "the time it was first reached stays");
// After commission: the same gifts are short of ₦50,000 net.
assert.equal(G.targetReached(t, { ...S, basis: "net" }), false);
assert.equal(G.countedKobo(t, { ...S, basis: "net" }), t.netKobo);
assert.equal(G.targetReached(t, { ...S, minSenders: 4 }), false, "a higher minimum");
// Across Lagos midnight: a gift at 00:30 in Lagos starts a new day from nothing.
const late = G.addGift(t, gift("femi", 1_000, "2026-11-03T22:59:00Z"), S);
assert.equal(late.day, "2026-11-03"); assert.equal(late.grossKobo, t.grossKobo + 100_000);
const fresh = G.addGift(late, gift("femi", 60_000, "2026-11-03T23:30:00Z"), S);
assert.deepEqual([fresh.day, fresh.grossKobo, fresh.count, fresh.senders, fresh.reachedAt], ["2026-11-04", 6_000_000, 1, ["femi"], undefined]);
// The senders list is bounded.
let many: G.DailyTotal | null = null;
for (let i = 0; i < G.SENDERS_KEPT + 20; i++) many = G.addGift(many, gift(`s${i}`, 200, "2026-11-03T08:00:00Z"), S);
assert.equal(many!.senders.length, G.SENDERS_KEPT); assert.equal(many!.count, G.SENDERS_KEPT + 20);

// ── The shelf's order ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const row = (uid: string, naira: number, senders: number, reachedAt: string | undefined, day = "2026-11-03", lastAt = "2026-11-03T20:00:00Z"): G.DailyTotal =>
  ({ day, uid, grossKobo: naira * 100, netKobo: Math.round(naira * 65), count: senders, senders: Array.from({ length: senders }, (_, i) => `${uid}${i}`), reachedAt, lastAt });
const rows = [
  row("a", 60_000, 3, "2026-11-03T12:00:00Z"),
  row("b", 90_000, 5, "2026-11-03T15:00:00Z"),
  row("c", 60_000, 4, "2026-11-03T09:00:00Z"), // same amount as a, reached earlier
  row("d", 200_000, 2, undefined), // big, but only two people
  row("e", 49_000, 9, undefined), // just short
  row("f", 300_000, 6, "2026-11-02T10:00:00Z", "2026-11-02"), // yesterday
  row("g", 55_000, 3, undefined, "2026-11-03", "2026-11-03T08:00:00Z"), // qualifies under today's settings, no reachedAt
];
assert.deepEqual(G.shelfOrder(rows, "2026-11-03", S).map((r) => r.uid), ["b", "c", "a", "g"], "most first; a tie goes to who reached it first");
assert.deepEqual(G.shelfOrder(rows, "2026-11-03", { ...S, minSenders: 2 }).map((r) => r.uid), ["d", "b", "c", "a", "g"]);
assert.deepEqual(G.shelfOrder(rows, "2026-11-02", S).map((r) => r.uid), ["f"], "yesterday's shelf is yesterday's");
assert.deepEqual(G.shelfOrder(rows, "2026-11-03", { ...S, basis: "net", targetKobo: 38_000 * 100 }).map((r) => r.uid), ["b", "c", "a"], "after commission");

assert.deepEqual(G.giftRange(), { minKobo: 20_000, maxKobo: 100_000_000, count: 14 });
console.log("GIFTS OK");
