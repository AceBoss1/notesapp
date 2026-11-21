// Nana for Chess (owner, 21 Nov 2026: "a free Nana for arcade [that won't cost us nor the players] where Nana suggests moves or analyze
// opponent moves"). Free means the hint is the same engine the computer plays with (lib/arcade/chess.ts), run in the browser, and the
// words are worked out by comparing the board before and after the move. Pure: no React, no DOM, no network.
import {
  BISHOP, BLACK, FLAG_CASTLE, KING, KNIGHT, LEVELS, PAWN, QUEEN, ROOK, VALUE, applyMove, gameStatus, legalMoves, pieceColor, pieceType,
  inCheck, searchBest, squareName, type ChessState, type Color, type Move, type SearchOptions,
} from "./chess";
import { listText, type NanaTake, type NanaTip } from "./nana";

const NAME = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
const CENTRE = new Set([27, 28, 35, 36]); // d4, e4, d5, e5
const MATE_NEAR = 100000 - 100; // chess.ts scores a mate as 100000 less the plies to it

/**
 * The hint's search budget. "Hard" depth, but capped by positions searched so a hint stays well under ~300 ms on a phone (a laptop
 * does it in a fraction of that); the time cap is only a safety net for a very slow device. Counting positions first keeps the hint
 * the same on every device.
 */
export const TIP_SEARCH: SearchOptions = { maxDepth: LEVELS.hard.maxDepth, maxNodes: 30000, timeMs: 250 };

export type ChessTip = { tip: NanaTip; highlight: { from: number; to: number } };

const opp = (c: Color): Color => (c === "w" ? "b" : "w");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The pieces of `by` that attack `sq` on this board (pins ignored: Nana is explaining, not proving). Each entry is a piece type.
 * Written here rather than exported from chess.ts so the engine's hot path stays untouched.
 */
export function attackers(board: readonly number[], sq: number, by: Color): number[] {
  const side = by === "b" ? BLACK : 0, out: number[] = [];
  const f = sq & 7, r = sq >> 3;
  const own = (x: number, y: number) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? board[y * 8 + x] : 0);
  const is = (pc: number, t: number) => pc !== 0 && (pc & BLACK) === side && (pc & 7) === t;
  const pr = by === "w" ? r - 1 : r + 1; // a pawn attacks forwards, so look one rank behind from its side
  for (const df of [-1, 1]) if (is(own(f + df, pr), PAWN)) out.push(PAWN);
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) if (is(own(f + df, r + dr), KNIGHT)) out.push(KNIGHT);
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) if ((df || dr) && is(own(f + df, r + dr), KING)) out.push(KING);
  for (const [df, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (let x = f + df, y = r + dr; x >= 0 && x < 8 && y >= 0 && y < 8; x += df, y += dr) {
      const pc = board[y * 8 + x];
      if (!pc) continue;
      const t = pc & 7, straight = df === 0 || dr === 0;
      if ((pc & BLACK) === side && (t === QUEEN || t === (straight ? ROOK : BISHOP))) out.push(t);
      break;
    }
  }
  return out;
}

/** True when the piece on `sq` can be won: attacked and not defended, or attacked by something worth less. */
function loose(board: readonly number[], sq: number): boolean {
  const pc = board[sq];
  if (!pc || (pc & 7) === KING) return false;
  const mine = pieceColor(pc);
  const att = attackers(board, sq, opp(mine));
  if (!att.length) return false;
  if (!attackers(board, sq, mine).length) return true;
  return Math.min(...att.map((t) => VALUE[t])) < VALUE[pc & 7];
}

/** The most valuable loose piece of `color`, or -1. */
function mostLoose(board: readonly number[], color: Color, skip = -1): number {
  let best = -1;
  for (let sq = 0; sq < 64; sq++) {
    const pc = board[sq];
    if (!pc || sq === skip || pieceColor(pc) !== color || !loose(board, sq)) continue;
    if (best < 0 || VALUE[pc & 7] > VALUE[board[best] & 7]) best = sq;
  }
  return best;
}

/** Material for `color` less the other side's, in centipawns (the engine's scale). */
function material(board: readonly number[], color: Color): number {
  let v = 0;
  for (const pc of board) if (pc) v += pieceColor(pc) === color ? VALUE[pc & 7] : -VALUE[pc & 7];
  return v;
}

/** "knight g1 to f3", "e2–e4", "castling king side". The board highlights it too, so plain words are enough. */
export function moveLabel(m: Move): string {
  if (m.flags & FLAG_CASTLE) return m.to > m.from ? "castling king side" : "castling queen side";
  const t = pieceType(m.piece);
  const path = `${squareName(m.from)}–${squareName(m.to)}`;
  if (t === PAWN) return m.promo ? `${path}, making a ${NAME[m.promo]}` : path;
  return `${NAME[t]} ${squareName(m.from)} to ${squareName(m.to)}`;
}

const isDevelopment = (s: ChessState, m: Move) => {
  const t = pieceType(m.piece), home = pieceColor(m.piece) === "w" ? 0 : 7;
  return (t === KNIGHT || t === BISHOP) && m.from >> 3 === home && s.fullmove <= 15;
};

