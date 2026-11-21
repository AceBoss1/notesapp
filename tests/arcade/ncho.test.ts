// Ncho (lib/arcade/ncho.ts), the owner's school rule: sowing both ways, the "4" capture, the chain option,
// the end of the game, winner by house, and computer play on both board sizes.
// Run: npx -y tsx tests/arcade/ncho.test.ts
import assert from "node:assert/strict";
import {
  AKAHAUSA_DEPTH, LEVEL_DEPTH, LONG_BOARD_DEPTH, applyMove, chooseMove, depthFor, holeCount, initialState, legalMoves,
  seededRng, sow, stallLimit, totalSeeds, type HolesPerSide, type NchoState, type NchoVariant,
} from "../../lib/arcade/ncho";

const at = (pits: number[], over: Partial<NchoState> = {}, variant: NchoVariant = "ncho"): NchoState => {
  const holesPerSide = (pits.length / 2) as HolesPerSide;
  return { ...initialState(undefined, 0, variant, { holesPerSide }), pits, ...over };
};
const sum = (s: NchoState) => s.pits.reduce((a, b) => a + b, 0) + s.stores[0] + s.stores[1];
let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };

// --- Setup ---
ok("standard board: 12 holes of 4 (48 seeds), you first, empty houses", () => {
  const s = initialState();
  assert.equal(s.holesPerSide, 6);
  assert.equal(s.variant, "ncho");
  assert.equal(s.chain, false, "chain is off by default");
  assert.deepEqual(s.pits, Array(12).fill(4));
  assert.equal(totalSeeds(6), 48);
  assert.deepEqual(s.stores, [0, 0]);
  assert.equal(s.turn, 0);
  assert.deepEqual(legalMoves(s), [0, 1, 2, 3, 4, 5]);
});
ok("Nchokoroto board: 24 holes of 4 (96 seeds)", () => {
  const s = initialState(undefined, 1, "ncho", { holesPerSide: 12, chain: true });
  assert.equal(s.holesPerSide, 12);
  assert.equal(holeCount(12), 24);
  assert.deepEqual(s.pits, Array(24).fill(4));
  assert.equal(sum(s), 96);
  assert.equal(totalSeeds(12), 96);
  assert.equal(s.chain, true);
  assert.equal(s.turn, 1, "first player is honoured (loser starts the next round)");
  assert.deepEqual(legalMoves(s), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
});

// --- Sowing ---
ok("Ncho sows anticlockwise (up the indexes) and never mutates", () => {
  const s0 = initialState();
  const s1 = applyMove(s0, 3);
  assert.deepEqual(s1.last?.path, [4, 5, 6, 7]);
  assert.deepEqual(s1.pits, [4, 4, 4, 0, 5, 5, 5, 5, 4, 4, 4, 4]);
  assert.deepEqual(s0.pits, Array(12).fill(4));
  assert.equal(s0.last, null);
  assert.equal(s1.turn, 1);
  assert.deepEqual(legalMoves(s1), [6, 7, 8, 9, 10, 11]);
  assert.throws(() => applyMove(s1, 2), /Illegal/, "can't play the other side");
  assert.throws(() => applyMove(applyMove(s1, 6), 3), /Illegal/, "can't play an empty hole");
  // Wrapping from the top row back to the bottom.
  assert.deepEqual(applyMove(at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3], { turn: 1 }), 11).last?.path, [0, 1, 2]);
});
ok("Aka-Hausa sows clockwise (down the indexes)", () => {
  const a0 = initialState(undefined, 0, "akahausa");
  const a1 = applyMove(a0, 3);
  assert.deepEqual(a1.last?.path, [2, 1, 0, 11]);
  assert.deepEqual(a1.pits, [5, 5, 5, 0, 4, 4, 4, 4, 4, 4, 4, 5]);
  assert.equal(a1.variant, "akahausa");
  assert.deepEqual(applyMove(a1, 6).last?.path, [5, 4, 3, 2]);
  // And on the long board: hole 0 clockwise goes into hole 23.
  const l = applyMove(initialState(undefined, 0, "akahausa", { holesPerSide: 12 }), 0);
  assert.deepEqual(l.last?.path, [23, 22, 21, 20]);
});
ok("12 or more seeds go round and round without skipping the starting hole", () => {
  const pits = Array(12).fill(0); pits[0] = 13;
  const { pits: after, move } = sow(pits, 0, 0);
  assert.equal(move.path.length, 13);
  assert.equal(move.path[11], 0, "the 12th seed goes back into the starting hole");
  assert.equal(move.path[12], 1);
  assert.equal(after[0], 1);
  assert.equal(after[1], 2);
  assert.equal(after.reduce((a, b) => a + b, 0), 13);
  // Clockwise on the long board: 25 seeds from hole 5 pass through it once and finish in hole 4.
  const long = Array(24).fill(0); long[5] = 25;
  const r = sow(long, 0, 5, "akahausa");
  assert.equal(r.move.path[23], 5);
  assert.equal(r.move.lastHole, 4);
  assert.equal(r.pits[5], 1);
  assert.equal(r.pits[4], 2);
});

