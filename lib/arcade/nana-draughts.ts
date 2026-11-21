// Nana for Draughts (owner, 21 Nov 2026: "a free Nana for arcade [that won't cost us nor the players] where Nana suggests moves or
// analyze opponent moves"). Free means the hint is the same engine the computer plays with (lib/arcade/draughts.ts), run in the
// browser, and the words come from comparing the board before and after. Works for all three rule sets (African 10×10 and 8×8,
// English 8×8). Pure: no React, no DOM, no network.
import {
  applyMove, chooseMove, legalMoves, movesFor, rowOf, colOf, sizeOf,
  type DraughtsMove, type DraughtsState, type Player,
} from "./draughts";
import { listText, type NanaTake, type NanaTip } from "./nana";

export type DraughtsTip = { tip: NanaTip; highlight: { from: number; to: number } };

/**
 * The hint's search budget, in positions. A hint has to come back at once when tapped (well under ~300 ms on a phone), so it gets less
 * than the computer's NODE_BUDGET: measured on a laptop, 5000 positions on 10×10 take about 70 ms at worst and 8000 on 8×8 about the
 * same; a phone is a few times slower. Counting positions (not milliseconds) gives the same hint on every device.
 */
export const TIP_BUDGET: Record<8 | 10, number> = { 10: 5000, 8: 8000 };

