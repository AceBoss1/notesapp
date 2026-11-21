// Ncho (Okwe): the Igbo seed-sowing game, played to the school rule the owner gave. Pure logic, no React or DOM,
// so tests and the UI share one set of rules.
//
// The board: two rows of holes, one row per player, and a storehouse (house, "ulo") for each player.
//   Standard Ncho: 6 holes a side (12 holes). Nchokoroto / Ncho Ncho Kororo: 12 holes a side (24 holes). Same rules.
//   Four seeds in every hole at the start (48 or 96 seeds).
// Indexes: holes 0..n-1 are player 0's (you, bottom row, left to right); holes n..2n-1 are player 1's (the computer,
// top row, right to left). Going up the indexes is anticlockwise round the board as drawn.
//
// The rules:
//   - Sowing: pick up all the seeds from one non-empty hole on your side and drop them one by one into the following
//     holes, anticlockwise for Ncho (clockwise for Aka-Hausa, which is otherwise exactly the same game), going round
//     and round. Seeds never go into a house while sowing, and no hole is skipped, not even the starting hole when
//     there are enough seeds to go all the way round. One lap only: the turn ends when the seeds run out.
//   - Capture, the "4" rule: you capture only when your last seed lands in one of the opponent's holes and makes it
//     exactly 4. Those 4 go into your house. 2, 3, 5, 6 and so on capture nothing.
//   - Village option "chain" (off by default; it is the biggest difference between villages, so "ask your elders"):
//     after making a 4, carry on backwards through the holes sown just before the last one, on the opponent's side,
//     taking each one that is also exactly 4, and stopping at the first that isn't or at the edge of their side.
//   - The game ends when the player to move has no seeds on their side, or when every seed has been captured.
//     The winner is whoever has the most seeds in their house; seeds left on the board are not counted. Equal is a draw.
//   - "Loser starts next round" is handled by the UI (components/games/NchoGame.tsx) via `initialState(..., first)`.
//
// Not implemented yet (possible later options): "take the house" (a hole you capture becomes yours), the school
// stage rule of at most 3 seeds per hole, and the formal 30-seconds-per-move timer.

export type Player = 0 | 1;
export type Level = "easy" | "medium" | "hard";
export type NchoVariant = "ncho" | "akahausa";
export type HolesPerSide = 6 | 12;

export type NchoOptions = {
  holesPerSide?: HolesPerSide; // 6 = standard Ncho, 12 = Nchokoroto
  chain?: boolean; // village chain-capture option, off by default
};

export type NchoMove = {
  player: Player;
  hole: number;
  path: number[]; // every hole a seed dropped into, in order (for the sowing animation)
  lastHole: number; // where the last seed landed
  made: number; // seeds in the last hole after sowing (before any capture)
  onTheirSide: boolean; // the last seed landed on the opponent's side
  captured: number[]; // holes emptied by the capture, last seed's hole first
  amount: number; // seeds taken into the mover's house
};

export type NchoState = {
  pits: number[]; // 2 × holesPerSide holes
  stores: [number, number]; // the two houses
  turn: Player;
  over: boolean;
  winner: Player | "draw" | null;
  last: NchoMove | null;
  plies: number;
  sinceCapture: number; // plies since the last capture (for the stall safeguard)
  endReason: "no-move" | "all-captured" | "stalled" | null;
  variant: NchoVariant; // "ncho" sows anticlockwise, "akahausa" clockwise
  holesPerSide: HolesPerSide;
  chain: boolean;
};

export const START_SEEDS = 4;
export const CAPTURE_AT = 4;

// Board helpers, all derived from the board size.
export const holeCount = (holesPerSide: number) => holesPerSide * 2;
export const totalSeeds = (holesPerSide: number) => holeCount(holesPerSide) * START_SEEDS;
export const sideOfHole = (hole: number, holesPerSide: number): Player => (hole < holesPerSide ? 0 : 1);
export const holesOfSide = (p: Player, holesPerSide: number): number[] =>
  Array.from({ length: holesPerSide }, (_, i) => (p === 0 ? i : holesPerSide + i));
