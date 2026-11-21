// Nana's Whot hints and takes (lib/arcade/nana-whot.ts). Run: npx -y tsx tests/arcade/nana-whot.test.ts
import assert from "node:assert/strict";
import { applyMove, computerMove, initialState, legalMoves, mulberry32, shuffle, type Card, type WhotState } from "../../lib/arcade/whot";
import { whotTake, whotTip } from "../../lib/arcade/nana-whot";

const c = (shape: Card["shape"], num: number): Card => ({ shape, num });
const base = (over: Partial<WhotState>): WhotState => ({
  hands: [[c("circle", 3), c("star", 7)], [c("square", 10), c("cross", 11)]],
  market: [c("triangle", 4), c("triangle", 5), c("star", 1)],
  pile: [c("circle", 7)], turn: 0, phase: "play", wanted: null, pending: null, winner: null, stuck: 0, seed: 1, log: "",
  ...over,
});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Across many real games: every tip is a legal move, and never changes when the computer's hand or the market are swapped for
// other cards (same counts), so Nana can't be leaking what you can't see.
let tips = 0;
for (let seed = 1; seed <= 60; seed += 1) {
  const rng = mulberry32(seed);
  let s = initialState(rng);
  for (let step = 0; step < 200 && s.phase !== "over"; step += 1) {
    if (s.turn === 0) {
      const t = whotTip(s);
      assert.ok(t, "a tip on your turn");
      assert.ok(t.tip.move && t.tip.why.length > 10, "the tip says what and why");
      assert.ok(legalMoves(s).some((m) => same(m, t.highlight)), `tip is legal (seed ${seed})`);
      // Swap the computer's cards and the market for a reshuffle of the same unseen cards.
      const unseen = shuffle([...s.hands[1], ...s.market], mulberry32(seed * 31 + step));
      const other: WhotState = { ...s, hands: [s.hands[0], unseen.slice(0, s.hands[1].length)], market: unseen.slice(s.hands[1].length) };
      assert.deepEqual(whotTip(other), t, "the tip only uses what you can see");
      tips += 1;
      s = applyMove(s, t.highlight);
    } else {
      const m = computerMove(s);
      const next = applyMove(s, m);
      const take = whotTake(s, m, next);
      assert.ok(take && take.text.length > 10, "a take on every computer move");
      assert.doesNotMatch(take.text, /undefined|NaN/);
      s = next;
    }
  }
}
assert.ok(tips > 200);
assert.equal(whotTip(base({ turn: 1 })), null, "no tip on the computer's turn");

// A winning play: your last card matches, so Nana says check up.
let t = whotTip(base({ hands: [[c("circle", 4)], [c("square", 10)]] }));
assert.deepEqual(t?.highlight, { type: "play", index: 0 });
assert.match(t!.tip.why, /last card/i);

// Pick Two when the computer is low: Nana names the special card and why.
t = whotTip(base({ hands: [[c("circle", 2), c("circle", 10), c("star", 3)], [c("square", 10)]] }));
assert.deepEqual(t?.highlight, { type: "play", index: 0 });
assert.equal(t!.tip.move, "your 2 of circles");
assert.match(t!.tip.why, /Pick Two makes the computer draw/);

// Defending a pick two with your own 2.
t = whotTip(base({ hands: [[c("star", 2), c("circle", 10)], [c("square", 10), c("star", 3)]], pending: { num: 2, count: 2 } }));
assert.deepEqual(t?.highlight, { type: "play", index: 0 });
assert.match(t!.tip.why, /computer picks 4/);

// Nothing matches: go to market. A plain match says it matches the pile.
t = whotTip(base({ hands: [[c("square", 3), c("star", 4)], [c("square", 10)]] }));
assert.deepEqual(t?.highlight, { type: "draw" });
assert.equal(t!.tip.move, "go to market");
t = whotTip(base({ hands: [[c("circle", 10), c("star", 4)], [c("square", 10), c("cross", 3)]] }));
assert.match(t!.tip.why, /matches the circles on the pile/);

// After your Whot: ask for the shape you hold most.
t = whotTip(base({ phase: "choose", hands: [[c("star", 3), c("star", 5), c("circle", 4)], [c("square", 10)]] }));
assert.deepEqual(t?.highlight, { type: "call", shape: "star" });
assert.match(t!.tip.why, /two stars/);

// Takes: the computer calls a shape; plays Pick Two; checks up; goes to market.
let before = base({ turn: 1, phase: "choose", hands: [[c("star", 3), c("circle", 4)], [c("square", 10)]] });
let take = whotTake(before, { type: "call", shape: "star" }, applyMove(before, { type: "call", shape: "star" }));
assert.match(take!.text, /asked for stars: check your stars/);
before = base({ turn: 1, hands: [[c("star", 3)], [c("circle", 2), c("square", 10)]] });
take = whotTake(before, { type: "play", index: 0 }, applyMove(before, { type: "play", index: 0 }));
assert.match(take!.text, /Pick Two/);
assert.equal(take!.tone, "risky");
before = base({ turn: 1, hands: [[c("star", 3)], [c("circle", 9)]] });
take = whotTake(before, { type: "play", index: 0 }, applyMove(before, { type: "play", index: 0 }));
assert.match(take!.text, /Check up/);
before = base({ turn: 1, hands: [[c("star", 3)], [c("square", 9)]] });
take = whotTake(before, { type: "draw" }, applyMove(before, { type: "draw" }));
assert.match(take!.text, /went to market/);
assert.equal(whotTake(base({}), { type: "draw" }, applyMove(base({}), { type: "draw" })), null, "no take on your own move");

console.log("nana whot: all tests passed");
