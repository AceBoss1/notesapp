// Ncho (Okwe): the Igbo seed-sowing game. Pure logic, no React or DOM, so tests and the UI share one set of rules.
// Holes 0–5 are player 0's (you, bottom row, left to right); holes 6–11 are player 1's (the computer, top row, right to left).
// Sowing goes up the indexes, which is anticlockwise round the board as drawn.
// Aka-Hausa, the harder variant, sows the other way: down the indexes, clockwise. Its captures run back through the holes
// sown just before the last one, so in index terms they go up rather than down. That direction is the only rule that
// differs for now; further Aka-Hausa rules can be added here when the owner gives them.

export type Player = 0 | 1;
export type Level = "easy" | "medium" | "hard";
export type NchoVariant = "ncho" | "akahausa";

export type NchoMove = {
  player: Player;
  hole: number;
  path: number[]; // every hole a seed dropped into, in order (for the sowing animation)
  captured: number[]; // holes emptied by the capture, last seed's hole first
  amount: number;
  grandSlam: boolean; // the capture would have taken everything, so it took nothing
};

export type NchoState = {
  pits: number[]; // 12 holes
  stores: [number, number];
  turn: Player;
  over: boolean;
  winner: Player | "draw" | null;
  last: NchoMove | null;
  plies: number;
  sinceCapture: number; // plies since the last capture, to stop endless shuffling
  endReason: "majority" | "no-move" | "stalled" | null;
  variant: NchoVariant; // "ncho" sows anticlockwise, "akahausa" clockwise
};

export const HOLES = 12;
export const START_SEEDS = 4;
export const TOTAL = HOLES * START_SEEDS; // 48
// Lone seeds can chase each other round forever; after this many plies with no capture we count up what's on the board.
export const STALL_PLIES = 100;

export const sideOf = (hole: number): Player => (hole < 6 ? 0 : 1);
export const holesOf = (p: Player): number[] => (p === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]);
export const seedsOnSide = (pits: number[], p: Player) => holesOf(p).reduce((s, h) => s + pits[h], 0);
const other = (p: Player): Player => (p === 0 ? 1 : 0);
// +1 for each hole sown: up the indexes for Ncho (anticlockwise), down them for Aka-Hausa (clockwise).
export const directionOf = (variant: NchoVariant): 1 | -1 => (variant === "akahausa" ? -1 : 1);

// The rng is accepted so every arcade game shares one signature; Ncho's start is fixed.
export function initialState(_rng?: () => number, first: Player = 0, variant: NchoVariant = "ncho"): NchoState {
  return {
    pits: Array(HOLES).fill(START_SEEDS),
    stores: [0, 0],
    turn: first,
    over: false,
    winner: null,
    last: null,
    plies: 0,
    sinceCapture: 0,
    endReason: null,
    variant,
  };
}

// Sow and capture without any legality checks or end-of-game handling.
export function sow(pits: number[], player: Player, hole: number, variant: NchoVariant = "ncho"): { pits: number[]; move: NchoMove } {
  const dir = directionOf(variant);
  const next = pits.slice();
  let seeds = next[hole];
  next[hole] = 0;
  const skipStart = seeds >= HOLES;
  const path: number[] = [];
  let pos = hole;
  while (seeds > 0) {
    pos = (pos + dir + HOLES) % HOLES;
    if (skipStart && pos === hole) continue;
    next[pos] += 1;
    path.push(pos);
    seeds -= 1;
  }
  const captured: number[] = [];
  let amount = 0;
  const opp = other(player);
  let p = pos;
  // Walk back against the sowing direction, staying on their side (the side boundary always ends the chain).
  while (sideOf(p) === opp && (next[p] === 2 || next[p] === 3)) {
    captured.push(p);
    amount += next[p];
    p = (p - dir + HOLES) % HOLES;
  }
  let grandSlam = false;
  if (amount > 0 && amount === seedsOnSide(next, opp)) {
    // Grand slam: taking every one of their seeds isn't allowed, so the sowing stands and nothing is taken.
    grandSlam = true;
    captured.length = 0;
    amount = 0;
  }
  for (const h of captured) next[h] = 0;
  return { pits: next, move: { player, hole, path, captured, amount, grandSlam } };
}

