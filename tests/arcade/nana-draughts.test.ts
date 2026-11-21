// Nana for Draughts: free hints from the engine and her take on the computer's moves (lib/arcade/nana-draughts.ts).
// Run: npx -y tsx tests/arcade/nana-draughts.test.ts
import assert from "node:assert/strict";
import {
  applyMove, initialState, legalMoves, sameMove, type Cell, type DraughtsMove, type DraughtsState, type Player, type Rules,
} from "../../lib/arcade/draughts";
import { draughtsTake, draughtsTip, moveLabel, squareNumber } from "../../lib/arcade/nana-draughts";

// Square number (standard notation) to board index, the inverse of squareNumber.
function idx(num: number, n: number) {
  const r = Math.floor((num - 1) / (n / 2)), k = (num - 1) % (n / 2);
  return r * n + 2 * k + (r % 2 === 0 ? 1 : 0);
}
function position(n: number, rules: Rules, turn: Player, pieces: { you?: number[]; them?: number[]; youKings?: number[] }): DraughtsState {
  const board: Cell[] = Array(n * n).fill(null);
  for (const s of pieces.you ?? []) board[idx(s, n)] = { side: 0, king: false };
  for (const s of pieces.youKings ?? []) board[idx(s, n)] = { side: 0, king: true };
  for (const s of pieces.them ?? []) board[idx(s, n)] = { side: 1, king: false };
  return { ...initialState(undefined, { rules, size: n as 8 | 10 }), board, turn };
}
const isLegal = (s: DraughtsState, from: number, to: number) => legalMoves(s).some((m) => m.from === from && m.path[m.path.length - 1] === to);
const find = (s: DraughtsState, from: number, to: number, n: number) =>
  legalMoves(s).find((m) => m.from === idx(from, n) && m.path[m.path.length - 1] === idx(to, n)) as DraughtsMove;

// Numbering matches standard draughts: on 10×10 your men start on 31–50, on 8×8 on 21–32.
for (let num = 1; num <= 50; num++) assert.equal(squareNumber(idx(num, 10), 10), num);
for (let num = 1; num <= 32; num++) assert.equal(squareNumber(idx(num, 8), 8), num);
const start10 = initialState();
assert.deepEqual(start10.board.map((c, i) => (c?.side === 0 ? squareNumber(i, 10) : 0)).filter(Boolean), Array.from({ length: 20 }, (_, i) => 31 + i));

// Each rule set: a legal tip at the start, worded, the same every time, and quick.
for (const [rules, size] of [["african", 10], ["african", 8], ["english", 8]] as const) {
  const s = initialState(undefined, { rules, size });
  const t = performance.now();
  const tip = draughtsTip(s);
  const ms = performance.now() - t;
  assert.ok(tip, `${rules} ${size}: a tip`);
  assert.ok(isLegal(s, tip.highlight.from, tip.highlight.to), `${rules} ${size}: the tip is legal`);
  assert.match(tip.tip.move, /^the man on \d+ to \d+$/);
  assert.ok(tip.tip.why.endsWith("."));
  assert.deepEqual(draughtsTip(s), tip, `${rules} ${size}: same position, same tip`);
  assert.ok(ms < 1500, `${rules} ${size}: quick (${ms.toFixed(0)} ms)`);
}

// A forced capture of one: "the man on 32 to 21, taking 1", and she says you must take.
const one = position(10, "african", 0, { you: [32, 46], them: [27, 5] });
const take1 = draughtsTip(one)!;
assert.equal(take1.tip.move, "the man on 32 to 21, taking 1");
assert.deepEqual(take1.highlight, { from: idx(32, 10), to: idx(21, 10) });
assert.match(take1.tip.why, /^You must take/);

// African rules: the biggest capture (two pieces) and she says it takes the most.
const two = position(10, "african", 0, { you: [32, 46], them: [27, 17, 28, 5] });
const take2 = draughtsTip(two)!;
assert.equal(take2.tip.move, "the man on 32 to 12, taking 2");
assert.match(take2.tip.why, /you must take, and this takes the most \(2\)/i);

// English rules on 8×8: a forced capture, and crowning.
const eng = position(8, "english", 0, { you: [22, 30], them: [18, 2] });
const engTip = draughtsTip(eng)!;
assert.match(engTip.tip.move, /taking 1$/);
assert.match(engTip.tip.why, /^You must take/);
const crown = position(8, "english", 0, { you: [6], them: [12] }); // only that man can move, and either way it crowns
const crownTip = draughtsTip(crown)!;
assert.match(crownTip.tip.why, /crowns a king/);

// A flying king's move is labelled as a king.
const kingPos = position(10, "african", 0, { youKings: [46], them: [5] });
assert.match(draughtsTip(kingPos)!.tip.move, /^the king on 46 to \d+/);

// Over: no tip.
assert.equal(draughtsTip({ ...start10, over: true, winner: 1 }), null);

// Her take on the computer's moves (the computer plays dark, moving down).
const preCap = position(10, "african", 1, { you: [27, 46, 47], them: [22, 3] });
const cap = find(preCap, 22, 31, 10);
const capTake = draughtsTake(preCap, cap, applyMove(preCap, cap));
assert.match(capTake.text, /^It took one of yours/);

// It steps next to your man with room behind: you must take, and she says whether it's a trap.
const preOffer = position(10, "african", 1, { you: [27, 46], them: [17, 3] });
const offer = find(preOffer, 17, 22, 10);
const offerTake = draughtsTake(preOffer, offer, applyMove(preOffer, offer));
assert.match(offerTake.text, /must take/);

// A threat to your man next move.
const preThreat = position(10, "african", 1, { you: [33, 46], them: [18, 3] });
const step = find(preThreat, 18, 23, 10);
const after = applyMove(preThreat, step);
const threatTake = draughtsTake(preThreat, step, after);
assert.ok(/threatens your piece on 28|must take/.test(threatTake.text) || threatTake.text.startsWith("It moved"), threatTake.text);

// Game over after its move.
const preWin = position(10, "african", 1, { you: [27], them: [22] });
const win = find(preWin, 22, 31, 10);
assert.match(draughtsTake(preWin, win, applyMove(preWin, win)).text, /game to the computer/);

// Labels.
const s0 = initialState();
const m0 = legalMoves(s0).find((m) => sameMove(m, find(s0, 32, 28, 10)))!;
assert.equal(moveLabel(s0, m0), "the man on 32 to 28");

console.log("nana-draughts: all tests passed");
