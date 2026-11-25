// Homepage doors (lib/home-doors.ts) and what a free trial kept you (lib/trial-earnings.ts). Pure.
// Run: npm run test:gtm → "ALL OK".
import assert from "node:assert/strict";
import { DOORS, PROOF_FLOORS, doorFrom, doorHash, proofFigures, quotesFor, roundDownNaira, type Quote } from "../../lib/home-doors";
import { breakEvenKobo, compareTrial, costFor, groupOf, nudgeDue, outcome, trialDays, trialStats, NUDGE_EVERY_MS, type LedgerIn, type Rates } from "../../lib/trial-earnings";

// ── Doors ──
assert.deepEqual(DOORS.map((d) => d.key), ["professionals", "academics", "sellers", "organisations"]);
for (const d of DOORS) {
  assert.equal(doorFrom(`#${doorHash(d.key)}`), d.key);
  assert.ok(d.sample.rows.length >= 4 && d.cta.href.startsWith("/"));
}
assert.equal(doorFrom("#organisations"), "organisations", "a bare door name works too");
assert.equal(doorFrom("", "?for=academics"), "academics");
assert.equal(doorFrom("#for-nobody", "?for=x"), null);
assert.equal(doorFrom(""), null);

// Quotes only with permission, and only for their door.
const qs: Quote[] = [
  { door: "professionals", text: "We run every client on it.", name: "Precheks", role: "consulting", permission: "email, 26 Nov 2026" },
  { door: "professionals", text: "No permission yet", name: "Someone", role: "coach", permission: "" },
  { door: "sellers", text: "Payments held until delivery won buyers over.", name: "ApexGlitz", role: "shop", permission: "WhatsApp, 26 Nov 2026" },
];
assert.deepEqual(quotesFor("professionals", qs).map((q) => q.name), ["Precheks"]);
assert.deepEqual(quotesFor("organisations", qs), []);
assert.deepEqual(quotesFor("professionals"), [], "none shipped: nothing made up");

// Figures: rounded down, and hidden below their floors.
assert.equal(roundDownNaira(403_179_500), "₦4M+");
assert.equal(roundDownNaira(82_307_200), "₦800k+");
assert.equal(roundDownNaira(31_719_400), "₦300k+");
assert.equal(roundDownNaira(5_550_000), "₦55k+");
assert.equal(roundDownNaira(99_900), "₦999");
assert.equal(roundDownNaira(-5), "₦0");
const today = proofFigures({ processedKobo: 403_179_500, paidOutKobo: 82_307_200, organisations: 10 });
assert.deepEqual(today.map((p) => p.value), ["₦4M+", "₦800k+", "10", "Held until delivery"]);
const small = proofFigures({ processedKobo: PROOF_FLOORS.processedKobo - 1, paidOutKobo: PROOF_FLOORS.paidOutKobo - 1, organisations: 2 });
assert.deepEqual(small.map((p) => p.value), ["Held until delivery"], "a small number is never the headline");

// ── Trial earnings ──
const basic: Rates = { session: 0.2, physical: 0.06, digital: 0.09 };
const pro: Rates = { session: 0.15, physical: 0.04, digital: 0.06 };
const at = (d: number) => new Date(Date.UTC(2026, 10, d, 10)).toISOString();
const from = at(16), to = at(31);
const e = (kind: string, gross: number, rate: number, day = 20, extra: Partial<LedgerIn> = {}): LedgerIn => ({ kind, grossKobo: gross, commissionKobo: Math.round(gross * rate), status: "held", createdAt: at(day), ...extra });

// The mockup's example at the live rates: ₦150,000 sessions, ₦20,000 subscriptions, ₦10,000 gifts.
const sample = [e("booking", 15_000_000, 0.15), e("subscription", 2_000_000, 0.15), e("gift", 1_000_000, 0.15)];
const c = compareTrial(sample, pro, basic, from, to);
assert.equal(c.grossKobo, 18_000_000);
assert.equal(c.keptPlanKobo, 15_300_000);
assert.equal(c.keptBackKobo, 14_400_000);
assert.equal(c.extraKobo, 900_000);
assert.deepEqual(c.lines.map((l) => l.label), ["Sessions", "Subscriptions", "Gifts"]);

