// Ludo in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and Puff-Puff";
// docs/ARCADE_TOURNAMENTS.md §3, "Same deal"). Pure: no React, no Firestore.
//
// One setup for every tournament, so entries compare like with like: four players, you (green) against three computers, the
// standard rules (2 dice, "6 + 5 straight home" off, "hit → home" on), and you roll first. The game ends at the first colour to get
// all four seeds home (the normal four-player game), so your placing is settled the moment anyone finishes.
//
// Dice: the k-th roll of the game (counted in state.rolls, whoever throws it) comes from mulberry32(the tournament seed mixed with k).
// Every entrant sees the same dice sequence, and since the computers' choices come from lib/arcade/ludo.ts chooseAction, which reads
// only the state, the whole game follows from the seed plus your own choices. That's all the browser records: which seed you moved with
// which die. Rolling is implied (you can only roll when it's your roll, and the roll is fixed by the seed), so it isn't recorded.
import {
  DEFAULT_OPTIONS, HOME, applyAction, applyRoll, chooseAction, legalActions, newGame, rollDice,
  type LudoAction, type LudoOptions, type LudoState,
} from "./ludo";
import type { ReplayResult, TournamentGame } from "./tournament-games";

/** The computer has a single strategy, so a Ludo tournament has a single level. */
export const LUDO_LEVELS = ["standard"];

/** The tournament rules: the game's own defaults, pinned here so a later change to the defaults can't change a running tournament. */
export const LUDO_TOURNEY_OPTIONS: LudoOptions = { ...DEFAULT_OPTIONS, dice: 2, sixFiveHome: false, hitHome: true };

/** A belt for the server: a game that somehow hasn't ended after this many rolls (all players) ends there and is ranked as it
 *  stands. Real games take about 100-170 rolls between four players; the bot games in the tests never come near it. */
export const LUDO_ROLL_CAP = 1200;

