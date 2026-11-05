// Paid lives (lib/live-tickets.ts): the price bands, the late window, the subscriber discount on top of each band (capped by Admin), the
// commission (the host's rate plus liveTicketUpliftPct % of it: the owner's 8% → 8.8% example), what the host sends, opening the room
// and cancelling for not starting; and the settings that drive them (Admin → Pricing, Admin → Limits → Audio rooms → Paid lives).
// Run: npm run test:live-tickets → "LIVE TICKETS OK".
import assert from "node:assert/strict";
import * as L from "../../lib/live-tickets";
import { DEFAULT_PRICING, applyPricing, cleanPricing, liveTicketUpliftPct } from "../../lib/pricing";
import { ROOM_DEFAULTS, cleanRoomOverrides, paidLiveFigures, roomSettings } from "../../lib/rooms";
import { tierLiveDiscounts, tierOffers } from "../../lib/fans";

const at = (iso: string) => new Date(iso);
const ev = (o: Partial<L.LiveEventDoc> = {}) => ({
  startsAt: "2026-11-15T18:00:00.000Z", earlyUntil: "2026-11-10T22:59:00.000Z",
  prices: { earlyKobo: 200_000, normalKobo: 300_000, lateKobo: 400_000 }, lateWindowMin: 20, status: "scheduled" as L.LiveStatus, ...o,
});

// ── Settings: every number is a default an admin can change ──
assert.equal(DEFAULT_PRICING.liveTicketUpliftPct, 10, "the uplift on paid-live tickets is 10% of the host's rate by default");
assert.deepEqual([ROOM_DEFAULTS.lateWindowMin, ROOM_DEFAULTS.liveDiscountMaxPct, ROOM_DEFAULTS.paidNoShowMin], [20, 50, 60]);
assert.deepEqual(paidLiveFigures(roomSettings({ lateWindowMin: 30, liveDiscountMaxPct: 40 })), { lateWindowMin: 30, discountMaxPct: 40, noShowMin: 60 });
assert.deepEqual(cleanRoomOverrides({ lateWindowMin: 25, liveDiscountMaxPct: 101, paidNoShowMin: 5 }), { lateWindowMin: 25 }, "out of range is dropped");
{
  const c = structuredClone(DEFAULT_PRICING); c.liveTicketUpliftPct = 15;
  assert.equal(cleanPricing(c).liveTicketUpliftPct, 15);
  applyPricing(cleanPricing(c));
  assert.equal(liveTicketUpliftPct(), 15, "applied where checkout reads it");
  applyPricing(DEFAULT_PRICING);
  const old = structuredClone(DEFAULT_PRICING) as Partial<typeof DEFAULT_PRICING>; delete old.liveTicketUpliftPct;
  assert.equal(cleanPricing(old).liveTicketUpliftPct, 10, "a config saved before paid lives keeps the default");
  assert.throws(() => cleanPricing({ ...DEFAULT_PRICING, liveTicketUpliftPct: 120 }), /Paid-live tickets, extra commission/);
}

