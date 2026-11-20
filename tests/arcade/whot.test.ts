// Whot rules (lib/arcade/whot.ts). Run: npx -y tsx tests/arcade/whot.test.ts
import assert from "node:assert/strict";
import { applyMove, canPlay, computerMove, initialState, legalMoves, makeDeck, mulberry32, topCard, type Card, type WhotState } from "../../lib/arcade/whot";

const c = (shape: Card["shape"], num: number): Card => ({ shape, num });
const base = (over: Partial<WhotState>): WhotState => ({
  hands: [[c("circle", 3), c("star", 7)], [c("square", 10), c("cross", 11)]],
  market: [c("triangle", 4), c("triangle", 5), c("star", 1)],
  pile: [c("circle", 7)], turn: 0, phase: "play", wanted: null, pending: null, winner: null, stuck: 0, seed: 1, log: "",
  ...over,
});

// The deck: 54 cards, five Whots, the right counts per shape.
const deck = makeDeck();
assert.equal(deck.length, 54);
assert.equal(deck.filter((x) => x.shape === "whot").length, 5);
assert.equal(deck.filter((x) => x.shape === "circle").length, 12);
assert.equal(deck.filter((x) => x.shape === "cross").length, 9);
assert.equal(deck.filter((x) => x.shape === "star").length, 7);

// Dealing: 5 each, one on the pile, never a Whot to start, no card lost.
for (let seed = 1; seed < 40; seed += 1) {
  const s = initialState(mulberry32(seed));
  assert.equal(s.hands[0].length, 5);
  assert.equal(s.hands[1].length, 5);
  assert.equal(s.pile.length, 1);
  assert.notEqual(topCard(s).shape, "whot");
  assert.equal(s.market.length + 11, 54);
}
// Same seed, same game.
assert.deepEqual(initialState(mulberry32(7)), initialState(mulberry32(7)));

// Matching shape or number; Whot goes on anything.
{
  const s = base({});
  assert.ok(canPlay(s, c("circle", 3)), "same shape");
  assert.ok(canPlay(s, c("star", 7)), "same number");
  assert.ok(!canPlay(s, c("square", 10)));
  assert.ok(canPlay(s, c("whot", 20)));
  assert.deepEqual(legalMoves(s).map((m) => m.type), ["play", "play", "draw"]);
}

// Playing a plain card passes the turn and never mutates.
{
  const s = base({});
  const n = applyMove(s, { type: "play", index: 0 });
  assert.equal(n.turn, 1);
  assert.deepEqual(topCard(n), c("circle", 3));
  assert.equal(s.hands[0].length, 2, "old state untouched");
  assert.throws(() => applyMove(s, { type: "play", index: 2 }));
  assert.throws(() => applyMove(base({ hands: [[c("square", 10), c("star", 2)], [c("circle", 1)]] }), { type: "play", index: 0 }));
}

// Draw: one card, turn passes.
{
  const n = applyMove(base({}), { type: "draw" });
  assert.equal(n.hands[0].length, 3);
  assert.deepEqual(n.hands[0][2], c("star", 1));
  assert.equal(n.turn, 1);
}

// 1 hold on and 8 suspension: the same player goes again.
{
  const n1 = applyMove(base({ hands: [[c("circle", 1), c("star", 3)], [c("square", 2)]] }), { type: "play", index: 0 });
  assert.equal(n1.turn, 0);
  const n8 = applyMove(base({ hands: [[c("circle", 8), c("star", 3)], [c("square", 2)]] }), { type: "play", index: 0 });
  assert.equal(n8.turn, 0);
}

