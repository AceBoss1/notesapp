// Chess for Notes Arcade: pure rules and the computer player. No React, no DOM.
// Squares are 0..63 with a1 = 0, h1 = 7, a8 = 56. Pieces are numbers: type 1..6 (P N B R Q K), black adds 8.
// The public state is immutable; the search works on a private mutable copy with make/unmake for speed.

export type Color = "w" | "b";
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6, BLACK = 8;
export type Level = "easy" | "medium" | "hard";

export const FLAG_DOUBLE = 1, FLAG_EP = 2, FLAG_CASTLE = 4;

export interface Move {
  from: number;
  to: number;
  piece: number;
  captured: number; // 0 when nothing is taken; the pawn for en passant
  promo: number; // piece type (2..5) or 0
  flags: number;
}

export interface ChessState {
  board: readonly number[];
  turn: Color;
  castling: number; // 1 = white king side, 2 = white queen side, 4 = black king side, 8 = black queen side
  ep: number; // en passant target square or -1
  halfmove: number;
  fullmove: number;
  keys: readonly string[]; // position keys since the start, current one last (for repetition)
}

export type Result = "checkmate" | "stalemate" | "insufficient" | "fifty" | "threefold";
export interface GameStatus { over: boolean; result: Result | null; winner: Color | null; check: boolean }

export const pieceType = (p: number) => p & 7;
export const pieceColor = (p: number): Color => (p & BLACK ? "b" : "w");
export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const squareName = (sq: number) => "abcdefgh"[sq & 7] + String((sq >> 3) + 1);
export const squareFromName = (n: string) => "abcdefgh".indexOf(n[0]) + (Number(n[1]) - 1) * 8;

const LETTERS = " pnbrqk";

// ---------- precomputed tables ----------
const KNIGHT_TARGETS: number[][] = [];
const KING_TARGETS: number[][] = [];
// Rays: 0..3 orthogonal (N, S, E, W), 4..7 diagonal.
const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const RAYS: number[][][] = [];
for (let sq = 0; sq < 64; sq++) {
  const f = sq & 7, r = sq >> 3;
  const jump = (list: [number, number][]) => list.map(([df, dr]) => [f + df, r + dr]).filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8).map(([x, y]) => y * 8 + x);
  KNIGHT_TARGETS.push(jump([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]));
  KING_TARGETS.push(jump(DIRS));
  RAYS.push(DIRS.map(([df, dr]) => {
    const ray: number[] = [];
    for (let x = f + df, y = r + dr; x >= 0 && x < 8 && y >= 0 && y < 8; x += df, y += dr) ray.push(y * 8 + x);
    return ray;
  }));
}
// Castling rights kept after a move touches a square (king or rook leaving, or a rook captured at home).
const CASTLE_MASK = new Array<number>(64).fill(15);
CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[4] = 15 & ~3; CASTLE_MASK[7] = 15 & ~1;
CASTLE_MASK[56] = 15 & ~8; CASTLE_MASK[60] = 15 & ~12; CASTLE_MASK[63] = 15 & ~4;

// ---------- mutable position used internally ----------
interface Undo { captured: number; castling: number; ep: number; half: number }
interface Pos { b: number[]; side: number; castling: number; ep: number; half: number; kings: [number, number] }

function toPos(s: ChessState): Pos {
  const b = s.board.slice();
  const kings: [number, number] = [b.indexOf(KING), b.indexOf(KING | BLACK)];
  return { b, side: s.turn === "w" ? 0 : BLACK, castling: s.castling, ep: s.ep, half: s.halfmove, kings };
}

