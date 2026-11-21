// Whot: pure game logic (no React). You (player 0) vs the computer (player 1).
// Rules follow the catalogue entry in lib/arcade/catalogue.ts.

export type Shape = "circle" | "triangle" | "cross" | "square" | "star";
export type Card = { shape: Shape | "whot"; num: number };
export type Player = 0 | 1;

export type WhotState = {
  hands: [Card[], Card[]];
  market: Card[]; // face down; draw from the end
  pile: Card[]; // face up; the top card is the last one
  turn: Player;
  phase: "play" | "choose" | "over"; // "choose": the player on turn just played a 20 and must ask for a shape
  wanted: Shape | null; // the shape asked for after a 20
  pending: { num: 2 | 5; count: number } | null; // pick two / pick three waiting on the player to move
  winner: Player | null;
  stuck: number; // turns in a row where nobody could play or pick (every card is in someone's hand)
  seed: number; // drives reshuffles so the state stays pure and replayable
  log: string; // what just happened, for the status line
};

export type WhotMove = { type: "play"; index: number } | { type: "draw" } | { type: "call"; shape: Shape };

export const SHAPES: Shape[] = ["circle", "triangle", "cross", "square", "star"];
const NUMBERS: Record<Shape, number[]> = {
  circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star: [1, 2, 3, 4, 5, 7, 8],
};
export const HAND_SIZE = 5;

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const shape of SHAPES) for (const num of NUMBERS[shape]) deck.push({ shape, num });
  for (let i = 0; i < 5; i += 1) deck.push({ shape: "whot", num: 20 });
  return deck;
}

// Small seeded generator, so a game can be replayed from its seed in tests.
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

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function initialState(rng: () => number = Math.random, first: Player = 0): WhotState {
  const deck = shuffle(makeDeck(), rng);
  const hands: [Card[], Card[]] = [[], []];
  for (let i = 0; i < HAND_SIZE; i += 1) {
    hands[0].push(deck.pop() as Card);
    hands[1].push(deck.pop() as Card);
  }
  // A Whot can't start the pile (nobody could match it), so tuck it back under the market and turn another.
  let start = deck.pop() as Card;
  while (start.shape === "whot") {
    deck.unshift(start);
    start = deck.pop() as Card;
  }
  return {
    hands, market: deck, pile: [start], turn: first, phase: "play", wanted: null, pending: null, winner: null, stuck: 0,
    seed: Math.floor(rng() * 4294967296), log: first === 0 ? "Your turn" : "Computer starts",
  };
}

export const topCard = (s: WhotState): Card => s.pile[s.pile.length - 1];
export const other = (p: Player): Player => (p === 0 ? 1 : 0);
const who = (p: Player) => (p === 0 ? "You" : "Computer");

export function canPlay(s: WhotState, card: Card): boolean {
  if (s.phase !== "play") return false;
  if (s.pending) return card.num === s.pending.num; // defend by stacking the same number
  if (card.shape === "whot") return true;
  if (s.wanted) return card.shape === s.wanted;
  const top = topCard(s);
  return card.shape === top.shape || card.num === top.num;
}

export function legalMoves(s: WhotState): WhotMove[] {
  if (s.phase === "over") return [];
  if (s.phase === "choose") return SHAPES.map((shape) => ({ type: "call", shape }));
  const moves: WhotMove[] = [];
  s.hands[s.turn].forEach((c, index) => { if (canPlay(s, c)) moves.push({ type: "play", index }); });
  moves.push({ type: "draw" });
  return moves;
}

// Takes up to n cards from the market, reshuffling the pile under its top card when the market runs dry.
function take(s: WhotState, n: number): { got: Card[]; market: Card[]; pile: Card[]; seed: number; reshuffled: boolean } {
  let market = s.market.slice();
  let pile = s.pile.slice();
  let seed = s.seed;
  let reshuffled = false;
  const got: Card[] = [];
  for (let i = 0; i < n; i += 1) {
    if (market.length === 0 && pile.length > 1) {
      const rng = mulberry32(seed);
      market = shuffle(pile.slice(0, -1), rng);
      pile = pile.slice(-1);
      seed = Math.floor(rng() * 4294967296);
      reshuffled = true;
    }
    const c = market.pop();
    if (!c) break;
    got.push(c);
  }
  return { got, market, pile, seed, reshuffled };
}

// Lower total wins if the game locks up with every card in someone's hand (very rare).
export const handValue = (h: Card[]) => h.reduce((t, c) => t + c.num, 0);

