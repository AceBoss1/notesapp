// Pay-per-minute sessions (lib/ppm.ts, the hold maths in lib/wallet.ts): the meter (the grace, per started minute counted from the start,
// the hold running out, the wait that's never charged, unused minutes back), the commission (the publisher's rate plus ppmUpliftPct % of
// it), the offer and the minutes a viewer holds, who may book, starting and dropping a call; and the settings that drive them (Admin →
// Pricing, Admin → Limits → Pay-per-minute sessions). Run: npm run test:ppm → "PPM OK".
import assert from "node:assert/strict";
import * as P from "../../lib/ppm";
import { DEFAULT_PRICING, applyPricing, cleanPricing, ppmUpliftPct } from "../../lib/pricing";
import { ROOM_DEFAULTS, cleanRoomOverrides, ppmFigures, roomSettings } from "../../lib/rooms";
import { bonusAllowedFor, settleSplit } from "../../lib/wallet";

const T0 = Date.parse("2026-11-12T15:00:00.000Z");
const at = (sec: number) => new Date(T0 + sec * 1000);
const iso = (sec: number) => at(sec).toISOString();
const sess = (o: Partial<P.PpmSessionDoc> = {}) => ({ startedAt: iso(0), holdMinutes: 30, perMinuteKobo: 15_000, graceSec: 60, topUpWaitSec: 60, ...o });

// ── Settings: every number is a default an admin can change ──
assert.equal(DEFAULT_PRICING.ppmUpliftPct, 20, "the uplift on pay-per-minute sessions is 20% of the publisher's rate by default (the VIP uplift)");
assert.deepEqual([ROOM_DEFAULTS.ppmMinMinutes, ROOM_DEFAULTS.ppmMaxMinutes, ROOM_DEFAULTS.ppmGraceSec, ROOM_DEFAULTS.ppmTopUpWaitSec, ROOM_DEFAULTS.ppmNoShowMin], [10, 240, 60, 60, 60]);
assert.deepEqual(ppmFigures(roomSettings({ ppmMinMinutes: 15, ppmGraceSec: 30 })), { minMinutes: 15, maxMinutes: 240, graceSec: 30, topUpWaitSec: 60, noShowMin: 60 });
assert.deepEqual(cleanRoomOverrides({ ppmMinMinutes: 0, ppmGraceSec: 301, ppmTopUpWaitSec: 90 }), { ppmTopUpWaitSec: 90 }, "out of range is dropped");
{
  const c = structuredClone(DEFAULT_PRICING); c.ppmUpliftPct = 25;
  applyPricing(cleanPricing(c));
  assert.equal(ppmUpliftPct(), 25, "applied where booking reads it");
  applyPricing(DEFAULT_PRICING);
  assert.equal(ppmUpliftPct(), 20);
  const old = structuredClone(DEFAULT_PRICING) as Partial<typeof DEFAULT_PRICING>; delete old.ppmUpliftPct;
  assert.equal(cleanPricing(old).ppmUpliftPct, 20, "a config saved before pay-per-minute keeps the default");
  assert.throws(() => cleanPricing({ ...DEFAULT_PRICING, ppmUpliftPct: -1 }), /Pay-per-minute sessions, extra commission/);
}
// No Bonus Credits, whatever BONUS_KINDS says.
assert.equal(bonusAllowedFor("ppm"), false);

// ── The grace and per started minute ──
assert.equal(P.billedMinutesFor(0, 60), 0);
assert.equal(P.billedMinutesFor(59, 60), 0);
assert.equal(P.billedMinutesFor(60, 60), 0, "a call of exactly the grace is free");
assert.equal(P.billedMinutesFor(61, 60), 2, "past the grace, every started minute from the start: 1:01 is two minutes");
assert.equal(P.billedMinutesFor(120, 60), 2);
assert.equal(P.billedMinutesFor(121, 60), 3);
assert.equal(P.billedMinutesFor(761, 60), 13, "12:41 in the call is 13 minutes (the approved mockup)");
assert.equal(P.billedMinutesFor(30, 0), 1, "with no grace the first second starts the first minute");
assert.equal(P.billedMinutesFor(-5, 60), 0);

