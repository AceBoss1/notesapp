// The stage-trigger numbers' arithmetic (lib/ops-metrics.ts). Run: npm run test:ops → "ALL OK".
import assert from "node:assert/strict";
import { against, fmtMs, growth, isTiming, percentile, worst } from "../../lib/ops-metrics";

assert.equal(percentile([], 95), null);
assert.equal(percentile([5], 95), 5);
assert.equal(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 95), 95, "nearest rank");
assert.equal(percentile([300, 100, 200], 50), 200, "unsorted input");
assert.equal(percentile(Array.from({ length: 20 }, (_, i) => (i === 19 ? 5000 : 100)), 95), 100, "one slow sample in 20 is the top 5%");

assert.equal(against(null, 10), "unknown");
assert.equal(against(Number.NaN, 10), "unknown");
assert.equal(against(10, 10), "crossed");
assert.equal(against(7, 10), "near");
assert.equal(against(6.9, 10), "ok");
assert.equal(against(1, 3, 1 / 3), "near", "Stage 1: one event is getting close");
assert.equal(against(0, 3, 1 / 3), "ok");

assert.equal(worst([]), "unknown");
assert.equal(worst(["ok", "unknown"]), "ok", "a number not measured yet doesn't hide one that is");
assert.equal(worst(["ok", "near", "crossed"]), "crossed");

assert.equal(growth(110, 100)?.toFixed(2), "0.10");
assert.equal(growth(null, 100), null); assert.equal(growth(5, 0), null);

assert.equal(fmtMs(null), "not measured yet"); assert.equal(fmtMs(640), "640 ms"); assert.equal(fmtMs(1234), "1.2 s"); assert.equal(fmtMs(31_000), "31 s");
assert.ok(isTiming("feed")); assert.ok(!isTiming("toString")); assert.ok(!isTiming(3));
console.log("ALL OK");
