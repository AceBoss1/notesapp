// Ludo for Notes Arcade: pure game logic, no React or DOM. The UI is components/games/LudoGame.tsx.
// Board: the classic 15×15 cross. A seed's position is its progress along its own route:
//   -1 = in the yard, 0 = its start square, 0–50 = the shared 52-square track, 51–55 = its home column, 56 = home.
// Players move clockwise. Player 0 is the person (bottom-left yard); 1, 2 and 3 are computer players.
// Options (owner, 21 Nov 2026): play with 1 die or 2 dice (2 by default), the optional "6 + 5 straight home" rule (off by default),
// and "hit → home" (on by default): a seed that captures goes straight home while the one it hit goes back to its yard.
// A turn, the way it's played at home (owner, 21 Nov 2026): roll, and while you throw a six (1 die) or a double six (2 dice), bank
// it and roll again. When the rolling stops, spend every banked die one at a time, in any order, on any seeds. A capture earns
// another roll, banked with whatever is still unspent. Only the star squares are safe: a seed landing on a start square sends
// the other colour sitting there back to its yard.

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
// Star squares sit eight steps past each start, as on the classic board. They're the only safe squares.
export const STARS: number[] = START.map((s) => (s + 8) % TRACK_LENGTH);
export const SAFE = new Set<number>(STARS);

// Home columns, outside in (progress 51 → 55).
export const HOME_COLUMN: Cell[][] = [
  [13, 12, 11, 10, 9].map((r) => [r, 7] as Cell),
  [1, 2, 3, 4, 5].map((c) => [7, c] as Cell),
  [1, 2, 3, 4, 5].map((r) => [r, 7] as Cell),
  [13, 12, 11, 10, 9].map((c) => [7, c] as Cell),
];

// Top-left corner of each player's 6×6 yard.
export const YARD_ORIGIN: Cell[] = [[9, 0], [0, 0], [0, 9], [9, 9]];

export type DiceCount = 1 | 2;
export type LudoOptions = {
  dice: DiceCount; // roll one die or two (two by default)
  sixFiveHome: boolean; // "6 + 5 straight home" (off by default)
  hitHome: boolean; // a seed that captures goes straight home (on by default: how most people play it; owner, 21 Nov 2026)
};
export const DEFAULT_OPTIONS: LudoOptions = { dice: 2, sixFiveHome: false, hitHome: true };

/** What a player can do with the current roll. */
export type LudoAction =
  | { kind: "step"; seed: number; die: number } // move one seed by one die (`die` is an index into state.dice)
  | { kind: "home"; seed: number }; // 6 + 5 straight home: spend a banked 6 and a banked 5 to send a seed from the yard home

export type LudoEvent =
  | { kind: "pass"; player: number; dice: number[] } // rolled, no legal move
  | { kind: "three-sixes"; player: number } // three sixes (1 die) or three double sixes (2 dice) in a row
  | {
      kind: "move"; player: number; seed: number; from: number; to: number; die: number; // die = the value used
      captured: { player: number; seed: number }[];
      bonus: boolean; // a capture: the same player rolls again, keeping any unspent dice
      hitHome?: boolean; // the capturing seed went straight home (the "hit → home" option); `to` is where it landed
      forfeited: number[]; // dice left over that couldn't be used
    }
  | { kind: "straight-home"; player: number; seed: number; bonus: boolean };

export type LudoState = {
  options: LudoOptions;
  seeds: number[][]; // [player][seed] → progress
  turn: number;
  phase: "roll" | "move" | "over";
  // Every die banked this turn, in the order thrown (phase "roll" with unspent dice: still rolling on sixes; phase "move":
  // spending them), or the last roll seen once a turn is over. Empty before the first roll.
  dice: number[];
  used: boolean[]; // which of `dice` are spent (or forfeited)
  sixes: number; // 1 die: sixes in a row. 2 dice: double sixes in a row. Reset by any other roll and by a capture.
  winner: number | null;
  captures: number[]; // seeds each player has sent back, for the scoreboard
  last: LudoEvent | null;
};