/** Why a move is good, in plain words, from the position before and after it. `score` is the engine's view for the mover, if known. */
export function explain(before: ChessState, m: Move, after: ChessState, score?: number): string {
  const me = before.turn, them = opp(me);
  const st = gameStatus(after);
  if (st.result === "checkmate") return "It's checkmate: their king has nowhere to go.";
  const reasons: string[] = [];
  if (inCheck(before)) reasons.push("it gets your king out of check");
  if (m.promo) reasons.push(`it turns your pawn into a ${NAME[m.promo]}`);
  if (m.captured) {
    const what = `${NAME[pieceType(m.captured)]}${m.flags & 2 ? "" : ` on ${squareName(m.to)}`}`;
    const free = !attackers(after.board, m.to, them).length;
    const ahead = VALUE[pieceType(m.captured)] > VALUE[pieceType(m.piece)] + 50;
    reasons.push(`it takes their ${what}${free ? " for free" : ahead ? " and wins material" : ""}`);
  }
  if (st.check) reasons.push("it gives check");
  if (m.flags & FLAG_CASTLE) reasons.push("it tucks your king away safely and brings a rook into play");
  if (!m.captured && loose(before.board, m.from) && !loose(after.board, m.to)) reasons.push(`it gets your ${NAME[pieceType(m.piece)]} out of danger`);
  // Something of theirs the moved piece now hits, worth more than it or left undefended.
  const hit = mostLoose(after.board, them);
  if (hit >= 0 && attackers(after.board, hit, me).length && !loose(before.board, hit)) reasons.push(`it attacks their ${NAME[pieceType(after.board[hit])]} on ${squareName(hit)}`);
  if (!reasons.length && isDevelopment(before, m)) reasons.push(`it brings your ${NAME[pieceType(m.piece)]} into play`);
  if (!m.captured && CENTRE.has(m.to) && reasons.length < 2) reasons.push("it takes a share of the centre");
  if (score !== undefined && score > MATE_NEAR && !st.check) reasons.push("it sets up a checkmate soon");
  else if (score !== undefined && score > MATE_NEAR) reasons.push("checkmate follows soon");
  // Honest when every move loses something: the engine's score sits well below the material on the board now, and a hint
  // shouldn't sound like a win when it isn't.
  const tough = score !== undefined && score < material(before.board, me) - 150 ? " It's the least bad move here: the others lose more." : "";
  if (!reasons.length) {
    const danger = mostLoose(before.board, me);
    return (danger >= 0 && !loose(after.board, danger) ? `It looks after your ${NAME[pieceType(before.board[danger])]} on ${squareName(danger)}, which was in danger.` : "It keeps your pieces safe and working together.") + tough;
  }
  return cap(listText(reasons)) + "." + tough;
}

/** What Nana would play for the side to move, with her reason and the squares to light up; null when the game is over. */
export function chessTip(s: ChessState, opts: SearchOptions = {}): ChessTip | null {
  if (gameStatus(s).over) return null;
  // chooseMove(s, "hard") is exactly searchBest with the hard settings; calling searchBest here also gives the score, for "mate soon".
  const choice = searchBest(s, { ...TIP_SEARCH, ...opts });
  if (!choice) return null;
  const m = choice.move;
  return { tip: { move: moveLabel(m), why: explain(s, m, applyMove(s, m), choice.score) }, highlight: { from: m.from, to: m.to } };
}

/**
 * Nana's take on the move just played (usually the computer's), spoken to the player who must now reply. Short: one or two sentences
 * on what it was for and what to watch. Tone is for the player: "risky" when something of theirs is in danger, "good" when the move
 * hands them a chance, "fine" otherwise.
 */
export function chessTake(before: ChessState, m: Move, after: ChessState): NanaTake {
  const mover = before.turn, you = opp(mover);
  const st = gameStatus(after);
  const piece = NAME[pieceType(m.piece)];
  if (st.result === "checkmate") return { text: "Checkmate. That one got through. Have another go: I'll point out the danger sooner.", tone: "risky" };
  if (st.over) return { text: "That's a draw. Nobody can win from here.", tone: "fine" };

  let did: string;
  if (m.flags & FLAG_CASTLE) did = "It castled to keep its king safe.";
  else if (m.promo) did = `It made a new ${NAME[m.promo]} on ${squareName(m.to)}.`;
  else if (m.captured) {
    const back = legalMoves(after).some((x) => x.to === m.to);
    did = `It took your ${NAME[pieceType(m.captured)]}${back ? `, but you can take back on ${squareName(m.to)}` : ""}.`;
  } else if (isDevelopment(before, m)) did = `It brought a ${piece} out.`;
  else if (CENTRE.has(m.to)) did = `Its ${piece} is fighting for the centre.`;
  else did = `It moved its ${piece} to ${squareName(m.to)}.`;

  if (st.check) return { text: `Check! Its ${piece} on ${squareName(m.to)} is after your king. ${m.captured ? did + " " : ""}Get your king to safety first.`.replace(/\s+/g, " ").trim(), tone: "risky" };

  // A piece of yours it now threatens, ignoring the one it can be taken back on.
  const threat = mostLoose(after.board, you);
  if (threat >= 0 && (!loose(before.board, threat) || m.captured)) {
    return { text: `${did} Watch your ${NAME[pieceType(after.board[threat])]} on ${squareName(threat)}: it's under attack.`, tone: "risky" };
  }
  // A piece of its own it has left loose: a chance for you.
  const chance = mostLoose(after.board, mover);
  if (chance >= 0 && !m.captured) return { text: `${did} Look closely: its ${NAME[pieceType(after.board[chance])]} on ${squareName(chance)} is loose.`, tone: "good" };
  return { text: did, tone: m.captured ? "risky" : "fine" };
}
