// Nana's Ace of Spades hints and takes (lib/arcade/nana-spades.ts). Run: npx -y tsx tests/arcade/nana-spades.test.ts
import assert from "node:assert/strict";
import { applyMove, computerMove, initialState, isLegal, mulberry32, sortHand, type Card, type SpadesState } from "../../lib/arcade/spades";
import { spadesTake, spadesTip } from "../../lib/arcade/nana-spades";

const card = (suit: Card["suit"], rank: number): Card => ({ suit, rank });

// Hand the other three seats' cards round at random (same counts): what you can't see must not change Nana's tip.
function reshuffleOthers(s: SpadesState, seed: number): SpadesState {
  const rng = mulberry32(seed);
  const pool = [1, 2, 3].flatMap((i) => s.hands[i]);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let at = 0;
  const hands = s.hands.map((h, i) => {
    if (i === 0) return h;
    const out = sortHand(pool.slice(at, at + h.length));
    at += h.length;
    return out;
  });
  return { ...s, hands };
}

// Whole games: every tip is legal, says why, and ignores the hidden hands. Every computer move gets a sensible take.
let tips = 0;
for (let seed = 1; seed <= 12; seed += 1) {
  let s = initialState(mulberry32(seed), 120);
  for (let step = 0; step < 2000 && s.phase !== "over"; step += 1) {
    if (s.phase === "handOver") { s = applyMove(s, { type: "next" }); continue; }
    if (s.turn === 0) {
      const t = spadesTip(s);
      assert.ok(t, "a tip on your turn");
      assert.ok(t.tip.why.length > 10 && !/undefined|NaN/.test(t.tip.why), t.tip.why);
      if (t.highlight.type === "play") assert.ok(isLegal(s, t.highlight.card), "the suggested card is legal");
      else assert.ok(t.highlight.bid >= 0 && t.highlight.bid <= 13);
      assert.deepEqual(spadesTip(reshuffleOthers(s, seed * 97 + step)), t, "same tip whatever the others hold");
      tips += 1;
      s = applyMove(s, t.highlight.type === "bid" ? { type: "bid", bid: t.highlight.bid } : { type: "play", card: t.highlight.card });
    } else {
      const m = computerMove(s);
      const next = applyMove(s, m);
      const take = spadesTake(s, m, next);
      assert.ok(take && take.text.length > 8 && !/undefined|NaN/.test(take.text), take?.text);
      s = next;
    }
  }
}
assert.ok(tips > 100);

// A hand-built position: you lead, hearts ace is the boss, so Nana leads it and says why.
const set = (over: Partial<SpadesState>): SpadesState => ({
  ...initialState(mulberry32(5)), phase: "play", turn: 0, bids: [3, 3, 3, 3], ...over,
});
let s = set({ hands: [[card("H", 14), card("H", 4), card("C", 9)], [card("H", 13), card("C", 2), card("D", 3)], [card("H", 2), card("C", 3), card("D", 4)], [card("H", 3), card("C", 4), card("D", 5)]] });
let t = spadesTip(s)!;
assert.deepEqual(t.highlight, { type: "play", card: card("H", 14) });
assert.equal(t.tip.move, "your ace of hearts");
assert.match(t.tip.why, /highest heart still out/);

// No hearts to follow: trump with your low spade to take the trick.
s = set({
  spadesBroken: true,
  trick: [{ seat: 1, card: card("H", 13) }, { seat: 2, card: card("H", 2) }, { seat: 3, card: card("H", 5) }],
  turn: 0,
  hands: [[card("S", 3), card("S", 12), card("C", 9)], [card("C", 2), card("D", 3)], [card("C", 3), card("D", 4)], [card("C", 4), card("D", 5)]],
});
t = spadesTip(s)!;
assert.deepEqual(t.highlight, { type: "play", card: card("S", 3) });
assert.match(t.tip.why, /trump/);

// Bidding: with the ace of spades and other aces, Nana bids on them.
s = { ...initialState(mulberry32(9)), turn: 0, phase: "bid", bids: [null, null, 4, null] };
s.hands = [sortHand([card("S", 14), card("S", 13), card("S", 9), card("S", 4), card("H", 14), card("C", 14), card("D", 2), card("D", 5), card("D", 7), card("H", 3), card("H", 6), card("C", 8), card("C", 10)]), ...s.hands.slice(1)];
t = spadesTip(s)!;
assert.equal(t.highlight.type, "bid");
assert.match(t.tip.move, /^bid \d+$/);
assert.match(t.tip.why, /you hold the ace of spades.*, plus four spades/i);
assert.match(t.tip.why, /Partner bid 4/);

// Takes: an opponent trumps to take the trick; a lead; the take is only for computer seats.
const before = set({
  spadesBroken: false, turn: 3,
  trick: [{ seat: 0, card: card("H", 13) }, { seat: 1, card: card("H", 2) }, { seat: 2, card: card("H", 5) }],
  hands: [[card("C", 9)], [card("D", 3)], [card("D", 4)], [card("S", 2)]],
});
const after = applyMove(before, { type: "play", card: card("S", 2) });
const take = spadesTake(before, { type: "play", card: card("S", 2) }, after)!;
assert.match(take.text, /East trumped with the 2 of spades to take the trick/);
assert.match(take.text, /Spades are broken/);
assert.equal(take.tone, "risky");
assert.equal(spadesTake({ ...before, turn: 0 }, { type: "play", card: card("C", 9) }, after), null);
const bidBefore: SpadesState = { ...initialState(mulberry32(3)), turn: 2, bids: [3, 2, null, null] };
assert.match(spadesTake(bidBefore, { type: "bid", bid: 4 }, applyMove(bidBefore, { type: "bid", bid: 4 }))!.text, /Partner bid 4\. Your team needs 7/);

console.log("nana spades: all tests passed");
