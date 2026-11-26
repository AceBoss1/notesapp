// Event and meeting invitations (lib/event-invites.ts). Pure.
import assert from "node:assert/strict";
import { EMAILS_PER_SEND, allowanceFor, cleanEmails, cleanMessage, packOf, pickRecipients, weekOf } from "../../lib/event-invites";
import { DEFAULT_PRICING } from "../../lib/pricing";

// The week is Monday to Sunday in Lagos time.
assert.equal(weekOf(new Date("2026-11-26T12:00:00Z")), "2026-11-23", "a Thursday");
assert.equal(weekOf(new Date("2026-11-23T00:30:00Z")), "2026-11-23", "Monday 01:30 in Lagos");
assert.equal(weekOf(new Date("2026-11-22T22:59:00Z")), "2026-11-16", "Sunday 23:59 in Lagos is still last week");
assert.equal(weekOf(new Date("2026-11-22T23:00:00Z")), "2026-11-23", "Monday 00:00 in Lagos");

// Allowances: the approved defaults, plus a pack while it runs.
const cfg = DEFAULT_PRICING.invites;
assert.deepEqual([cfg.perWeekBasic, cfg.perWeekPro, cfg.perWeekBusiness], [500, 2_000, 5_000]);
assert.deepEqual([cfg.pack10kKobo, cfg.pack25kKobo, cfg.pack50kKobo], [1_000_000, 2_500_000, 4_500_000]);
const now = new Date("2026-11-26T12:00:00Z");
assert.equal(allowanceFor("standard", cfg, null, now), 500);
assert.equal(allowanceFor("basic", cfg, null, now), 500);
assert.equal(allowanceFor("pro", cfg, null, now), 2_000);
assert.equal(allowanceFor("business", cfg, { sends: 10_000, until: "2026-12-20T00:00:00Z" }, now), 15_000);
assert.equal(allowanceFor("business", cfg, { sends: 10_000, until: "2026-11-20T00:00:00Z" }, now), 5_000, "a pack that ran out");
assert.equal(allowanceFor("enterprise", cfg, null, now), cfg.perWeekEnterprise);
assert.equal(packOf("25k")?.sends, 25_000);
assert.equal(packOf("1m"), null);

// Pasted addresses.
const e = cleanEmails("Ada@Example.com, tolu@example.com\nnot-an-email ada@example.com; bisi@mail.ng");
assert.deepEqual(e.emails, ["ada@example.com", "tolu@example.com", "bisi@mail.ng"]);
assert.equal(e.skipped, 2, "one bad, one repeat");
assert.equal(cleanEmails(Array.from({ length: EMAILS_PER_SEND + 20 }, (_, i) => `p${i}@x.ng`).join(",")).emails.length, EMAILS_PER_SEND);
assert.equal(cleanMessage("a\n\n\n\nb"), "a\n\nb");
assert.equal(cleanMessage("x".repeat(900)).length, 500);

// Who gets this send: not people already in, no repeats, followers first, cut to what's left.
const r = pickRecipients({ uids: ["a", "b", "b", "c", "in"], emails: ["x@y.ng", "z@y.ng"] }, new Set(["in"]), 4);
assert.deepEqual(r, { uids: ["a", "b", "c"], emails: ["x@y.ng"], cut: 1 });
assert.deepEqual(pickRecipients({ uids: ["a"], emails: [] }, new Set(), 0), { uids: [], emails: [], cut: 1 });
assert.deepEqual(pickRecipients({ uids: [], emails: ["x@y.ng"] }, new Set(), -3), { uids: [], emails: [], cut: 1 });
console.log("ALL OK");
