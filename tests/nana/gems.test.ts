// Nana's gems, allowance timer and spending order (lib/nana-gems.ts), and which questions may use the answer bank (lib/nana-bank.ts).
// Run: npm run test:nana → "ALL OK".
import assert from "node:assert/strict";
import { costKobo, effortsFor, gemsFor, nextReset, periodAllowance, periodKey, pickEffort, pickGem, spend, standing, canStart } from "../../lib/nana-gems";
import { bankKey, bankQuestion } from "../../lib/nana-bank";

// Who gets which gem and effort: Pearl and Quick for all; Emerald and Balanced from Business; Ruby and Thorough on Enterprise.
assert.deepEqual(gemsFor("standard"), ["pearl"]); assert.deepEqual(gemsFor("pro"), ["pearl"]);
assert.deepEqual(gemsFor("business"), ["pearl", "emerald"]); assert.deepEqual(gemsFor("enterprise"), ["pearl", "emerald", "ruby"]);
assert.deepEqual(effortsFor("basic"), ["low"]); assert.deepEqual(effortsFor("business"), ["low", "medium"]); assert.deepEqual(effortsFor("enterprise"), ["low", "medium", "high"]);
assert.equal(pickGem("business", "ruby"), "emerald", "asking above your plan gets the best you have");
assert.equal(pickGem("basic", "emerald"), "pearl"); assert.equal(pickGem("enterprise", "ruby"), "ruby"); assert.equal(pickGem("enterprise", "nonsense"), "pearl");
assert.equal(pickEffort("pro", "high"), "low"); assert.equal(pickEffort("business", "high"), "medium"); assert.equal(pickEffort("enterprise", "high"), "high");

// Cost: $1 in / $5 out per million at ₦1,600 = 160,000 kobo to the dollar.
const pearl = { inUsd: 1, outUsd: 5 };
assert.equal(costKobo({ input_tokens: 1_000_000 }, pearl, 160_000), 160_000);
assert.equal(costKobo({ output_tokens: 1000 }, pearl, 160_000), 800, "1,000 output tokens = $0.005 = ₦8");
assert.equal(costKobo({ cache_read_input_tokens: 100_000 }, pearl, 160_000), 1_600, "cache reads at a tenth");
assert.equal(costKobo({ cache_creation_input_tokens: 100_000 }, pearl, 160_000), 20_000, "cache writes at 1.25×");
assert.equal(costKobo({ input_tokens: 1 }, pearl, 160_000), 1, "rounded up to the kobo");
assert.equal(costKobo({}, pearl, 160_000), 0);

// The timer runs on Lagos time; weeks start on Monday.
const sunNight = new Date("2026-10-18T22:30:00Z"); // 11:30 pm Sunday in Lagos
assert.equal(periodKey(sunNight, "week"), "w2026-10-12");
assert.equal(nextReset(sunNight, "week").toISOString(), "2026-10-18T23:00:00.000Z", "Monday 00:00 Lagos");
assert.equal(periodKey(new Date("2026-10-18T23:00:00Z"), "week"), "w2026-10-19", "a new week at midnight Lagos");
assert.equal(periodKey(sunNight, "day"), "d2026-10-18"); assert.equal(nextReset(sunNight, "day").toISOString(), "2026-10-18T23:00:00.000Z");
assert.equal(periodKey(new Date("2026-10-31T23:30:00Z"), "month"), "2026-11", "already November in Lagos");
assert.equal(nextReset(new Date("2026-12-15T12:00:00Z"), "month").toISOString(), "2026-12-31T23:00:00.000Z");
assert.equal(periodAllowance(300_000, "month"), 300_000);
assert.equal(periodAllowance(300_000, "week"), Math.round(300_000 * 12 / 52.1775));
assert.equal(periodAllowance(300_000, "day"), Math.round(300_000 * 12 / 365.25));

// Spending: allowance first, then credit; a new period starts the allowance again; credit never goes below zero.
const s = standing({ period: "w2026-10-12", usedKobo: 500, creditKobo: 1_000 }, "w2026-10-12", 800);
assert.deepEqual(s, { allowanceKobo: 800, usedKobo: 500, leftKobo: 300, creditKobo: 1_000 });
assert.deepEqual(spend(s, 400, true), { fromAllowance: 300, fromCredit: 100, usedKobo: 800, creditKobo: 900 });
assert.deepEqual(spend(s, 400, false), { fromAllowance: 0, fromCredit: 400, usedKobo: 500, creditKobo: 600 }, "a gem the allowance doesn't cover uses credit");
assert.deepEqual(spend(s, 5_000, true).creditKobo, 0, "we carry an overrun, never a negative balance");
assert.equal(standing({ period: "w2026-10-05", usedKobo: 800, creditKobo: 0 }, "w2026-10-12", 800).leftKobo, 800, "last week's use is forgotten");
assert.equal(canStart(standing({ period: "p", usedKobo: 800, creditKobo: 0 }, "p", 800), true), false);
assert.equal(canStart(standing({ period: "p", usedKobo: 800, creditKobo: 1 }, "p", 800), true), true);

// The answer bank takes general first questions only.
const q = (t: string) => bankQuestion([{ role: "user", content: t }]);
assert.equal(q("How do I get paid?"), "how do i get paid");
assert.equal(q("Hi Nana, how do I get paid? Thanks"), q("how do I get paid"), "greetings and punctuation don't matter");
assert.equal(q("How do I get paid on NotesApp with Paystack?"), "how do i get paid on notesapp with paystack");
assert.equal(q("My order NA-20391 hasn't arrived"), null, "an order number");
assert.equal(q("Can you email me at tola@example.com?"), null);
assert.equal(q("Why can't @tola see my post?"), null);
assert.equal(q("Call me on 0803 123 4567"), null);
assert.equal(q("Is Chimdinma Okafor on here?"), null, "a name, or a question about this page");
assert.equal(q("What does this page do?"), null);
assert.equal(q("hi"), null, "too short");
assert.equal(bankQuestion([{ role: "user", content: "How do I get paid?" }, { role: "assistant", content: "…" }, { role: "user", content: "And then?" }]), null, "only the first question in a chat");
assert.notEqual(bankKey("how do i get paid", true, "kb"), bankKey("how do i get paid", false, "kb"), "members and visitors are kept apart");
assert.notEqual(bankKey("how do i get paid", true, "kb v1"), bankKey("how do i get paid", true, "kb v2"), "editing the help centre retires old answers");
console.log("ALL OK");
