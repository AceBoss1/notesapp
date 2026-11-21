// Notes Arcade tournaments, Phase 1 (docs/ARCADE_TOURNAMENTS.md §3 and §6; owner, 21 Nov 2026: "start tournaments"). The contract every
// tournament game meets, and the registry the server and pages use. Pure: no Firestore, no React.
//
// "Same deal": every entrant plays the same game from the same seed at the same level. The browser records what the player did (a
// string of moves, whatever suits the game); the server replays that recording with the game's own code from the tournament's seed and
// keeps the result IT works out. A made-up score can't pass, because the browser's word for the result is never taken.
//
// Each game adds one file `lib/arcade/replay-<slug>.ts` exporting a `TournamentGame` and is listed in TOURNAMENT_GAMES below.

/** What a replay found. `rank` sorts entries: a bigger tuple wins, compared item by item (e.g. [won ? 1 : 0, -moves]). */
export type ReplayResult =
  | {
      ok: true;
      /** Did the run reach a proper end (a win, a loss, a crash)? Unfinished runs are refused for tournaments. */
      finished: boolean;
      /** The ranking key, compared item by item, bigger first. */
      rank: number[];
      /** One line for the leaderboard, e.g. "Won, 3 cards left to the computer" or "4,120 points · 1,880 m". */
      summary: string;
      /** The main number on the leaderboard (score, or a points-like number). */
      score: number;
      /** Game time the run took in milliseconds, when the game knows it (real-time games); the server refuses a run that claims more
       *  game time than real time passed since it started. */
      ms?: number;
    }
  | { ok: false; error: string };

export type TournamentGame = {
  slug: string; // the catalogue slug: "whot", "run", "snake", "chess"…
  name: string;
  /** The levels a tournament can be set to (shown in Admin); the first is the default. */
  levels: string[];
  /** How entries are ranked, in words, for the tournament page ("Wins first, then the fewest cards left to the computer"). */
  rankedBy: string;
  /** Recordings longer than this many characters are refused before replaying. */
  maxRecording: number;
  /** Replays a recording from the seed at the level. Must be pure and deterministic, and must refuse anything after the game ended. */
  replay(seed: number, level: string, recording: unknown): ReplayResult;
};

/** Compare two rank tuples: positive when a ranks above b. */
export function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Firestore can't order by an array, so entries also store the rank as one sortable string. Each item is offset and zero-padded. */
export function rankKey(rank: number[]): string {
  const OFFSET = 1e12;
  return rank.map((n) => String(Math.round(n + OFFSET)).padStart(14, "0")).join(".");
}

// The registry. Each game's adapter is added by its own file; see the top of this file.
import { RUN_TOURNAMENT } from "./replay-run";
import { WHOT_TOURNAMENT } from "./replay-whot";
import { SNAKE_TOURNAMENT } from "./replay-snake";
import { CHESS_TOURNAMENT } from "./replay-chess";

export const TOURNAMENT_GAMES: TournamentGame[] = [WHOT_TOURNAMENT, RUN_TOURNAMENT, SNAKE_TOURNAMENT, CHESS_TOURNAMENT];

export const tournamentGame = (slug: unknown): TournamentGame | undefined => TOURNAMENT_GAMES.find((g) => g.slug === slug);

/**
 * How a game component plays a tournament try (the prop is `tourney`). The page gets `seed`, `level` and `runId` from
 * POST /api/arcade/tournaments/[id]/start and renders the game with this; the game then:
 *   - deals/builds from `seed` at `level` (level select locked, Undo off, no "new game", Nana off: <ArcadeNana context={{ mode: "tournament" }} />),
 *   - records every player action into a string the game's `replay` understands,
 *   - calls `onFinish(recording)` once when the game ends (win, loss, crash), and shows `finishedText` if given.
 * The computer players' choices must come from the seeded state only (no Math.random), so the server's replay reproduces them.
 */
export type TourneyProps = {
  runId: string;
  seed: number;
  level: string;
  onFinish: (recording: string) => void;
  /** Shown after the try is sent, e.g. "Checked: 4,120 points. Best so far: 5,300. 1 try left." */
  finishedText?: string;
};
