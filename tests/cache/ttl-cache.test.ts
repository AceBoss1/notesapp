// The keyed TTL cache (lib/ttl-cache.ts ttlCacheBy): one load per key within the TTL, separate keys load separately, the oldest key goes
// when full, and invalidate drops a key. Run: npx -y tsx tests/cache/ttl-cache.test.ts → "ALL OK".
import assert from "node:assert/strict";
import { ttlCacheBy } from "../../lib/ttl-cache";

(async () => {
  const calls: string[] = [];
  const get = ttlCacheBy(60_000, async (k: string) => { calls.push(k); return k.toUpperCase(); }, 2);
  assert.deepEqual(await Promise.all([get("a"), get("a"), get("a")]), ["A", "A", "A"]);
  assert.deepEqual(calls, ["a"], "one load for many callers at once");
  assert.equal(await get("b"), "B");
  assert.equal(await get("a"), "A");
  assert.deepEqual(calls, ["a", "b"], "cached within the TTL");
  await get("c"); // full (max 2): "a", the oldest key, goes
  await get("a");
  assert.deepEqual(calls, ["a", "b", "c", "a"]);
  get.invalidate("a");
  await get("a");
  assert.equal(calls.filter((c) => c === "a").length, 3, "invalidate drops the key");
  const fast = ttlCacheBy(1, async (k: number) => { calls.push(String(k)); return k; });
  await fast(1); await new Promise((r) => setTimeout(r, 5)); await fast(1);
  assert.equal(calls.filter((c) => c === "1").length, 2, "reloads after the TTL");
  console.log("ALL OK");
})().catch((e) => { console.error(e); process.exit(1); });