// ── Price bands: early bird → normal → late, then closed ──
let b = L.bandAt(ev(), at("2026-11-08T10:00:00Z"));
assert.ok(b.open && b.band === "early" && b.kobo === 200_000 && b.until === ev().earlyUntil, "early bird until the date the host picked");
b = L.bandAt(ev(), at("2026-11-10T23:00:00Z"));
assert.ok(b.open && b.band === "normal" && b.kobo === 300_000 && b.until === ev().startsAt, "then normal until the start");
b = L.bandAt(ev(), at("2026-11-15T18:05:00Z"));
assert.ok(b.open && b.band === "late" && b.kobo === 400_000 && b.until === null, "late from the start; the host hasn't opened yet, so no end yet");
// The late window counts from when the live really started.
const started = ev({ status: "live", startedAt: "2026-11-15T18:07:00.000Z" });
assert.equal(L.lateClosesAt(started), "2026-11-15T18:27:00.000Z");
b = L.bandAt(started, at("2026-11-15T18:26:59Z"));
assert.ok(b.open && b.band === "late" && b.until === "2026-11-15T18:27:00.000Z", "late until 20 minutes in");
b = L.bandAt(started, at("2026-11-15T18:27:00Z"));
assert.ok(!b.open && /closed 20 minutes into the live/.test(b.why), "then no more tickets");
// Opened early (10 minutes before): normal still applies until the start, and the window runs from the start.
const early = ev({ status: "live", startedAt: "2026-11-15T17:50:00.000Z" });
b = L.bandAt(early, at("2026-11-15T17:55:00Z"));
assert.ok(b.open && b.band === "normal");
assert.equal(L.lateClosesAt(early), "2026-11-15T18:20:00.000Z");
// The window is the one fixed on the live (an admin change later doesn't move it).
b = L.bandAt(ev({ status: "live", startedAt: "2026-11-15T18:00:00.000Z", lateWindowMin: 45 }), at("2026-11-15T18:40:00Z"));
assert.ok(b.open && b.band === "late");
b = L.bandAt(ev({ status: "live", startedAt: "2026-11-15T18:00:00.000Z", lateWindowMin: 0 }), at("2026-11-15T18:00:01Z"));
assert.ok(!b.open, "a window of 0: no late tickets once it starts");
assert.ok(!L.bandAt(ev({ status: "cancelled" }), at("2026-11-08T10:00:00Z")).open);
assert.ok(!L.bandAt(ev({ status: "ended" }), at("2026-11-15T18:05:00Z")).open);

// ── The subscriber discount: their tier's, capped, on top of whichever band ──
const offers = tierOffers({ tiers: { premium: { enabled: true, priceKobo: 200_000, planCode: "P", liveDiscountPct: 10 }, vip: { enabled: true, priceKobo: 750_000, planCode: "V", liveDiscountPct: 20 }, vvip: { enabled: true, priceKobo: 2_500_000, planCode: "W", liveDiscountPct: 60 } } });
const d = tierLiveDiscounts(offers);
assert.deepEqual(d, { premium: 10, vip: 20, vvip: 60 });
assert.equal(L.discountFor("premium", d, 50), 10);
assert.equal(L.discountFor("vip", d, 50), 20);
assert.equal(L.discountFor("vvip", d, 50), 50, "a host's 60% is cut to the Admin cap");
assert.equal(L.discountFor("vvip", d, 0), 0, "cap 0: no discounts");
assert.equal(L.discountFor(null, d, 50), 0, "not a subscriber: no discount");
assert.deepEqual(tierLiveDiscounts(tierOffers({ enabled: true, priceKobo: 200_000 })), {}, "settings from before have none");
for (const [band, list] of [["early", 200_000], ["normal", 300_000], ["late", 400_000]] as const) {
  assert.equal(L.discounted(list, 20), list * 0.8, `VIP 20% off the ${band} price`);
}
assert.equal(L.discounted(333_300, 10), 300_000, "rounded to whole naira (₦2,999.70 → ₦3,000)");
assert.equal(L.discounted(300_000, 0), 300_000);
assert.equal(L.discounted(10_000, 100), 100, "never below ₦1");
assert.equal(L.cleanDiscountPct("25", 50), 25);
assert.equal(L.cleanDiscountPct(-5, 50), 0);
assert.equal(L.cleanDiscountPct("x", 50), 0);
assert.equal(L.tierDiscountLine(d, 50), "Premium 10% off · VIP 20% off · VVIP 50% off");

// ── Commission: the host's rate plus the uplift % of it, on what the buyer pays ──
// The owner's example (the create form's "You keep"): ₦2,000 at an 8% rate + 10% of it (8.8%) = ₦1,824.
let q = L.quoteLiveTicket(200_000, 0, 0.08, 10);
assert.deepEqual(q, { listKobo: 200_000, discountPct: 0, payKobo: 200_000, rate: 0.088, commissionKobo: 17_600, netKobo: 182_400 });
// With a VIP discount (20%) on the late price: commission is on what was paid.
q = L.quoteLiveTicket(400_000, 20, 0.08, 10);
assert.deepEqual([q.payKobo, q.rate, q.commissionKobo, q.netKobo], [320_000, 0.088, 28_160, 291_840]);
assert.equal(L.liveTicketRate(0.35, 10), 0.385);
assert.equal(L.liveTicketRate(0.08, 0), 0.08, "uplift 0: the normal rate");
assert.equal(L.liveTicketRate(0.6, 100), 1, "never over 100%");

