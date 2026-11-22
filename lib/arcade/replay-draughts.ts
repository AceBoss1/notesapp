// Draughts in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and Puff-Puff";
// docs/ARCADE_TOURNAMENTS.md §3: "win, then fewest moves, against the computer at a set level"). Pure: no React, no Firestore.
//
// A tournament has one setting, its level, so the level carries the rules as well as the computer's strength: "african10-medium" is
// African rules on the 10×10 board against the medium computer (the default), "african8-hard" African on 8×8 against hard,
// "english-easy" English (always 8×8) against easy, and so on. The 40-moves-each draw rule is always on, so no game runs for ever.
// You play light from the bottom and move first, as in practice games; the start never varies.
//
// The browser records only your moves, in standard draughts numbering: the dark squares numbered 1, 2, 3… row by row from the top-left
// of the board as you see it (1–50 on 10×10, 1–32 on 8×8), "32-28" for a step and "28x19x10" for a capture, listing EVERY square the
// piece lands on, so a multi-jump (or a flying king's landing square) is never ambiguous. A last "resign" means you gave up.
// The server replays your moves with lib/arcade/draughts.ts and works out the computer's replies itself, so they must come out the same:
//   - the computer's search stops at a fixed number of positions (TOURNEY_BUDGET), never at a clock, so a slow phone and the server stop
//     at the same place;
//   - easy's slips and the pick between equally good moves draw from a generator seeded by the tournament seed and the move number,
//     never Math.random.
import type { ReplayResult, TournamentGame } from "./tournament-games";
import {
  applyMove, chooseMove, countPieces, initialState, isDark, legalMoves, seededRng, sizeOf,
  type BoardSize, type DraughtsMove, type DraughtsState, type Level, type Rules,
} from "./draughts";

export type DraughtsBoard = "african10" | "african8" | "english";
export const DRAUGHTS_BOARDS: Record<DraughtsBoard, { rules: Rules; size: BoardSize; label: string }> = {
  african10: { rules: "african", size: 10, label: "African 10×10" },
  african8: { rules: "african", size: 8, label: "African 8×8" },
  english: { rules: "english", size: 8, label: "English 8×8" },
};
const LEVEL_ORDER: Level[] = ["medium", "easy", "hard"];
/** Every rules-and-level pair a tournament can be set to; the first (African 10×10, medium) is the default. */
export const DRAUGHTS_LEVELS: string[] = (Object.keys(DRAUGHTS_BOARDS) as DraughtsBoard[]).flatMap((b) => LEVEL_ORDER.map((l) => `${b}-${l}`));

/** Reads a tournament level ("african10-medium") into its board and computer level, or null when it isn't one. */
export function parseDraughtsLevel(level: string): { board: DraughtsBoard; level: Level; rules: Rules; size: BoardSize } | null {
  if (!DRAUGHTS_LEVELS.includes(level)) return null;
  const [board, l] = level.split("-") as [DraughtsBoard, Level];
  return { board, level: l, rules: DRAUGHTS_BOARDS[board].rules, size: DRAUGHTS_BOARDS[board].size };
}

// The computer's search budget in positions: the game's own figures for a quick answer (the same as Nana's hints, lib/arcade/nana-draughts.ts
// TIP_BUDGET), so the server can replay a long game in well under a second. Fixed numbers: changing them changes every reply, so a
// running tournament must never see them change.
export const TOURNEY_BUDGET: Record<BoardSize, number> = { 10: 5000, 8: 8000 };
export const DRAUGHTS_MAX_MOVES = 1000; // your moves; the 40-move rule and the 40 pieces on the board end any real game long before
export const RESIGN = "resign";

/** The start both sides build: the browser to play, the server to replay. You play light and move first; the 40-move draw is on. */
export function draughtsTourneyStart(seed: number, level: string): DraughtsState {
  void seed; // the start never varies; the seed only steers the computer's choices (draughtsTourneyReply)
  const p = parseDraughtsLevel(level) ?? parseDraughtsLevel(DRAUGHTS_LEVELS[0])!;
  return initialState(undefined, { drawRule: true, first: 0, rules: p.rules, size: p.size });
}

/** The computer's tournament reply: the same in the browser and on the server, from the seed, the level and the position alone. */
export function draughtsTourneyReply(s: DraughtsState, level: Level, seed: number): DraughtsMove {
  const rng = seededRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(s.moves + 1, 0x85ebca6b)) >>> 0);
  return chooseMove(s, level, rng, TOURNEY_BUDGET[sizeOf(s.board) === 10 ? 10 : 8]);
}

/** A square's standard number: the dark squares counted 1, 2, 3… row by row from the top-left. */
export function squareNumber(i: number, n: number): number {
  let k = 0;
  for (let j = 0; j <= i; j++) if (isDark(j, n)) k++;
  return k;
}