export function newGame(options: Partial<LudoOptions> = {}, first = 0): LudoState {
  return {
    options: { ...DEFAULT_OPTIONS, ...options },
    seeds: Array.from({ length: PLAYERS }, () => Array(SEEDS).fill(YARD)),
    turn: first,
    phase: "roll",
    dice: [],
    used: [],
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

/** A roll of `count` dice. */
export function rollDice(count: number, rng: () => number = Math.random): number[] {
  return Array.from({ length: count }, () => rollDie(rng));
}

/** Absolute track square for a progress on the shared track, or null if in yard / home column / home. */
export function absSquare(player: number, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START[player] + progress) % TRACK_LENGTH;
}

/** Where a seed would land with this die, or null if it can't move. */
export function target(progress: number, die: number): number | null {
  if (progress === YARD) return die === 6 ? 0 : null;
  if (progress >= HOME) return null;
  const to = progress + die;
  return to <= HOME ? to : null; // exact roll needed to finish
}

/** The unspent dice still banked this turn. */
export function banked(state: LudoState): number[] {
  return state.dice.filter((_, i) => !state.used[i]);
}

/** The seed "6 + 5 straight home" would send home right now, or null if that move isn't on offer:
 * the rule is on, a 6 and a 5 are both banked and unspent, and a seed is still in the yard. */
export function straightHomeSeed(state: LudoState): number | null {
  if (!state.options.sixFiveHome || state.phase !== "move") return null;
  const left = banked(state);
  if (!left.includes(6) || !left.includes(5)) return null;
  const i = state.seeds[state.turn].indexOf(YARD);
  return i >= 0 ? i : null;
}

/** Everything the player whose turn it is may do with the current roll. Equal unspent dice are offered once. */
export function legalActions(state: LudoState): LudoAction[] {
  if (state.phase !== "move") return [];
  const out: LudoAction[] = [];
  const seen = new Set<number>();
  state.dice.forEach((d, i) => {
    if (state.used[i] || seen.has(d)) return;
    seen.add(d);
    state.seeds[state.turn].forEach((p, seed) => { if (target(p, d) !== null) out.push({ kind: "step", seed, die: i }); });
  });
  const h = straightHomeSeed(state);
  if (h !== null) out.push({ kind: "home", seed: h });
  return out;
}

/** Seeds that can move with some unspent die (the 6 + 5 straight-home move is separate: see legalActions). */
export function legalMoves(state: LudoState): number[] {
  const seeds = new Set<number>();
  for (const a of legalActions(state)) if (a.kind === "step") seeds.add(a.seed);
  return [...seeds].sort((a, b) => a - b);
}

/** Unspent dice indexes that can move this seed. */
export function diceForSeed(state: LudoState, seed: number): number[] {
  if (state.phase !== "move") return [];
  const p = state.seeds[state.turn][seed];
  return state.dice.flatMap((d, i) => (!state.used[i] && p !== undefined && target(p, d) !== null ? [i] : []));
}

function nextPlayer(p: number): number {
  return (p + 1) % PLAYERS;
}

// Next player's turn. The dice stay on show (all marked spent).
function endTurn(state: LudoState, last: LudoEvent): LudoState {
  return { ...state, used: state.dice.map(() => true), turn: nextPlayer(state.turn), phase: "roll", sixes: 0, last };
}

/** Take a roll (one value with 1 die, two with 2 dice) and bank it. A six (a double six with 2 dice) means roll again;
 * any other roll ends the rolling: spend the bank, or pass if none of it can be used. */
export function applyRoll(state: LudoState, roll: number | readonly number[]): LudoState {
  if (state.phase !== "roll") throw new Error("Not time to roll");
  const rolledNow = typeof roll === "number" ? [roll] : [...roll];
  if (rolledNow.length !== state.options.dice || rolledNow.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) throw new Error("Bad die");
  const player = state.turn;
  const sixRoll = rolledNow.every((d) => d === 6);
  const sixes = sixRoll ? state.sixes + 1 : 0;
  const dice = [...banked(state), ...rolledNow];
  const fresh = { ...state, dice, used: dice.map(() => false), sixes };
  if (sixes === 3) return endTurn(fresh, { kind: "three-sixes", player }); // the whole bank goes with it
  if (sixRoll) return fresh; // banked: roll again
  const ready: LudoState = { ...fresh, phase: "move" };
  if (legalActions(ready).length === 0) return endTurn(ready, { kind: "pass", player, dice });
  return ready;
}

// After spending a die: carry on if something else can be spent, otherwise the leftovers are lost and the turn passes.
function afterSpend(state: LudoState, event: (forfeited: number[]) => LudoEvent): LudoState {
  if (legalActions(state).length > 0) return { ...state, last: event([]) };
  return endTurn(state, event(banked(state)));
}

/** Play one action. Captures, bonus rolls, forfeited dice and the win are handled here. */
export function applyAction(state: LudoState, action: LudoAction): LudoState {
  if (state.phase !== "move") throw new Error("Not time to move");
  const player = state.turn;
  const seeds = state.seeds.map((row) => [...row]);

  if (action.kind === "home") {
    const h = straightHomeSeed(state);
    if (h === null || h !== action.seed) throw new Error("Illegal move: 6 + 5 straight home isn't on offer");
    seeds[player][h] = HOME;
    const used = [...state.used];
    for (const v of [6, 5]) used[state.dice.findIndex((d, i) => d === v && !used[i])] = true;
    const next = { ...state, seeds, used };
    const event: LudoEvent = { kind: "straight-home", player, seed: h, bonus: false };
    if (seeds[player].every((p) => p === HOME)) return { ...next, phase: "over", winner: player, last: event };
    return afterSpend(next, () => event);
  }

  const { seed, die } = action;
  const value = state.dice[die];
  const from = state.seeds[player][seed];
  const to = value === undefined || state.used[die] || from === undefined ? null : target(from, value);
  if (to === null) throw new Error(`Illegal move: seed ${seed} with ${value ?? "no die"}`);

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
  const hitHome = captured.length > 0 && state.options.hitHome;
  if (hitHome) seeds[player][seed] = HOME; // the hitter goes straight home
  const used = [...state.used];
  used[die] = true;
  const next: LudoState = { ...state, seeds, captures, used };
  const event = (bonus: boolean, forfeited: number[]): LudoEvent => ({
    kind: "move", player, seed, from, to, die: value as number, captured, bonus, forfeited, ...(hitHome ? { hitHome: true } : {}),
  });

  if (seeds[player].every((p) => p === HOME)) return { ...next, phase: "over", winner: player, last: event(false, []) };
  if (captured.length > 0) return { ...next, phase: "roll", sixes: 0, last: event(true, []) }; // roll again; unspent dice stay banked
  return afterSpend(next, (forfeited) => event(false, forfeited));
}

/** Move one seed with a die (an index into state.dice). Without a die, the first unspent one that works is used. */
export function applyMove(state: LudoState, seed: number, die?: number): LudoState {
  if (state.phase !== "move") throw new Error("Not time to move");
  const d = die ?? diceForSeed(state, seed)[0];
  if (d === undefined) throw new Error(`Illegal move: seed ${seed}`);
  return applyAction(state, { kind: "step", seed, die: d });
}

/** How many opponent seeds could land on this square with one die (1–6), counting a colour's yard as threatening
 * its start square (a six brings a seed straight out onto it). Star squares are never threatened. */
export function threatAt(state: LudoState, player: number, sq: number): number {
  if (SAFE.has(sq)) return 0;
  let n = 0;
  for (let p = 0; p < PLAYERS; p++) {
    if (p === player) continue;
    if (sq === START[p] && state.seeds[p].includes(YARD)) n++;
    for (const q of state.seeds[p]) {
      const a = absSquare(p, q);
      if (a === null) continue;
      const d = (sq - a + TRACK_LENGTH) % TRACK_LENGTH;
      if (d >= 1 && d <= 6 && q + d <= LAST_TRACK) n++; // it must still be on the track when it gets there
    }
  }
  return n;
}

// How good one action is for the player making it. Capture > straight home > finish > leave the yard >
// reach safety > advance the leader, avoiding squares an opponent can reach.
function actionScore(state: LudoState, action: LudoAction, after: LudoState): number {
  const player = state.turn;
  if (after.phase === "over" && after.winner === player) return 100000;
  if (action.kind === "home") return 1700;
  const from = state.seeds[player][action.seed];
  const to = after.seeds[player][action.seed];
  const captured = after.last?.kind === "move" ? after.last.captured.length : 0;
  let score = 0;
  if (captured > 0) score += 2000 + captured * 50;
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
  return score;
}

/**
 * The computer's choice. It tries each banked die on each seed, then the best use of another die,
 * and scores the pair, so it picks which die goes on which seed. It takes 6 + 5 straight home unless a capture is on.
 */
export function chooseAction(state: LudoState): LudoAction {
  const actions = legalActions(state);
  if (actions.length === 0) throw new Error("No legal move");
  let best = actions[0];
  let bestScore = -Infinity;
  for (const a of actions) {
    const after = applyAction(state, a);
    let score = actionScore(state, a, after);
    if (after.phase === "roll" && after.turn === state.turn) score += 100; // capture first: see the bonus roll before spending the rest
    // What the next banked die can do (after a capture, the dice still banked count too).
    const more = after.turn !== state.turn || after.phase === "over" ? null
      : after.phase === "move" ? after : banked(after).length ? { ...after, phase: "move" as const } : null;
    if (more) {
      let follow = -Infinity;
      for (const b of legalActions(more)) follow = Math.max(follow, actionScore(more, b, applyAction(more, b)));
      if (follow > -Infinity) score += follow;
    }
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

/** One computer step: roll in a "roll" state, act in a "move" state. For tests and quick simulations. */
export function autoStep(state: LudoState, rng: () => number = Math.random): LudoState {
  if (state.phase === "roll") return applyRoll(state, rollDice(state.options.dice, rng));
  if (state.phase === "move") return applyAction(state, chooseAction(state));
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