// --- Capture: exactly 4 in their hole ---
ok("last seed makes exactly 4 in their hole: those 4 go to your house", () => {
  const pits = [0, 0, 0, 0, 0, 2, 3, 3, 1, 1, 1, 1];
  const s = applyMove(at(pits), 5); // 6→4, 7→4: last seed makes 4 in hole 7
  assert.deepEqual(s.last?.captured, [7]);
  assert.equal(s.last?.made, 4);
  assert.equal(s.last?.amount, 4);
  assert.equal(s.stores[0], 4);
  assert.equal(s.pits[7], 0);
  assert.equal(s.pits[6], 4, "chain is off: hole 6 stays");
  assert.equal(sum(s), sum(at(pits)));
});
ok("3 or 5 in their hole captures nothing", () => {
  const three = applyMove(at([0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1, 1]), 5);
  assert.equal(three.last?.made, 3);
  assert.equal(three.last?.onTheirSide, true);
  assert.equal(three.last?.amount, 0);
  assert.equal(three.stores[0], 0);
  const five = applyMove(at([0, 0, 0, 0, 0, 1, 4, 1, 1, 1, 1, 1]), 5);
  assert.equal(five.last?.made, 5);
  assert.equal(five.last?.amount, 0);
  // 2 (the old rule) captures nothing either.
  assert.equal(applyMove(at([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]), 5).last?.amount, 0);
});
ok("4 on your own side captures nothing", () => {
  const s = applyMove(at([0, 2, 3, 3, 0, 0, 1, 1, 1, 1, 1, 1]), 1); // 2→4, 3→4 (own side)
  assert.equal(s.last?.made, 4);
  assert.equal(s.last?.onTheirSide, false);
  assert.equal(s.last?.amount, 0);
  assert.deepEqual(s.pits.slice(0, 6), [0, 0, 4, 4, 0, 0]);
});
ok("the computer captures on your side the same way", () => {
  const s = applyMove(at([3, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1], { turn: 1 }), 11); // 11 → 0: makes 4
  assert.deepEqual(s.last?.captured, [0]);
  assert.equal(s.stores[1], 4);
  // Aka-Hausa: 6 → 5 clockwise makes 4 there.
  const a = applyMove(at([1, 1, 1, 1, 1, 3, 1, 0, 0, 0, 0, 0], { turn: 1 }, "akahausa"), 6);
  assert.deepEqual(a.last?.captured, [5]);
  assert.equal(a.stores[1], 4);
});

