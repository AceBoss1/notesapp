// Ncho (lib/arcade/ncho.ts): sowing, captures, the grand-slam and feeding rules, the end of the game, and computer play.
// Run: npx -y tsx tests/arcade/ncho.test.ts
import assert from "node:assert/strict";
import { AKAHAUSA_DEPTH, HOLES, LEVEL_DEPTH, STALL_PLIES, TOTAL, applyMove, chooseMove, depthFor, initialState, legalMoves, seededRng, sow, type NchoState } from "../../lib/arcade/ncho";

const at = (pits: number[], over: Partial<NchoState> = {}): NchoState => ({ ...initialState(), pits, ...over });
const sum = (s: NchoState) => s.pits.reduce((a, b) => a + b, 0) + s.stores[0] + s.stores[1];

// Start: 12 holes of 4, you first, all six holes playable.
const s0 = initialState();
assert.deepEqual(s0.pits, Array(12).fill(4));
assert.equal(s0.turn, 0);
assert.deepEqual(legalMoves(s0), [0, 1, 2, 3, 4, 5]);

// Sowing one per hole anticlockwise; the move doesn't change the original state.
const s1 = applyMove(s0, 3);
assert.deepEqual(s1.pits, [4, 4, 4, 0, 5, 5, 5, 5, 4, 4, 4, 4]);
assert.deepEqual(s0.pits, Array(12).fill(4), "never mutates");
assert.equal(s1.turn, 1);
assert.deepEqual(s1.last?.path, [4, 5, 6, 7]);
assert.deepEqual(legalMoves(s1), [6, 7, 8, 9, 10, 11]);
assert.throws(() => applyMove(s1, 2), /Illegal/);

// Wrapping from the top row back to the bottom.
{
  const s = applyMove(at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3], { turn: 1 }), 11);
  assert.deepEqual(s.last?.path, [0, 1, 2]);
}

// Capture: last seed makes 2 on their side, and the holes before it with 2 or 3 go too, stopping at the first that doesn't.
{
  const pits = [0, 0, 0, 0, 0, 4, 1, 2, 1, 2, 5, 0];
  // Hole 5's 4 seeds go to 6,7,8,9 → 2,3,2,3: all four captured... unless that's everything they have (it isn't: hole 10 has 5).
  const s = applyMove(at(pits), 5);
  assert.deepEqual(s.last?.captured, [9, 8, 7, 6]);
  assert.equal(s.stores[0], 10);
  assert.deepEqual(s.pits, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0]);
  assert.equal(sum(s), sum(at(pits)));
}
{
  // The chain breaks at a hole that isn't 2 or 3.
  const s = applyMove(at([0, 0, 0, 0, 0, 3, 1, 3, 2, 0, 4, 0]), 5);
  // 6→2, 7→4, 8→3: capture 8 only (7 has 4).
  assert.deepEqual(s.last?.captured, [8]);
  assert.equal(s.stores[0], 3);
}
// No capture when the last seed lands on your own side, or makes 1 or 4.
assert.equal(applyMove(at([0, 2, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1]), 1).last?.amount, 0);
assert.equal(applyMove(at([0, 0, 0, 0, 0, 1, 3, 1, 1, 1, 1, 1]), 5).last?.amount, 0);

// Grand slam: a capture that would take all their seeds takes nothing, but the sowing stands.
{
  const s = applyMove(at([1, 0, 0, 0, 0, 2, 1, 2, 0, 0, 0, 0]), 5);
  assert.equal(s.last?.grandSlam, true);
  assert.equal(s.last?.amount, 0);
  assert.equal(s.stores[0], 0);
  assert.deepEqual(s.pits, [1, 0, 0, 0, 0, 0, 2, 3, 0, 0, 0, 0]);
}

// 12 or more seeds skip the starting hole.
{
  const pits = Array(12).fill(0); pits[0] = 12; pits[8] = 1;
  const { pits: after, move } = sow(pits, 0, 0);
  assert.equal(after[0], 0, "start hole skipped");
  assert.equal(move.path.length, 12);
  assert.ok(!move.path.includes(0));
  assert.equal(after[1], 2, "the 12th seed lands in hole 1");
}