/** The start both sides build: the browser to play, the server to replay. Same seed, same game, you roll first. */
export function ludoTourneyStart(seed: number, level: string): LudoState {
  void seed; // the board starts empty; the seed decides the dice (ludoTourneyDice)
  void level; // one level today; kept in the signature so a harder computer can be added without changing callers
  return newGame(LUDO_TOURNEY_OPTIONS, 0);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The dice for roll number `k` (0 first) of a tournament game: the same for every entrant. */
export function ludoTourneyDice(seed: number, k: number): number[] {
  // Mix the roll number into the seed (a Weyl step and a murmur-style finaliser), so neighbouring rolls get unrelated streams.
  let h = (seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return rollDice(LUDO_TOURNEY_OPTIONS.dice, mulberry32((h ^ (h >>> 16)) >>> 0));
}

/** The game has ended: someone got all four home, or (never in practice) the roll cap was reached. */
export const ludoTourneyOver = (s: LudoState) => s.phase === "over" || s.rolls >= LUDO_ROLL_CAP;

/** Rolls and plays for the computers, and rolls for you, until you have dice to spend or the game is over. The browser does the
 *  same one step at a time, with pauses (and waits for you to press ROLL, which is why your rolls needn't be recorded). */
export function ludoTourneyAdvance(seed: number, s: LudoState, onYourTurn?: () => void): LudoState {
  let g = s;
  // Each step is a roll or a spent die, and the roll cap stops the loop even in a game that would never end.
  while (!ludoTourneyOver(g) && !(g.turn === 0 && g.phase === "move")) {
    if (g.phase === "roll") {
      // A roll of yours with nothing banked starts a turn (a six's re-roll is the same turn).
      if (g.turn === 0 && onYourTurn && g.used.every(Boolean)) onYourTurn();
      g = applyRoll(g, ludoTourneyDice(seed, g.rolls));
    } else g = applyAction(g, chooseAction(g));
  }
  return g;
}

// The recording: one two-character token per seed you moved, run together, e.g. "0624" = seed 1 with a 6, then seed 3 with a 4.
//   first character   the seed, 0-3 (your seeds in yard order)
//   second character  the die value spent, 1-6
// A die is named by its value, not its position: when two banked dice show the same number they're interchangeable, and the value
// is the one spelling both sides agree on (ludoTourneyAction picks the first unspent die with that value, as legalActions offers it).
const TOKEN = /^[0-3][1-6]$/;

export function encodeLudoMove(s: LudoState, a: LudoAction): string {
  if (a.kind !== "step") throw new Error("6 + 5 straight home is off in tournaments");
  return `${a.seed}${s.dice[a.die]}`;
}

/** The legal action for "this seed with a die showing this value", in the one form the replay uses, or null if it isn't legal. */
export function ludoTourneyAction(s: LudoState, seed: number, value: number): LudoAction | null {
  return legalActions(s).find((a) => a.kind === "step" && a.seed === seed && s.dice[a.die] === value) ?? null;
}

/** The (seed, die value) pairs in a recording, or null when it can't be read. An empty string is no moves. */
export function decodeLudoMoves(recording: unknown): [number, number][] | null {
  if (typeof recording !== "string" || recording.length % 2 !== 0) return null;
  const out: [number, number][] = [];
  for (let i = 0; i < recording.length; i += 2) {
    const t = recording.slice(i, i + 2);
    if (!TOKEN.test(t)) return null;
    out.push([Number(t[0]), Number(t[1])]);
  }
  return out;
}

export type LudoReplay = { ok: true; state: LudoState; moves: number; turns: number } | { ok: false; error: string };

/** Replays your moves from the seed, the computers answering exactly as they do in the browser. */
export function replayLudo(seed: number, level: string, recording: unknown): LudoReplay {
  const moves = decodeLudoMoves(recording);
  if (!moves) return { ok: false, error: "That game couldn't be read." };
  let turns = 0;
  const advance = (g: LudoState) => ludoTourneyAdvance(seed, g, () => { turns++; });
  let s = advance(ludoTourneyStart(seed, level));
  for (const [seedNo, value] of moves) {
    if (ludoTourneyOver(s)) return { ok: false, error: "That game carries on after it ended." };
    const a = ludoTourneyAction(s, seedNo, value);
    if (!a) return { ok: false, error: "That game has a move the rules don't allow." };
    s = advance(applyAction(s, a));
  }
  return { ok: true, state: s, moves: moves.length, turns };
}

/** Your seeds home. */
export const ludoSeedsHome = (s: LudoState) => s.seeds[0].filter((p) => p === HOME).length;

/** Your place, 1-4: the winner is 1st; the rest by seeds home, then by how far their seeds have got (ties share the better place). */
export function ludoPlace(s: LudoState): number {
  if (s.winner === 0) return 1;
  const key = (c: number) => [s.seeds[c].filter((p) => p === HOME).length, s.seeds[c].reduce((n, p) => n + Math.max(0, p + 1), 0)];
  const mine = key(0);
  let place = 1;
  for (let c = 1; c < 4; c++) {
    if (s.winner === c) { place++; continue; }
    const k = key(c);
    if (k[0] > mine[0] || (k[0] === mine[0] && k[1] > mine[1])) place++;
  }
  return place;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const ORDINAL = ["1st", "2nd", "3rd", "4th"];

export const LUDO_TOURNAMENT: TournamentGame = {
  slug: "ludo",
  name: "Ludo",
  levels: LUDO_LEVELS,
  rankedBy: "Wins first, then the most of your seeds home, then the fewest turns. Four players, you against three computers; 2 dice, hit → home on, 6 + 5 home off",
  // Two characters a move; a whole game takes you well under 150 moves, so 1,000 is plenty.
  maxRecording: 1000,
  replay(seed, level, recording): ReplayResult {
    if (!LUDO_LEVELS.includes(level)) return { ok: false, error: "That level isn't one Ludo has." };
    const r = replayLudo(seed, level, recording);
    if (!r.ok) return r;
    const s = r.state;
    const finished = ludoTourneyOver(s);
    const won = s.phase === "over" && s.winner === 0;
    const home = ludoSeedsHome(s);
    // Doc §3: the win first, then your seeds home, then the fewest turns.
    const rank = [won ? 1 : 0, home, -r.turns];
    // Points for the leaderboard, never out of order with `rank`: a win is 1,000 plus up to 500 for a quick game; otherwise 100 a
    // seed home plus up to 99 for fewer turns (at most 3 home without winning, so never near 1,000).
    const score = won ? 1000 + Math.max(0, 500 - r.turns) : 100 * home + Math.max(0, 99 - r.turns);
    const summary = !finished
      ? `Unfinished, ${plural(home, "seed")} home after ${plural(r.turns, "turn")}`
      : won
        ? `Won with ${plural(home, "seed")} home in ${plural(r.turns, "turn")}`
        : `Finished ${ORDINAL[ludoPlace(s) - 1]}, ${plural(home, "seed")} home`;
    return { ok: true, finished, rank, summary, score };
  },
};