// --- Chain option ---
ok("chain off vs on (anticlockwise)", () => {
  // Hole 4's 4 seeds: 5 (own), 6→4, 7→4, 8→4. Last makes 4 in hole 8; holes 7 and 6 behind it are also 4.
  const pits = [0, 0, 0, 0, 4, 0, 3, 3, 3, 1, 1, 1];
  const off = applyMove(at(pits), 4);
  assert.deepEqual(off.last?.captured, [8]);
  assert.equal(off.stores[0], 4);
  const on = applyMove(at(pits, { chain: true }), 4);
  assert.deepEqual(on.last?.captured, [8, 7, 6]);
  assert.equal(on.stores[0], 12);
  assert.equal(sum(on), sum(at(pits)));
  // The chain stops at their edge: hole 5 (yours) is never taken even if it holds 4.
  const edge = applyMove(at([0, 0, 0, 0, 2, 3, 3, 1, 1, 1, 1, 1], { chain: true }), 4); // 5→4 (own), 6→4
  assert.deepEqual(edge.last?.captured, [6]);
});
ok("chain stops at the first hole that isn't exactly 4", () => {
  const s = applyMove(at([0, 0, 0, 0, 4, 0, 3, 4, 3, 1, 1, 1], { chain: true }), 4); // 6→4, 7→5, 8→4
  assert.deepEqual(s.last?.captured, [8]);
  assert.equal(s.stores[0], 4);
});
ok("chain runs back the other way for Aka-Hausa", () => {
  // Hole 1 clockwise: 0 (own), 11→4, 10→4, 9→4.
  const pits = [0, 4, 0, 0, 0, 0, 1, 1, 1, 3, 3, 3];
  const on = applyMove(at(pits, { chain: true }, "akahausa"), 1);
  assert.deepEqual(on.last?.captured, [9, 10, 11]);
  assert.equal(on.stores[0], 12);
  const off = applyMove(at(pits, {}, "akahausa"), 1);
  assert.deepEqual(off.last?.captured, [9]);
});

// --- End of the game ---
ok("the game ends when the player to move has no seeds; winner by house only", () => {
  // You sow your last seed into their side; they have plenty, so the game goes on.
  const going = applyMove(at([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], { stores: [20, 27] }), 5);
  assert.equal(going.over, false);
  assert.equal(going.turn, 1);
  // They sow; now you (to move) have nothing: game over. Seeds on the board aren't counted.
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0], { stores: [22, 21], turn: 1 }), 6);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "no-move");
  assert.deepEqual(s.stores, [22, 21], "board seeds are not added to anyone's house");
  assert.equal(s.pits.reduce((a, b) => a + b, 0), 5, "they stay on the board");
  assert.equal(s.winner, 0, "you win on houses although they hold more seeds overall");
  assert.deepEqual(legalMoves(s), []);
  assert.throws(() => applyMove(s, 7), /Illegal/);
});
ok("equal houses is a draw", () => {
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0], { stores: [23, 23], turn: 1 }), 6);
  assert.equal(s.over, true);
  assert.equal(s.winner, "draw");
});
ok("capturing every seed ends the game", () => {
  const s = applyMove(at([0, 0, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0], { stores: [24, 20] }), 5);
  assert.equal(s.stores[0], 28);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "all-captured");
  assert.equal(s.winner, 0);
});
ok("no majority rule and no forced feeding", () => {
  // 25 of 48 in your house doesn't end it.
  const s = applyMove(at([0, 0, 0, 0, 0, 2, 3, 3, 4, 0, 0, 0], { stores: [21, 0] }), 5);
  assert.equal(s.stores[0], 25);
  assert.equal(s.over, false);
  // They have nothing, but you may still play a move that doesn't reach them (the game ends after it).
  const starve = at([0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 0], { stores: [20, 24] });
  assert.deepEqual(legalMoves(starve), [3, 5]);
  const after = applyMove(starve, 3);
  assert.equal(after.over, true);
  assert.equal(after.winner, 1);
});
ok("the stall safeguard ends a game with no captures (100 moves for 6 holes, 200 for 12)", () => {
  assert.equal(stallLimit(6), 100);
  assert.equal(stallLimit(12), 200);
  const s = applyMove(at([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], { stores: [23, 23], turn: 1, sinceCapture: 99 }), 11);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "stalled");
});

// --- Purity ---
ok("applyMove never mutates its input", () => {
  const s = at([0, 0, 0, 0, 4, 0, 3, 3, 3, 1, 1, 1], { chain: true });
  const snap = JSON.stringify(s);
  const next = applyMove(s, 4);
  assert.equal(JSON.stringify(s), snap);
  assert.notEqual(next.pits, s.pits);
  assert.notEqual(next.stores, s.stores);
});