// Feeding: if they have nothing, you must give them seeds when you can.
{
  const s = at([0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0], { stores: [20, 20] });
  assert.deepEqual(legalMoves(s), [5], "hole 3's single seed stays on your side, so it isn't allowed");
}
// And when no move can feed them, the game ends and each side keeps what's on it.
{
  // Player 1 sows 11 → 0. Now you have 1 seed in hole 0 and they have none; hole 0 can't reach them: the game ends.
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], { stores: [24, 23], turn: 1 }), 11);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "no-move");
  assert.deepEqual(s.stores, [25, 23]);
  assert.equal(s.winner, 0);
}
{
  // A draw at 24 each. Hole 5 → 6. Player 1's one seed can only go to hole 7, which doesn't feed you: game over, they keep it.
  const s = applyMove(at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], { stores: [24, 23], turn: 0 }), 5);
  assert.equal(s.over, true);
  assert.deepEqual(s.stores, [24, 24]);
  assert.equal(s.winner, "draw");
}

// More than 24 ends the game straight away.
{
  const s = applyMove(at([0, 0, 0, 0, 0, 2, 1, 2, 4, 0, 0, 0], { stores: [20, 15] }), 5);
  assert.equal(s.stores[0], 25);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "majority");
  assert.equal(s.winner, 0);
}

{
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1], { stores: [22, 22], turn: 1 }), 11);
  // 11 → 0; you have 1 in hole 0, they have 1 in hole 10: you can't feed? They have seeds, so you move 0 → 1. Game continues.
  assert.equal(s.over, false);
}

// Stalling: after STALL_PLIES plies with no capture, the board is counted.
{
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], { stores: [23, 23], turn: 1, sinceCapture: STALL_PLIES - 1 }), 11);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "stalled");
  assert.equal(s.stores[0] + s.stores[1], 48);
}

// The computer takes an obvious capture at every level.
{
  const s = at([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0], { stores: [0, 0] });
  s.pits[2] = 5; s.pits[0] = 1; s.pits[10] = 9; // hole 2 → 3,4,5,6,7: 6 and 7 make 2 each → capture 4
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(s, level, seededRng(1)), 2, level);
}

// Full games between two computer players finish, with seeds conserved and only legal moves.
for (let seed = 1; seed <= 12; seed++) {
  const rng = seededRng(seed);
  const levels = ["easy", "medium", "hard"] as const;
  let s = initialState(rng);
  let guard = 0;
  while (!s.over) {
    const level = levels[(seed + s.turn) % 3];
    const h = chooseMove(s, level, rng);
    assert.ok(legalMoves(s).includes(h));
    s = applyMove(s, h);
    assert.equal(sum(s), TOTAL);
    assert.ok(s.pits.every((n) => n >= 0) && s.pits.length === HOLES);
    guard++;
    assert.ok(guard < 2000, "game must finish");
  }
  assert.ok(s.winner !== null);
}

// --- Aka-Hausa: the same game sown clockwise (down the indexes), with a computer that looks one move further ahead. ---
const ak = (pits: number[], over: Partial<NchoState> = {}): NchoState => ({ ...initialState(undefined, 0, "akahausa"), pits, ...over });