const other = (p: Player): Player => (p === 0 ? 1 : 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The square's number in standard draughts notation: dark squares counted 1, 2, 3… row by row from the computer's side, so on 10×10
 * your men start on 31–50 and on 8×8 on 21–32. It's how draughts players talk about moves ("32 to 28").
 */
export const squareNumber = (i: number, n: number) => rowOf(i, n) * (n / 2) + Math.floor(colOf(i, n) / 2) + 1;

const landing = (m: DraughtsMove) => m.path[m.path.length - 1];

/** "the man on 32 to 28", "the king on 46 to 5, taking 2". */
export function moveLabel(state: DraughtsState, m: DraughtsMove): string {
  const n = sizeOf(state.board);
  const kind = state.board[m.from]?.king ? "king" : "man";
  const taking = m.captures.length ? `, taking ${m.captures.length}` : "";
  return `the ${kind} on ${squareNumber(m.from, n)} to ${squareNumber(landing(m), n)}${taking}`;
}

/** The most pieces `side` can take if it moves next on this board (0 when it has no capture). */
function threat(state: DraughtsState, side: Player): DraughtsMove | null {
  const caps = movesFor(state.board, side, state.rules).filter((m) => m.captures.length > 0);
  return caps.length ? caps.reduce((a, b) => (b.captures.length > a.captures.length ? b : a)) : null;
}

/** Can `side` take the piece on `sq` if it moved next? */
const canTake = (state: DraughtsState, side: Player, sq: number) =>
  movesFor(state.board, side, state.rules).some((m) => m.captures.includes(sq));

/**
 * After `after` (the other side to move), the worst trade they can force: for each of their captures, how many we take back.
 * Returns their best (captures they make minus what we take back), or null if they have no capture.
 */
function bestExchange(after: DraughtsState): { they: number; back: number } | null {
  if (after.over) return null;
  const caps = legalMoves(after).filter((m) => m.captures.length > 0);
  if (!caps.length) return null;
  let worst: { they: number; back: number } | null = null;
  for (const c of caps) {
    const next = applyMove(after, c);
    const back = next.over ? 0 : Math.max(0, ...legalMoves(next).map((m) => m.captures.length));
    if (!worst || c.captures.length - back > worst.they - worst.back) worst = { they: c.captures.length, back };
  }
  return worst;
}

/** Why the move is good, in plain words, from the position before and after it. */
export function explain(before: DraughtsState, m: DraughtsMove, after: DraughtsState): string {
  const me = before.turn, n = sizeOf(before.board);
  if (after.over && after.winner === me) return "It wins the game: they have no move left.";
  const reasons: string[] = [];
  const all = legalMoves(before);
  const forced = m.captures.length > 0;
  if (forced) {
    const options = new Set(all.map((x) => `${x.from}:${landing(x)}`)).size;
    // African rules only allow the biggest capture, so when it's more than one piece, say that's why.
    if (before.rules === "african" && (options > 1 || m.captures.length > 1)) reasons.push(`you must take, and this takes the most (${m.captures.length})`);
    else if (options > 1) reasons.push(`you must take, and this is the best way (${m.captures.length})`);
    else reasons.push(`you must take, and this is the only way (${m.captures.length})`);
  }
  if (m.crowns) reasons.push("it crowns a king");
  const ex = bestExchange(after);
  if (forced && !ex) reasons.push("they can't take back");
  else if (forced && m.captures.length - ex!.they + ex!.back > 0) reasons.push("you still come out ahead after they take back");
  else if (!forced && ex && ex.back > ex.they) reasons.push(`it gives ${ex.they === 1 ? "one" : ex.they} away on purpose: after they take, you take back ${ex.back}`);
  else if (!forced && canTake(before, other(me), m.from) && !canTake(after, other(me), landing(m))) reasons.push(`it gets your ${before.board[m.from]?.king ? "king" : "man"} out of danger`);
  if (!reasons.length) {
    const piece = before.board[m.from];
    const to = landing(m), row = rowOf(to, n);
    const far = me === 0 ? 0 : n - 1;
    if (piece && !piece.king && Math.abs(row - far) === 1 && !canTake(after, other(me), to)) reasons.push("it heads for the far row to crown next");
    else if (!threat(after, other(me))) {
      const col = colOf(to, n);
      reasons.push(col >= n / 2 - 2 && col <= n / 2 + 1 ? "it takes the centre and leaves them nothing to take" : "it keeps your pieces together and leaves them nothing to take");
    } else reasons.push("it's the safest move here: every other one loses more");
  }
  return cap(listText(reasons)) + ".";
}

/** What Nana would play for the side to move, with her reason and the squares to light up; null when the game is over. */
export function draughtsTip(state: DraughtsState, budget = TIP_BUDGET[sizeOf(state.board) === 10 ? 10 : 8]): DraughtsTip | null {
  if (state.over || !legalMoves(state).length) return null;
  // A fixed rng (0.5) makes the hint the same every time she's asked: among equally good moves she always picks the same one.
  const m = chooseMove(state, "hard", () => 0.5, budget);
  const after = applyMove(state, m);
  return { tip: { move: moveLabel(state, m), why: explain(state, m, after) }, highlight: { from: m.from, to: landing(m) } };
}

/**
 * Nana's take on the move just played (usually the computer's), spoken to the player who must now reply. One or two short sentences.
 * Tone is for the player: "risky" when they're about to lose pieces, "good" when the move hands them a free capture, "fine" otherwise.
 */
export function draughtsTake(before: DraughtsState, m: DraughtsMove, after: DraughtsState): NanaTake {
  const mover = before.turn, you = other(mover), n = sizeOf(before.board);
  if (after.over) {
    if (after.winner === mover) return { text: "That's the game to the computer. Have another go: I'll warn you sooner.", tone: "risky" };
    if (after.winner === "draw") return { text: "That's a draw: forty moves each without a capture.", tone: "fine" };
    return { text: "It has no move left. You win!", tone: "good" };
  }
  const piece = before.board[m.from];
  const crownText = m.crowns ? (before.rules === "african" ? " and crowned a king: kings fly, so watch the long diagonals" : " and crowned a king, which moves both ways") : "";
  let did: string;
  if (m.captures.length) did = `It took ${m.captures.length === 1 ? "one of yours" : `${m.captures.length} of yours`}${crownText}.`;
  else if (m.crowns) did = `It crowned a king${crownText.replace(" and crowned a king", "")}.`;
  else if (piece && !piece.king && Math.abs(rowOf(landing(m), n) - (mover === 0 ? 0 : n - 1)) === 1) did = "It's one step from crowning a king.";
  else did = `It moved ${piece?.king ? "its king" : "a man"} to ${squareNumber(landing(m), n)}.`;

  // Your reply is forced when you can take; say whether taking is safe or a trap.
  const ex = bestExchange(after);
  if (ex) {
    if (ex.back > ex.they) return { text: `${did} Careful: you must take ${ex.they}, but then it takes back ${ex.back}. Pick your capture carefully.`, tone: "risky" };
    if (ex.back === 0) return { text: `${did} You must take now, and it can't take back.`, tone: "good" };
    if (ex.they > ex.back) return { text: `${did} You must take ${ex.they} and it can only take back ${ex.back}: good for you.`, tone: "good" };
    return { text: `${did} It's offering a trade: you must take ${ex.they}, then it takes ${ex.back} back.`, tone: "fine" };
  }
  // Otherwise: is something of yours in danger next move?
  const danger = threat(after, mover);
  if (danger) {
    const sq = squareNumber(danger.captures[0], n);
    const more = danger.captures.length > 1 ? ` It could take ${danger.captures.length} in one go.` : "";
    return { text: `${did} Watch out: it threatens your piece on ${sq}.${more}`, tone: "risky" };
  }
  return { text: did, tone: m.captures.length ? "risky" : "fine" };
}
