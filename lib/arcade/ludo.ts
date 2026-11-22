// Ludo for Notes Arcade: pure game logic, no React or DOM. The UI is components/games/LudoGame.tsx.
// Board: the classic 15×15 cross. A seed's position is its progress along its own route:
//   -1 = in the yard, 0 = its start square, 0–50 = the shared 52-square track, 51–55 = its home column, 56 = home.
// Players move clockwise. Player 0 is the person (bottom-left yard); 1, 2 and 3 are computer players.
// Options (owner, 21 Nov 2026): play with 1 die or 2 dice (2 by default), the optional "6 + 5 straight home" rule (off by default),
// and "hit → home" (on by default): a seed that captures goes straight home while the one it hit goes back to its yard.
// A turn, the way it's played at home (owner, 21 Nov 2026): roll, and while you throw a six (1 die) or a double six (2 dice), bank
// it and roll again. When the rolling stops, spend every banked die one at a time, in any order, on any seeds. A capture does NOT
// earn another roll (owner, 21 Nov 2026): only a six (1 die) or a double six (2 dice) does. Only the star squares are safe: a seed landing on a start square sends
// the other colour sitting there back to its yard.
// Who plays which colour (owner, 21 Nov 2026): state.table says which controller owns each colour and which colours are in play.
// By default that's four separate players. "2 v 2 yards": the person owns any two colours, one computer the other two; each colour
// still takes its own turn clockwise, colours with the same owner share squares (never capture each other), and a controller
// wins with all 8 seeds home. "Knockout": with table.playToLast the game carries on after someone finishes until only one
// controller is left (state.order is the finishing order, state.loser the one left); see the Knockout helpers at the bottom.

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

// Seats: owner[colour] = the controller playing that colour (0 is the person); active[colour] = that yard is in play (an empty
// yard is skipped in turn order and has no seeds on the board); playToLast = keep playing until only one controller is unfinished.
export type LudoTable = { owner: number[]; active: boolean[]; playToLast: boolean };
export const DEFAULT_TABLE: LudoTable = { owner: [0, 1, 2, 3], active: [true, true, true, true], playToLast: false };

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
      hitHome?: boolean; // the capturing seed went straight home (the "hit → home" option); `to` is where it landed
      forfeited: number[]; // dice left over that couldn't be used
    }
  | { kind: "straight-home"; player: number; seed: number };

export type LudoState = {
  options: LudoOptions;
  table: LudoTable;
  seeds: number[][]; // [player][seed] → progress
  turn: number;
  phase: "roll" | "move" | "over";
  // Every die banked this turn, in the order thrown (phase "roll" with unspent dice: still rolling on sixes; phase "move":
  // spending them), or the last roll seen once a turn is over. Empty before the first roll.
  dice: number[];
  used: boolean[]; // which of `dice` are spent (or forfeited)
  sixes: number; // 1 die: sixes in a row. 2 dice: double sixes in a row. Reset by any other roll.
  winner: number | null; // the controller who finished first (with the default table, the same as the colour)
  order: number[]; // controllers in the order they got all their seeds home
  loser: number | null; // the one controller left unfinished when the game ended with only one left (knockout rounds, 2 v 2)
  captures: number[]; // seeds each colour has sent back, for the scoreboard
  last: LudoEvent | null;
  // Rolls taken so far this game, by anyone. Normal play ignores it; tournaments (lib/arcade/replay-ludo.ts; owner, 21 Nov 2026:
  // "add tournament versions of Ludo…") deal the k-th roll of the game from the tournament seed and k, so every entrant gets the same
  // dice sequence and the browser and the server agree on which roll comes next without keeping a count of their own.
  rolls: number;
};

export function newGame(options: Partial<LudoOptions> = {}, first = 0, table: Partial<LudoTable> = {}): LudoState {
  const t: LudoTable = { ...DEFAULT_TABLE, ...table };
  if (t.owner.length !== PLAYERS || t.active.length !== PLAYERS) throw new Error("Bad table");
  if (new Set(t.owner.filter((_, c) => t.active[c])).size < 2) throw new Error("Bad table: needs two controllers");
  const state: LudoState = {
    options: { ...DEFAULT_OPTIONS, ...options },
    table: { owner: [...t.owner], active: [...t.active], playToLast: t.playToLast },
    seeds: Array.from({ length: PLAYERS }, () => Array(SEEDS).fill(YARD)),
    turn: first,
    phase: "roll",
    dice: [],
    used: [],
    sixes: 0,
    winner: null,
    order: [],
    loser: null,
    captures: Array(PLAYERS).fill(0),
    last: null,
    rolls: 0,
  };
  return state.table.active[first] ? state : { ...state, turn: nextPlayer(state, first) };
}

