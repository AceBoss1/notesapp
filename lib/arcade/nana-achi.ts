// Nana for Achi (owner, 21 Nov 2026: "a free Nana for arcade [that won't cost us nor the players] where Nana suggests moves or
// analyze opponent moves"). Everything here comes from lib/arcade/achi.ts itself: the hint is the solved-game move the computer
// plays on HARD, and the reasons are read off the board before and after. No AI service, so it costs nothing and works offline.
// Pure: no React or DOM.
import { LINES, applyMove, chooseMove, legalMoves, lineOf, other, phaseOf, scoreMoves, solvedValue, type AchiState, type Move, type Player } from "./achi";
import { listText, rateMove, type NanaTake, type NanaTip } from "./nana";

// The same names the board reads out (components/games/AchiGame.tsx), so a hint matches what a screen reader says.
export const POINT_NAMES = ["top left", "top middle", "top right", "left middle", "centre", "right middle", "bottom left", "bottom middle", "bottom right"];
// In the order of LINES in lib/arcade/achi.ts.
export const LINE_NAMES = ["top row", "bottom row", "left side", "right side", "diagonal from top left", "diagonal from top right", "middle row", "middle column"];

export type AchiHighlight = { from: number | null; to: number };

const lineName = (line: readonly number[]) => LINE_NAMES[LINES.findIndex((l) => l.every((i) => line.includes(i)))] ?? "line";
const moveLabel = (m: Move) => (m.kind === "place" ? `placing on the ${POINT_NAMES[m.to]}` : `sliding ${POINT_NAMES[m.from]} to ${POINT_NAMES[m.to]}`);
const sameMove = (a: Move, b: Move) => a.kind === b.kind && a.to === b.to && (a.kind === "place" || (b.kind === "move" && a.from === b.from));

/** The moves that would fill a line for `p` if it were their turn now (the threats they hold). */
export function winningMoves(s: AchiState, p: Player): Move[] {
  if (s.winner !== null) return [];
  const asIf: AchiState = { ...s, turn: p, seen: {} };
  return legalMoves(asIf).filter((m) => {
    const b = s.board.slice();
    if (m.kind === "move") b[m.from] = null;
    b[m.to] = p;
    return lineOf(b, p) !== null;
  });
}

// Where a threat would be filled: the empty point of a line holding two of p's pieces.
const threatPoints = (s: AchiState, p: Player) => [...new Set(winningMoves(s, p).map((m) => m.to))];
// The line a threat point completes for p.
function threatLine(s: AchiState, p: Player, point: number): readonly number[] | undefined {
  return LINES.find((l) => l.includes(point) && l.filter((i) => i !== point).every((i) => s.board[i] === p));
}

/** Why a move is good for the side making it, read off the board before and after. */
function reasons(before: AchiState, m: Move, after: AchiState, you: boolean): string[] {
  const me = before.turn;
  const them = other(me);
  const theirName = you ? "the computer" : "you";
  const mine = you ? "your" : "its";
  if (after.winner === me) {
    if (after.endReason === "stuck") return [you ? "the computer has no move left, so you win" : "you have no move left"];
    return [`it fills ${mine} ${lineName(after.winLine ?? [])}${you ? ", so you win" : ""}`];
  }
  const out: string[] = [];
  const blocked = threatPoints(before, them).filter((pt) => pt === m.to || !threatPoints(after, them).includes(pt));
  if (blocked.length) {
    const line = threatLine(before, them, blocked[0]);
    out.push(`it blocks ${you ? "the computer's" : "your"} ${line ? lineName(line) : "line"}`);
  }
  const threats = threatPoints(after, me);
  if (threats.length >= 2) out.push(`it makes two threats at once, and ${theirName} can only block one`);
  else if (threats.length === 1) {
    const line = threatLine(after, me, threats[0]);
    out.push(`it puts two on the ${line ? lineName(line) : "line"}, so ${theirName} must block the ${POINT_NAMES[threats[0]]}`);
  }
  if (!out.length && m.kind === "place" && m.to === 4) out.push("the centre sits on four lines, more than any other point");
  if (!out.length && after.winner === null) {
    // The game is solved: say what perfect play makes of the position, from the mover's side.
    const v = solvedValue(after).v; // from the side to move next, the opponent
    if (v === "loss") out.push(`with careful play from here, ${you ? "you" : "it"} can force a win`);
    else if (v === "draw") {
      const scored = scoreMoves(before, "hard");
      const losing = scored.filter((x) => x.score < 0).length;
      if (losing > 0 && losing === scored.length - 1) out.push(`every other move lets ${theirName} force a win`);
      else if (losing > 0) out.push(`some moves here let ${theirName} force a win, and this one doesn't`);
    }
  }
  return out;
}

