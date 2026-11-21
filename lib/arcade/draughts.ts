// Draughts on a 10×10 or 8×8 board: pure logic, no React or DOM. Two rule sets:
//  - "african" (default, on 10×10 with 20 each, or on 8×8; the international rules most Nigerian players know): men step forward but capture
//    forwards and backwards; kings fly any distance along a clear diagonal and capture from afar; you must take the
//    most pieces you can; a man is crowned only if the move ends on the far row (passing through it mid-capture doesn't count).
//  - "english": men move and capture forward only; kings move one square either way; any capture will do, but a
//    sequence must be finished; reaching the far row crowns and ends the move.
// The board is n×n (n = 10 or 8, read from the board's length). Squares are 0…n²−1, row = floor(i / n) from the top.
// Light (player 0, you) fills the bottom n/2−1 rows and moves up; dark (player 1, the computer) fills the top n/2−1
// rows and moves down. Only dark squares ((row + col) odd) are used, so each side has a dark corner on its left.

export type Player = 0 | 1;
export type Level = "easy" | "medium" | "hard";
export type Rules = "african" | "english";
export type Piece = { side: Player; king: boolean };
export type Cell = Piece | null;

export type DraughtsMove = {
  from: number;
  path: number[]; // squares landed on, in order (one for a step, one per jump)
  captures: number[]; // squares of the pieces taken, in order
  crowns: boolean;
};

export type DraughtsState = {
  board: Cell[];
  turn: Player;
  over: boolean;
  winner: Player | "draw" | null;
  last: DraughtsMove | null;
  quiet: number; // plies since the last capture
  drawRule: boolean; // draw after 40 moves each with no capture
  moves: number; // plies played
  rules: Rules;
};

export type BoardSize = 8 | 10;
export const SIZE = 8; // the English board; African defaults to 10
export const DRAW_PLIES = 80; // 40 moves each

export const sizeOf = (board: Cell[]) => Math.round(Math.sqrt(board.length));
export const rowOf = (i: number, n = SIZE) => Math.floor(i / n);
export const colOf = (i: number, n = SIZE) => i % n;
export const isDark = (i: number, n = SIZE) => (rowOf(i, n) + colOf(i, n)) % 2 === 1;
const other = (p: Player): Player => (p === 0 ? 1 : 0);
const at = (r: number, c: number, n: number) => (r >= 0 && r < n && c >= 0 && c < n ? r * n + c : -1);
// The row a side crowns on.
const farRow = (p: Player, n: number) => (p === 0 ? 0 : n - 1);
const forward = (p: Player) => (p === 0 ? -1 : 1);

const ALL: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
function dirs(piece: Piece): [number, number][] {
  const f = forward(piece.side);
  return piece.king ? ALL : [[f, -1], [f, 1]];
}

// The rng is accepted so every arcade game shares one signature; the start position is fixed.
// African rules default to the 10×10 board; English is always 8×8.
export function initialState(_rng?: () => number, opts: { drawRule?: boolean; first?: Player; rules?: Rules; size?: BoardSize } = {}): DraughtsState {
  const rules = opts.rules ?? "african";
  const n: BoardSize = rules === "english" ? 8 : opts.size ?? 10;
  const board: Cell[] = Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++) {
    if (!isDark(i, n)) continue;
    if (rowOf(i, n) < n / 2 - 1) board[i] = { side: 1, king: false };
    else if (rowOf(i, n) > n / 2) board[i] = { side: 0, king: false };
  }
  return { board, turn: opts.first ?? 0, over: false, winner: null, last: null, quiet: 0, drawRule: opts.drawRule ?? true, moves: 0, rules };
}