/** One move in standard numbering: "32-28", or "28x19x10" with every landing square of a capture. */
export function encodeDraughtsMove(m: DraughtsMove, n: number): string {
  const sep = m.captures.length > 0 ? "x" : "-";
  return [m.from, ...m.path].map((i) => squareNumber(i, n)).join(sep);
}

/** The whole recording: your moves in order, then "resign" if you gave up. */
export const encodeDraughts = (moves: readonly DraughtsMove[], n: number, resigned = false): string =>
  [...moves.map((m) => encodeDraughtsMove(m, n)), ...(resigned ? [RESIGN] : [])].join(",");

export type DraughtsOutcome = "win" | "draw" | "loss";
export type DraughtsReplay =
  | { ok: true; state: DraughtsState; finished: boolean; outcome: DraughtsOutcome | null; resigned: boolean; moves: number; pieces: number }
  | { ok: false; error: string };

const TOKEN = /^[1-9]\d?(?:-[1-9]\d?|(?:x[1-9]\d?)+)$/;
const piecesLeft = (s: DraughtsState) => { const c = countPieces(s.board, 0); return c.men + c.kings; };

/** Replays your moves from the start, the computer replying to each. Refuses an illegal move, or anything after the end. */
export function replayDraughts(seed: number, level: string, recording: unknown): DraughtsReplay {
  const p = parseDraughtsLevel(level);
  if (!p) return { ok: false, error: "Unknown level." };
  if (typeof recording !== "string") return { ok: false, error: "That game couldn't be read." };
  if (recording.length > DRAUGHTS_TOURNAMENT.maxRecording) return { ok: false, error: "That game is too long." };
  const tokens = recording === "" ? [] : recording.split(",");
  if (tokens.length > DRAUGHTS_MAX_MOVES + 1) return { ok: false, error: "That game is too long." };
  let s = draughtsTourneyStart(seed, level);
  const n = sizeOf(s.board);
  let moves = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (s.over) return { ok: false, error: "That game carries on after it ended." };
    if (tok === RESIGN) {
      if (i !== tokens.length - 1) return { ok: false, error: "That game carries on after resigning." };
      return { ok: true, state: s, finished: true, outcome: "loss", resigned: true, moves, pieces: piecesLeft(s) };
    }
    if (!TOKEN.test(tok)) return { ok: false, error: "That game couldn't be read." };
    // Every legal move has exactly one spelling (its start and every landing square), so matching the spelling finds the move.
    const m = legalMoves(s).find((x) => encodeDraughtsMove(x, n) === tok);
    if (!m) return { ok: false, error: `Move ${moves + 1} (${tok}) isn't legal there.` };
    s = applyMove(s, m);
    moves++;
    if (s.over) continue;
    s = applyMove(s, draughtsTourneyReply(s, p.level, seed));
  }
  if (!s.over) return { ok: true, state: s, finished: false, outcome: null, resigned: false, moves, pieces: piecesLeft(s) };
  const outcome: DraughtsOutcome = s.winner === 0 ? "win" : s.winner === "draw" ? "draw" : "loss";
  return { ok: true, state: s, finished: true, outcome, resigned: false, moves, pieces: piecesLeft(s) };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export const DRAUGHTS_TOURNAMENT: TournamentGame = {
  slug: "draughts",
  name: "Draughts",
  levels: DRAUGHTS_LEVELS,
  rankedBy: "Wins first, then the fewest moves, then the most pieces left; a draw beats a loss, and a longer fight beats a quick loss",
  maxRecording: 16000,
  replay(seed: number, level: string, recording: unknown): ReplayResult {
    const r = replayDraughts(seed, level, recording);
    if (!r.ok) return r;
    const { outcome, moves, pieces } = r;
    if (!outcome) return { ok: true, finished: false, rank: [0, moves, pieces], summary: `Unfinished after ${plural(moves, "move")}`, score: 0 };
    const tier = outcome === "win" ? 2 : outcome === "draw" ? 1 : 0;
    const left = `${plural(pieces, "piece")} left`;
    const summary = outcome === "win" ? `Won in ${plural(moves, "move")} with ${left}`
      : outcome === "draw" ? `Draw after ${plural(moves, "move")} with ${left}`
      : r.resigned ? `Resigned after ${plural(moves, "move")}` : `Lost in ${plural(moves, "move")}`;
    // A points-like number in the same order as the main rank: wins 1000–2000 (fewer moves higher), draws 400–499, losses 0–399.
    const score = outcome === "win" ? 2000 - moves : outcome === "draw" ? 400 + Math.min(moves, 99) : Math.min(moves, 399);
    return { ok: true, finished: true, rank: [tier, outcome === "win" ? -moves : moves, pieces], summary, score };
  },
};
