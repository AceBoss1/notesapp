// Puff-Puff Rush in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and
// Puff-Puff"; docs/ARCADE_TOURNAMENTS.md §3, "Same deal"). Pure: no React, no Firestore.
//
// The game is already deterministic (lib/arcade/puffpuff.ts: no Math.random, no clock; the goats' choices come from the seed kept in the
// state, and the markets come in a fixed order), so every entrant meets the same goats in the same markets at the tournament's speed. The
// browser records every frame it stepped, as the frame's time in whole milliseconds and the direction pressed on that frame, and the server
// steps the same code through the same frames from the same seed and works the score out itself.
//
// A try ends at the first of: losing your last life, clearing PUFF_TOURNEY_MARKETS markets (three times round all three), or
// PUFF_TOURNEY_MAX_MS of game time. The last two keep every try bounded however well (or slowly) someone rides; tries expire after 30
// minutes on the server anyway, and pausing stops game time, so the cap is on riding, not on breathers.
import { initialState, step, type Dir, type PuffState, type Speed } from "./puffpuff";
import type { ReplayResult, TournamentGame } from "./tournament-games";

// "normal" first: it's the default, the speed the game starts at.
export const PUFF_LEVELS: Speed[] = ["normal", "chill", "fast"];
export const PUFF_TOURNEY_MARKETS = 9;
export const PUFF_TOURNEY_MAX_MS = 15 * 60_000;
/** The longest frame recorded: PuffPuffGame never steps more than 100 ms in one frame. */
export const PUFF_MAX_STEP_MS = 100;
/** 15 minutes of frames at 240 Hz is 216,000; a real try always fits. */
export const PUFF_MAX_STEPS = 250_000;

const DIR_CODES: (Dir | null)[] = [null, "up", "left", "down", "right"];

/** The frame time the game actually steps with in a tournament: whole milliseconds, 1 to 100. */
export const puffStepDt = (dtMs: number) => Math.min(PUFF_MAX_STEP_MS, Math.max(1, Math.round(dtMs)));

// One frame is two base-36 characters (no separators), the number dt × 5 + direction (0 none, 1 up, 2 left, 3 down, 4 right): from "05"
// (1 ms, nothing pressed) to "e0" (100 ms, right). Fixed width keeps a 15-minute try well under a megabyte, and has one spelling per run.
export function encodePuffStep(dtMs: number, dir: Dir | null): string {
  return (puffStepDt(dtMs) * 5 + Math.max(0, DIR_CODES.indexOf(dir))).toString(36).padStart(2, "0");
}

/** The start both sides build: the browser to play, the server to replay. */
export function puffTourneyStart(seed: number, level: string): PuffState {
  return initialState({ seed, speed: level as Speed });
}

/** Markets cleared so far: every market before the one you're on, plus this one once its last puff-puff is gone. */
export const puffMarkets = (s: PuffState) => s.level - 1 + (s.phase === "cleared" ? 1 : 0);

/** Why the try is over, or null while it carries on. The game and the replay both stop on the step that makes this non-null. */
export function puffTourneyEnd(s: PuffState): "caught" | "markets" | "time" | null {
  if (s.phase === "over") return "caught";
  if (puffMarkets(s) >= PUFF_TOURNEY_MARKETS) return "markets";
  if (s.timeMs >= PUFF_TOURNEY_MAX_MS) return "time";
  return null;
}

export type PuffReplay = { ok: true; state: PuffState; steps: number } | { ok: false; error: string };

/** Replays a recording from the seed at the speed. Nothing is accepted after the try has ended. */
export function replayPuff(seed: number, level: string, recording: unknown): PuffReplay {
  if (typeof recording !== "string" || recording.length % 2 !== 0 || !/^[0-9a-z]*$/.test(recording)) {
    return { ok: false, error: "That run couldn't be read." };
  }
  const steps = recording.length / 2;
  if (steps > PUFF_MAX_STEPS) return { ok: false, error: "That run is too long." };
  let s = puffTourneyStart(seed, level);
  for (let i = 0; i < steps; i++) {
    if (puffTourneyEnd(s)) return { ok: false, error: "That run carries on after it ended." };
    const n = parseInt(recording.slice(2 * i, 2 * i + 2), 36);
    const dt = Math.floor(n / 5);
    if (dt < 1 || dt > PUFF_MAX_STEP_MS) return { ok: false, error: "That run couldn't be read." };
    const dir = DIR_CODES[n % 5];
    s = step(s, dt, dir ? { dir } : {});
  }
  return { ok: true, state: s, steps };
}

const n = (x: number) => x.toLocaleString("en-US");

export const PUFFPUFF_TOURNAMENT: TournamentGame = {
  slug: "puffpuff",
  name: "Puff-Puff Rush",
  levels: PUFF_LEVELS,
  rankedBy: "Highest score, then the most markets cleared, then the quickest",
  maxRecording: PUFF_MAX_STEPS * 2,
  replay(seed, level, recording): ReplayResult {
    if (!(PUFF_LEVELS as string[]).includes(level)) return { ok: false, error: "That speed isn't one Puff-Puff Rush has." };
    const r = replayPuff(seed, level, recording);
    if (!r.ok) return r;
    const s = r.state;
    const markets = puffMarkets(s);
    const ms = s.timeMs; // every recorded frame is 1–100 ms, under step's own 250 ms cap, so this is the sum of the frames
    return {
      ok: true,
      finished: puffTourneyEnd(s) !== null,
      rank: [s.score, markets, -Math.round(ms / 1000)],
      summary: `${n(s.score)} points · ${markets} ${markets === 1 ? "market" : "markets"}`,
      score: s.score,
      ms,
    };
  },
};
