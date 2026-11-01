// Community giving and event tickets, the pure rules (lib/giving.ts, lib/tickets.ts): the charge bands, the card charge, covering the
// charges or not, the cap before verification, when gifts are paid out, ticket types and codes. Run: npm run test:giving → "GIVING OK".
import assert from "node:assert/strict";
import { GIVING_MIN_KOBO, UNVERIFIED_GIFT_CAP_KOBO, bandChargeKobo, cardChargeKobo, cleanGivingSettings, giftProblem, givingReleaseAfter, quoteGift } from "../../lib/giving";
import { cleanTicketTypes, makeTicketCode, readTicketCode, showCode, ticketsLeft } from "../../lib/tickets";

const N = (naira: number) => naira * 100;

// Bands, like a bank transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above.
assert.equal(bandChargeKobo(N(100)), N(10));
assert.equal(bandChargeKobo(N(5_000)), N(10));
assert.equal(bandChargeKobo(N(5_001)), N(25));
assert.equal(bandChargeKobo(N(50_000)), N(25));
assert.equal(bandChargeKobo(N(50_001)), N(50));
assert.equal(bandChargeKobo(N(2_000_000)), N(50));

// Paystack local: 1.5% + ₦100, the ₦100 waived under ₦2,500, capped at ₦2,000.
assert.equal(cardChargeKobo(N(2_000)), N(30), "under ₦2,500: 1.5% only");
assert.equal(cardChargeKobo(N(2_500)), 3_750 + N(100));
assert.equal(cardChargeKobo(N(10_000)), N(250));
assert.equal(cardChargeKobo(N(200_000)), N(2_000), "capped");
assert.equal(cardChargeKobo(12_345), 186, "rounded up to the kobo");

// By card, not covering: the charges come out of the gift.
let q = quoteGift(N(10_000), { method: "card", cover: false });
assert.deepEqual([q.payKobo, q.cardChargeKobo, q.bandKobo, q.netKobo], [N(10_000), N(250), N(25), N(10_000) - N(275)]);
// By card, covering: the card charge is on the larger amount charged; the community gets exactly the gift.
q = quoteGift(N(10_000), { method: "card", cover: true });
assert.equal(q.netKobo, N(10_000));
assert.equal(q.payKobo, 1_027_919);
assert.equal(q.payKobo - cardChargeKobo(q.payKobo) - q.bandKobo, N(10_000));
assert.ok((q.payKobo - 1) - cardChargeKobo(q.payKobo - 1) - q.bandKobo < N(10_000), "not a kobo more than needed");
for (const g of [N(100), N(2_400), N(2_470), N(5_000), N(49_999), N(133_333), N(1_000_000)]) {
  const c = quoteGift(g, { method: "card", cover: true });
  assert.ok(c.netKobo >= g && c.netKobo - g <= 2, `covered by card: the whole gift arrives (${g})`);
  assert.equal(c.payKobo, c.giftKobo + c.bandKobo + c.cardChargeKobo + (c.netKobo - g));
}
// From the wallet: just the band.
assert.deepEqual(quoteGift(N(10_000), { method: "wallet", cover: true }), { giftKobo: N(10_000), bandKobo: N(25), cardChargeKobo: 0, payKobo: N(10_025), netKobo: N(10_000), covered: true });
assert.deepEqual(quoteGift(N(60_000), { method: "wallet", cover: false }), { giftKobo: N(60_000), bandKobo: N(50), cardChargeKobo: 0, payKobo: N(60_000), netKobo: N(59_950), covered: false });
assert.ok(quoteGift(N(10_000), { method: "card", cover: true }).payKobo > quoteGift(N(10_000), { method: "wallet", cover: true }).payKobo, "the wallet is cheaper");