// Every full jump sequence for one piece. Taken pieces stay on the board until the move ends: they can't be jumped
// twice and (for a flying king) they block the diagonal.
function jumpsFrom(board: Cell[], from: number, piece: Piece, rules: Rules): DraughtsMove[] {
  const out: DraughtsMove[] = [];
  const n = sizeOf(board);
  const free = (i: number) => i >= 0 && (board[i] === null || i === from);
  const flying = piece.king && rules === "african";
  const capDirs = piece.king || rules === "african" ? ALL : dirs(piece);
  const walk = (sq: number, path: number[], caps: number[]) => {
    let extended = false;
    // English: crowning ends the move, so a man that has just reached the far row stops here.
    const crownedNow = rules === "english" && !piece.king && path.length > 0 && rowOf(sq, n) === farRow(piece.side, n);
    if (!crownedNow) {
      for (const [dr, dc] of capDirs) {
        let r = rowOf(sq, n) + dr, c = colOf(sq, n) + dc;
        if (flying) while (free(at(r, c, n))) { r += dr; c += dc; }
        const mid = at(r, c, n);
        if (mid < 0) continue;
        const m = board[mid];
        if (!m || m.side === piece.side || caps.includes(mid)) continue;
        r += dr; c += dc;
        while (free(at(r, c, n))) {
          const land = at(r, c, n);
          extended = true;
          walk(land, [...path, land], [...caps, mid]);
          if (!flying) break;
          r += dr; c += dc;
        }
      }
    }
    if (!extended && path.length > 0) {
      const crowns = !piece.king && rowOf(sq, n) === farRow(piece.side, n);
      out.push({ from, path, captures: caps, crowns });
    }
  };
  walk(from, [], []);
  return out;
}

export function legalMoves(state: DraughtsState): DraughtsMove[] {
  if (state.over) return [];
  return movesFor(state.board, state.turn, state.rules);
}

export function movesFor(board: Cell[], side: Player, rules: Rules = "african"): DraughtsMove[] {
  const n = sizeOf(board);
  let jumps: DraughtsMove[] = [];
  const steps: DraughtsMove[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p || p.side !== side) continue;
    jumps.push(...jumpsFrom(board, i, p, rules));
    if (jumps.length > 0) continue; // once a capture exists, plain steps don't matter
    const flying = p.king && rules === "african";
    for (const [dr, dc] of dirs(p)) {
      let r = rowOf(i, n) + dr, c = colOf(i, n) + dc;
      for (let to = at(r, c, n); to >= 0 && board[to] === null; r += dr, c += dc, to = at(r, c, n)) {
        steps.push({ from: i, path: [to], captures: [], crowns: !p.king && rowOf(to, n) === farRow(side, n) });
        if (!flying) break;
      }
    }
  }
  // Captures are compulsory; under African rules you must take the most pieces you can.
  if (rules === "african" && jumps.length > 0) {
    const most = Math.max(...jumps.map((m) => m.captures.length));
    jumps = jumps.filter((m) => m.captures.length === most);
  }
  return jumps.length > 0 ? jumps : steps;
}

export const sameMove = (a: DraughtsMove, b: DraughtsMove) =>
  a.from === b.from && a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);

export function applyMove(state: DraughtsState, move: DraughtsMove): DraughtsState {
  const legal = legalMoves(state).find((m) => sameMove(m, move));
  if (!legal) throw new Error(`Illegal move from ${move.from}`);
  return settle(play(state, legal));
}

// Apply a move already known to be legal (the search uses this to skip the check).
function play(state: DraughtsState, m: DraughtsMove): DraughtsState {
  const board = state.board.slice();
  const piece = board[m.from]!;
  board[m.from] = null;
  for (const c of m.captures) board[c] = null;
  board[m.path[m.path.length - 1]] = m.crowns ? { side: piece.side, king: true } : piece;
  return {
    ...state,
    board,
    turn: other(state.turn),
    last: m,
    quiet: m.captures.length > 0 ? 0 : state.quiet + 1,
    moves: state.moves + 1,
  };
}

// The player to move loses if they have no pieces or no legal move.
function settle(state: DraughtsState): DraughtsState {
  if (movesFor(state.board, state.turn, state.rules).length === 0) return { ...state, over: true, winner: other(state.turn) };
  if (state.drawRule && state.quiet >= DRAW_PLIES) return { ...state, over: true, winner: "draw" };
  return state;
}