// 2 pick two: the victim may stack a 2 (now pick four) or picks.
{
  const s = base({ hands: [[c("circle", 2), c("star", 3)], [c("square", 2), c("cross", 5)]] });
  const a = applyMove(s, { type: "play", index: 0 });
  assert.deepEqual(a.pending, { num: 2, count: 2 });
  assert.equal(a.turn, 1);
  assert.ok(!canPlay(a, c("cross", 5)) && !canPlay(a, c("whot", 20)) && canPlay(a, c("square", 2)), "only a 2 defends");
  const b = applyMove(a, { type: "play", index: 0 });
  assert.deepEqual(b.pending, { num: 2, count: 4 });
  assert.equal(b.turn, 0);
  const d = applyMove(b, { type: "draw" });
  assert.equal(d.hands[0].length, 1 + 4, "picked four: three from the market, then the pile is reshuffled");
  assert.equal(d.pile.length, 1);
  assert.equal(d.pending, null);
  assert.equal(d.turn, 1);
}

// 5 pick three.
{
  const a = applyMove(base({ hands: [[c("circle", 5), c("star", 3)], [c("square", 10)]] }), { type: "play", index: 0 });
  assert.deepEqual(a.pending, { num: 5, count: 3 });
  const d = applyMove(a, { type: "draw" });
  assert.equal(d.hands[1].length, 4);
}

// 14 general market: the other player picks one and the player goes again.
{
  const a = applyMove(base({ hands: [[c("circle", 14), c("star", 3)], [c("square", 10)]] }), { type: "play", index: 0 });
  assert.equal(a.hands[1].length, 2);
  assert.equal(a.turn, 0);
  assert.equal(a.market.length, 2);
}

// 20 Whot: choose a shape, then the other player must follow it (or play a Whot).
{
  const a = applyMove(base({ hands: [[c("whot", 20), c("star", 3)], [c("square", 10)]] }), { type: "play", index: 0 });
  assert.equal(a.phase, "choose");
  assert.equal(a.turn, 0);
  assert.equal(legalMoves(a).length, 5);
  const b = applyMove(a, { type: "call", shape: "square" });
  assert.equal(b.wanted, "square");
  assert.equal(b.turn, 1);
  assert.ok(canPlay(b, c("square", 10)) && canPlay(b, c("whot", 20)) && !canPlay(b, c("circle", 14)));
  const n = applyMove(b, { type: "play", index: 0 });
  assert.equal(n.wanted, null);
}

// Market runs out: the pile (minus its top) is reshuffled into the market.
{
  const s = base({ market: [], pile: [c("cross", 1), c("cross", 2), c("circle", 7)] });
  const n = applyMove(s, { type: "draw" });
  assert.equal(n.hands[0].length, 3);
  assert.deepEqual(n.pile, [c("circle", 7)]);
  assert.equal(n.market.length, 1);
}

// Winning: the last card ends the game.
{
  const n = applyMove(base({ hands: [[c("circle", 3)], [c("square", 10)]] }), { type: "play", index: 0 });
  assert.equal(n.phase, "over");
  assert.equal(n.winner, 0);
  assert.throws(() => applyMove(n, { type: "draw" }));
}

// The computer: defends with a 2, otherwise plays something legal; asks for its strongest shape.
{
  const s = base({ turn: 1, pending: { num: 2, count: 2 }, hands: [[c("circle", 3)], [c("square", 2), c("circle", 9)]] });
  assert.deepEqual(computerMove(s), { type: "play", index: 0 });
  const ch = base({ turn: 1, phase: "choose", hands: [[c("circle", 3)], [c("star", 3), c("star", 4), c("circle", 9)]] });
  assert.deepEqual(computerMove(ch), { type: "call", shape: "star" });
}

// Full games between two computer players finish without an illegal move, and no card is ever lost.
let finished = 0;
for (let seed = 1; seed <= 300; seed += 1) {
  let s = initialState(mulberry32(seed), (seed % 2) as 0 | 1);
  for (let i = 0; i < 2000 && s.phase !== "over"; i += 1) {
    const m = computerMove(s);
    assert.ok(legalMoves(s).some((x) => JSON.stringify(x) === JSON.stringify(m)), `illegal move in game ${seed}`);
    s = applyMove(s, m);
    assert.equal(s.hands[0].length + s.hands[1].length + s.market.length + s.pile.length, 54);
  }
  if (s.phase === "over") { finished += 1; assert.ok(s.winner === 0 || s.winner === 1); }
}
assert.equal(finished, 300, "every game finished");

console.log("whot: all tests passed");
