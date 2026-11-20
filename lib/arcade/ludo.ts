// Ludo for Notes Arcade: pure game logic, no React or DOM. The UI is components/games/LudoGame.tsx.
// Board: the classic 15×15 cross. A seed's position is its progress along its own route:
//   -1 = in the yard, 0 = its start square, 0–50 = the shared 52-square track, 51–55 = its home column, 56 = home.
// Players move clockwise. Player 0 is the person (bottom-left yard); 1, 2 and 3 are computer players.

export const PLAYERS = 4;
export const SEEDS = 4;
export const YARD = -1;
export const LAST_TRACK = 50; // last progress on the shared track before turning into the home column
export const HOME = 56;
export const TRACK_LENGTH = 52;

export type Cell = [row: number, col: number];

// The 52 track squares, clockwise, starting at the left arm's top row. Index = absolute square.
export const TRACK: Cell[] = (() => {
  const t: Cell[] = [];
  for (let c = 0; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  return t;
})();

// Each player's start square (absolute index). Player 0 sits bottom-left; turn order runs clockwise.
export const START: number[] = [40, 1, 14, 27];
// Star squares sit eight steps past each start, as on the classic board.
export const STARS: number[] = START.map((s) => (s + 8) % TRACK_LENGTH);
export const SAFE = new Set<number>([...START, ...STARS]);

// Home columns, outside in (progress 51 → 55).
export const HOME_COLUMN: Cell[][] = [
  [13, 12, 11, 10, 9].map((r) => [r, 7] as Cell),
  [1, 2, 3, 4, 5].map((c) => [7, c] as Cell),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as Cell),
  [13, 12, 11, 10, 9].map((c) => [7, c] as Cell),
];

// Top-left corner of each player's 6×6 yard.
export const YARD_ORIGIN: Cell[] = [[9, 0], [0, 0], [0, 9], [9, 9]];

export type LudoEvent =
  | { kind: "pass"; player: number; die: number } // rolled, no legal move
  | { kind: "three-sixes"; player: number }
  | { kind: "move"; player: number; seed: number; from: number; to: number; die: number; captured: { player: number; seed: number }[]; bonus: boolean };

export type LudoState = {
  seeds: number[][]; // [player][seed] → progress
  turn: number;
  phase: "roll" | "move" | "over";
  die: number | null; // the roll waiting to be used (phase "move") or the last roll seen
  sixes: number; // sixes in a row this turn
  winner: number | null;
  captures: number[]; // seeds each player has sent back, for the scoreboard
  last: LudoEvent | null;
};

export function newGame(first = 0): LudoState {
  return {
    seeds: Array.from({ length: PLAYERS }, () => Array(SEEDS).fill(YARD)),
    turn: first,
    phase: "roll",
    die: null,
    sixes: 0,
    winner: null,
    captures: Array(PLAYERS).fill(0),
    last: null,
  };
}

/** A fair die from any `() => number` in [0, 1). Pass a seeded one in tests. */
export function rollDie(rng: () => number = Math.random): number {
  return Math.min(6, Math.floor(rng() * 6) + 1);
}

/** Absolute track square for a progress on the shared track, or null if in yard / home column / home. */
export function absSquare(player: number, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START[player] + progress) % TRACK_LENGTH;
}

/** Where a seed would land with this roll, or null if it can't move. */
export function target(progress: number, die: number): number | null {
  if (progress === YARD) return die === 6 ? 0 : null;
  if (progress >= HOME) return null;
  const to = progress + die;
  return to <= HOME ? to : null; // exact roll needed to finish
}

export function legalMoves(state: LudoState): number[] {
  if (state.phase !== "move" || state.die === null) return [];
  return movesFor(state.seeds[state.turn], state.die);
}

function movesFor(seeds: number[], die: number): number[] {
  const out: number[] = [];
  seeds.forEach((p, i) => { if (target(p, die) !== null) out.push(i); });
  return out;
}

function nextPlayer(p: number): number {
  return (p + 1) % PLAYERS;
}

/** Use a die roll: either wait for a seed to be chosen, or pass the turn. */
export function applyRoll(state: LudoState, die: number): LudoState {
  if (state.phase !== "roll") throw new Error("Not time to roll");
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error("Bad die");
  const player = state.turn;
  const sixes = die === 6 ? state.sixes + 1 : 0;
  if (sixes === 3) {
    return { ...state, turn: nextPlayer(player), phase: "roll", die, sixes: 0, last: { kind: "three-sixes", player } };
  }
  if (movesFor(state.seeds[player], die).length === 0) {
    return { ...state, turn: nextPlayer(player), phase: "roll", die, sixes: 0, last: { kind: "pass", player, die } };
  }
  return { ...state, phase: "move", die, sixes };
}