function attacked(p: Pos, sq: number, by: number): boolean {
  const b = p.b, f = sq & 7;
  // Pawns attack diagonally forward, so look one rank behind the target from the attacker's view.
  const pawn = PAWN | by;
  const back = by ? sq + 8 : sq - 8;
  if (back >= 0 && back < 64) {
    if (f > 0 && b[back - 1] === pawn) return true;
    if (f < 7 && b[back + 1] === pawn) return true;
  }
  const kn = KNIGHT | by;
  for (const t of KNIGHT_TARGETS[sq]) if (b[t] === kn) return true;
  const kg = KING | by;
  for (const t of KING_TARGETS[sq]) if (b[t] === kg) return true;
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const ray = rays[d];
    for (let i = 0; i < ray.length; i++) {
      const q = b[ray[i]];
      if (!q) continue;
      if ((q & BLACK) === by) {
        const t = q & 7;
        if (t === QUEEN || (d < 4 ? t === ROOK : t === BISHOP)) return true;
      }
      break;
    }
  }
  return false;
}

const inCheckPos = (p: Pos) => attacked(p, p.kings[p.side ? 1 : 0], p.side ^ BLACK);

function addPawnMove(out: Move[], from: number, to: number, piece: number, captured: number, flags: number, onlyQueen: boolean) {
  const r = to >> 3;
  if (r === 0 || r === 7) {
    out.push({ from, to, piece, captured, promo: QUEEN, flags });
    if (!onlyQueen) for (const promo of [KNIGHT, ROOK, BISHOP]) out.push({ from, to, piece, captured, promo, flags });
  } else out.push({ from, to, piece, captured, promo: 0, flags });
}

// Pseudo-legal moves (may leave own king in check). `tactical` limits to captures and queen promotions (quiescence).
function genPseudo(p: Pos, tactical = false): Move[] {
  const out: Move[] = [];
  const b = p.b, side = p.side, opp = side ^ BLACK;
  for (let sq = 0; sq < 64; sq++) {
    const pc = b[sq];
    if (!pc || (pc & BLACK) !== side) continue;
    const t = pc & 7;
    if (t === PAWN) {
      const dir = side ? -8 : 8;
      const to = sq + dir;
      const r = sq >> 3, f = sq & 7;
      if (!b[to]) {
        const promoting = (to >> 3) === 0 || (to >> 3) === 7;
        if (!tactical || promoting) addPawnMove(out, sq, to, pc, 0, 0, tactical);
        if (!tactical && r === (side ? 6 : 1) && !b[to + dir]) out.push({ from: sq, to: to + dir, piece: pc, captured: 0, promo: 0, flags: FLAG_DOUBLE });
      }
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const c = to + df, target = b[c];
        if (target && (target & BLACK) === opp) addPawnMove(out, sq, c, pc, target, 0, tactical);
        else if (c === p.ep && !target) out.push({ from: sq, to: c, piece: pc, captured: PAWN | opp, promo: 0, flags: FLAG_EP });
      }
    } else if (t === KNIGHT || t === KING) {
      for (const to of t === KNIGHT ? KNIGHT_TARGETS[sq] : KING_TARGETS[sq]) {
        const target = b[to];
        if (target ? (target & BLACK) === opp : !tactical) out.push({ from: sq, to, piece: pc, captured: target, promo: 0, flags: 0 });
      }
      if (t === KING && !tactical) genCastles(p, sq, pc, out);
    } else {
      const d0 = t === BISHOP ? 4 : 0, d1 = t === ROOK ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const to of RAYS[sq][d]) {
          const target = b[to];
          if (!target) { if (!tactical) out.push({ from: sq, to, piece: pc, captured: 0, promo: 0, flags: 0 }); continue; }
          if ((target & BLACK) === opp) out.push({ from: sq, to, piece: pc, captured: target, promo: 0, flags: 0 });
          break;
        }
      }
    }
  }
  return out;
}

