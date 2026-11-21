// Nana in Notes Arcade: when she may help, and the small helpers the games share (lib/arcade/nana.ts).
import assert from "node:assert/strict";
import { DEFAULT_DUEL_RULES, listText, nanaAvailability, nanaKey, rateMove } from "../../lib/arcade/nana";

assert.deepEqual(nanaAvailability({ mode: "practice" }), { available: true });
const t = nanaAvailability({ mode: "tournament" });
assert.equal(t.available, false, "never in tournaments");
assert.equal(DEFAULT_DUEL_RULES.nana, false, "off in a duel unless both agree");
assert.equal(nanaAvailability({ mode: "duel", rules: DEFAULT_DUEL_RULES }).available, false);
assert.equal(nanaAvailability({ mode: "duel", rules: { nana: true } }).available, true);
assert.equal(nanaKey("ludo"), "arcade-nana-ludo");
assert.equal(rateMove(10, 10, 3), "good");
assert.equal(rateMove(8, 10, 3), "fine");
assert.equal(rateMove(2, 10, 3), "risky");
assert.equal(listText([]), "");
assert.equal(listText(["a"]), "a");
assert.equal(listText(["a", "b", "c"]), "a, b and c");
console.log("nana: all tests passed");