// Amounts and the cap until the community is verified.
assert.equal(giftProblem(GIVING_MIN_KOBO, false), null);
assert.match(giftProblem(GIVING_MIN_KOBO - 100, true)!, /₦100 or more/);
assert.equal(giftProblem(UNVERIFIED_GIFT_CAP_KOBO, false), null);
assert.match(giftProblem(UNVERIFIED_GIFT_CAP_KOBO + 100, false)!, /verified.*₦20,000/);
assert.equal(giftProblem(UNVERIFIED_GIFT_CAP_KOBO + 100, true), null);
assert.match(giftProblem(N(5_000_001), true)!, /up to/);
assert.match(giftProblem(12_345.5, true)!, /₦100/);

// Paid out together: 24 hours on, at the next 10:00 Lagos.
assert.equal(givingReleaseAfter(new Date("2026-10-30T09:00:00Z")).toISOString(), "2026-10-31T09:00:00.000Z");
assert.equal(givingReleaseAfter(new Date("2026-10-30T09:01:00Z")).toISOString(), "2026-11-01T09:00:00.000Z");
assert.equal(givingReleaseAfter(new Date("2026-10-29T23:30:00Z")).toISOString(), "2026-10-31T09:00:00.000Z");

// Funds: named by admins, "Donation" when none.
assert.deepEqual(cleanGivingSettings({ enabled: true, funds: [" Tithe ", "Offering", "tithe", "", "Building  fund"] }), { enabled: true, funds: ["Tithe", "Offering", "Building fund"] });
assert.deepEqual(cleanGivingSettings({}), { enabled: false, funds: ["Donation"] });

// Ticket types: priced in naira, sold counts kept, a type with sales can't go or drop below what's sold.
let r = cleanTicketTypes([{ name: "Regular", priceNaira: 5000, quantity: 100 }, { name: "VIP", priceNaira: 20000, quantity: 10 }], []);
assert.ok(r.ok);
const types = r.ok ? r.types : [];
assert.deepEqual(types.map((t) => [t.id, t.priceKobo, t.quantity, t.sold]), [["regular", N(5_000), 100, 0], ["vip", N(20_000), 10, 0]]);
types[1].sold = 8;
assert.equal(ticketsLeft(types[1]), 2);
r = cleanTicketTypes([{ id: "regular", name: "Regular", priceNaira: 6000, quantity: 120 }], types);
assert.ok(!r.ok && /VIP has tickets sold/.test(r.error));
r = cleanTicketTypes([{ id: "regular", name: "Regular", priceNaira: 6000, quantity: 120 }, { id: "vip", name: "VIP", priceNaira: 20000, quantity: 5 }], types);
assert.ok(!r.ok && /8 already sold/.test(r.error));
r = cleanTicketTypes([{ id: "vip", name: "VIP", priceNaira: 25000, quantity: 8 }, { id: "regular", name: "Regular", priceNaira: 5000, quantity: 100 }, { name: "Regular", priceNaira: 3000, quantity: 5 }], types);
assert.ok(r.ok && r.types[0].sold === 8 && r.types[0].priceKobo === N(25_000) && r.types[2].id === "regular-2");
assert.ok(!cleanTicketTypes([{ name: "Cheap", priceNaira: 50, quantity: 5 }], []).ok, "₦100 at least");
assert.ok(!cleanTicketTypes([{ name: "", priceNaira: 500, quantity: 5 }], []).ok);

// Codes: unambiguous letters and digits, read back from the code, its dashed form or the check-in link.
const code = makeTicketCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
assert.match(code, /^[2-9A-HJKMNP-Z]{10}$/);
assert.equal(readTicketCode(code.toLowerCase()), code);
assert.equal(readTicketCode(` ${showCode(code)} `), code);
assert.equal(readTicketCode(`https://notesapp.name.ng/events/abc/checkin?code=${code}`), code);
assert.equal(readTicketCode("HELLO"), "");
assert.equal(readTicketCode("ABCDE-0OIL1"), "", "never 0, O, I, L or 1");

console.log("GIVING OK");