export function applyMove(s: WhotState, move: WhotMove): WhotState {
  if (s.phase === "over") throw new Error("Game is over");
  const me = s.turn;
  const opp = other(me);
  const hands: [Card[], Card[]] = [s.hands[0].slice(), s.hands[1].slice()];

  if (move.type === "call") {
    if (s.phase !== "choose") throw new Error("Nothing to call");
    return { ...s, hands, phase: "play", wanted: move.shape, turn: opp, log: `${who(me)} asked for ${move.shape}s` };
  }
  if (s.phase !== "play") throw new Error("Choose a shape first");

  if (move.type === "draw") {
    const n = s.pending ? s.pending.count : 1;
    const t = take(s, n);
    hands[me].push(...t.got);
    const stuck = t.got.length === 0 ? s.stuck + 1 : 0;
    const base = { ...s, hands, market: t.market, pile: t.pile, seed: t.seed, pending: null, turn: opp, stuck };
    const note = t.reshuffled ? " (market reshuffled)" : "";
    if (stuck >= 2) {
      const a = handValue(hands[0]); const b = handValue(hands[1]);
      const winner: Player = a <= b ? 0 : 1;
      return { ...base, phase: "over", winner, log: `No cards left to pick. ${who(winner)} ${winner === 0 ? "win" : "wins"} on the count` };
    }
    const picked = t.got.length === 1 ? "one" : String(t.got.length);
    return { ...base, log: `${who(me)} picked ${t.got.length ? picked : "nothing"}${note}` };
  }

  const card = hands[me][move.index];
  if (!card || !canPlay(s, card)) throw new Error("Illegal card");
  hands[me].splice(move.index, 1);
  const pile = [...s.pile, card];
  const base: WhotState = { ...s, hands, pile, wanted: null, pending: null, stuck: 0 };
  if (hands[me].length === 0) return { ...base, phase: "over", winner: me, log: me === 0 ? "Check up! You win" : "Check up! Computer wins" };

  switch (card.num) {
    case 1: return { ...base, turn: me, log: `Hold on: ${who(me)} ${me === 0 ? "go" : "goes"} again` };
    case 8: return { ...base, turn: me, log: `Suspension: ${me === 0 ? "computer misses a turn" : "you miss a turn"}` };
    case 2:
    case 5: {
      const count = (s.pending?.count ?? 0) + (card.num === 2 ? 2 : 3);
      return { ...base, turn: opp, pending: { num: card.num, count }, log: `${who(me)} played ${card.num}: ${me === 0 ? "computer" : "you"} pick ${count}` };
    }
    case 14: {
      const t = take({ ...base }, 1);
      hands[opp].push(...t.got);
      return { ...base, hands, market: t.market, pile: t.pile, seed: t.seed, turn: me, log: `General market: ${me === 0 ? "computer picks" : "you pick"} one` };
    }
    case 20: return { ...base, phase: "choose", turn: me, log: me === 0 ? "Whot! Ask for a shape" : "Whot! Computer is choosing a shape" };
    default: return { ...base, turn: opp, log: `${who(me)} played ${card.num} ${card.shape}` };
  }
}

// The computer: defend pick-twos when it can, hit hard when you're on your last card, keep Whots for when it's stuck.
export function computerMove(s: WhotState): WhotMove {
  const hand = s.hands[s.turn];
  if (s.phase === "choose") {
    const counts = SHAPES.map((shape) => hand.filter((c) => c.shape === shape).length);
    const best = counts.indexOf(Math.max(...counts));
    return { type: "call", shape: SHAPES[best] };
  }
  const playable = hand.map((c, index) => ({ c, index })).filter((x) => canPlay(s, x.c));
  if (playable.length === 0) return { type: "draw" };
  const oppCards = s.hands[other(s.turn)].length;
  const shapeCount = (sh: Card["shape"]) => hand.filter((c) => c.shape === sh).length;
  const score = (c: Card) => {
    let v = shapeCount(c.shape) * 2; // stay in shapes we hold plenty of
    if (c.shape === "whot") v = hand.length === 1 ? 100 : -20;
    if (c.num === 1 || c.num === 8) v += hand.length > 1 ? 6 : 0; // play again, but only useful with a follow-up
    if (c.num === 2 || c.num === 5) v += oppCards <= 2 ? 12 : 4;
    if (c.num === 14) v += oppCards <= 2 ? 10 : 3;
    v += c.num / 20; // shed bigger numbers in case of a count
    return v;
  };
  playable.sort((a, b) => score(b.c) - score(a.c));
  return { type: "play", index: playable[0].index };
}

export function shapeLabel(sh: Card["shape"]): string {
  return sh === "whot" ? "Whot" : sh.charAt(0).toUpperCase() + sh.slice(1);
}

export function cardLabel(c: Card): string {
  return c.shape === "whot" ? "Whot 20" : `${c.num} ${c.shape}`;
}