// The king may not castle out of, through, or into check; the squares between must be empty.
function genCastles(p: Pos, sq: number, pc: number, out: Move[]) {
  const b = p.b, side = p.side, opp = side ^ BLACK;
  const home = side ? 60 : 4;
  if (sq !== home) return;
  const kBit = side ? 4 : 1, qBit = side ? 8 : 2, rook = ROOK | side;
  if (p.castling & kBit && !b[home + 1] && !b[home + 2] && b[home + 3] === rook &&
      !attacked(p, home, opp) && !attacked(p, home + 1, opp) && !attacked(p, home + 2, opp))
    out.push({ from: home, to: home + 2, piece: pc, captured: 0, promo: 0, flags: FLAG_CASTLE });
  if (p.castling & qBit && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook &&
      !attacked(p, home, opp) && !attacked(p, home - 1, opp) && !attacked(p, home - 2, opp))
    out.push({ from: home, to: home - 2, piece: pc, captured: 0, promo: 0, flags: FLAG_CASTLE });
}

function make(p: Pos, m: Move): Undo {
  const undo: Undo = { captured: m.captured, castling: p.castling, ep: p.ep, half: p.half };
  const b = p.b, side = p.side;
  b[m.from] = 0;
  b[m.to] = m.promo ? m.promo | side : m.piece;
  if (m.flags & FLAG_EP) b[m.to + (side ? 8 : -8)] = 0;
  if (m.flags & FLAG_CASTLE) {
    if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
    else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
  }
  if ((m.piece & 7) === KING) p.kings[side ? 1 : 0] = m.to;
  p.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
  p.ep = m.flags & FLAG_DOUBLE ? (m.from + m.to) >> 1 : -1;
  p.half = (m.piece & 7) === PAWN || m.captured ? 0 : p.half + 1;
  p.side = side ^ BLACK;
  return undo;
}

function unmake(p: Pos, m: Move, u: Undo) {
  const b = p.b;
  p.side ^= BLACK;
  const side = p.side;
  b[m.from] = m.piece;
  if (m.flags & FLAG_EP) { b[m.to] = 0; b[m.to + (side ? 8 : -8)] = u.captured; }
  else b[m.to] = u.captured;
  if (m.flags & FLAG_CASTLE) {
    if (m.to > m.from) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
    else { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
  }
  if ((m.piece & 7) === KING) p.kings[side ? 1 : 0] = m.from;
  p.castling = u.castling; p.ep = u.ep; p.half = u.half;
}

function legalFromPos(p: Pos): Move[] {
  const out: Move[] = [];
  for (const m of genPseudo(p)) {
    const u = make(p, m);
    if (!attacked(p, p.kings[p.side ? 0 : 1], p.side)) out.push(m);
    unmake(p, m, u);
  }
  return out;
}

// ---------- public rules API ----------
export function legalMoves(s: ChessState): Move[] {
  return legalFromPos(toPos(s));
}

export function inCheck(s: ChessState): boolean {
  return inCheckPos(toPos(s));
}

// Board, side, castling rights and en passant (only when a capture is really possible), as FIDE counts repetition.
export function positionKey(s: Omit<ChessState, "keys">): string {
  let k = "";
  for (let i = 0; i < 64; i++) { const pc = s.board[i]; k += pc ? (pc & BLACK ? LETTERS[pc & 7] : LETTERS[pc & 7].toUpperCase()) : "."; }
  const p = toPos({ ...s, keys: [] });
  const ep = s.ep >= 0 && legalFromPos(p).some((m) => m.flags & FLAG_EP) ? squareName(s.ep) : "-";
  return `${k} ${s.turn} ${s.castling} ${ep}`;
}

function withKey(s: Omit<ChessState, "keys">, prev: readonly string[]): ChessState {
  return { ...s, keys: [...prev, positionKey(s)] };
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseFen(fen: string): ChessState {
  const [placement, turn = "w", castle = "-", ep = "-", half = "0", full = "1"] = fen.trim().split(/\s+/);
  const rows = placement.split("/");
  if (rows.length !== 8) throw new Error("FEN needs 8 ranks");
  const board = new Array<number>(64).fill(0);
  rows.forEach((row, i) => {
    let f = 0;
    const r = 7 - i;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const t = LETTERS.indexOf(ch.toLowerCase());
      if (t < 1) throw new Error(`Bad FEN piece ${ch}`);
      board[r * 8 + f] = t | (ch === ch.toLowerCase() ? BLACK : 0);
      f++;
    }
    if (f !== 8) throw new Error("FEN rank must have 8 squares");
  });
  let castling = 0;
  if (castle.includes("K")) castling |= 1;
  if (castle.includes("Q")) castling |= 2;
  if (castle.includes("k")) castling |= 4;
  if (castle.includes("q")) castling |= 8;
  const base = { board, turn: (turn === "b" ? "b" : "w") as Color, castling, ep: ep === "-" ? -1 : squareFromName(ep), halfmove: Number(half) || 0, fullmove: Number(full) || 1 };
  return withKey(base, []);
}

export function toFen(s: ChessState): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "", empty = 0;
    for (let f = 0; f < 8; f++) {
      const pc = s.board[r * 8 + f];
      if (!pc) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += pc & BLACK ? LETTERS[pc & 7] : LETTERS[pc & 7].toUpperCase();
    }
    rows.push(row + (empty ? empty : ""));
  }
  const c = (s.castling & 1 ? "K" : "") + (s.castling & 2 ? "Q" : "") + (s.castling & 4 ? "k" : "") + (s.castling & 8 ? "q" : "");
  return `${rows.join("/")} ${s.turn} ${c || "-"} ${s.ep >= 0 ? squareName(s.ep) : "-"} ${s.halfmove} ${s.fullmove}`;
}