// Left out: refunds, other currencies, payments outside the trial, kinds the plan doesn't change.
const noise = [
  ...sample,
  e("booking", 5_000_000, 0.15, 20, { status: "refunded" }),
  e("booking", 5_000_000, 0.15, 20, { currency: "GHS" }),
  e("booking", 5_000_000, 0.2, 10), // before the trial
  e("adshare", 400_000, 0), e("shipping", 300_000, 0), e("giving", 900_000, 0),
];
assert.deepEqual(compareTrial(noise, pro, basic, from, to), c);
assert.equal(groupOf("adshare"), null);
assert.equal(groupOf("order"), "physical");
assert.equal(groupOf("course"), "digital");

// A VIP uplift (+10% of the rate) carries across: 16.5% on Pro becomes 22% on Free Basic.
const vip = compareTrial([e("subscription", 1_000_000, 0.165)], pro, basic, from, to);
assert.equal(vip.keptPlanKobo, 835_000);
assert.equal(vip.keptBackKobo, 780_000);
// A payment charged nothing stays at nothing; shop and downloads at their own rates.
assert.equal(compareTrial([e("ticket", 1_000_000, 0)], pro, basic, from, to).extraKobo, 0);
const shop = compareTrial([e("order", 1_000_000, 0.04), e("digital", 1_000_000, 0.06)], pro, basic, from, to);
assert.equal(shop.keptBackKobo, 1_000_000 - 60_000 + 1_000_000 - 90_000);
assert.equal(shop.extraKobo, 20_000 + 30_000);

// Did it pay? Pro ₦5,000 a month; 15 days cost ₦2,500.
assert.equal(trialDays(from, to), 15);
assert.equal(costFor(500_000, 15), 250_000);
const big = compareTrial([e("booking", 18_000_000, 0.15)], pro, basic, from, to); // ₦180,000 of sessions → ₦9,000 more
const paid = outcome(big, 500_000, 15, pro, basic);
assert.equal(big.extraKobo, 900_000);
assert.equal(paid.verdict, "paid");
assert.equal(paid.paceKobo, 1_800_000);
assert.equal(paid.times, 3.6);
const smallTrial = compareTrial([e("booking", 1_800_000, 0.15)], pro, basic, from, to); // ₦18,000 → ₦900 more
const notYet = outcome(smallTrial, 500_000, 15, pro, basic);
assert.equal(notYet.verdict, "not_yet");
assert.equal(notYet.breakEvenKobo, 10_000_000, "Pro pays for itself from ₦100,000 a month");
assert.equal(breakEvenKobo(2_500_000, { session: 0.08, physical: 0, digital: 0 }, basic), 20_833_400, "Business from about ₦208,334");
assert.equal(breakEvenKobo(500_000, basic, basic), null);
assert.equal(outcome(compareTrial([], pro, basic, from, to), 500_000, 15, pro, basic).verdict, "not_yet", "nothing earned is never 'it paid'");

// The one nudge.
const NOW = Date.parse("2027-01-20T09:00:00Z");
assert.equal(nudgeDue({ extraKobo: 600_000 }, 500_000, undefined, NOW), true);
assert.equal(nudgeDue({ extraKobo: 400_000 }, 500_000, undefined, NOW), false, "not until it would pay for itself");
assert.equal(nudgeDue({ extraKobo: 600_000 }, 500_000, new Date(NOW - NUDGE_EVERY_MS + 1).toISOString(), NOW), false, "once every 60 days");
assert.equal(nudgeDue({ extraKobo: 600_000 }, 500_000, new Date(NOW - NUDGE_EVERY_MS).toISOString(), NOW), true);

// Admin's figures.
const r = (uid: string, verdict: "paid" | "not_yet", extraKobo: number, nudgedAt?: string[]) => ({
  uid, until: "2026-11-30T10:00:00.000Z", monthlyKobo: 500_000, comparison: { extraKobo } as never, outcome: { verdict } as never, nudgedAt,
});
const st = trialStats([r("a", "paid", 900_000), r("b", "paid", 300_000), r("c", "not_yet", 90_000), r("d", "not_yet", 50_000, ["2027-01-20T09:00:00.000Z"])],
  { a: "2026-11-30T12:00:00.000Z", b: "2026-11-01T00:00:00.000Z", d: "2027-01-21T09:00:00.000Z" });
assert.deepEqual(st, { ended: 4, toldPaid: 2, toldNotYet: 2, paidAfter: 2, paidAfterToldPaid: 1, paidAfterToldNotYet: 1, givenUpKobo: 1_340_000, planMonthlyKobo: 1_000_000, nudged: 1, paidAfterNudge: 1 });

console.log("ALL OK");