export const seedsOnSide = (pits: number[], p: Player, holesPerSide = pits.length / 2) => {
  let s = 0;
  const from = p === 0 ? 0 : holesPerSide;
  for (let h = from; h < from + holesPerSide; h++) s += pits[h];
  return s;
};
// State-based shorthands.
export const sideOf = (state: Pick<NchoState, "holesPerSide">, hole: number) => sideOfHole(hole, state.holesPerSide);
export const holesOf = (state: Pick<NchoState, "holesPerSide">, p: Player) => holesOfSide(p, state.holesPerSide);

// Not one of the owner's rules, just a safeguard so a game always ends: lone seeds can chase each other round for
// ever, so after this many moves in a row with no capture the game stops and the houses are counted as they stand.
export const stallLimit = (holesPerSide: number) => (holesPerSide >= 12 ? 200 : 100);

const other = (p: Player): Player => (p === 0 ? 1 : 0);
// +1 for each hole sown: up the indexes for Ncho (anticlockwise), down them for Aka-Hausa (clockwise).
export const directionOf = (variant: NchoVariant): 1 | -1 => (variant === "akahausa" ? -1 : 1);

// The rng is accepted so every arcade game shares one signature; Ncho's start is fixed.
export function initialState(_rng?: () => number, first: Player = 0, variant: NchoVariant = "ncho", options: NchoOptions = {}): NchoState {
  const holesPerSide: HolesPerSide = options.holesPerSide === 12 ? 12 : 6;
  return {
    pits: Array(holeCount(holesPerSide)).fill(START_SEEDS),
    stores: [0, 0],
    turn: first,
    over: false,
    winner: null,
    last: null,
    plies: 0,
    sinceCapture: 0,
    endReason: null,
    variant,
    holesPerSide,
    chain: !!options.chain,
  };
}

// Sow and capture without any legality checks or end-of-game handling. Returns a new pits array.
export function sow(
  pits: number[],
  player: Player,
  hole: number,
  variant: NchoVariant = "ncho",
  chain = false,
): { pits: number[]; move: NchoMove } {
  const n = pits.length;
  const half = n / 2;
  const dir = directionOf(variant);
  const next = pits.slice();
  let seeds = next[hole];
  next[hole] = 0;
  const path: number[] = [];
  let pos = hole;
  while (seeds > 0) {
    pos = (pos + dir + n) % n; // every hole in turn, the starting one included
    next[pos] += 1;
    path.push(pos);
    seeds -= 1;
  }
  const opp = other(player);
  const made = next[pos];
  const onTheirSide = sideOfHole(pos, half) === opp;
  const captured: number[] = [];
  let amount = 0;
  if (onTheirSide && made === CAPTURE_AT) {
    let p = pos;
    // With the chain option, walk back against the sowing direction while still on their side and still exactly 4.
    do {
      captured.push(p);
      amount += next[p];
      next[p] = 0;
      p = (p - dir + n) % n;
    } while (chain && sideOfHole(p, half) === opp && next[p] === CAPTURE_AT && !captured.includes(p));
  }
  return { pits: next, move: { player, hole, path, lastHole: pos, made, onTheirSide, captured, amount } };
}

export function legalMoves(state: NchoState): number[] {
  if (state.over) return [];
  return holesOf(state, state.turn).filter((h) => state.pits[h] > 0);
}

function finish(state: NchoState, reason: NonNullable<NchoState["endReason"]>): NchoState {
  // Only the houses count; seeds left on the board stay where they are and aren't added to anyone.
  const [a, b] = state.stores;
  const winner: NchoState["winner"] = a > b ? 0 : b > a ? 1 : "draw";
  return { ...state, over: true, winner, endReason: reason };
}

// After a move: end the game if every seed is captured, the player to move has nothing to play, or it has stalled.
function settle(state: NchoState): NchoState {
  if (state.stores[0] + state.stores[1] === totalSeeds(state.holesPerSide)) return finish(state, "all-captured");
  if (seedsOnSide(state.pits, state.turn, state.holesPerSide) === 0) return finish(state, "no-move");
  if (state.sinceCapture >= stallLimit(state.holesPerSide)) return finish(state, "stalled");
  return state;
}