export function initialState(): ChessState {
  return parseFen(START_FEN);
}

// Returns the new state; never mutates. The move should come from legalMoves.
export function applyMove(s: ChessState, m: Move): ChessState {
  const p = toPos(s);
  make(p, m);
  const next = { board: p.b, turn: (p.side ? "b" : "w") as Color, castling: p.castling, ep: p.ep, halfmove: p.half, fullmove: s.fullmove + (s.turn === "b" ? 1 : 0) };
  return withKey(next, s.keys);
}

export function findMove(s: ChessState, from: number, to: number, promo = QUEEN): Move | undefined {
  const list = legalMoves(s).filter((m) => m.from === from && m.to === to);
  return list.find((m) => !m.promo || m.promo === promo) ?? list[0];
}

export function insufficientMaterial(board: readonly number[]): boolean {
  const minors: { t: number; sq: number }[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const t = board[sq] & 7;
    if (!t || t === KING) continue;
    if (t === PAWN || t === ROOK || t === QUEEN) return false;
    minors.push({ t, sq });
  }
  if (minors.length <= 1) return true; // bare kings, or king and one minor piece against king
  // Only bishops, all on the same colour of square: nobody can ever mate.
  if (minors.every((m) => m.t === BISHOP)) {
    const colour = (sq: number) => ((sq >> 3) + (sq & 7)) & 1;
    return minors.every((m) => colour(m.sq) === colour(minors[0].sq));
  }
  return false;
}

export function gameStatus(s: ChessState): GameStatus {
  const p = toPos(s);
  const check = inCheckPos(p);
  const moves = legalFromPos(p);
  if (!moves.length) return check
    ? { over: true, result: "checkmate", winner: s.turn === "w" ? "b" : "w", check }
    : { over: true, result: "stalemate", winner: null, check };
  if (insufficientMaterial(s.board)) return { over: true, result: "insufficient", winner: null, check };
  if (s.halfmove >= 100) return { over: true, result: "fifty", winner: null, check };
  const key = s.keys[s.keys.length - 1];
  if (key && s.keys.filter((k) => k === key).length >= 3) return { over: true, result: "threefold", winner: null, check };
  return { over: false, result: null, winner: null, check };
}

