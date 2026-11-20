// Ace of Spades: pure game logic (no React). Seats: 0 you (south), 1 west, 2 partner (north), 3 east.
// Play goes clockwise 0 → 1 → 2 → 3. Teams: 0 + 2 (you) against 1 + 3. Rules follow lib/arcade/catalogue.ts.

export type Suit = "S" | "H" | "D" | "C";
export type Card = { suit: Suit; rank: number }; // rank 2..14, ace high
export type Seat = 0 | 1 | 2 | 3;
export type Play = { seat: Seat; card: Card };
export type HandResult = { bids: [number, number]; tricks: [number, number]; points: [number, number] };

export type SpadesState = {
  hands: Card[][];
  bids: (number | null)[];
  tricksWon: number[];
  trick: Play[];
  lastTrick: { plays: Play[]; winner: Seat } | null;
  played: Card[]; // every card played this hand, for the computer's card counting
  turn: Seat;
  dealer: Seat;
  phase: "bid" | "play" | "handOver" | "over";
  spadesBroken: boolean;
  scores: [number, number];
  history: HandResult[];
  target: number;
  winner: 0 | 1 | null; // team
  seed: number;
};

export type SpadesMove = { type: "bid"; bid: number } | { type: "play"; card: Card } | { type: "next" };

export const SUITS: Suit[] = ["S", "H", "C", "D"];
export const TARGET = 250;
export const teamOf = (seat: number): 0 | 1 => (seat % 2 === 0 ? 0 : 1);
export const nextSeat = (seat: number): Seat => ((seat + 1) % 4) as Seat;
export const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank += 1) deck.push({ suit, rank });
  return deck;
}

// Hands are kept sorted: spades, hearts, clubs, diamonds (black/red alternate), low to high.
export function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank);
}

function deal(seed: number): { hands: Card[][]; seed: number } {
  const rng = mulberry32(seed);
  const deck = makeDeck();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hands = [0, 1, 2, 3].map((p) => sortHand(deck.slice(p * 13, p * 13 + 13)));
  return { hands, seed: Math.floor(rng() * 4294967296) };
}

function startHand(prev: Pick<SpadesState, "scores" | "history" | "target" | "seed">, dealer: Seat): SpadesState {
  const d = deal(prev.seed);
  const first = nextSeat(dealer);
  return {
    hands: d.hands, bids: [null, null, null, null], tricksWon: [0, 0, 0, 0], trick: [], lastTrick: null, played: [],
    turn: first, dealer, phase: "bid", spadesBroken: false, scores: prev.scores, history: prev.history, target: prev.target,
    winner: null, seed: d.seed,
  };
}

export function initialState(rng: () => number = Math.random, target = TARGET): SpadesState {
  // East deals the first hand, so you bid and lead first.
  return startHand({ scores: [0, 0], history: [], target, seed: Math.floor(rng() * 4294967296) }, 3);
}

export function legalCards(s: SpadesState, seat: Seat = s.turn): Card[] {
  const hand = s.hands[seat];
  if (s.phase !== "play" || seat !== s.turn) return [];
  if (s.trick.length === 0) {
    const nonSpades = hand.filter((c) => c.suit !== "S");
    return s.spadesBroken || nonSpades.length === 0 ? hand.slice() : nonSpades;
  }
  const led = s.trick[0].card.suit;
  const follow = hand.filter((c) => c.suit === led);
  return follow.length ? follow : hand.slice();
}

export function isLegal(s: SpadesState, card: Card): boolean {
  return legalCards(s).some((c) => sameCard(c, card));
}

// Who is winning a (partial) trick: highest spade, else highest of the suit led.
export function trickLeader(plays: Play[]): Play {
  const led = plays[0].card.suit;
  let best = plays[0];
  for (const p of plays.slice(1)) {
    const b = best.card; const c = p.card;
    const beats = c.suit === b.suit ? c.rank > b.rank : c.suit === "S" || (c.suit === led && b.suit !== "S" && b.suit !== led);
    if (beats) best = p;
  }
  return best;
}

