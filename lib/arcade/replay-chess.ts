// Chess, recorded and replayed for tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §3: "win, then fewest
// moves, against the computer at a set level"). Pure. The entrant always plays White; the browser records only the entrant's moves in UCI
// ("e2e4,g1f3,e7e8q", and a last "resign" if they give up), and the server replays them with lib/arcade/chess.ts, working out the
// computer's replies itself. So the replies must come out the same in the browser and on the server:
//   - the search has a node budget only, never a clock (`timeMs: Infinity`, `now: () => 0`): a time cut-off would stop at a different
//     place on a slow phone than on the server and pick a different move;
//   - the "easy" level's loose picks draw from a generator seeded by the tournament seed and the move number, never Math.random.
import type { TournamentGame, ReplayResult } from "./tournament-games";
import {
  LEVELS, applyMove, chooseMove, gameStatus, initialState, legalMoves, squareName,
  type ChessState, type Level, type Move, type Result,
} from "./chess";

export const CHESS_LEVELS: Level[] = ["medium", "easy", "hard"];
export const CHESS_MAX_MOVES = 400; // the entrant's moves; far more than the fifty-move and repetition rules let a game run
export const RESIGN = "resign";

const PROMO_LETTER = ["", "", "n", "b", "r", "q"];

/** A move in UCI: from, to, and the promotion piece if any ("e7e8q"). What the replay reads back. */
export const uciOf = (m: Move): string => squareName(m.from) + squareName(m.to) + (m.promo ? PROMO_LETTER[m.promo] : "");

/** The whole recording: the entrant's moves in order, then "resign" if they gave up. */
export const encodeChess = (moves: readonly Move[], resigned = false): string => [...moves.map(uciOf), ...(resigned ? [RESIGN] : [])].join(",");

// mulberry32, seeded per reply from the tournament seed and the ply, so nothing has to be carried between moves (and the browser can't
// drift from the server by drawing an extra number somewhere).
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The number of half-moves played so far (the position keys run from the start, current one last). */
export const plyOf = (s: ChessState) => s.keys.length - 1;

/** The computer's tournament reply: the same in the browser and on the server, from the seed, the level and the position alone. */
export function tourneyReply(s: ChessState, level: Level, seed: number): Move | null {
  const rng = seededRng((Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(plyOf(s) + 1, 0x85ebca6b)) >>> 0);
  return chooseMove(s, level, rng, { ...LEVELS[level], timeMs: Infinity, now: () => 0 });
}

export type ChessOutcome = "win" | "draw" | "loss";
export type ChessReplay =
  | { ok: true; state: ChessState; finished: boolean; outcome: ChessOutcome | null; result: Result | "resign" | null; moves: number }
  | { ok: false; error: string };

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Replays the entrant's moves from the start, the computer replying to each. Refuses an illegal move, or anything after the end. */
export function replayChess(seed: number, level: Level, recording: unknown): ChessReplay {
  if (typeof recording !== "string") return { ok: false, error: "That game couldn't be read." };
  if (recording.length > CHESS_TOURNAMENT.maxRecording) return { ok: false, error: "That game is too long." };
  const tokens = recording === "" ? [] : recording.split(",");
  if (tokens.length > CHESS_MAX_MOVES + 1) return { ok: false, error: "That game is too long." };
  let s = initialState();
  let moves = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (gameStatus(s).over) return { ok: false, error: "That game carries on after it ended." };
    if (tok === RESIGN) {
      if (i !== tokens.length - 1) return { ok: false, error: "That game carries on after resigning." };
      return { ok: true, state: s, finished: true, outcome: "loss", result: "resign", moves };
    }
    if (!UCI.test(tok)) return { ok: false, error: "That game couldn't be read." };
    const m = legalMoves(s).find((x) => uciOf(x) === tok);
    if (!m) return { ok: false, error: `Move ${moves + 1} (${tok}) isn't legal there.` };
    s = applyMove(s, m);
    moves++;
    if (gameStatus(s).over) continue;
    const reply = tourneyReply(s, level, seed);
    if (!reply) return { ok: false, error: "The computer had no move." }; // can't happen: the game isn't over
    s = applyMove(s, reply);
  }
  const st = gameStatus(s);
  if (!st.over) return { ok: true, state: s, finished: false, outcome: null, result: null, moves };
  const outcome: ChessOutcome = st.winner === "w" ? "win" : st.winner === "b" ? "loss" : "draw";
  return { ok: true, state: s, finished: true, outcome, result: st.result, moves };
}

const DRAW_WORD: Record<string, string> = {
  stalemate: "stalemate", insufficient: "not enough pieces", fifty: "fifty-move rule", threefold: "threefold repetition",
};
const plural = (n: number) => `${n} move${n === 1 ? "" : "s"}`;

export const CHESS_TOURNAMENT: TournamentGame = {
  slug: "chess",
  name: "Chess",
  levels: CHESS_LEVELS,
  rankedBy: "Wins first, then the fewest moves; a draw beats a loss, and a longer fight beats a quick loss",
  maxRecording: CHESS_MAX_MOVES * 6 + RESIGN.length,
  replay(seed: number, level: string, recording: unknown): ReplayResult {
    if (!CHESS_LEVELS.includes(level as Level)) return { ok: false, error: "Unknown level." };
    const r = replayChess(seed, level as Level, recording);
    if (!r.ok) return r;
    const { outcome, moves } = r;
    if (!outcome) return { ok: true, finished: false, rank: [0, moves], summary: `Unfinished after ${plural(moves)}`, score: 0 };
    const tier = outcome === "win" ? 2 : outcome === "draw" ? 1 : 0;
    const summary = outcome === "win" ? `Won in ${plural(moves)}`
      : outcome === "draw" ? `Draw (${DRAW_WORD[r.result ?? "stalemate"]}) after ${plural(moves)}`
      : r.result === "resign" ? `Resigned after ${plural(moves)}` : `Lost in ${plural(moves)}`;
    // A points-like number in the same order as the rank: wins 600–1000 (fewer moves higher), draws 400–499, losses 0–399.
    const score = outcome === "win" ? 1000 - moves : outcome === "draw" ? 400 + Math.min(moves, 99) : Math.min(moves, 399);
    return { ok: true, finished: true, rank: [tier, outcome === "win" ? -moves : moves], summary, score };
  },
};