export function countPieces(board: Cell[], side: Player) {
  let men = 0, kings = 0;
  for (const p of board) if (p && p.side === side) { if (p.king) kings++; else men++; }
  return { men, kings };
}

// --- Computer player: negamax alpha-beta. ---

export const LEVEL_DEPTH: Record<Level, number> = { easy: 2, medium: 4, hard: 6 };
const MAN = 100;
// A flying king is worth far more than a one-step king.
const KING: Record<Rules, number> = { english: 150, african: 300 };
const WIN = 100000;

// Material (an English king is worth one and a half men, a flying king three) plus a little for men that have pushed forward.
export function evaluate(board: Cell[], me: Player, rules: Rules = "african"): number {
  const n = sizeOf(board);
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    let v = p.king ? KING[rules] : MAN;
    if (!p.king) v += 4 * (p.side === 0 ? n - 1 - rowOf(i, n) : rowOf(i, n));
    else v += (n - 1) / 2 - Math.abs((n - 1) / 2 - colOf(i, n)); // kings like the middle
    score += p.side === me ? v : -v;
  }
  return score;
}

// The search counts positions and gives up past a budget, so the big 10×10 board with flying kings stays quick on a
// phone. Counting positions (not milliseconds) keeps the computer's play the same on every device.
export const NODE_BUDGET = 25000;
class OutOfBudget extends Error {}
type Search = { nodes: number; budget: number };

function negamax(state: DraughtsState, depth: number, alpha: number, beta: number, ply: number, search: Search): number {
  if (++search.nodes > search.budget) throw new OutOfBudget();
  const moves = movesFor(state.board, state.turn, state.rules);
  if (moves.length === 0) return -WIN + ply; // prefer quicker wins, slower losses
  if (state.drawRule && state.quiet >= DRAW_PLIES) return 0;
  // Keep searching through forced captures so the computer doesn't stop mid-exchange.
  if (depth <= 0 && (moves[0].captures.length === 0 || depth < -6)) return evaluate(state.board, state.turn, state.rules);
  let best = -Infinity;
  for (const m of order(moves)) {
    const s = -negamax(play(state, m), depth - 1, -beta, -alpha, ply + 1, search);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

// Bigger captures and crownings first: better pruning.
const order = (moves: DraughtsMove[]) => moves.slice().sort((a, b) => b.captures.length - a.captures.length || Number(b.crowns) - Number(a.crowns));

// Every move tied for the best score at one depth. Moves that can't beat the best so far are cut off early;
// scores are whole numbers, so the tiny margin still lets an exact tie through.
function bestAt(state: DraughtsState, moves: DraughtsMove[], depth: number, search: Search): DraughtsMove[] {
  let bestScore = -Infinity;
  let best: DraughtsMove[] = [];
  for (const m of moves) {
    const s = -negamax(play(state, m), depth - 1, -Infinity, -(bestScore - 1e-6), 1, search);
    if (s > bestScore) { bestScore = s; best = [m]; }
    else if (s === bestScore) best.push(m);
  }
  return best;
}

export function chooseMove(state: DraughtsState, level: Level = "medium", rng: () => number = Math.random, budget = NODE_BUDGET): DraughtsMove {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal move");
  if (moves.length === 1) return moves[0];
  // Easy slips now and then so it's beatable.
  if (level === "easy" && rng() < 0.25) return moves[Math.floor(rng() * moves.length)];
  const ordered = order(moves);
  // Look one move ahead, then deeper, keeping the deepest search that finished inside the budget.
  let best = bestAt(state, ordered, 1, { nodes: 0, budget: Infinity });
  const search: Search = { nodes: 0, budget };
  for (let depth = 2; depth <= LEVEL_DEPTH[level]; depth++) {
    try { best = bestAt(state, [...best, ...ordered.filter((m) => !best.includes(m))], depth, search); }
    catch (e) { if (e instanceof OutOfBudget) break; throw e; }
  }
  return best[Math.floor(rng() * best.length)];
}

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