// Short algebraic notation, worked out before the move is played.
export function moveToSan(s: ChessState, m: Move): string {
  let san: string;
  const t = m.piece & 7;
  if (m.flags & FLAG_CASTLE) san = m.to > m.from ? "O-O" : "O-O-O";
  else {
    const dest = squareName(m.to);
    if (t === PAWN) {
      san = (m.captured ? "abcdefgh"[m.from & 7] + "x" : "") + dest + (m.promo ? "=" + LETTERS[m.promo].toUpperCase() : "");
    } else {
      const rivals = legalMoves(s).filter((o) => o.to === m.to && o.from !== m.from && o.piece === m.piece);
      let dis = "";
      if (rivals.length) {
        const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
        const sameRank = rivals.some((o) => o.from >> 3 === m.from >> 3);
        if (!sameFile) dis = "abcdefgh"[m.from & 7];
        else if (!sameRank) dis = String((m.from >> 3) + 1);
        else dis = squareName(m.from);
      }
      san = LETTERS[t].toUpperCase() + dis + (m.captured ? "x" : "") + dest;
    }
  }
  const p = toPos(s);
  make(p, m);
  if (inCheckPos(p)) san += legalFromPos(p).length ? "+" : "#";
  return san;
}

export function perft(s: ChessState, depth: number): number {
  const p = toPos(s);
  const walk = (d: number): number => {
    const moves = legalFromPos(p);
    if (d === 1) return moves.length;
    let n = 0;
    for (const m of moves) { const u = make(p, m); n += walk(d - 1); unmake(p, m, u); }
    return n;
  };
  return depth === 0 ? 1 : walk(depth);
}

// ---------- evaluation ----------
export const VALUE = [0, 100, 320, 330, 500, 900, 0];
// Piece-square tables, written from white's side with a8 first (the usual simplified tables).
const PST: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
// In the endgame the king should walk to the centre.
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

// Score in centipawns from the side to move.
function evaluate(p: Pos): number {
  const b = p.b;
  let score = 0, heavy = 0;
  for (let sq = 0; sq < 64; sq++) { const t = b[sq] & 7; if (t > PAWN && t < KING) heavy += VALUE[t]; }
  const endgame = heavy <= 1600;
  for (let sq = 0; sq < 64; sq++) {
    const pc = b[sq];
    if (!pc) continue;
    const t = pc & 7, black = pc & BLACK;
    const idx = black ? sq : (7 - (sq >> 3)) * 8 + (sq & 7);
    const v = VALUE[t] + (t === KING && endgame ? KING_END[idx] : PST[t][idx]);
    score += black ? -v : v;
  }
  return p.side ? -score : score;
}

// ---------- search ----------
const MATE = 100000;
export interface SearchOptions { maxDepth?: number; maxNodes?: number; timeMs?: number; now?: () => number }
export const LEVELS: Record<Level, Required<Pick<SearchOptions, "maxDepth" | "maxNodes" | "timeMs">>> = {
  easy: { maxDepth: 1, maxNodes: 5000, timeMs: 300 },
  medium: { maxDepth: 3, maxNodes: 40000, timeMs: 600 },
  hard: { maxDepth: 4, maxNodes: 150000, timeMs: 900 },
};

// Captures first, most valuable victim by least valuable attacker; then promotions, then killer moves.
function orderScore(m: Move, killers?: (Move | null)[]): number {
  let s = 0;
  if (m.captured) s += 10000 + VALUE[m.captured & 7] * 10 - VALUE[m.piece & 7] / 10;
  if (m.promo) s += 9000 + VALUE[m.promo];
  if (!s && killers) for (const k of killers) if (k && k.from === m.from && k.to === m.to) s += 5000;
  return s;
}
const sameMove = (a: Move | null | undefined, b: Move) => !!a && a.from === b.from && a.to === b.to && a.promo === b.promo;

class Searcher {
  nodes = 0;
  aborted = false;
  killers: (Move | null)[][] = [];
  constructor(private p: Pos, private maxNodes: number, private deadline: number, private now: () => number) {}

  private tick() {
    this.nodes++;
    if (this.nodes >= this.maxNodes || ((this.nodes & 1023) === 0 && this.now() > this.deadline)) this.aborted = true;
  }

