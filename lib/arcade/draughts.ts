// Draughts on 8×8: pure logic, no React or DOM. Two rule sets:
//  - "african" (default; the international rules most Nigerian players know, on 8×8): men step forward but capture
//    forwards and backwards; kings fly any distance along a clear diagonal and capture from afar; you must take the
//    most pieces you can; a man is crowned only if the move ends on the far row (passing through it mid-capture doesn't count).
//  - "english": men move and capture forward only; kings move one square either way; any capture will do, but a
//    sequence must be finished; reaching the far row crowns and ends the move.
// Squares are 0–63, row = floor(i / 8) from the top. Light (player 0, you) starts on rows 5–7 and moves up;
// dark (player 1, the computer) starts on rows 0–2 and moves down. Only dark squares ((row + col) odd) are used.

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

export const SIZE = 8;
export const DRAW_PLIES = 80; // 40 moves each

export const rowOf = (i: number) => Math.floor(i / SIZE);
export const colOf = (i: number) => i % SIZE;
export const isDark = (i: number) => (rowOf(i) + colOf(i)) % 2 === 1;
const other = (p: Player): Player => (p === 0 ? 1 : 0);
const at = (r: number, c: number) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? r * SIZE + c : -1);
// The row a side crowns on.
const farRow = (p: Player) => (p === 0 ? 0 : SIZE - 1);
const forward = (p: Player) => (p === 0 ? -1 : 1);

const ALL: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
function dirs(piece: Piece): [number, number][] {
  const f = forward(piece.side);
  return piece.king ? ALL : [[f, -1], [f, 1]];
}

// The rng is accepted so every arcade game shares one signature; the start position is fixed.
export function initialState(_rng?: () => number, opts: { drawRule?: boolean; first?: Player; rules?: Rules } = {}): DraughtsState {
  const board: Cell[] = Array(SIZE * SIZE).fill(null);
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!isDark(i)) continue;
    if (rowOf(i) <= 2) board[i] = { side: 1, king: false };
    else if (rowOf(i) >= 5) board[i] = { side: 0, king: false };
  }
  return { board, turn: opts.first ?? 0, over: false, winner: null, last: null, quiet: 0, drawRule: opts.drawRule ?? true, moves: 0, rules: opts.rules ?? "african" };
}

// Every full jump sequence for one piece. Taken pieces stay on the board until the move ends: they can't be jumped
// twice and (for a flying king) they block the diagonal.
function jumpsFrom(board: Cell[], from: number, piece: Piece, rules: Rules): DraughtsMove[] {
  const out: DraughtsMove[] = [];
  const free = (i: number) => i >= 0 && (board[i] === null || i === from);
  const flying = piece.king && rules === "african";
  const capDirs = piece.king || rules === "african" ? ALL : dirs(piece);
  const walk = (sq: number, path: number[], caps: number[]) => {
    let extended = false;
    // English: crowning ends the move, so a man that has just reached the far row stops here.
    const crownedNow = rules === "english" && !piece.king && path.length > 0 && rowOf(sq) === farRow(piece.side);
    if (!crownedNow) {
      for (const [dr, dc] of capDirs) {
        let r = rowOf(sq) + dr, c = colOf(sq) + dc;
        if (flying) while (free(at(r, c))) { r += dr; c += dc; }
        const mid = at(r, c);
        if (mid < 0) continue;
        const m = board[mid];
        if (!m || m.side === piece.side || caps.includes(mid)) continue;
        r += dr; c += dc;
        while (free(at(r, c))) {
          const land = at(r, c);
          extended = true;
          walk(land, [...path, land], [...caps, mid]);
          if (!flying) break;
          r += dr; c += dc;
        }
      }
    }
    if (!extended && path.length > 0) {
      const crowns = !piece.king && rowOf(sq) === farRow(piece.side);
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
  let jumps: DraughtsMove[] = [];
  const steps: DraughtsMove[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p || p.side !== side) continue;
    jumps.push(...jumpsFrom(board, i, p, rules));
    if (jumps.length > 0) continue; // once a capture exists, plain steps don't matter
    const flying = p.king && rules === "african";
    for (const [dr, dc] of dirs(p)) {
      let r = rowOf(i) + dr, c = colOf(i) + dc;
      for (let to = at(r, c); to >= 0 && board[to] === null; r += dr, c += dc, to = at(r, c)) {
        steps.push({ from: i, path: [to], captures: [], crowns: !p.king && rowOf(to) === farRow(side) });
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
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    let v = p.king ? KING[rules] : MAN;
    if (!p.king) v += 4 * (p.side === 0 ? SIZE - 1 - rowOf(i) : rowOf(i));
    else v += 3 - Math.abs(3.5 - colOf(i)); // kings like the middle
    score += p.side === me ? v : -v;
  }
  return score;
}

function negamax(state: DraughtsState, depth: number, alpha: number, beta: number, ply: number): number {
  const moves = movesFor(state.board, state.turn, state.rules);
  if (moves.length === 0) return -WIN + ply; // prefer quicker wins, slower losses
  if (state.drawRule && state.quiet >= DRAW_PLIES) return 0;
  // Keep searching through forced captures so the computer doesn't stop mid-exchange.
  if (depth <= 0 && (moves[0].captures.length === 0 || depth < -6)) return evaluate(state.board, state.turn, state.rules);
  let best = -Infinity;
  for (const m of order(moves)) {
    const s = -negamax(play(state, m), depth - 1, -beta, -alpha, ply + 1);
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

// Bigger captures and crownings first: better pruning.
const order = (moves: DraughtsMove[]) => moves.slice().sort((a, b) => b.captures.length - a.captures.length || Number(b.crowns) - Number(a.crowns));

export function chooseMove(state: DraughtsState, level: Level = "medium", rng: () => number = Math.random): DraughtsMove {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal move");
  if (moves.length === 1) return moves[0];
  // Easy slips now and then so it's beatable.
  if (level === "easy" && rng() < 0.25) return moves[Math.floor(rng() * moves.length)];
  const depth = LEVEL_DEPTH[level];
  let bestScore = -Infinity;
  let best: DraughtsMove[] = [];
  for (const m of order(moves)) {
    const s = -negamax(play(state, m), depth - 1, -Infinity, Infinity, 1);
    if (s > bestScore) { bestScore = s; best = [m]; }
    else if (s === bestScore) best.push(m);
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
