// Draughts (lib/arcade/draughts.ts): steps, compulsory captures, multi-jumps, crowning, kings, the end of the game, computer play,
// under English rules first, then the African (international, on 8×8) differences.
// Run: npx -y tsx tests/arcade/draughts.test.ts
import assert from "node:assert/strict";
import {
  DRAW_PLIES, applyMove, chooseMove, countPieces, initialState, legalMoves, seededRng,
  type Cell, type DraughtsMove, type DraughtsState, type Player, type Rules,
} from "../../lib/arcade/draughts";

const sq = (r: number, c: number) => r * 8 + c;
const empty = (): Cell[] => Array(64).fill(null);
const man = (side: Player): Cell => ({ side, king: false });
const king = (side: Player): Cell => ({ side, king: true });
const pos = (pieces: [number, number, Cell][], turn: Player = 0, extra: Partial<DraughtsState> = {}): DraughtsState => {
  const board = empty();
  for (const [r, c, p] of pieces) board[sq(r, c)] = p;
  return { ...initialState(undefined, { rules: "english" }), board, turn, ...extra };
};
const afr = (pieces: [number, number, Cell][], turn: Player = 0): DraughtsState => pos(pieces, turn, { rules: "african" });
const key = (m: DraughtsMove) => `${m.from}>${m.path.join(">")}`;
const keys = (s: DraughtsState) => legalMoves(s).map(key).sort();

// African rules on 10×10 are the default; English is always 8×8.
assert.equal(initialState().rules, "african");
assert.equal(initialState().board.length, 100);
assert.equal(initialState(undefined, { rules: "english", size: 10 }).board.length, 64);
assert.equal(initialState(undefined, { size: 8 }).board.length, 64);

// Start: 12 each on dark squares, light to move with 7 possible steps.
const s0 = initialState(undefined, { rules: "english" });
assert.deepEqual(countPieces(s0.board, 0), { men: 12, kings: 0 });
assert.deepEqual(countPieces(s0.board, 1), { men: 12, kings: 0 });
assert.ok(s0.board.every((p, i) => !p || (Math.floor(i / 8) + (i % 8)) % 2 === 1));
assert.equal(legalMoves(s0).length, 7);
assert.ok(legalMoves(s0).every((m) => m.from >= sq(5, 0) && m.path[0] < m.from), "light moves up");

// A step; the original state isn't touched.
const step = legalMoves(s0).find((m) => m.from === sq(5, 2) && m.path[0] === sq(4, 3))!;
const s1 = applyMove(s0, step);
assert.equal(s1.board[sq(4, 3)]?.side, 0);
assert.equal(s1.board[sq(5, 2)], null);
assert.equal(s0.board[sq(5, 2)]?.side, 0, "never mutates");
assert.equal(s1.turn, 1);
assert.ok(legalMoves(s1).every((m) => m.path[0] > m.from), "dark moves down");
assert.throws(() => applyMove(s1, step), /Illegal/);

// Men don't move backwards.
assert.deepEqual(keys(pos([[4, 3, man(0)]])), [`${sq(4, 3)}>${sq(3, 2)}`, `${sq(4, 3)}>${sq(3, 4)}`].sort());

// Captures are compulsory: only the capture is offered.
{
  const s = pos([[5, 2, man(0)], [4, 3, man(1)], [6, 7, man(0)], [0, 1, man(1)]]);
  assert.deepEqual(keys(s), [`${sq(5, 2)}>${sq(3, 4)}`]);
  const after = applyMove(s, legalMoves(s)[0]);
  assert.equal(after.board[sq(4, 3)], null, "captured piece removed");
  assert.equal(countPieces(after.board, 1).men, 1);
}

// Men capture forward only.
{
  const s = pos([[3, 2, man(0)], [4, 3, man(1)], [7, 0, man(0)], [0, 7, man(1)]]);
  assert.ok(legalMoves(s).every((m) => m.captures.length === 0), "no backward capture for a man");
}