assert.equal(initialState().variant, "ncho", "Ncho is the default");
{
  const a0 = initialState(undefined, 0, "akahausa");
  assert.equal(a0.variant, "akahausa");
  assert.deepEqual(legalMoves(a0), [0, 1, 2, 3, 4, 5]);
  // Clockwise from hole 3: 2, 1, 0, then round the corner to 11.
  const a1 = applyMove(a0, 3);
  assert.deepEqual(a1.last?.path, [2, 1, 0, 11]);
  assert.deepEqual(a1.pits, [5, 5, 5, 0, 4, 4, 4, 4, 4, 4, 4, 5]);
  assert.equal(a1.variant, "akahausa", "the variant carries through moves");
  assert.equal(a1.turn, 1);
  // Purity: the old state is untouched.
  assert.deepEqual(a0.pits, Array(12).fill(4), "never mutates");
  assert.deepEqual(a0.stores, [0, 0]);
  assert.equal(a0.last, null);
  // The computer's side wraps clockwise from 6 down into your row.
  assert.deepEqual(applyMove(a1, 6).last?.path, [5, 4, 3, 2]);
}
{
  // Your capture runs the other way: hole 0's 3 seeds go 11, 10, 9; the last makes 2 in hole 9,
  // then back through 10 (3) and 11 (2): all three taken.
  const pits = [3, 0, 0, 0, 0, 0, 5, 0, 0, 1, 2, 1];
  const s = applyMove(ak(pits), 0);
  assert.deepEqual(s.last?.path, [11, 10, 9]);
  assert.deepEqual(s.last?.captured, [9, 10, 11]);
  assert.equal(s.stores[0], 7);
  assert.deepEqual(s.pits, [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0]);
  assert.equal(sum(s), sum(ak(pits)));
  // The same position under Ncho sows 1, 2, 3 and captures nothing.
  assert.equal(applyMove(at(pits), 0).last?.amount, 0);
}
{
  // The computer's capture: hole 6's 3 seeds go 5, 4, 3; back through 4 and 5, and the chain stops at the side's edge.
  const s = applyMove(ak([5, 0, 0, 1, 2, 1, 3, 0, 0, 0, 0, 0], { turn: 1 }), 6);
  assert.deepEqual(s.last?.captured, [3, 4, 5]);
  assert.equal(s.stores[1], 7);
  assert.equal(s.pits[0], 5);
}
{
  // The chain breaks at a hole that isn't 2 or 3: 11→2, 10→4, 9→3 captures 9 only.
  const s = applyMove(ak([3, 0, 0, 0, 0, 0, 4, 0, 0, 2, 3, 1]), 0);
  assert.deepEqual(s.last?.captured, [9]);
  assert.equal(s.stores[0], 3);
}
{
  // Grand slam still applies.
  const s = applyMove(ak([2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 1]), 0);
  assert.equal(s.last?.grandSlam, true);
  assert.equal(s.stores[0], 0);
  assert.equal(s.over, false);
  assert.deepEqual(s.pits, [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 2]);
}
{
  // Feeding, clockwise: hole 0's seed reaches their hole 11; hole 5's only reaches your hole 4.
  assert.deepEqual(legalMoves(ak([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], { stores: [23, 23] })), [0]);
  // 12 or more still skip the starting hole, going the other way.
  const pits = Array(12).fill(0); pits[0] = 12;
  const { pits: after, move } = sow(pits, 0, 0, "akahausa");
  assert.equal(after[0], 0);
  assert.deepEqual(move.path.slice(0, 2), [11, 10]);
  assert.equal(move.path[11], 11, "the 12th seed lands back in hole 11");
  assert.deepEqual(move.captured, [11], "making 2 there, which is captured");
  assert.equal(after[11], 0);
}
// Harder: one level deeper at each difficulty.
for (const level of ["easy", "medium", "hard"] as const) {
  assert.equal(AKAHAUSA_DEPTH[level], LEVEL_DEPTH[level] + 1);
  assert.equal(depthFor("akahausa", level), LEVEL_DEPTH[level] + 1);
  assert.equal(depthFor("ncho", level), LEVEL_DEPTH[level]);
}
{
  // The computer takes the obvious clockwise capture: hole 0 → 11, 10, 9 takes 7.
  const s = ak([3, 0, 0, 0, 0, 1, 5, 0, 0, 1, 2, 1]);
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(s, level, seededRng(2)), 0, level);
}
// Full computer-vs-computer Aka-Hausa games finish legally, and the hard level stays quick.
{
  let slowest = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const rng = seededRng(100 + seed);
    const levels = ["easy", "medium", "hard"] as const;
    let s = initialState(rng, 0, "akahausa");
    let guard = 0;
    while (!s.over) {
      const level = levels[(seed + s.turn) % 3];
      const t = performance.now();
      const h = chooseMove(s, level, rng);
      slowest = Math.max(slowest, performance.now() - t);
      assert.ok(legalMoves(s).includes(h));
      const before = s.pits.slice();
      const next = applyMove(s, h);
      assert.deepEqual(s.pits, before, "never mutates");
      // Every sowing goes clockwise: each step is one hole down the indexes (skipping the start hole on a lap).
      let pos = h;
      for (const p of next.last!.path) {
        let want = (pos + HOLES - 1) % HOLES;
        if (want === h) want = (want + HOLES - 1) % HOLES;
        assert.equal(p, want);
        pos = p;
      }
      s = next;
      assert.equal(s.variant, "akahausa");
      assert.equal(sum(s), TOTAL);
      assert.ok(s.pits.every((n) => n >= 0) && s.pits.length === HOLES);
      guard++;
      assert.ok(guard < 2000, "game must finish");
    }
    assert.ok(s.winner !== null && s.endReason !== null);
  }
  assert.ok(slowest < 1000, `slowest move ${slowest.toFixed(0)}ms`);
}

console.log("ncho: all tests passed");