// --- Computer ---
ok("depths: Aka-Hausa one deeper; the long board capped", () => {
  for (const level of ["easy", "medium", "hard"] as const) {
    assert.equal(AKAHAUSA_DEPTH[level], LEVEL_DEPTH[level] + 1);
    assert.equal(depthFor("ncho", level), LEVEL_DEPTH[level]);
    assert.equal(depthFor("akahausa", level), AKAHAUSA_DEPTH[level]);
    assert.equal(depthFor("ncho", level, 12), LONG_BOARD_DEPTH[level]);
    assert.equal(depthFor("akahausa", level, 12), LONG_BOARD_DEPTH[level] + 1);
  }
});
ok("the computer takes an obvious capture", () => {
  // Hole 11 (1 seed) → your hole 0, making 4. Hole 8 only sows its own side.
  const s = at([3, 3, 1, 0, 0, 0, 0, 0, 3, 0, 0, 1], { turn: 1 });
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(s, level, seededRng(1)), 11, level);
  const a = at([0, 0, 0, 0, 0, 3, 1, 0, 0, 0, 2, 0], { turn: 1 }, "akahausa"); // hole 6 → 5 makes 4
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(a, level, seededRng(2)), 6, level);
});

function playOut(holesPerSide: HolesPerSide, variant: NchoVariant, chain: boolean, seed: number, levels: readonly ("easy" | "medium" | "hard")[]) {
  const rng = seededRng(seed);
  const n = holeCount(holesPerSide);
  const dir = variant === "akahausa" ? -1 : 1;
  let s = initialState(rng, (seed % 2) as 0 | 1, variant, { holesPerSide, chain });
  let slowest = 0;
  while (!s.over) {
    const level = levels[(seed + s.turn) % levels.length];
    const t = performance.now();
    const h = chooseMove(s, level, rng);
    slowest = Math.max(slowest, performance.now() - t);
    assert.ok(legalMoves(s).includes(h));
    const before = JSON.stringify(s);
    const next = applyMove(s, h);
    assert.equal(JSON.stringify(s), before, "never mutates");
    // Every step is one hole in the sowing direction, no skips.
    let pos = h;
    for (const p of next.last!.path) { assert.equal(p, (pos + dir + n) % n); pos = p; }
    assert.equal(next.last!.path.length, s.pits[h]);
    // Captures only ever take exactly-4 holes on the other side.
    if (next.last!.amount > 0) {
      assert.equal(next.last!.amount, 4 * next.last!.captured.length);
      if (!chain) assert.equal(next.last!.captured.length, 1);
      for (const c of next.last!.captured) assert.notEqual(c < holesPerSide ? 0 : 1, s.turn);
    }
    s = next;
    assert.equal(sum(s), totalSeeds(holesPerSide));
    assert.ok(s.pits.every((x) => x >= 0) && s.pits.length === n);
    assert.ok(s.plies < 5000, "game must finish");
  }
  assert.ok(s.winner !== null && s.endReason !== null);
  const [a, b] = s.stores;
  assert.equal(s.winner, a > b ? 0 : b > a ? 1 : "draw");
  return { slowest, plies: s.plies, reason: s.endReason };
}

for (const holesPerSide of [6, 12] as const) {
  for (const variant of ["ncho", "akahausa"] as const) {
    for (const chain of [false, true]) {
      ok(`computer v computer: ${holesPerSide} holes, ${variant}, chain ${chain ? "on" : "off"}`, () => {
        const games = holesPerSide === 6 ? 4 : 2;
        const levels = holesPerSide === 6 ? (["easy", "medium", "hard"] as const) : (["easy", "medium"] as const);
        const summary: string[] = [];
        for (let g = 1; g <= games; g++) {
          const r = playOut(holesPerSide, variant, chain, g * 7 + holesPerSide, levels);
          summary.push(`${r.plies} moves/${r.reason}`);
        }
        console.log(`        ${summary.join(", ")}`);
      });
    }
  }
}

ok("12-hole hard moves stay under 300ms (both variants, chain on)", () => {
  let slowest = 0;
  for (const variant of ["ncho", "akahausa"] as const) {
    const r = playOut(12, variant, true, 99, ["hard"]);
    slowest = Math.max(slowest, r.slowest);
  }
  console.log(`        slowest hard move on 12 holes: ${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 300, `slowest move ${slowest.toFixed(0)}ms`);
});

console.log(`ncho: all ${checks} tests passed`);
