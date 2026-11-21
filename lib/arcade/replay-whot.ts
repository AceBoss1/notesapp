// Whot in tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §3, "Same deal"). Pure: no React, no Firestore.
//
// Every entrant gets the same deal: the deck is shuffled by mulberry32(tournament seed), and YOU always lead (so the first move isn't a
// coin toss that some entrants win and others lose). The computer has one way of playing (lib/arcade/whot.ts computerMove), which reads only
// the state, and reshuffles of the market come from state.seed, so the whole game follows from the seed plus the player's own moves.
// That's all the browser records: the player's moves, one token each. The server alternates them with the computer's replies here and
// works out the result itself.
import { applyMove, computerMove, initialState, legalMoves, mulberry32, type Shape, type WhotMove, type WhotState } from "./whot";
import type { ReplayResult, TournamentGame } from "./tournament-games";

/** The computer has a single strategy, so a Whot tournament has a single level. */
export const WHOT_LEVELS = ["standard"];

/** The start both sides build: the browser to deal, the server to replay. Same seed, same deal, you lead. */
export function whotTourneyStart(seed: number, level: string): WhotState {
  void level; // one level today; kept in the signature so a harder computer can be added without changing callers
  return initialState(mulberry32(seed), 0);
}

// The recording: the player's moves joined by commas, e.g. "2,m,0,4,S,1".
//   a number  play the card at that position in your hand (0 is the first card shown)
//   m         go to market (pick one, or pick the two/three waiting)
//   C T X Q S after your Whot 20, ask for circle, triangle, cross, sQuare or Star
// Positions are plain decimals with no leading zeros, so each game has exactly one spelling.
const CALL_CODE: Record<Shape, string> = { circle: "C", triangle: "T", cross: "X", square: "Q", star: "S" };
const CODE_CALL: Record<string, Shape> = { C: "circle", T: "triangle", X: "cross", Q: "square", S: "star" };
const TOKEN = /^(?:0|[1-9]\d?|m|[CTXQS])$/;

export function encodeWhotMove(m: WhotMove): string {
  if (m.type === "draw") return "m";
  if (m.type === "call") return CALL_CODE[m.shape];
  return String(m.index);
}

/** The moves in a recording, or null when it can't be read. An empty string is no moves. */
export function decodeWhotMoves(recording: unknown): WhotMove[] | null {
  if (typeof recording !== "string") return null;
  if (recording === "") return [];
  const out: WhotMove[] = [];
  for (const t of recording.split(",")) {
    if (!TOKEN.test(t)) return null;
    if (t === "m") out.push({ type: "draw" });
    else if (CODE_CALL[t]) out.push({ type: "call", shape: CODE_CALL[t] });
    else out.push({ type: "play", index: Number(t) });
  }
  return out;
}

/** Lets the computer play until it's your turn or the game is over (the browser does the same, one move at a time with a pause). */
export function whotComputerTurns(s: WhotState): WhotState {
  let g = s;
  // Each computer move either sheds a card or passes the turn, so this ends; the cap is only a belt for the server.
  for (let i = 0; i < 500 && g.phase !== "over" && g.turn === 1; i++) g = applyMove(g, computerMove(g));
  return g;
}

const same = (a: WhotMove, b: WhotMove) =>
  a.type === b.type && (a.type !== "play" || a.index === (b as typeof a).index) && (a.type !== "call" || a.shape === (b as typeof a).shape);

export type WhotReplay = { ok: true; state: WhotState; moves: number } | { ok: false; error: string };

/** Replays your moves from the seed, the computer answering each one exactly as it does in the browser. */
export function replayWhot(seed: number, level: string, recording: unknown): WhotReplay {
  const moves = decodeWhotMoves(recording);
  if (!moves) return { ok: false, error: "That game couldn't be read." };
  let s = whotComputerTurns(whotTourneyStart(seed, level));
  for (const m of moves) {
    if (s.phase === "over") return { ok: false, error: "That game carries on after it ended." };
    if (!legalMoves(s).some((l) => same(l, m))) return { ok: false, error: "That game has a move the rules don't allow." };
    s = whotComputerTurns(applyMove(s, m));
  }
  return { ok: true, state: s, moves: moves.length };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export const WHOT_TOURNAMENT: TournamentGame = {
  slug: "whot",
  name: "Whot",
  levels: WHOT_LEVELS,
  rankedBy: "Wins first, then the most cards left in the computer's hand, then the fewest moves",
  // About two characters a move; 4,000 is far more than any real game takes (most finish in under 60 moves).
  maxRecording: 4000,
  replay(seed, level, recording): ReplayResult {
    if (!WHOT_LEVELS.includes(level)) return { ok: false, error: "That level isn't one Whot has." };
    const r = replayWhot(seed, level, recording);
    if (!r.ok) return r;
    const s = r.state;
    const won = s.phase === "over" && s.winner === 0;
    const theirs = s.hands[1].length;
    const mine = s.hands[0].length;
    // Doc §3: the win first, then the cards the computer was left holding (a bigger beating ranks higher), then the fewest moves.
    // A loss ranks by how close you came: fewer cards left in your own hand.
    const rank = [won ? 1 : 0, won ? theirs : -mine, -r.moves];
    // Points for the leaderboard, never out of order with `rank`: a win is 1,000 plus 100 a card left to the computer, less up to 99
    // for moves (so a card always outweighs any number of moves); a loss is 100 less 10 a card still in your hand, never below 0.
    const score = won ? 1000 + 100 * theirs - Math.min(r.moves, 99) : Math.max(0, 100 - 10 * mine);
    const summary = s.phase !== "over"
      ? `Unfinished, ${plural(r.moves, "move")}`
      : won
        ? `Won with ${plural(theirs, "card")} left to the computer, ${plural(r.moves, "move")}`
        : `Lost, ${plural(mine, "card")} left in your hand`;
    return { ok: true, finished: s.phase === "over", rank, summary, score };
  },
};
