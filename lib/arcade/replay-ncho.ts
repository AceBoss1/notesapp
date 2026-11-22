// Ncho and Ncho Aka-Hausa in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi
// and Puff-Puff"; docs/ARCADE_TOURNAMENTS.md §3: "Seed difference, against the computer at a set level"). Pure: no React, no Firestore.
//
// Same deal for everyone: 2 players (you v the computer), 3 rounds, the tournament's computer level, and YOU sow first in round 1 (the
// start is fixed, so the seed isn't needed to build it; later rounds are started by whoever the rules say, the fewest houses first).
// Aka-Hausa is the very same game sown clockwise, with the computer looking one move further ahead (lib/arcade/ncho.ts depthFor), so the
// two share this file and differ only in the variant they replay.
//
// The browser records only the holes you sow, by index ("2,5,0,…"). Round changes aren't recorded: the rules decide who starts the next
// round, and the replay carries on by itself exactly as the game does. The server replays your holes with lib/arcade/ncho.ts and works
// out the computer's sowings itself, so they must come out the same in the browser and on the server:
//   - the computer's search is depth-limited (a fixed number of moves ahead per level), never cut off by a clock;
//   - its random choices (easy's slips, and the pick between equally good holes) draw from a generator seeded by the tournament seed and
//     the move number, never Math.random.
import type { ReplayResult, TournamentGame } from "./tournament-games";
import {
  HUMAN, applyMove, chooseMove, housesOf, initialState, legalMoves, seededRng,
  type Level, type NchoState, type NchoVariant,
} from "./ncho";

export const NCHO_LEVELS: Level[] = ["medium", "easy", "hard"];
/** Tournaments always last 3 rounds (the game's own default), so every entrant plays the same length of game. */
export const NCHO_TOURNEY_ROUNDS = 3;
// A round stops after 400 sowings in all (lib/arcade/ncho.ts moveCap), so you can't sow more than that in 3 rounds.
export const NCHO_MAX_MOVES = 400 * NCHO_TOURNEY_ROUNDS;

/** The start both sides build: the browser to play, the server to replay. You v the computer, 3 rounds, you sow first. */
export function nchoTourneyStart(seed: number, level: string, variant: NchoVariant = "ncho"): NchoState {
  void seed; void level; // the board always starts 4 seeds a hole; the seed only steers the computer's choices (nchoTourneyReply)
  return initialState(undefined, HUMAN, variant, { rounds: NCHO_TOURNEY_ROUNDS, players: 2 });
}

/** The computer's tournament sowing: the same in the browser and on the server, from the seed, the level and the position alone. */
export function nchoTourneyReply(s: NchoState, level: Level, seed: number): number {
  const rng = seededRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(s.plies + 1, 0x85ebca6b)) >>> 0);
  return chooseMove(s, level, rng);
}

/** One hole you sowed, as the recording spells it. */
export const encodeNchoMove = (hole: number): string => String(hole);
/** The whole recording: the holes you sowed, in order. */
export const encodeNcho = (holes: readonly number[]): string => holes.map(encodeNchoMove).join(",");

// Lets the computer play until it's your turn or the game ends (it may start a round, or move again after a round it ended).
function computerPlays(s: NchoState, level: Level, seed: number): NchoState {
  while (!s.over && s.turn !== HUMAN) s = applyMove(s, nchoTourneyReply(s, level, seed));
  return s;
}

export type NchoOutcome = "win" | "draw" | "loss";
export type NchoReplay =
  | { ok: true; state: NchoState; finished: boolean; outcome: NchoOutcome | null; moves: number; houses: [number, number]; seeds: [number, number] }
  | { ok: false; error: string };

const HOLE = /^(?:0|[1-9]\d?)$/; // one spelling per hole: no leading zeros

/** Replays your sowings from the start, the computer playing its turns in between. Refuses an illegal hole, or anything after the end. */
export function replayNcho(seed: number, level: Level, variant: NchoVariant, recording: unknown): NchoReplay {
  if (typeof recording !== "string") return { ok: false, error: "That game couldn't be read." };
  if (recording.length > NCHO_MAX_MOVES * 3) return { ok: false, error: "That game is too long." };
  const tokens = recording === "" ? [] : recording.split(",");
  if (tokens.length > NCHO_MAX_MOVES) return { ok: false, error: "That game is too long." };
  let s = computerPlays(nchoTourneyStart(seed, level, variant), level, seed);
  let moves = 0;
  for (const tok of tokens) {
    if (s.over) return { ok: false, error: "That game carries on after it ended." };
    if (!HOLE.test(tok)) return { ok: false, error: "That game couldn't be read." };
    const hole = Number(tok);
    if (!legalMoves(s).includes(hole)) return { ok: false, error: `Move ${moves + 1} (hole ${tok}) isn't legal there.` };
    s = applyMove(s, hole);
    moves++;
    s = computerPlays(s, level, seed);
  }
  if (!s.over) {
    // Unfinished: houses as they stand this round (seeds still in play aren't counted yet).
    return { ok: true, state: s, finished: false, outcome: null, moves, houses: [housesOf(s.owner, 0), housesOf(s.owner, 1)], seeds: [s.stores[0], s.stores[1]] };
  }
  // The last round's count decides it: houses after the refill, and the seeds each side counted (store plus the holes it owned).
  const r = s.lastRound!;
  const outcome: NchoOutcome = s.winner === HUMAN ? "win" : s.winner === "draw" ? "draw" : "loss";
  return { ok: true, state: s, finished: true, outcome, moves, houses: [r.houses[0], r.houses[1]], seeds: [r.totals[0], r.totals[1]] };
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `-${-n}` : "level");

function makeTournament(variant: NchoVariant): TournamentGame {
  const game: TournamentGame = {
    slug: variant,
    name: variant === "akahausa" ? "Ncho Aka-Hausa" : "Ncho",
    levels: NCHO_LEVELS,
    rankedBy: "Wins first (most houses after 3 rounds), then the house difference, then the seed difference in the last count",
    maxRecording: NCHO_MAX_MOVES * 3,
    replay(seed: number, level: string, recording: unknown): ReplayResult {
      if (!NCHO_LEVELS.includes(level as Level)) return { ok: false, error: "Unknown level." };
      const r = replayNcho(seed, level as Level, variant, recording);
      if (!r.ok) return r;
      const [mh, th] = r.houses;
      const hd = mh - th, sd = r.seeds[0] - r.seeds[1];
      if (!r.outcome) return { ok: true, finished: false, rank: [0, hd, sd], summary: `Unfinished in round ${r.state.round}`, score: 0 };
      const tier = r.outcome === "win" ? 2 : r.outcome === "draw" ? 1 : 0;
      const summary = r.outcome === "win" ? `Won ${mh} houses to ${th} (seeds ${signed(sd)})`
        : r.outcome === "draw" ? `Drew ${mh} houses each (seeds ${signed(sd)})`
        : `Lost ${mh} houses to ${th} (seeds ${signed(sd)})`;
      // A points-like number in the same order as the rank: the tier, then the house difference (−12…12), then the seed difference
      // (−48…48), each fitted in its own band.
      const score = tier * 10000 + (hd + 12) * 100 + (sd + 48);
      return { ok: true, finished: true, rank: [tier, hd, sd], summary, score };
    },
  };
  return game;
}

export const NCHO_TOURNAMENT: TournamentGame = makeTournament("ncho");
// Aka-Hausa: the same game sown clockwise; its own tournament entry (same file, so both stay in step).
export const AKAHAUSA_TOURNAMENT: TournamentGame = makeTournament("akahausa");
