// Achi: a three-in-a-line game. Pure logic, no React or DOM.
//
// Points are numbered row by row:   0 — 1 — 2
//                                   | \ | / |
//                                   3 — 4 — 5
//                                   | / | \ |
//                                   6 — 7 — 8
// Eight lines (owner, 21 Nov 2026, replacing the earlier six-line board): the four outer edges, the middle row and
// middle column through the centre, and the two diagonals. Pieces slide along any line to the next point, and three
// of yours on any of the eight lines wins.

export type Player = 0 | 1; // 0 = you, 1 = the computer
export type Cell = Player | null;
export type Level = "easy" | "medium" | "hard";
export type Move = { kind: "place"; to: number } | { kind: "move"; from: number; to: number };
export type EndReason = "line" | "stuck" | "repetition" | "cap";

export type AchiState = {
  board: Cell[];
  turn: Player;
  startedBy: Player;
  plies: number; // every place and move counts
  winner: Player | "draw" | null;
  endReason: EndReason | null;
  winLine: number[] | null;
  seen: Record<string, number>; // position (board + turn) → times it has occurred, for the repetition draw
  last: Move | null;
};

export const PIECES = 3;
export const MOVE_CAP = 60; // no winner after 60 places and moves: a draw
export const REPEATS = 3; // the same position a third time: a draw

export const LINES: readonly (readonly number[])[] = [
  [0, 1, 2], // top
  [6, 7, 8], // bottom
  [0, 3, 6], // left
  [2, 5, 8], // right
  [0, 4, 8], // diagonal
  [2, 4, 6], // diagonal
  [3, 4, 5], // middle row
  [1, 4, 7], // middle column
];

// Neighbours along the lines: consecutive points on each line.
export const ADJACENT: readonly number[][] = (() => {
  const adj: number[][] = Array.from({ length: 9 }, () => []);
  for (const line of LINES) {
    for (let i = 0; i + 1 < line.length; i++) {
      adj[line[i]].push(line[i + 1]);
      adj[line[i + 1]].push(line[i]);
    }
  }
  return adj.map((a) => a.sort((x, y) => x - y));
})();

export const other = (p: Player): Player => (p === 0 ? 1 : 0);

export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const boardKey = (board: Cell[]) => board.map((c) => (c === null ? "." : String(c))).join("");
const posKey = (board: Cell[], turn: Player) => `${boardKey(board)}${turn}`;

export function initialState(first: Player = 0): AchiState {
  const board: Cell[] = Array(9).fill(null);
  return { board, turn: first, startedBy: first, plies: 0, winner: null, endReason: null, winLine: null, seen: { [posKey(board, first)]: 1 }, last: null };
}

export const piecesOf = (board: Cell[], p: Player) => board.reduce((n: number, c) => n + (c === p ? 1 : 0), 0);
// You place until your three are down, then you move.
export const phaseOf = (board: Cell[], p: Player): "placing" | "moving" => (piecesOf(board, p) < PIECES ? "placing" : "moving");

export function lineOf(board: Cell[], p: Player): number[] | null {
  for (const line of LINES) if (line.every((i) => board[i] === p)) return [...line];
  return null;
}

function movesOn(board: Cell[], p: Player): Move[] {
  const out: Move[] = [];
  if (phaseOf(board, p) === "placing") {
    for (let i = 0; i < 9; i++) if (board[i] === null) out.push({ kind: "place", to: i });
    return out;
  }
  for (let i = 0; i < 9; i++) {
    if (board[i] !== p) continue;
    for (const j of ADJACENT[i]) if (board[j] === null) out.push({ kind: "move", from: i, to: j });
  }
  return out;
}

// Hemmed in: in the moving phase with every neighbour of every piece taken. On this board that can only happen
// once a line is already filled (tests/arcade/achi.test.ts checks every position), but the rule stands.
export const cannotMove = (board: Cell[], p: Player) => movesOn(board, p).length === 0;

export function legalMoves(s: AchiState): Move[] {
  return s.winner !== null ? [] : movesOn(s.board, s.turn);
}

export const targetsFrom = (s: AchiState, from: number): number[] =>
  legalMoves(s).flatMap((m) => (m.kind === "move" && m.from === from ? [m.to] : []));

const sameMove = (a: Move, b: Move) => a.kind === b.kind && a.to === b.to && (a.kind === "place" || (b.kind === "move" && a.from === b.from));
export const isLegal = (s: AchiState, m: Move) => legalMoves(s).some((x) => sameMove(x, m));

function boardAfter(board: Cell[], p: Player, m: Move): Cell[] {
  const b = board.slice();
  if (m.kind === "move") b[m.from] = null;
  b[m.to] = p;
  return b;
}

// Plays a move and settles the game: a line wins at once; a player left with no move loses; then the draws.
export function applyMove(s: AchiState, m: Move): AchiState {
  if (!isLegal(s, m)) throw new Error(`Illegal move ${JSON.stringify(m)}`);
  const mover = s.turn;
  const board = boardAfter(s.board, mover, m);
  const turn = other(mover);
  const plies = s.plies + 1;
  const key = posKey(board, turn);
  const seen = { ...s.seen, [key]: (s.seen[key] ?? 0) + 1 };
  const base = { ...s, board, turn, plies, seen, last: m };
  const line = lineOf(board, mover);
  if (line) return { ...base, winner: mover, endReason: "line", winLine: line };
  if (cannotMove(board, turn)) return { ...base, winner: mover, endReason: "stuck" };
  if (seen[key] >= REPEATS) return { ...base, winner: "draw", endReason: "repetition" };
  if (plies >= MOVE_CAP) return { ...base, winner: "draw", endReason: "cap" };
  return base;
}