  quiesce(alpha: number, beta: number, qdepth: number): number {
    this.tick();
    if (this.aborted) return 0;
    const stand = evaluate(this.p);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qdepth > 8) return alpha;
    const moves = genPseudo(this.p, true).sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of moves) {
      const u = make(this.p, m);
      if (attacked(this.p, this.p.kings[this.p.side ? 0 : 1], this.p.side)) { unmake(this.p, m, u); continue; }
      const score = -this.quiesce(-beta, -alpha, qdepth + 1);
      unmake(this.p, m, u);
      if (this.aborted) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if (depth <= 0) return this.quiesce(alpha, beta, 0);
    this.tick();
    if (this.aborted) return 0;
    if (this.p.half >= 100) return 0;
    const killers = (this.killers[ply] ??= [null, null]);
    const moves = genPseudo(this.p).sort((a, b) => orderScore(b, killers) - orderScore(a, killers));
    let legal = 0;
    for (const m of moves) {
      const u = make(this.p, m);
      if (attacked(this.p, this.p.kings[this.p.side ? 0 : 1], this.p.side)) { unmake(this.p, m, u); continue; }
      legal++;
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      unmake(this.p, m, u);
      if (this.aborted) return 0;
      if (score >= beta) {
        if (!m.captured && !sameMove(killers[0], m)) { killers[1] = killers[0]; killers[0] = m; }
        return beta;
      }
      if (score > alpha) alpha = score;
    }
    if (!legal) return inCheckPos(this.p) ? -MATE + ply : 0;
    return alpha;
  }
}

export interface Choice { move: Move; score: number; depth: number; nodes: number }

// Iterative deepening alpha-beta, capped by depth, node count and time. Returns null when there's no legal move.
export function searchBest(s: ChessState, opts: SearchOptions = {}): Choice | null {
  const now = opts.now ?? (() => Date.now());
  const p = toPos(s);
  const root = legalFromPos(p).sort((a, b) => orderScore(b) - orderScore(a));
  if (!root.length) return null;
  const searcher = new Searcher(p, opts.maxNodes ?? 100000, now() + (opts.timeMs ?? 1000), now);
  let best = root[0], bestScore = -Infinity, reached = 0;
  for (let depth = 1; depth <= (opts.maxDepth ?? 3); depth++) {
    let alpha = -Infinity, iterBest: Move | null = null;
    for (const m of root) {
      const u = make(p, m);
      const score = -searcher.negamax(depth - 1, -Infinity, -alpha, 1);
      unmake(p, m, u);
      if (searcher.aborted) break;
      if (score > alpha) { alpha = score; iterBest = m; }
    }
    // The previous best is searched first, so anything that beat it before a cut-off is still trustworthy.
    if (iterBest) { best = iterBest; bestScore = alpha; reached = searcher.aborted ? depth - 1 : depth; }
    if (searcher.aborted || Math.abs(bestScore) > MATE - 100) break;
    root.splice(root.indexOf(best), 1);
    root.unshift(best);
  }
  return { move: best, score: bestScore, depth: reached, nodes: searcher.nodes };
}

// The computer's move for a level. Easy looks one move ahead (plus captures) and picks loosely among the good ones.
export function chooseMove(s: ChessState, level: Level, rng: () => number = Math.random, opts: SearchOptions = {}): Move | null {
  if (level === "easy") {
    const p = toPos(s);
    const moves = legalFromPos(p);
    if (!moves.length) return null;
    if (rng() < 0.15) return moves[Math.floor(rng() * moves.length)];
    const searcher = new Searcher(p, 1e7, Infinity, () => 0);
    const scored = moves.map((m) => {
      const u = make(p, m);
      const score = -searcher.quiesce(-Infinity, Infinity, 0) + rng() * 30;
      unmake(p, m, u);
      return { m, score };
    });
    const top = Math.max(...scored.map((x) => x.score));
    const good = scored.filter((x) => x.score >= top - 90);
    return good[Math.floor(rng() * good.length)].m;
  }
  const cfg = { ...LEVELS[level], ...opts };
  const choice = searchBest(s, cfg);
  return choice ? choice.move : null;
}