// ── The meter (the mockup: ₦150 a minute, 30 minutes held, 12:41 in) ──
{
  const m = P.meterAt(sess(), at(761));
  assert.deepEqual([m.elapsedSec, m.billedMinutes, m.chargeKobo, m.holdKobo, m.exhausted, m.endsAt], [761, 13, 195_000, 450_000, false, null]);
  assert.equal(P.meterLine(m), "13 min billed · ₦1,950 of ₦4,500 held · 17 min left");
  assert.equal(P.clock(m.elapsedSec), "12:41");
  assert.equal(P.clock(3_725), "1:02:05");
  assert.equal(P.meterAt(sess(), at(40)).graceLeftSec, 20);
  assert.equal(P.meterAt(sess({ startedAt: undefined }), at(500)).elapsedSec, 0, "no meter before the server has heard both phones");
  // Ended: the meter stops at the end, whenever it's read.
  const ended = P.meterAt(sess({ endedAt: iso(600) }), at(5_000));
  assert.deepEqual([ended.elapsedSec, ended.billedMinutes, ended.chargeKobo], [600, 10, 150_000]);
}
// ── The hold runs out: the viewer is asked to add minutes; the call ends after the wait, which is never charged ──
{
  const s = sess({ holdMinutes: 10 });
  const before = P.meterAt(s, at(599));
  assert.equal(before.exhausted, false);
  assert.equal(before.leftSec, 1);
  const out = P.meterAt(s, at(600));
  assert.equal(out.exhausted, true, "every held minute used");
  assert.equal(out.endsAt, iso(660), "the call ends 60 seconds later unless they add minutes");
  assert.equal(P.topUpOverdue(out, at(659)), false);
  assert.equal(P.topUpOverdue(P.meterAt(s, at(660)), at(660)), true);
  const waiting = P.meterAt(s, at(655));
  assert.deepEqual([waiting.billedMinutes, waiting.chargeKobo], [10, 150_000], "the wait after the hold ran out isn't charged: never more than the hold");
  // They added 15 minutes during the wait: the minutes they talked on are billed, as usual, from the bigger hold.
  const added = P.meterAt({ ...s, holdMinutes: 25 }, at(655));
  assert.deepEqual([added.exhausted, added.billedMinutes, added.endsAt], [false, 11, null]);
  // The wait is the session's own (fixed at booking).
  assert.equal(P.meterAt(sess({ holdMinutes: 10, topUpWaitSec: 90 }), at(600)).endsAt, iso(690));
}
// ── Settling the hold: what was used is charged, the rest goes back ──
assert.deepEqual(settleSplit(450_000, 195_000), { chargedKobo: 195_000, releasedKobo: 255_000 });
assert.deepEqual(settleSplit(450_000, 0), { chargedKobo: 0, releasedKobo: 450_000 }, "a call within the grace (or none): all of it back");
assert.deepEqual(settleSplit(450_000, 999_999), { chargedKobo: 450_000, releasedKobo: 0 }, "never more than the hold");
assert.deepEqual(settleSplit(450_000, -5), { chargedKobo: 0, releasedKobo: 450_000 });
assert.deepEqual(settleSplit(450_000, NaN), { chargedKobo: 0, releasedKobo: 450_000 });
{
  // A whole call: 30 min held, 12:41 used → 13 minutes charged, 17 back.
  const m = P.meterAt(sess({ endedAt: iso(761) }), at(761));
  assert.deepEqual(settleSplit(m.holdKobo, m.chargeKobo), { chargedKobo: 195_000, releasedKobo: 255_000 });
}

// ── Commission: the publisher's rate plus ppmUpliftPct % of it ──
assert.equal(P.ppmRate(0.08, 20), 0.096, "8% + 20% of it = 9.6%");
assert.equal(P.ppmRate(0.1, 0), 0.1);
assert.equal(P.ppmRate(0.9, 20), 1, "never more than everything");
assert.deepEqual(P.splitCharge(195_000, 0.096), { grossKobo: 195_000, rate: 0.096, commissionKobo: 18_720, netKobo: 176_280 });