export function scoreHand(bid: number, tricks: number): number {
  return tricks >= bid ? 10 * bid + (tricks - bid) : -10 * bid;
}

export function applyMove(s: SpadesState, move: SpadesMove): SpadesState {
  if (move.type === "next") {
    if (s.phase !== "handOver") throw new Error("Hand not over");
    return startHand(s, nextSeat(s.dealer));
  }
  if (move.type === "bid") {
    if (s.phase !== "bid") throw new Error("Not bidding");
    if (!Number.isInteger(move.bid) || move.bid < 0 || move.bid > 13) throw new Error("Bid 0 to 13");
    const bids = s.bids.slice();
    bids[s.turn] = move.bid;
    const done = bids.every((b) => b !== null);
    // Bidding starts left of the dealer, and so does the first trick.
    return { ...s, bids, turn: done ? nextSeat(s.dealer) : nextSeat(s.turn), phase: done ? "play" : "bid", lastTrick: null };
  }
  if (s.phase !== "play") throw new Error("Not playing");
  if (!isLegal(s, move.card)) throw new Error("Illegal card");
  const seat = s.turn;
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => !sameCard(c, move.card)) : h));
  const trick = [...s.trick, { seat, card: move.card }];
  const played = [...s.played, move.card];
  const spadesBroken = s.spadesBroken || move.card.suit === "S";
  if (trick.length < 4) return { ...s, hands, trick, played, spadesBroken, turn: nextSeat(seat) };

  const winner = trickLeader(trick).seat;
  const tricksWon = s.tricksWon.slice();
  tricksWon[winner] += 1;
  const next: SpadesState = { ...s, hands, trick: [], played, spadesBroken, tricksWon, lastTrick: { plays: trick, winner }, turn: winner };
  if (hands.every((h) => h.length === 0)) return finishHand(next);
  return next;
}

function finishHand(s: SpadesState): SpadesState {
  const bids = [0, 1].map((t) => (s.bids[t] ?? 0) + (s.bids[t + 2] ?? 0)) as [number, number];
  const tricks = [0, 1].map((t) => s.tricksWon[t] + s.tricksWon[t + 2]) as [number, number];
  const points = [0, 1].map((t) => scoreHand(bids[t], tricks[t])) as [number, number];
  const scores: [number, number] = [s.scores[0] + points[0], s.scores[1] + points[1]];
  const history = [...s.history, { bids, tricks, points }];
  // Over once a team reaches the target and is ahead; a tie at the top plays on.
  const top = Math.max(...scores);
  const over = top >= s.target && scores[0] !== scores[1];
  return { ...s, scores, history, phase: over ? "over" : "handOver", winner: over ? (scores[0] > scores[1] ? 0 : 1) : null };
}

// ---------- The computer ----------

// Bid: sure-ish winners outside spades, plus spade strength and short suits to trump in.
export function computerBid(hand: Card[]): number {
  let est = 0;
  const spades = hand.filter((c) => c.suit === "S");
  for (const suit of ["H", "C", "D"] as Suit[]) {
    const cards = hand.filter((c) => c.suit === suit);
    const has = (r: number) => cards.some((c) => c.rank === r);
    if (has(14)) est += cards.length <= 5 ? 1 : 0.7;
    if (has(13) && cards.length >= 2) est += cards.length <= 4 ? 0.8 : 0.5;
    if (has(12) && cards.length >= 3 && cards.length <= 4 && (has(14) || has(13))) est += 0.4;
    if (spades.length >= 2) est += cards.length === 0 ? 1.2 : cards.length === 1 ? 0.6 : 0;
  }
  const sRanks = spades.map((c) => c.rank);
  if (sRanks.includes(14)) est += 1;
  if (sRanks.includes(13)) est += spades.length >= 2 ? 1 : 0.4;
  if (sRanks.includes(12)) est += spades.length >= 3 ? 0.8 : 0.2;
  if (spades.length > 3) est += (spades.length - 3) * 0.9;
  return Math.max(1, Math.min(13, Math.round(est)));
}