/** The controllers taking part (owners of colours in play), lowest first. */
export function controllers(state: LudoState): number[] {
  return [...new Set(state.table.owner.filter((_, c) => state.table.active[c]))].sort((a, b) => a - b);
}

/** The colours in play that this controller owns. */
export function coloursOf(state: LudoState, controller: number): number[] {
  return state.table.owner.flatMap((o, c) => (o === controller && state.table.active[c] ? [c] : []));
}

/** Two colours are on the same side (same controller): they share squares and never capture each other. */
export function friendly(state: LudoState, a: number, b: number): boolean {
  return state.table.owner[a] === state.table.owner[b];
}

function allHome(state: LudoState, controller: number): boolean {
  return coloursOf(state, controller).every((c) => state.seeds[c].every((p) => p === HOME));
}

/** Still taking turns: in play, seeds still to get home, controller not finished. */
export function inPlay(state: LudoState, colour: number): boolean {
  return state.table.active[colour] && !state.seeds[colour].every((p) => p === HOME) && !state.order.includes(state.table.owner[colour]);
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

// The next colour clockwise that's still taking turns (empty yards and finished colours are skipped).
function nextPlayer(state: LudoState, p: number): number {
  for (let i = 1; i <= PLAYERS; i++) {
    const q = (p + i) % PLAYERS;
    if (inPlay(state, q)) return q;
  }
  return p;
}

// Next player's turn. The dice stay on show (all marked spent).
function endTurn(state: LudoState, last: LudoEvent): LudoState {
  return { ...state, used: state.dice.map(() => true), turn: nextPlayer(state, state.turn), phase: "roll", sixes: 0, last };
}

// The colour whose turn it is has just got its last seed home. If that finishes its controller, they go into the finishing
// order; the game ends at the first finish (or, with playToLast, when only one controller is left). Otherwise play moves on:
// a colour with every seed home has nothing left to move, so any dice it still holds are lost.
function colourDone(state: LudoState, event: (forfeited: number[]) => LudoEvent): LudoState {
  const c = state.table.owner[state.turn];
  const order = allHome(state, c) && !state.order.includes(c) ? [...state.order, c] : state.order;
  const remaining = controllers(state).filter((x) => !order.includes(x));
  const next = { ...state, order };
  if (order.length > state.order.length && (!state.table.playToLast || remaining.length <= 1)) {
    return { ...next, phase: "over", winner: order[0], loser: remaining.length === 1 ? remaining[0] : null, last: event([]) };
  }
  return endTurn(next, event(banked(state)));
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
  const fresh = { ...state, dice, used: dice.map(() => false), sixes, rolls: state.rolls + 1 };
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

/** Play one action. Captures, forfeited dice and the win are handled here. A capture never earns a bonus roll. */
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
    const event: LudoEvent = { kind: "straight-home", player, seed: h };
    if (seeds[player].every((p) => p === HOME)) return colourDone(next, () => event);
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
      if (friendly(state, p, player) || !state.table.active[p]) continue; // your own colours share the square
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
  const event = (forfeited: number[]): LudoEvent => ({
    kind: "move", player, seed, from, to, die: value as number, captured, forfeited, ...(hitHome ? { hitHome: true } : {}),
  });

  if (seeds[player].every((p) => p === HOME)) return colourDone(next, event);
  return afterSpend(next, event);
}

/** Move one seed with a die (an index into state.dice). Without a die, the first unspent one that works is used. */
export function applyMove(state: LudoState, seed: number, die?: number): LudoState {
  if (state.phase !== "move") throw new Error("Not time to move");
  const d = die ?? diceForSeed(state, seed)[0];
  if (d === undefined) throw new Error(`Illegal move: seed ${seed}`);
  return applyAction(state, { kind: "step", seed, die: d });
}

/** How many opponent seeds could land on this square with one die (1–6), counting a colour's yard as threatening
 * its start square (a six brings a seed straight out onto it). Star squares are never threatened; nor are you by your own colours. */
export function threatAt(state: LudoState, player: number, sq: number): number {
  if (SAFE.has(sq)) return 0;
  let n = 0;
  for (let p = 0; p < PLAYERS; p++) {
    if (friendly(state, p, player) || !state.table.active[p]) continue;
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
  if (after.order.length > state.order.length) return 100000; // this finishes the controller: all its seeds home
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
    // What the next banked die can do.
    const more = after.turn === state.turn && after.phase === "move" ? after : null;
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

/** Play a game out between computer players to the end (the knockout's "play out the rest"). */
export function playOut(state: LudoState, rng: () => number = Math.random, maxSteps = 100000): LudoState {
  let s = state;
  for (let i = 0; i < maxSteps && s.phase !== "over"; i++) s = autoStep(s, rng);
  return s;
}

/** Owners for a two-controller game: `me` plays the two colours in `myYards`, `them` the other two. */
export function pairOwners(me: number, them: number, myYards: readonly number[]): number[] {
  if (myYards.length !== 2 || myYards[0] === myYards[1] || myYards.some((c) => !Number.isInteger(c) || c < 0 || c >= PLAYERS)) {
    throw new Error("Pick two different yards");
  }
  return Array.from({ length: PLAYERS }, (_, c) => (myYards.includes(c) ? me : them));
}

/** "2 v 2 yards": the person (controller 0) plays `myYards`, one computer (controller 1) the other two. */
export function twoYardsTable(myYards: readonly number[]): LudoTable {
  return { owner: pairOwners(0, 1, myYards), active: [true, true, true, true], playToLast: false };
}

// ---- Knockout (owner, 21 Nov 2026) ----
// Round 1: four players, one colour each, played until only one hasn't got all four home: that one is out. Round 2: the
// three left play a fresh game, the knocked-out player's yard empty; last is out again. Final: the two left own two yards
// each (2 v 2 yards rules) and the first to get all 8 home wins the knockout.

export type KnockoutRound = { round: number; order: number[]; loser: number | null };
export type Knockout = {
  round: 1 | 2 | 3; // 3 = the final
  alive: number[]; // controllers still in, lowest first
  out: number[]; // controllers knocked out, first out first (the runner-up last once there's a champion)
  champion: number | null;
  results: KnockoutRound[];
};

export function newKnockout(): Knockout {
  return { round: 1, alive: [0, 1, 2, 3], out: [], champion: null, results: [] };
}

/** The final's default yards: each finalist keeps its own colour and takes its opposite yard, or, if the two finalists sit
 * opposite each other, the yard after its own clockwise. Returns an owner array. */
export function finalYards(alive: readonly number[]): number[] {
  const [a, b] = alive;
  if (alive.length !== 2) throw new Error("The final needs two players");
  const mine = (a + 2) % PLAYERS === b ? [a, (a + 1) % PLAYERS] : [a, (a + 2) % PLAYERS];
  return pairOwners(a, b, mine);
}

/** The table for the knockout's current round. In the final, `owner` may give the finalists a different split of yards
 * (each must own exactly two). */
export function knockoutTable(ko: Knockout, owner?: readonly number[]): LudoTable {
  if (ko.round < 3) {
    return { owner: [0, 1, 2, 3], active: [0, 1, 2, 3].map((c) => ko.alive.includes(c)), playToLast: true };
  }
  const o = owner ? [...owner] : finalYards(ko.alive);
  if (o.length !== PLAYERS || ko.alive.some((c) => o.filter((x) => x === c).length !== 2)) throw new Error("Each finalist owns two yards");
  return { owner: o, active: [true, true, true, true], playToLast: false };
}

/** A fresh game for the knockout's current round. */
export function knockoutGame(ko: Knockout, options: Partial<LudoOptions> = {}, owner?: readonly number[]): LudoState {
  if (ko.champion !== null) throw new Error("The knockout is over");
  return newGame(options, 0, knockoutTable(ko, owner));
}

/** Record a finished round: the last player is out; after the final, the winner is champion. */
export function advanceKnockout(ko: Knockout, game: LudoState): Knockout {
  if (game.phase !== "over" || game.loser === null || ko.champion !== null) throw new Error("The round isn't over");
  const results = [...ko.results, { round: ko.round, order: [...game.order], loser: game.loser }];
  const alive = ko.alive.filter((c) => c !== game.loser);
  const out = [...ko.out, game.loser];
  if (ko.round === 3) return { ...ko, alive, out, champion: game.winner, results };
  return { ...ko, round: (ko.round + 1) as 2 | 3, alive, out, results };
}

/** Play the rest of a knockout between computers (when the person is out). */
export function playOutKnockout(ko: Knockout, options: Partial<LudoOptions> = {}, rng: () => number = Math.random): Knockout {
  let k = ko;
  while (k.champion === null) k = advanceKnockout(k, playOut(knockoutGame(k, options), rng));
  return k;
}