// ── The offer ──
{
  const ok = P.cleanPpmOffer({ enabled: true, voiceNaira: "150", videoNaira: 300, audience: "premium" });
  assert.ok(ok.ok && ok.offer.voiceKobo === 15_000 && ok.offer.videoKobo === 30_000 && ok.offer.audience === "premium");
  const voiceOnly = P.cleanPpmOffer({ enabled: true, voiceNaira: 200, videoNaira: "" });
  assert.ok(voiceOnly.ok && voiceOnly.offer.videoKobo === 0 && voiceOnly.offer.audience === "everyone");
  assert.match((P.cleanPpmOffer({ enabled: true }) as { error: string }).error, /voice, video or both/);
  assert.ok(P.cleanPpmOffer({ enabled: false }).ok, "switched off needs no price");
  const off = P.cleanPpmOffer({ enabled: false, voiceNaira: 10, videoNaira: 300 });
  assert.ok(off.ok && off.offer.voiceKobo === 0 && off.offer.videoKobo === 30_000, "switched off: a price out of range isn't kept, nor refused");
  assert.match((P.cleanPpmOffer({ enabled: true, voiceNaira: 20 }) as { error: string }).error, /₦50 to ₦50,000/);
  assert.match((P.cleanPpmOffer({ enabled: true, videoNaira: 60_000 }) as { error: string }).error, /Video/);
  assert.match((P.cleanPpmOffer({ enabled: true, voiceNaira: 100, audience: "gold" }) as { error: string }).error, /who can book/);
  assert.equal(P.priceOf({ voiceKobo: 15_000, videoKobo: 30_000 }, "video"), 30_000);
}
// ── Who may book: their own tiers, from the chosen tier up ──
assert.equal(P.mayBookFor("everyone", null), true);
assert.equal(P.mayBookFor("premium", null), false);
assert.equal(P.mayBookFor("premium", "premium"), true);
assert.equal(P.mayBookFor("vip", "premium"), false);
assert.equal(P.mayBookFor("vip", "vvip"), true);
assert.equal(P.mayBookFor("vvip", "vip"), false);
assert.equal(P.audienceLine("premium", "Kemi"), "For Kemi's Premium, VIP and VVIP subscribers.");
assert.equal(P.audienceLine("everyone", "Kemi"), "Open to everyone.");
assert.equal(P.firstName("Dr Kemi Ojo"), "Kemi");
assert.equal(P.firstName("Bisi Adeyemi"), "Bisi");
assert.equal(P.firstName("Dr"), "Dr");
// ── The minutes to hold ──
assert.deepEqual(P.cleanHoldMinutes(30, 10, 240), { ok: true, minutes: 30 });
assert.match((P.cleanHoldMinutes(9, 10, 240) as { error: string }).error, /at least 10 minutes/);
assert.match((P.cleanHoldMinutes(12.5, 10, 240) as { error: string }).error, /at least 10/);
assert.match((P.cleanHoldMinutes(241, 10, 240) as { error: string }).error, /at most 240/);
assert.equal(P.holdFor(30, 15_000), 450_000);

// ── Starting the call, the meter's start, a dropped phone ──
{
  const s = { status: "booked" as const, startsAt: iso(0) };
  assert.equal(P.mayCall(s, 60, at(-11 * 60)).ok, false, "not more than 10 minutes early");
  assert.equal(P.mayCall(s, 60, at(-10 * 60)).ok, true);
  assert.equal(P.mayCall(s, 60, at(60 * 60)).ok, true);
  assert.equal(P.mayCall(s, 60, at(60 * 60 + 1)).ok, false, "after the no-show minutes it's over");
  assert.equal(P.mayCall({ ...s, status: "live" }, 60, at(5 * 3600)).ok, true, "a live session's call can always be rejoined");
  assert.equal(P.mayCall({ ...s, status: "cancelled" }, 60, at(0)).ok, false);
  assert.equal(P.noShowDue(s, 60, at(3_601)), true);
  assert.equal(P.noShowDue({ ...s, status: "live" }, 60, at(9_999)), false);
  assert.equal(P.bothHere({ viewer: iso(0) }, at(1)), false, "the meter waits for both phones");
  assert.equal(P.bothHere({ viewer: iso(0), host: iso(10) }, at(20)), true);
  assert.equal(P.bothHere({ viewer: iso(0), host: iso(50) }, at(50)), false, "a beat older than 45 seconds doesn't count");
  const live = { status: "live" as const, startedAt: iso(0), beats: { viewer: iso(300), host: iso(310) } };
  assert.equal(P.droppedAt(live, at(340)), null);
  assert.equal(P.droppedAt(live, at(345)), iso(300), "the viewer's phone went quiet: the call ended at the last moment both were there");
  assert.equal(P.droppedAt({ ...live, status: "booked" }, at(999)), null);
}
assert.equal(P.callKindOf("video"), "video");
assert.equal(P.callKindOf("voice"), "audio");

console.log("PPM OK");