export function legalMoves(state: NchoState): number[] {
  if (state.over) return [];
  const me = state.turn;
  const opp = other(me);
  const mine = holesOf(me).filter((h) => state.pits[h] > 0);
  if (seedsOnSide(state.pits, opp) > 0) return mine;
  // They have nothing: you must give them seeds if any move can.
  return mine.filter((h) => seedsOnSide(sow(state.pits, me, h, state.variant).pits, opp) > 0);
}

function finish(state: NchoState, reason: NchoState["endReason"], sweep: boolean): NchoState {
  const pits = state.pits.slice();
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  if (sweep) {
    // Seeds left on the board go to whoever has them on their side.
    for (let h = 0; h < HOLES; h++) {
      stores[sideOf(h)] += pits[h];
      pits[h] = 0;
    }
  }
  const winner: NchoState["winner"] = stores[0] > stores[1] ? 0 : stores[1] > stores[0] ? 1 : "draw";
  return { ...state, pits, stores, over: true, winner, endReason: reason };
}

// After a move (or at the start), end the game if someone has a majority, it has stalled, or the next player can't move.
function settle(state: NchoState): NchoState {
  if (state.stores[0] > TOTAL / 2 || state.stores[1] > TOTAL / 2) return finish(state, "majority", false);
  if (state.sinceCapture >= STALL_PLIES) return finish(state, "stalled", true);
  if (legalMoves(state).length === 0) return finish(state, "no-move", true);
  return state;
}

export function applyMove(state: NchoState, hole: number): NchoState {
  if (!legalMoves(state).includes(hole)) throw new Error(`Illegal move ${hole}`);
  const { pits, move } = sow(state.pits, state.turn, hole, state.variant);
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  stores[state.turn] += move.amount;
  return settle({
    ...state,
    pits,
    stores,
    turn: other(state.turn),
    last: move,
    plies: state.plies + 1,
    sinceCapture: move.amount > 0 ? 0 : state.sinceCapture + 1,
  });
}

// --- Computer player: alpha-beta minimax on the store difference. ---

export const LEVEL_DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };
// Aka-Hausa is the harder game: the computer looks one move further ahead at every level.
export const AKAHAUSA_DEPTH: Record<Level, number> = { easy: 3, medium: 5, hard: 7 };
export const depthFor = (variant: NchoVariant, level: Level) => (variant === "akahausa" ? AKAHAUSA_DEPTH : LEVEL_DEPTH)[level];

function evaluate(state: NchoState, me: Player): number {
  const diff = state.stores[me] - state.stores[other(me)];
  if (state.over) return state.winner === me ? 1000 + diff : state.winner === "draw" ? 0 : -1000 + diff;
  // Seeds still on your side are a small plus: they're likelier to end up yours.
  return diff * 4 + (seedsOnSide(state.pits, me) - seedsOnSide(state.pits, other(me)));
}

function search(state: NchoState, depth: number, alpha: number, beta: number, me: Player): number {
  if (depth === 0 || state.over) return evaluate(state, me);
  const moves = legalMoves(state);
  if (state.turn === me) {
    let best = -Infinity;
    for (const h of moves) {
      best = Math.max(best, search(applyMove(state, h), depth - 1, alpha, beta, me));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const h of moves) {
    best = Math.min(best, search(applyMove(state, h), depth - 1, alpha, beta, me));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(state: NchoState, level: Level = "medium", rng: () => number = Math.random): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal move");
  // Easy slips now and then so it's beatable.
  if (level === "easy" && rng() < 0.3) return moves[Math.floor(rng() * moves.length)];
  const me = state.turn;
  const depth = depthFor(state.variant, level);
  let bestScore = -Infinity;
  let best: number[] = [];
  for (const h of moves) {
    const s = search(applyMove(state, h), depth - 1, -Infinity, Infinity, me);
    if (s > bestScore) { bestScore = s; best = [h]; }
    else if (s === bestScore) best.push(h);
  }
  return best[Math.floor(rng() * best.length)];
}

// Small seeded RNG for tests and repeatable games.
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
