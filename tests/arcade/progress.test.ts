// Signed-in Arcade progress (lib/arcade/progress.ts): only well-formed keys and small values are saved, and the number of keys is capped.
// Run: npm run test:arcade.
import assert from "node:assert/strict";
import { MAX_KEYS, MAX_VALUE, cleanKey, cleanKv, cleanValue, mergeKv } from "../../lib/arcade/progress";

// The keys the games use today.
for (const k of ["arcade-draughts-wins", "notes-arcade-ludo-wins", "notes-arcade-whot-record", "notes-arcade-chess", "arcade-akahausa-wins"]) assert.equal(cleanKey(k), k, k);
for (const k of ["", "wins", "arcade-", "Arcade-ludo", "arcade-ludo wins", "arcade-../x", "__proto__", `arcade-${"x".repeat(80)}`, 5, null]) assert.equal(cleanKey(k), null, String(k));

assert.equal(cleanValue("3"), "3");
assert.equal(cleanValue(7), "7");
assert.equal(cleanValue(JSON.stringify({ w: 1, l: 2 })), '{"w":1,"l":2}');
assert.equal(cleanValue("x".repeat(MAX_VALUE + 1)), null);
assert.equal(cleanValue({ a: 1 }), null);
assert.equal(cleanValue(Number.NaN), null);

assert.deepEqual(cleanKv({ "arcade-ncho-wins": "2", bad: "1", "arcade-chess": { no: 1 } }), { "arcade-ncho-wins": "2" });
assert.deepEqual(cleanKv(null), {});
assert.deepEqual(cleanKv(["arcade-x"]), {});

// Merging: updates win, other saved keys stay.
const m = mergeKv({ "arcade-ludo-wins": "1", "arcade-ncho-wins": "4" }, { "arcade-ludo-wins": "2" });
assert.deepEqual(m.kv, { "arcade-ludo-wins": "2", "arcade-ncho-wins": "4" });
assert.deepEqual(m.refused, []);

// The cap: a new key past MAX_KEYS is refused, an existing key can still be updated.
const full = Object.fromEntries(Array.from({ length: MAX_KEYS }, (_, i) => [`arcade-k${i}`, "1"]));
const capped = mergeKv(full, { "arcade-new": "1", "arcade-k0": "9" });
assert.equal(Object.keys(capped.kv).length, MAX_KEYS);
assert.equal(capped.kv["arcade-k0"], "9");
assert.deepEqual(capped.refused, ["arcade-new"]);

console.log("arcade progress: ok");
