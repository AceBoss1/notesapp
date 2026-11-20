// Ace of Spades rules (lib/arcade/spades.ts). Run: npx -y tsx tests/arcade/spades.test.ts
import assert from "node:assert/strict";
import {
  applyMove, computerBid, computerMove, computerPlay, initialState, legalCards, makeDeck, mulberry32, scoreHand, trickLeader,
  type Card, type Seat, type SpadesState,
} from "../../lib/arcade/spades";

const c = (code: string): Card => {
  const suit = code.slice(-1) as Card["suit"];
  const r = code.slice(0, -1);
  return { suit, rank: ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r) };
};
const cs = (codes: string) => codes.split(" ").map(c);
const playing = (over: Partial<SpadesState>): SpadesState => ({
  ...initialState(mulberry32(1)), phase: "play", bids: [3, 3, 3, 3], ...over,
});

// Deck and deal.
assert.equal(makeDeck().length, 52);
{
  const s = initialState(mulberry32(5));
  assert.equal(s.phase, "bid");
  assert.deepEqual(s.hands.map((h) => h.length), [13, 13, 13, 13]);
  const all = s.hands.flat().map((x) => x.suit + x.rank);
  assert.equal(new Set(all).size, 52);
  assert.equal(s.turn, 0, "you bid first on the first hand");
  assert.deepEqual(initialState(mulberry32(5)), s);
}

// Bidding goes round the table, then the player left of the dealer leads.
{
  let s = initialState(mulberry32(2));
  assert.throws(() => applyMove(s, { type: "bid", bid: 14 }));
  assert.throws(() => applyMove(s, { type: "play", card: s.hands[0][0] }));
  for (const b of [4, 3, 2, 3]) s = applyMove(s, { type: "bid", bid: b });
  assert.deepEqual(s.bids, [4, 3, 2, 3]);
  assert.equal(s.phase, "play");
  assert.equal(s.turn, 0);
}

// Spades can't be led until broken, unless that's all you have.
{
  const s = playing({ hands: [cs("2S 5H 9D"), [], [], []], turn: 0, trick: [] });
  assert.deepEqual(legalCards(s), cs("5H 9D"));
  assert.deepEqual(legalCards({ ...s, spadesBroken: true }).length, 3);
  assert.deepEqual(legalCards({ ...s, hands: [cs("2S KS"), [], [], []] }).length, 2);
}

// Follow suit when you can; otherwise anything, including a spade.
{
  const trick = [{ seat: 3 as Seat, card: c("10H") }];
  const s = playing({ hands: [cs("2S 5H KH 9D"), [], [], []], turn: 0, trick });
  assert.deepEqual(legalCards(s), cs("5H KH"));
  const v = playing({ hands: [cs("2S 9D"), [], [], []], turn: 0, trick });
  assert.deepEqual(legalCards(v), cs("2S 9D"));
  assert.deepEqual(legalCards(v, 1), [], "only the player on turn has moves");
}

// Trick winner: highest spade, else highest of the suit led (off-suit cards never win).
{
  const t = (codes: string) => trickLeader(cs(codes).map((card, i) => ({ seat: i as Seat, card }))).seat;
  assert.equal(t("10H KH 2H AD"), 1);
  assert.equal(t("10H KH 2S AD"), 2);
  assert.equal(t("10H 3S 2S AS"), 3);
  assert.equal(t("10H AC AD 9H"), 0);
}

// Playing a trick: winner takes it and leads; spades become broken when one is played.
{
  let s = playing({ hands: [cs("10H 3D"), cs("KH 4D"), cs("2S 5D"), cs("AD 6D")], turn: 0 });
  s = applyMove(s, { type: "play", card: c("10H") });
  assert.throws(() => applyMove(s, { type: "play", card: c("4D") }), /Illegal/);
  s = applyMove(s, { type: "play", card: c("KH") });
  s = applyMove(s, { type: "play", card: c("2S") });
  assert.ok(s.spadesBroken);
  s = applyMove(s, { type: "play", card: c("AD") });
  assert.equal(s.trick.length, 0);
  assert.equal(s.lastTrick?.winner, 2);
  assert.equal(s.tricksWon[2], 1);
  assert.equal(s.turn, 2, "the winner leads");
}