export function applyMove(state: NchoState, hole: number): NchoState {
  if (state.over || sideOf(state, hole) !== state.turn || !(state.pits[hole] > 0)) throw new Error(`Illegal move ${hole}`);
  const { pits, move } = sow(state.pits, state.turn, hole, state.variant, state.chain);
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

// --- Computer player: alpha-beta minimax on the difference between the two houses. ---

export const LEVEL_DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };
// Aka-Hausa is the harder game: the computer looks one move further ahead at every level.
export const AKAHAUSA_DEPTH: Record<Level, number> = { easy: 3, medium: 5, hard: 7 };
// The 12-hole board has twice the choices per move, so the search is capped to keep each move quick (well under
// 300ms on a desktop; the tests measure it). Aka-Hausa still gets its extra move on top of these.
export const LONG_BOARD_DEPTH: Record<Level, number> = { easy: 2, medium: 3, hard: 5 };
export const depthFor = (variant: NchoVariant, level: Level, holesPerSide: number = 6) => {
  const base = holesPerSide >= 12 ? LONG_BOARD_DEPTH[level] : LEVEL_DEPTH[level];
  return base + (variant === "akahausa" ? 1 : 0);
};

const WIN = 10000;

// A lean copy of sow for the search: mutates `pits` in place and returns the seeds captured.
function sowFast(pits: number[], player: Player, hole: number, dir: number, chain: boolean): number {
  const n = pits.length;
  const half = n >> 1;
  let seeds = pits[hole];
  pits[hole] = 0;
  let pos = hole;
  const laps = Math.floor(seeds / n);
  if (laps > 0) { for (let h = 0; h < n; h++) pits[h] += laps; seeds -= laps * n; }
  while (seeds > 0) { pos = (pos + dir + n) % n; pits[pos] += 1; seeds -= 1; }
  const theirs = (h: number) => (player === 0 ? h >= half : h < half);
  if (!theirs(pos) || pits[pos] !== CAPTURE_AT) return 0;
  let amount = 0;
  let p = pos;
  let steps = 0;
  do {
    amount += pits[p];
    pits[p] = 0;
    p = (p - dir + n) % n;
    steps++;
  } while (chain && steps < half && theirs(p) && pits[p] === CAPTURE_AT);
  return amount;
}

type Ctx = { dir: number; chain: boolean; half: number; total: number; stall: number; me: Player };

function search(pits: number[], stores: [number, number], turn: Player, since: number, depth: number, alpha: number, beta: number, c: Ctx): number {
  const diff = stores[c.me] - stores[other(c.me)];
  const lead = (d: number) => (d > 0 ? WIN + d : d < 0 ? -WIN + d : 0);
  if (stores[0] + stores[1] === c.total) return lead(diff);
  if (seedsOnSide(pits, turn, c.half) === 0 || since >= c.stall) return lead(diff);
  if (depth === 0) return diff;
  const from = turn === 0 ? 0 : c.half;
  const maximise = turn === c.me;
  let best = maximise ? -Infinity : Infinity;
  for (let h = from; h < from + c.half; h++) {
    if (pits[h] === 0) continue;
    const next = pits.slice();
    const got = sowFast(next, turn, h, c.dir, c.chain);
    const ns: [number, number] = [stores[0], stores[1]];
    ns[turn] += got;
    const v = search(next, ns, other(turn), got > 0 ? 0 : since + 1, depth - 1, alpha, beta, c);
    if (maximise) { if (v > best) best = v; if (best > alpha) alpha = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
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
  const c: Ctx = {
    dir: directionOf(state.variant),
    chain: state.chain,
    half: state.holesPerSide,
    total: totalSeeds(state.holesPerSide),
    stall: stallLimit(state.holesPerSide),
    me,
  };
  const depth = depthFor(state.variant, level, state.holesPerSide);
  let bestScore = -Infinity;
  let best: number[] = [];
  for (const h of moves) {
    const next = state.pits.slice();
    const got = sowFast(next, me, h, c.dir, c.chain);
    const ns: [number, number] = [state.stores[0], state.stores[1]];
    ns[me] += got;
    // A window just below the best so far keeps equal moves (for a random pick between them) while still pruning.
    const s = search(next, ns, other(me), got > 0 ? 0 : state.sinceCapture + 1, depth - 1, bestScore - 1, Infinity, c);
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