// Multi-jump must continue to the end.
{
  const s = pos([[7, 0, man(0)], [6, 1, man(1)], [4, 3, man(1)], [0, 7, man(1)]]);
  const ms = legalMoves(s);
  assert.equal(ms.length, 1);
  assert.deepEqual(ms[0].path, [sq(5, 2), sq(3, 4)]);
  assert.deepEqual(ms[0].captures, [sq(6, 1), sq(4, 3)]);
  const after = applyMove(s, ms[0]);
  assert.equal(countPieces(after.board, 1).men, 1);
  // A partial jump isn't a legal move.
  assert.throws(() => applyMove(s, { from: sq(7, 0), path: [sq(5, 2)], captures: [sq(6, 1)], crowns: false }), /Illegal/);
}

// Branching jumps: both full routes are offered.
{
  const s = pos([[5, 2, man(0)], [4, 3, man(1)], [2, 3, man(1)], [2, 5, man(1)], [7, 0, man(0)]]);
  assert.deepEqual(keys(s).length, 2);
}

// Reaching the far row crowns, and crowning ends the move even if a king could jump on.
{
  const s = pos([[2, 1, man(0)], [1, 2, man(1)], [1, 4, man(1)], [7, 0, man(0)], [5, 6, man(1)]]);
  const ms = legalMoves(s);
  assert.equal(ms.length, 1);
  assert.deepEqual(ms[0].path, [sq(0, 3)]);
  assert.equal(ms[0].crowns, true);
  const after = applyMove(s, ms[0]);
  assert.deepEqual(after.board[sq(0, 3)], { side: 0, king: true });
  assert.ok(after.board[sq(1, 4)], "no further jump after crowning");
}
{
  const s = pos([[1, 2, man(0)], [7, 0, man(1)]]);
  const m = legalMoves(s).find((x) => x.path[0] === sq(0, 1))!;
  assert.equal(applyMove(s, m).board[sq(0, 1)]?.king, true);
}

// Kings move and jump both ways.
{
  const s = pos([[4, 3, king(0)], [0, 7, man(1)]]);
  assert.equal(legalMoves(s).length, 4);
  const j = pos([[2, 3, king(0)], [3, 4, man(1)], [5, 4, man(1)], [0, 1, man(1)]]);
  const ms = legalMoves(j);
  assert.equal(ms.length, 1);
  assert.deepEqual(ms[0].path, [sq(4, 5), sq(6, 3)], "king jumps backwards twice");
}

// Win: taking the last piece.
{
  const s = pos([[5, 2, man(0)], [4, 3, man(1)]]);
  const after = applyMove(s, legalMoves(s)[0]);
  assert.equal(after.over, true);
  assert.equal(after.winner, 0);
}
// Win: the other side has pieces but no move.
{
  // A dark man on (6,1) is boxed in by light men on (7,0) and (7,2); its jumps would leave the board.
  // Light men on (5,0) and (5,2) block light's own captures of it, so light simply steps elsewhere.
  const s = pos([[6, 1, man(1)], [7, 0, man(0)], [7, 2, man(0)], [5, 0, man(0)], [5, 2, man(0)], [5, 6, man(0)]]);
  const m = legalMoves(s).find((x) => x.from === sq(5, 6))!;
  const after = applyMove(s, m);
  assert.equal(after.over, true);
  assert.equal(after.winner, 0);
}

// Draw after 40 moves each without a capture (and not when the rule is off).
{
  const s = pos([[4, 3, king(0)], [0, 1, king(1)]], 0, { quiet: DRAW_PLIES - 1 });
  const after = applyMove(s, legalMoves(s)[0]);
  assert.equal(after.over, true);
  assert.equal(after.winner, "draw");
  const off = applyMove({ ...s, drawRule: false }, legalMoves(s)[0]);
  assert.equal(off.over, false);
}

// The computer takes a free double jump.
{
  const s = pos([[7, 0, man(0)], [6, 1, man(1)], [4, 3, man(1)], [2, 1, man(1)], [6, 5, man(0)]], 0);
  for (const level of ["easy", "medium", "hard"] as const) {
    const m = chooseMove({ ...s }, level, seededRng(3));
    assert.equal(m.captures.length, 2, level);
  }
}

// --- African rules ---