// Scoring: 10 a trick bid plus 1 per extra; miss and lose 10 a trick bid.
assert.equal(scoreHand(5, 5), 50);
assert.equal(scoreHand(5, 7), 52);
assert.equal(scoreHand(5, 4), -50);
assert.equal(scoreHand(0, 2), 2);

// End of a hand: team bids and tricks are added, and a team at 250 or more that's ahead wins.
{
  const last = (scores: [number, number]) => {
    let s = playing({
      hands: [cs("AH"), cs("2H"), cs("3H"), cs("4H")], turn: 0, bids: [3, 2, 3, 4], tricksWon: [4, 3, 3, 2], scores,
    });
    for (let i = 0; i < 4; i += 1) s = applyMove(s, { type: "play", card: s.hands[s.turn][0] });
    return s;
  };
  const s = last([100, 100]);
  assert.equal(s.phase, "handOver");
  assert.deepEqual(s.history.at(-1), { bids: [6, 6], tricks: [8, 5], points: [62, -60] });
  assert.deepEqual(s.scores, [162, 40]);
  const n = applyMove(s, { type: "next" });
  assert.equal(n.phase, "bid");
  assert.equal(n.dealer, 0);
  assert.equal(n.turn, 1);
  assert.deepEqual(n.scores, [162, 40]);
  const w = last([200, 230]);
  assert.equal(w.phase, "over");
  assert.equal(w.winner, 0);
}

// Computer bids: a strong hand bids more than a weak one; always 1 to 13.
{
  const strong = computerBid(cs("AS KS QS JS 10S AH KH AC KC AD 2D 3D 4D"));
  const weak = computerBid(cs("2S 3H 4H 5H 6C 7C 8C 9D 2D 3D 4D 5D 6D"));
  assert.ok(strong >= 9, `strong bid ${strong}`);
  assert.equal(weak, 1);
}

// Computer play: ducks when partner is winning and it's last; wins cheaply when it can; follows low when it can't.
{
  const trick = [{ seat: 3 as Seat, card: c("5H") }, { seat: 0 as Seat, card: c("KH") }, { seat: 1 as Seat, card: c("9H") }];
  const duck = playing({ hands: [[], [], cs("2H AH"), []], turn: 2, trick });
  assert.deepEqual(computerPlay(duck), c("2H"));
  const t2 = [{ seat: 0 as Seat, card: c("10H") }, { seat: 1 as Seat, card: c("4H") }, { seat: 2 as Seat, card: c("JH") }];
  const cheap = playing({ hands: [[], [], [], cs("3H QH KH")], turn: 3, trick: t2 });
  assert.deepEqual(computerPlay(cheap), c("QH"), "last to play, opponent winning: cheapest winner");
  const cant = playing({ hands: [[], cs("3H 8H"), [], []], turn: 1, trick: [{ seat: 0 as Seat, card: c("AH") }] });
  assert.deepEqual(computerPlay(cant), c("3H"));
  const ruff = playing({ hands: [[], [], [], cs("2S 9S 4C")], turn: 3, trick: [{ seat: 0, card: c("QH") }, { seat: 1, card: c("3H") }, { seat: 2, card: c("AH") }] });
  assert.deepEqual(computerPlay(ruff), c("2S"), "void: trump with the lowest spade");
}

// Full games with four computer players finish without an illegal move; scores add up to the history.
for (let seed = 1; seed <= 40; seed += 1) {
  let s = initialState(mulberry32(seed));
  let steps = 0;
  while (s.phase !== "over" && steps < 20000) {
    const m = computerMove(s);
    if (m.type === "play") assert.ok(legalCards(s).some((x) => x.suit === m.card.suit && x.rank === m.card.rank), `illegal play in game ${seed}`);
    s = applyMove(s, m);
    if (s.phase === "handOver" || s.phase === "over") {
      assert.equal(s.tricksWon.reduce((a, b) => a + b, 0), 13);
    }
    steps += 1;
  }
  assert.equal(s.phase, "over", `game ${seed} finished`);
  assert.ok(Math.max(...s.scores) >= 250);
  assert.deepEqual(s.scores, [0, 1].map((t) => s.history.reduce((a, h) => a + h.points[t], 0)));
}

console.log("spades: all tests passed");