/** Move one seed by the current roll. Captures, bonus rolls and the win are handled here. */
export function applyMove(state: LudoState, seed: number): LudoState {
  if (state.phase !== "move" || state.die === null) throw new Error("Not time to move");
  const player = state.turn;
  const die = state.die;
  const from = state.seeds[player][seed];
  const to = from === undefined ? null : target(from, die);
  if (to === null) throw new Error(`Illegal move: seed ${seed} with ${die}`);

  const seeds = state.seeds.map((row) => [...row]);
  seeds[player][seed] = to;
  const captured: { player: number; seed: number }[] = [];
  const sq = absSquare(player, to);
  if (sq !== null && !SAFE.has(sq)) {
    for (let p = 0; p < PLAYERS; p++) {
      if (p === player) continue;
      seeds[p].forEach((q, i) => {
        if (absSquare(p, q) === sq) { seeds[p][i] = YARD; captured.push({ player: p, seed: i }); }
      });
    }
  }
  const captures = [...state.captures];
  captures[player] += captured.length;

  const won = seeds[player].every((p) => p === HOME);
  const bonus = !won && (die === 6 || captured.length > 0);
  const last: LudoEvent = { kind: "move", player, seed, from, to, die, captured, bonus };
  if (won) return { ...state, seeds, captures, phase: "over", winner: player, last };
  if (bonus) return { ...state, seeds, captures, phase: "roll", last }; // keeps the sixes count for the three-sixes rule
  return { ...state, seeds, captures, turn: nextPlayer(player), phase: "roll", sixes: 0, last };
}

/** How many opponent seeds could land on this square with one roll (1–6). Safe squares are never threatened. */
export function threatAt(state: LudoState, player: number, sq: number): number {
  if (SAFE.has(sq)) return 0;
  let n = 0;
  for (let p = 0; p < PLAYERS; p++) {
    if (p === player) continue;
    for (const q of state.seeds[p]) {
      const a = absSquare(p, q);
      if (a === null) continue;
      const d = (sq - a + TRACK_LENGTH) % TRACK_LENGTH;
      if (d >= 1 && d <= 6 && q + d <= LAST_TRACK) n++; // it must still be on the track when it gets there
    }
  }
  return n;
}

/**
 * The computer's choice. Capture beats finishing, finishing beats leaving the yard,
 * then it saves a threatened seed or pushes the leader on, avoiding squares an opponent can reach.
 */
export function chooseMove(state: LudoState): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal move");
  const player = state.turn;
  const die = state.die as number;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const seed of moves) {
    const from = state.seeds[player][seed];
    const to = target(from, die) as number;
    const after = applyMove(state, seed);
    const captured = after.last?.kind === "move" ? after.last.captured.length : 0;
    let score = 0;
    if (captured > 0) score += 1000 + captured * 50;
    if (to === HOME) score += 800;
    if (from === YARD) score += 600;
    if (from <= LAST_TRACK && to > LAST_TRACK) score += 300; // into the home column: safe for good
    const fromSq = absSquare(player, from);
    const toSq = absSquare(player, to);
    if (fromSq !== null) score += threatAt(state, player, fromSq) * 120; // get out of danger
    if (toSq !== null) {
      score -= threatAt(after, player, toSq) * 150;
      if (SAFE.has(toSq)) score += 60;
    }
    score += Math.max(0, from) * 2; // otherwise favour the leader
    if (score > bestScore) { bestScore = score; best = seed; }
  }
  return best;
}

/** One full computer step from a "roll" state, for tests and quick simulations. */
export function autoStep(state: LudoState, rng: () => number = Math.random): LudoState {
  if (state.phase === "roll") return applyRoll(state, rollDie(rng));
  if (state.phase === "move") return applyMove(state, chooseMove(state));
  return state;
}

/** Board cell for a seed on the track or in its home column (null in yard / home). */
export function seedCell(player: number, progress: number): Cell | null {
  const sq = absSquare(player, progress);
  if (sq !== null) return TRACK[sq];
  if (progress > LAST_TRACK && progress < HOME) return HOME_COLUMN[player][progress - LAST_TRACK - 1];
  return null;
}

/** Seeded RNG (mulberry32) so tests and replays are repeatable. */
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