// African on 8×8: same start, same 7 opening steps (men still step forward only).
assert.equal(legalMoves(initialState(undefined, { size: 8 })).length, 7);
assert.deepEqual(keys(afr([[4, 3, man(0)]])), [`${sq(4, 3)}>${sq(3, 2)}`, `${sq(4, 3)}>${sq(3, 4)}`].sort());

// Men capture backwards.
{
  const s = afr([[3, 2, man(0)], [4, 3, man(1)], [7, 0, man(0)], [0, 7, man(1)]]);
  assert.deepEqual(keys(s), [`${sq(3, 2)}>${sq(5, 4)}`]);
}

// The screenshot position: jump forward to (1,2), then backwards over (2,3) to (3,4).
{
  const s = afr([[3, 0, man(0)], [2, 1, man(1)], [2, 3, man(1)], [0, 1, man(1)], [0, 3, man(1)], [7, 6, man(0)]]);
  const ms = legalMoves(s);
  assert.equal(ms.length, 1);
  assert.deepEqual(ms[0].path, [sq(1, 2), sq(3, 4)]);
  assert.deepEqual(ms[0].captures, [sq(2, 1), sq(2, 3)]);
}

// You must take the most pieces: the double jump beats the single.
{
  const s = afr([[5, 0, man(0)], [4, 1, man(1)], [2, 3, man(1)], [5, 6, man(0)], [4, 7, man(1)], [0, 5, man(1)]]);
  // (5,6) could take (4,7)? no: it would land off the board. (5,0)x(4,1)x(2,3) takes two.
  const single = afr([[5, 0, man(0)], [4, 1, man(1)], [2, 3, man(1)], [5, 4, man(0)], [4, 5, man(1)], [0, 7, man(1)]]);
  assert.deepEqual(legalMoves(s).map((m) => m.captures.length), [2]);
  const counts = legalMoves(single).map((m) => m.captures.length);
  assert.ok(counts.length > 0 && counts.every((c) => c === 2), "only the double jump is offered");
  // English allows either.
  assert.ok(legalMoves({ ...single, rules: "english" }).some((m) => m.captures.length === 1));
}

// Flying kings: slide the whole clear diagonal.
{
  const s = afr([[7, 0, king(0)], [0, 1, man(1)]]);
  const ms = legalMoves(s);
  assert.equal(ms.length, 7, "a1 king reaches every square to h8");
  assert.ok(ms.some((m) => m.path[0] === sq(0, 7)));
  // English king: one square.
  assert.equal(legalMoves({ ...s, rules: "english" }).length, 1);
}

// Flying kings capture from afar and may land on any empty square beyond.
{
  const s = afr([[7, 0, king(0)], [4, 3, man(1)], [0, 1, man(1)]]);
  const ms = legalMoves(s);
  assert.deepEqual(ms.map((m) => m.path[0]).sort((a, b) => a - b), [sq(0, 7), sq(1, 6), sq(2, 5), sq(3, 4)].sort((a, b) => a - b));
  assert.ok(ms.every((m) => m.captures[0] === sq(4, 3)));
  // Two pieces in a row can't be jumped.
  const blocked = afr([[7, 0, king(0)], [4, 3, man(1)], [3, 4, man(1)], [0, 1, man(1)]]);
  assert.ok(legalMoves(blocked).every((m) => m.captures.length === 0));
}

// A flying king's multi-capture turns corners, and must pick the landing that keeps capturing.
{
  // King a1 takes (5,2); of its landings (4,3)…(1,6), only (4,3) lines up a second capture, of (2,1), landing on (1,0).
  const s = afr([[7, 0, king(0)], [5, 2, man(1)], [2, 1, man(1)], [0, 7, man(1)]]);
  const ms = legalMoves(s);
  assert.ok(ms.length > 0 && ms.every((m) => m.captures.length === 2), "takes both");
  assert.ok(ms.every((m) => m.path[0] === sq(4, 3) && m.path[1] === sq(1, 0)), "the only landing that goes on capturing");
}