/** What Nana would play for the side to move (the person, on their turn), the move to highlight, and why. Null when there's no move. */
export function achiTip(state: AchiState): { tip: NanaTip; highlight: AchiHighlight } | null {
  if (legalMoves(state).length === 0) return null;
  // HARD plays from the solved game; a fixed rng picks the same move every time among equals.
  const m = chooseMove(state, "hard", () => 0.5);
  const after = applyMove(state, m);
  const why = reasons(state, m, after, true);
  const text = why.length ? `${capital(listText(why))}.` : legalMoves(state).length === 1 ? "It's your only move." : "It keeps the game level. No move here does better.";
  return { tip: { move: moveLabel(m), why: text }, highlight: { from: m.kind === "move" ? m.from : null, to: m.to } };
}

const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Nana's take on the computer's move `m`, played from `before` to `after`: what it was for, and a warning if it now threatens a line. */
export function achiTake(before: AchiState, m: Move, after: AchiState): NanaTake | null {
  if (!legalMoves(before).some((x) => sameMove(x, m))) return null;
  const mover = before.turn;
  const scored = scoreMoves(before, "hard");
  const best = Math.max(...scored.map((x) => x.score));
  const score = scored.find((x) => sameMove(x.move, m))?.score ?? best;
  const tone = rateMove(score, best, 0);
  const what = m.kind === "place" ? `placed on the ${POINT_NAMES[m.to]}` : `slid from the ${POINT_NAMES[m.from]} to the ${POINT_NAMES[m.to]}`;
  const you = other(mover);

  if (after.winner === mover) {
    return { text: after.endReason === "stuck" ? "The computer hemmed you in: you have no move left." : `The computer filled its ${lineName(after.winLine ?? [])}. Good game. Try again?`, tone };
  }
  if (after.winner === "draw") return { text: `The computer ${what}. That's a draw.`, tone };

  const sentences: string[] = [];
  const blocked = threatPoints(before, you).filter((pt) => pt === m.to || !threatPoints(after, you).includes(pt));
  const threats = threatPoints(after, mover);
  if (blocked.length) {
    const line = threatLine(before, you, blocked[0]);
    sentences.push(`The computer blocked your ${line ? lineName(line) : "line"}.`);
  } else if (m.kind === "place" && m.to === 4) sentences.push("The computer took the centre, which sits on four lines.");
  else sentences.push(`The computer ${what}.`);

  // What you should look at next: a line of yours you can fill now, or its threat to block.
  const yours = threatPoints(after, you);
  if (yours.length) sentences.push(`You can fill a line now. Look at the ${POINT_NAMES[yours[0]]}.`);
  else if (threats.length >= 2) sentences.push(`It has two lines nearly done. Block the ${POINT_NAMES[threats[0]]} or the ${POINT_NAMES[threats[1]]}.`);
  else if (threats.length === 1) {
    const line = threatLine(after, mover, threats[0]);
    sentences.push(`Watch the ${line ? lineName(line) : "line"}: block the ${POINT_NAMES[threats[0]]} next.`);
  } else if (tone === "risky" && solvedValue(after).v === "win") sentences.push("That was a slip. You can win from here.");
  else if (phaseOf(before.board, mover) === "placing" && phaseOf(after.board, mover) === "moving" && phaseOf(after.board, you) === "moving") sentences.push("All six are down. Now slide yours along the lines.");
  return { text: sentences.join(" "), tone };
}
