// Notes Tasks rules (lib/tasks.ts). Run: npm run test:tasks → "TASKS OK".
import assert from "node:assert/strict";
import {
  ANON_FEE_KOBO, TaskError, anonFeeFor, anonLabel, budgetKobo, canPost, cleanStars, cleanTask, isOpenFor, publicTask, publishCostKobo, slotsLeft, workerNetKobo, type Task,
} from "../../lib/tasks";

const good = { title: "Translate 500 sentences", summary: "English to Hausa, typed by hand, for a language dataset.", details: "Translate each English sentence into natural Hausa. A Hausa reviewer checks a sample.", category: "language", rewardNaira: 40000, slots: 3, days: 3, openDays: 7, anonymous: true, brief: " the sheet link ", terms: "Keep it confidential." };
const c = cleanTask(good);
assert.equal(c.rewardKobo, 4_000_000); assert.equal(c.slots, 3); assert.equal(c.brief, "the sheet link"); assert.equal(c.anonymous, true);
const bad = (patch: object, re: RegExp) => assert.throws(() => cleanTask({ ...good, ...patch }), (e: unknown) => e instanceof TaskError && re.test(e.message));
bad({ title: "Hi" }, /title/); bad({ summary: "short" }, /summary/); bad({ details: "too short" }, /Describe/); bad({ category: "spam" }, /category/);
bad({ rewardNaira: 500 }, /reward/); bad({ rewardNaira: "abc" }, /reward/); bad({ slots: 0 }, /How many/); bad({ slots: 51 }, /How many/); bad({ days: 61 }, /Days/); bad({ openDays: 0 }, /open/);
assert.equal(cleanTask({ ...good, anonymous: "yes" }).anonymous, false, "only a real true turns it on");

// Money: rewards × places held; the fee only when anonymous and the plan doesn't include it; workers get the reward less 10%.
assert.equal(budgetKobo(c), 12_000_000);
assert.equal(anonFeeFor(true, "standard"), ANON_FEE_KOBO); assert.equal(anonFeeFor(true, "pro"), ANON_FEE_KOBO);
assert.equal(anonFeeFor(true, "business"), 0); assert.equal(anonFeeFor(true, "enterprise"), 0); assert.equal(anonFeeFor(false, "standard"), 0);
assert.equal(publishCostKobo(c, true, "standard"), 12_000_000 + ANON_FEE_KOBO);
assert.equal(workerNetKobo(4_000_000), 3_600_000);

// Who may post.
assert.equal(canPost({}, true, false, true).ok, true); assert.equal(canPost({}, false, true, true).ok, true);
assert.equal(canPost({}, false, false, true).ok, false); assert.equal(canPost({}, true, false, false).ok, false); assert.equal(canPost({ suspended: true }, true, true, true).ok, false);

// The anonymous label says what kind of poster it is, never who.
assert.equal(anonLabel({ accountKind: "organisation", industry: "tech" }), "Verified organisation · Technology or software");
assert.equal(anonLabel({ industry: "other" }), "Verified member");
const t = { id: "t1", posterUid: "secret", posterUsername: "acme", posterName: "Acme Ltd", posterAvatar: "a.png", posterOrg: true, anonymous: true, anonLabel: "Verified organisation", status: "open", funded: true, closesAt: new Date(Date.now() + 86_400_000).toISOString(), slots: 3, accepted: 1, approved: 1 } as unknown as Task;
const p = publicTask(t) as Record<string, unknown>;
assert.equal(p.posterUid, undefined); assert.equal(p.posterUsername, ""); assert.equal(p.posterName, "Verified organisation"); assert.equal(p.posterAvatar, "");
assert.equal((publicTask({ ...t, anonymous: false }) as Record<string, unknown>).posterName, "Acme Ltd");
assert.equal(slotsLeft(t), 1); assert.equal(isOpenFor(t), true); assert.equal(isOpenFor({ ...t, funded: false }), false); assert.equal(isOpenFor({ ...t, closesAt: "2020-01-01T00:00:00Z" }), false);
assert.equal(cleanStars(5), 5); assert.throws(() => cleanStars(6)); assert.throws(() => cleanStars(2.5));
console.log("TASKS OK");
