// Achi in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and Puff-Puff").
// Pure: no React, no Firestore.
//
// Same deal for everyone: you v the computer at the tournament's level, and YOU place first (the start is fixed). The default level is
// medium. Hard plays from the solved game (lib/arcade/achi.ts solve): the first player wins with perfect play (in 5 turns), so against
// hard only flawless play wins and any slip loses or draws; medium can be beaten more than one way and still punishes mistakes, so it
// spreads a leaderboard better. Hard stays on the list for an "experts only" tournament.
//
// The browser records only your turns: "p4" (place on point 4) or "m3-4" (slide from 3 to 4), and a last "resign" if you give up. The
// server replays them with lib/arcade/achi.ts and works out the computer's turns itself, so they must come out the same in both places:
// hard reads the solved table, medium searches a fixed 4 plies (no clock), and every random pick (easy's anywhere-move, the choice
// between equally good moves) draws from a generator seeded by the tournament seed and the turn number, never Math.random.
import type { ReplayResult, TournamentGame } from "./tournament-games";
import { applyMove, chooseMove, initialState, legalMoves, piecesOf, seededRng, type AchiState, type Level, type Move } from "./achi";

export const ACHI_LEVELS: Level[] = ["medium", "easy", "hard"];
export const RESIGN = "resign";
// The game is drawn after 60 places and moves in all (lib/arcade/achi.ts MOVE_CAP), so you get at most 30 turns.
export const ACHI_MAX_TURNS = 30;

/** The start both sides build: the browser to play, the server to replay. The board is empty and you place first. */
export function achiTourneyStart(seed: number, level: string): AchiState {
  void seed; void level; // the start never varies; the seed only steers the computer's choices (achiTourneyReply)
  return initialState(0);
}

/** The computer's tournament turn: the same in the browser and on the server, from the seed, the level and the position alone. */
export function achiTourneyReply(s: AchiState, level: Level, seed: number): Move {
  const rng = seededRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(s.plies + 1, 0x85ebca6b)) >>> 0);
  return chooseMove(s, level, rng);
}

/** One of your turns as the recording spells it: "p4" or "m3-4". */
export const encodeAchiMove = (m: Move): string => (m.kind === "place" ? `p${m.to}` : `m${m.from}-${m.to}`);
/** The whole recording: your turns in order, then "resign" if you gave up. */
export const encodeAchi = (moves: readonly Move[], resigned = false): string =>
  [...moves.map(encodeAchiMove), ...(resigned ? [RESIGN] : [])].join(",");

export type AchiOutcome = "win" | "draw" | "loss";
export type AchiReplay =
  | { ok: true; state: AchiState; finished: boolean; outcome: AchiOutcome | null; resigned: boolean; turns: number; pieces: number }
  | { ok: false; error: string };

const TOKEN = /^(?:p[0-8]|m[0-8]-[0-8])$/;

/** Replays your turns from the start, the computer answering each. Refuses an illegal turn, or anything after the end. */
export function replayAchi(seed: number, level: Level, recording: unknown): AchiReplay {
  if (typeof recording !== "string") return { ok: false, error: "That game couldn't be read." };
  if (recording.length > ACHI_TOURNAMENT.maxRecording) return { ok: false, error: "That game is too long." };
  const tokens = recording === "" ? [] : recording.split(",");
  if (tokens.length > ACHI_MAX_TURNS + 1) return { ok: false, error: "That game is too long." };
  let s = achiTourneyStart(seed, level);
  let turns = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (s.winner !== null) return { ok: false, error: "That game carries on after it ended." };
    if (tok === RESIGN) {
      if (i !== tokens.length - 1) return { ok: false, error: "That game carries on after resigning." };
      return { ok: true, state: s, finished: true, outcome: "loss", resigned: true, turns, pieces: piecesOf(s.board, 0) };
    }
    if (!TOKEN.test(tok)) return { ok: false, error: "That game couldn't be read." };
    const m = legalMoves(s).find((x) => encodeAchiMove(x) === tok);
    if (!m) return { ok: false, error: `Turn ${turns + 1} (${tok}) isn't legal there.` };
    s = applyMove(s, m);
    turns++;
    if (s.winner !== null) continue;
    s = applyMove(s, achiTourneyReply(s, level, seed));
  }
  if (s.winner === null) return { ok: true, state: s, finished: false, outcome: null, resigned: false, turns, pieces: piecesOf(s.board, 0) };
  const outcome: AchiOutcome = s.winner === 0 ? "win" : s.winner === "draw" ? "draw" : "loss";
  return { ok: true, state: s, finished: true, outcome, resigned: false, turns, pieces: piecesOf(s.board, 0) };
}

const plural = (n: number) => `${n} turn${n === 1 ? "" : "s"}`;

export const ACHI_TOURNAMENT: TournamentGame = {
  slug: "achi",
  name: "Achi",
  levels: ACHI_LEVELS,
  rankedBy: "Wins first, then the fewest turns; a draw beats a loss, and a longer fight beats a quick loss",
  maxRecording: ACHI_MAX_TURNS * 6 + RESIGN.length,
  replay(seed: number, level: string, recording: unknown): ReplayResult {
    if (!ACHI_LEVELS.includes(level as Level)) return { ok: false, error: "Unknown level." };
    const r = replayAchi(seed, level as Level, recording);
    if (!r.ok) return r;
    const { outcome, turns } = r;
    if (!outcome) return { ok: true, finished: false, rank: [0, turns], summary: `Unfinished after ${plural(turns)}`, score: 0 };
    const tier = outcome === "win" ? 2 : outcome === "draw" ? 1 : 0;
    const summary = outcome === "win" ? `Won in ${plural(turns)}`
      : outcome === "draw" ? `Draw after ${plural(turns)}`
      : r.resigned ? `Resigned after ${plural(turns)}` : `Lost in ${plural(turns)}`;
    // A points-like number in the same order as the rank: wins 900–1000 (fewer turns higher), draws 400–499, losses 0–99.
    const score = outcome === "win" ? 1000 - turns : outcome === "draw" ? 400 + turns : turns;
    return { ok: true, finished: true, rank: [tier, outcome === "win" ? -turns : turns], summary, score };
  },
};
