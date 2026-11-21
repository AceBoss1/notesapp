// Snake, recorded and replayed for tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §3). Pure: the
// browser writes down one character per tick, the way the head went on that tick ("-" straight on, or U / D / L / R for a turn), and the
// server steps the same rules (lib/arcade/snake.ts) from the tournament's seed at its speed until the snake dies. The food comes from
// the seed, so every entrant chases the same snacks; the score is the server's own count, never the browser's.
import type { TournamentGame, ReplayResult } from "./tournament-games";
import { createSnake, step, SNAKE_PACES, type SnakeDir, type SnakePace, type SnakeState } from "./snake";

const LETTER: Record<SnakeDir, string> = { up: "U", down: "D", left: "L", right: "R" };
const FROM_LETTER: Record<string, SnakeDir> = { U: "up", D: "down", L: "left", R: "right" };

// Tournament runs expire after 30 minutes; 40,000 ticks is over 48 minutes even at the fastest 72 ms, so a real run always fits.
export const SNAKE_MAX_TICKS = 40_000;

/** The character for the tick about to be played from `before`: what the replay reads back. The game calls it just before each step. */
export const encodeSnakeTick = (before: SnakeState): string => (before.queued === before.dir ? "-" : LETTER[before.queued]);

export type SnakeReplay = { ok: true; state: SnakeState } | { ok: false; error: string };

/**
 * Replays a recording ("---U----L--…") from the seed at the pace. A turn letter sets the way the head goes on that tick, just as the
 * player's queued turn did; a straight reversal (only possible by tampering, or by two quick turns inside one tick in the real game) runs
 * into the snake's own neck exactly as it would in play. Nothing is accepted after the snake has died.
 */
export function replaySnake(seed: number, pace: SnakePace, recording: unknown): SnakeReplay {
  if (typeof recording !== "string" || !/^[-UDLR]*$/.test(recording)) return { ok: false, error: "That run couldn't be read." };
  if (recording.length > SNAKE_MAX_TICKS) return { ok: false, error: "That run is too long." };
  let s = createSnake(seed, pace);
  for (const ch of recording) {
    if (s.over) return { ok: false, error: "That run carries on after the snake died." };
    if (ch !== "-") s = { ...s, queued: FROM_LETTER[ch] };
    s = step(s);
  }
  return { ok: true, state: s };
}

export const SNAKE_TOURNAMENT: TournamentGame = {
  slug: "snake",
  name: "Snake",
  levels: ["classic", "chill", "fast"],
  rankedBy: "Highest score, then whoever got there in the fewest moves",
  maxRecording: SNAKE_MAX_TICKS,
  replay(seed: number, level: string, recording: unknown): ReplayResult {
    if (!SNAKE_PACES.includes(level as SnakePace)) return { ok: false, error: "Unknown speed." };
    const r = replaySnake(seed, level as SnakePace, recording);
    if (!r.ok) return r;
    const s = r.state;
    return {
      ok: true,
      finished: s.over,
      // The length always follows the score (3 + score / 10), so the tie-break is speed: fewer ticks to the same score ranks higher.
      rank: [s.score, -s.ticks],
      summary: `${String(s.score).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} points, length ${s.snake.length}`,
      score: s.score,
      ms: s.ms,
    };
  },
};