// Highest card of a suit nobody has played yet, i.e. the card that can't be beaten in that suit.
function isBoss(card: Card, s: SpadesState, seat: Seat): boolean {
  for (let r = card.rank + 1; r <= 14; r += 1) {
    const gone = s.played.some((c) => c.suit === card.suit && c.rank === r) || s.hands[seat].some((c) => c.suit === card.suit && c.rank === r);
    if (!gone) return false;
  }
  return true;
}

const lowFirst = (a: Card, b: Card) => (a.suit === "S" ? 1 : 0) - (b.suit === "S" ? 1 : 0) || a.rank - b.rank;

export function computerPlay(s: SpadesState): Card {
  const seat = s.turn;
  const legal = legalCards(s, seat);
  const team = teamOf(seat);
  const teamBid = (s.bids[team] ?? 0) + (s.bids[team + 2] ?? 0);
  const teamTricks = s.tricksWon[team] + s.tricksWon[team + 2];
  const needTricks = teamTricks < teamBid;

  if (s.trick.length === 0) {
    const bosses = legal.filter((c) => c.suit !== "S" && isBoss(c, s, seat));
    if (bosses.length) return bosses.sort((a, b) => b.rank - a.rank)[0];
    const spadeBoss = legal.filter((c) => c.suit === "S" && isBoss(c, s, seat));
    if (needTricks && spadeBoss.length) return spadeBoss[0];
    // Lead low from the longest side suit, so partner can win or we draw out high cards.
    const counts = (suit: Suit) => s.hands[seat].filter((c) => c.suit === suit).length;
    return legal.slice().sort((a, b) => (a.suit === "S" ? 1 : 0) - (b.suit === "S" ? 1 : 0) || counts(b.suit) - counts(a.suit) || a.rank - b.rank)[0];
  }

  const leading = trickLeader(s.trick);
  const partnerWinning = teamOf(leading.seat) === team;
  const last = s.trick.length === 3;
  const winners = legal.filter((c) => trickLeader([...s.trick, { seat, card: c }]).seat === seat);
  const cheapFirst = winners.slice().sort((a, b) => (a.suit === "S" ? 1 : 0) - (b.suit === "S" ? 1 : 0) || a.rank - b.rank);
  if (partnerWinning) {
    // Partner has it: duck, unless partner's card is weak and we hold a sure winner to protect the trick.
    const weak = !last && leading.card.suit !== "S" && !isBoss(leading.card, s, seat);
    const sure = cheapFirst.find((c) => c.suit !== "S" && isBoss(c, s, seat));
    if (weak && needTricks && sure) return sure;
    return legal.slice().sort(lowFirst)[0];
  }
  if (cheapFirst.length) {
    // Win as cheaply as possible; if others still play after us, a card that can't be beaten is safer.
    if (!last) {
      const sure = cheapFirst.find((c) => c.suit !== "S" && isBoss(c, s, seat));
      if (sure) return sure;
    }
    return cheapFirst[0];
  }
  return legal.slice().sort(lowFirst)[0];
}

export function computerMove(s: SpadesState): SpadesMove {
  if (s.phase === "bid") return { type: "bid", bid: computerBid(s.hands[s.turn]) };
  if (s.phase === "handOver") return { type: "next" };
  return { type: "play", card: computerPlay(s) };
}

export const SUIT_NAME: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[r]);
export const cardName = (c: Card) => `${({ 11: "jack", 12: "queen", 13: "king", 14: "ace" } as Record<number, string>)[c.rank] ?? c.rank} of ${SUIT_NAME[c.suit]}`;
export const SEAT_NAME = ["You", "West", "Partner", "East"] as const;