// ---- The computer ----

// Perfect play: the whole game is solved once by working back from finished positions (about 3,000 of them, so it's instant).
// Value is from the side to move: "win"/"loss" with how many plies to the end, or "draw" if neither side can force it.
type Solved = { v: "win" | "loss" | "draw"; d: number };
let solvedCache: Map<string, Solved> | null = null;

function terminalValue(board: Cell[], turn: Player): Solved | null {
  if (lineOf(board, other(turn))) return { v: "loss", d: 0 };
  if (cannotMove(board, turn)) return { v: "loss", d: 0 };
  return null;
}

export function solve(): Map<string, Solved> {
  if (solvedCache) return solvedCache;
  const states: { board: Cell[]; turn: Player; key: string }[] = [];
  const build = (i: number, board: Cell[], a: number, b: number) => {
    if (i === 9) {
      for (const turn of [0, 1] as Player[]) states.push({ board: board.slice(), turn, key: posKey(board, turn) });
      return;
    }
    board[i] = null; build(i + 1, board, a, b);
    if (a < PIECES) { board[i] = 0; build(i + 1, board, a + 1, b); }
    if (b < PIECES) { board[i] = 1; build(i + 1, board, a, b + 1); }
    board[i] = null;
  };
  build(0, Array(9).fill(null), 0, 0);

  const solved = new Map<string, Solved>();
  const children = new Map<string, string[]>();
  for (const st of states) {
    const t = terminalValue(st.board, st.turn);
    if (t) { solved.set(st.key, t); continue; }
    children.set(st.key, movesOn(st.board, st.turn).map((m) => posKey(boardAfter(st.board, st.turn, m), other(st.turn))));
  }
  // Round by round, so the distances come out exact: a win is the quickest, a loss the slowest.
  for (let changed = true; changed;) {
    changed = false;
    const round: [string, Solved][] = [];
    for (const [key, kids] of children) {
      if (solved.has(key)) continue;
      const vals = kids.map((k) => solved.get(k));
      const losses = vals.filter((v): v is Solved => v?.v === "loss");
      if (losses.length) { round.push([key, { v: "win", d: Math.min(...losses.map((x) => x.d)) + 1 }]); continue; }
      if (vals.every((v) => v?.v === "win")) round.push([key, { v: "loss", d: Math.max(...vals.map((x) => x!.d)) + 1 }]);
    }
    for (const [k, v] of round) { solved.set(k, v); changed = true; }
  }
  for (const key of children.keys()) if (!solved.has(key)) solved.set(key, { v: "draw", d: 0 });
  solvedCache = solved;
  return solved;
}

export function solvedValue(s: AchiState): Solved {
  return solve().get(posKey(s.board, s.turn))!;
}

// Score of a move for the mover, from the solved table: quick wins first, then draws, then the slowest loss.
function perfectScore(s: AchiState, m: Move): number {
  const child = solve().get(posKey(boardAfter(s.board, s.turn, m), other(s.turn)))!;
  if (child.v === "loss") return 1000 - child.d;
  if (child.v === "draw") return 0;
  return -1000 + child.d;
}

// Medium: look a few plies ahead and judge the rest by a simple feel for the board.
export const LEVEL_DEPTH: Record<Exclude<Level, "hard">, number> = { easy: 1, medium: 4 };
const WIN = 10000;

function heuristic(board: Cell[], p: Player): number {
  let score = 0;
  for (const line of LINES) {
    const mine = line.filter((i) => board[i] === p).length;
    const theirs = line.filter((i) => board[i] === other(p)).length;
    if (theirs === 0 && mine === 2) score += 8;
    if (mine === 0 && theirs === 2) score -= 8;
  }
  if (board[4] === p) score += 3; // the centre reaches four points
  else if (board[4] === other(p)) score -= 3;
  if (phaseOf(board, p) === "moving") score += movesOn(board, p).length;
  if (phaseOf(board, other(p)) === "moving") score -= movesOn(board, other(p)).length;
  return score;
}

function negamax(board: Cell[], turn: Player, depth: number, memo: Map<string, number>): number {
  const t = terminalValue(board, turn);
  if (t) return -WIN - depth; // sooner losses are worse
  if (depth === 0) return heuristic(board, turn);
  const key = `${posKey(board, turn)}:${depth}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  let best = -Infinity;
  for (const m of movesOn(board, turn)) best = Math.max(best, -negamax(boardAfter(board, turn, m), other(turn), depth - 1, memo));
  memo.set(key, best);
  return best;
}

const searchMemo = new Map<string, number>();

export function scoreMoves(s: AchiState, level: Level): { move: Move; score: number }[] {
  return legalMoves(s).map((move) => {
    if (level === "hard") return { move, score: perfectScore(s, move) };
    const depth = LEVEL_DEPTH[level];
    return { move, score: -negamax(boardAfter(s.board, s.turn, move), other(s.turn), depth - 1, searchMemo) };
  });
}

export function chooseMove(s: AchiState, level: Level, rng: () => number = Math.random): Move {
  const scored = scoreMoves(s, level);
  if (scored.length === 0) throw new Error("No legal move");
  if (level === "easy") {
    // Takes a win it can see, otherwise plays anywhere.
    const wins = scored.filter((x) => x.score >= WIN);
    const pool = wins.length ? wins : scored;
    return pool[Math.floor(rng() * pool.length)].move;
  }
  // Several equally good moves: pick one at random so games vary.
  const best = Math.max(...scored.map((x) => x.score));
  const top = scored.filter((x) => x.score === best);
  return top[Math.floor(rng() * top.length)].move;
}