// Passing through the far row mid-capture doesn't crown; ending there does.
{
  // Man (2,1) takes (1,2) to (0,3), then must go on backwards over (1,4) to (2,5): stays a man.
  const s = afr([[2, 1, man(0)], [1, 2, man(1)], [1, 4, man(1)], [7, 0, man(0)], [5, 6, man(1)]]);
  const ms = legalMoves(s);
  assert.equal(ms.length, 1);
  assert.deepEqual(ms[0].path, [sq(0, 3), sq(2, 5)]);
  assert.equal(ms[0].crowns, false);
  assert.equal(applyMove(s, ms[0]).board[sq(2, 5)]?.king, false);
  const end = afr([[2, 1, man(0)], [1, 2, man(1)], [7, 0, man(0)], [5, 6, man(1)]]);
  const m = legalMoves(end)[0];
  assert.equal(m.crowns, true);
  assert.equal(applyMove(end, m).board[sq(0, 3)]?.king, true);
}

// --- African on 10×10 ---
{
  const s = initialState();
  const n = 10;
  assert.deepEqual(countPieces(s.board, 0), { men: 20, kings: 0 });
  assert.deepEqual(countPieces(s.board, 1), { men: 20, kings: 0 });
  assert.ok(s.board.every((p, i) => !p || (Math.floor(i / n) + (i % n)) % 2 === 1), "dark squares only");
  assert.ok(s.board.slice(40, 60).every((p) => p === null), "two empty middle rows");
  assert.equal(s.board[9 * n]?.side, 0, "your bottom-left corner is a dark square with a man on it");
}
{
  // Positions on 10×10.
  const n = 10;
  const at10 = (pieces: [number, number, Cell][], turn: Player = 0): DraughtsState => {
    const board: Cell[] = Array(100).fill(null);
    for (const [r, c, p] of pieces) board[r * n + c] = p;
    return { ...initialState(), board, turn };
  };
  const q = (r: number, c: number) => r * n + c;
  // A king in the corner flies all 9 squares of the long diagonal.
  assert.equal(legalMoves(at10([[9, 0, king(0)], [0, 3, man(1)]])).length, 9);
  // Men crown on row 0 and capture backwards here too.
  const back = at10([[3, 2, man(0)], [4, 3, man(1)], [9, 0, man(0)], [0, 9, man(1)]]);
  assert.deepEqual(legalMoves(back).map((m) => m.path[0]), [q(5, 4)]);
  const crown = at10([[1, 2, man(0)], [9, 0, man(1)]]);
  assert.ok(legalMoves(crown).every((m) => m.crowns));
  // Dark crowns on row 9.
  const dark = at10([[8, 3, man(1)], [0, 1, man(0)]], 1);
  assert.ok(legalMoves(dark).every((m) => m.crowns && Math.floor(m.path[0] / n) === 9));
  // Majority capture across pieces: the triple beats the double.
  const most = at10([[9, 0, man(0)], [8, 1, man(1)], [6, 3, man(1)], [4, 5, man(1)], [9, 8, man(0)], [8, 7, man(1)], [6, 5, man(1)], [0, 1, man(1)]]);
  assert.deepEqual([...new Set(legalMoves(most).map((m) => m.captures.length))], [3]);
}

// Full games between two computer players finish without an illegal move, under both rule sets.
for (let seed = 1; seed <= 9; seed++) {
  const rng = seededRng(seed);
  const levels = ["easy", "medium", "hard"] as const;
  const rules: Rules = seed % 3 === 0 ? "english" : "african";
  const size = seed % 3 === 2 ? 8 : 10;
  let s = initialState(rng, { rules, size });
  const start = s.board.filter(Boolean).length;
  let guard = 0;
  while (!s.over) {
    const level = levels[(seed + s.turn) % 3];
    const m = chooseMove(s, level, rng);
    assert.ok(legalMoves(s).some((x) => key(x) === key(m)));
    s = applyMove(s, m);
    const total = countPieces(s.board, 0).men + countPieces(s.board, 0).kings + countPieces(s.board, 1).men + countPieces(s.board, 1).kings;
    assert.ok(total <= start);
    guard++;
    assert.ok(guard < 1000, "game must finish");
  }
  assert.ok(s.winner !== null);
}

console.log("draughts: all tests passed");