// ── What the host sends ──
const now = at("2026-11-05T12:00:00Z");
const good = { title: "  Raising your first ₦5m:  live Q&A ", startsAt: "2026-11-15T18:00:00.000Z", earlyUntil: "2026-11-10T22:59:00.000Z", earlyNaira: 2000, normalNaira: "3000", lateNaira: 4000, audience: "premium", record: "replay" };
const c = L.cleanLiveEvent(good, now);
assert.ok(c.ok);
assert.deepEqual(c.event, { title: "Raising your first ₦5m: live Q&A", description: "", startsAt: good.startsAt, earlyUntil: good.earlyUntil, prices: { earlyKobo: 200_000, normalKobo: 300_000, lateKobo: 400_000 }, audience: "premium", record: "replay" });
const bad = (o: Record<string, unknown>, re: RegExp) => { const r = L.cleanLiveEvent({ ...good, ...o }, now); assert.ok(!r.ok && re.test(r.error), `${JSON.stringify(o)} → ${!r.ok && r.error}`); };
bad({ title: "Hi" }, /title/);
bad({ startsAt: "2026-11-05T12:05:00Z" }, /at least 15 minutes/);
bad({ startsAt: "2027-11-05T12:05:00Z" }, /within the next 180 days/);
bad({ earlyNaira: 50 }, /Early bird: a price from ₦100/);
bad({ earlyNaira: 3500 }, /early bird price can't be more than the normal/);
bad({ lateNaira: 2500 }, /late price can't be less than the normal/);
bad({ earlyUntil: "2026-11-16T00:00:00Z" }, /by the start/);
bad({ earlyUntil: "2026-11-01T00:00:00Z" }, /after now/);
bad({ audience: "vvip" }, /who can buy/);
bad({ record: "maybe" }, /recorded/);

// ── Who may buy ──
assert.ok(L.mayBuyFor("everyone", null));
assert.ok(!L.mayBuyFor("premium", null) && L.mayBuyFor("premium", "premium") && L.mayBuyFor("premium", "vvip"));
assert.ok(!L.mayBuyFor("vip", "premium") && L.mayBuyFor("vip", "vip") && L.mayBuyFor("vip", "vvip"));

// ── Opening the room, reopening after a drop, and cancelling for not starting ──
assert.ok(!L.mayOpen(ev(), 60, at("2026-11-15T17:40:00Z")).ok, "not before 15 minutes ahead");
assert.ok(L.mayOpen(ev(), 60, at("2026-11-15T17:45:00Z")).ok);
assert.ok(L.mayOpen(ev(), 60, at("2026-11-15T18:59:00Z")).ok, "late, but within the no-show minutes");
assert.ok(!L.mayOpen(ev(), 60, at("2026-11-15T19:00:00Z")).ok);
assert.ok(L.noShowDue(ev(), 60, at("2026-11-15T19:00:00Z")) && !L.noShowDue(ev(), 60, at("2026-11-15T18:59:59Z")));
assert.ok(!L.noShowDue(ev({ status: "live" }), 60, at("2026-11-16T00:00:00Z")), "a live that started is never a no-show");
const ended = ev({ status: "ended", endedAt: "2026-11-15T19:30:00.000Z" });
assert.ok(L.mayOpen(ended, 60, at("2026-11-15T19:55:00Z")).ok, "reopened within 30 minutes of a drop");
assert.ok(!L.mayOpen(ended, 60, at("2026-11-15T20:00:01Z")).ok);
assert.ok(!L.mayOpen(ev({ status: "cancelled" }), 60, at("2026-11-15T18:00:00Z")).ok);

// ── For screens ──
assert.equal(L.ticketRef("7Q2KABCDEF"), "NAPL-7Q2K");
assert.equal(L.liveTicketId("L1", "ada"), "L1_ada");
assert.match(L.recordNotice("replay"), /may be offered as a replay/);
assert.match(L.recordNotice("safety"), /safety review only/);

console.log("LIVE TICKETS OK");
