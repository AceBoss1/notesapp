// Ncho with 4 players (lib/arcade/ncho.ts; owner, 21 Nov 2026: "on ncho 4 player can start each owning 3 seed pots,
// temporarily seed home is divided into 2, players lose pots till they're out"): you and three computers on the same
// 12 holes, 3 holes and a store each, turns in sowing order, the same captures, rounds, conquest and knock-outs.
// Run: npx -y tsx tests/arcade/ncho4.test.ts
import assert from "node:assert/strict";
import {
  FOUR_PLAYER_DEPTH, applyMove, autoStartsNextRound, chooseMove, depthFor, directionOf, endRound, homeOf, housesOf,
  initialState, legalMoves, nextPlayer, ownedHoles, playersIn, seededRng, startingOwner, tieOrder,
  type Level, type NchoState, type NchoVariant, type Player, type RoundsTarget,
} from "../../lib/arcade/ncho";

const at = (pits: number[], over: Partial<NchoState> = {}, variant: NchoVariant = "ncho"): NchoState =>
  ({ ...initialState(undefined, 0, variant, { players: 4 }), pits, ...over });
const sumOf = (s: { pits: number[]; stores: number[] }) => s.pits.reduce((a, b) => a + b, 0) + s.stores.reduce((a, b) => a + b, 0);
const zeros = (n: number) => Array(n).fill(0) as number[];
let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };

// --- Setup and ownership ---
ok("4 players: 3 holes each in sowing order, a store each, 48 seeds", () => {
  const s = initialState(undefined, 0, "ncho", { players: 4 });
  assert.equal(s.players, 4);
  assert.deepEqual(s.owner, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  assert.deepEqual(startingOwner(6, 4), s.owner);
  assert.deepEqual(s.stores, [0, 0, 0, 0]);
  assert.deepEqual(s.pits, Array(12).fill(4));
  assert.deepEqual(legalMoves(s), [0, 1, 2]);
  assert.deepEqual(legalMoves({ ...s, turn: 2 }), [6, 7, 8]);
  assert.equal(homeOf(7, 12, 4), 2);
  assert.deepEqual(ownedHoles(s.owner, 3, 4), [9, 10, 11]);
  assert.throws(() => applyMove(s, 3), /Illegal/, "Computer 1's hole");
  // The 2-player game is unchanged.
  assert.equal(initialState().players, 2);
  assert.deepEqual(initialState().stores, [0, 0]);
});
ok("turns follow the sowing direction and skip players who are out", () => {
  const own = startingOwner(6, 4);
  assert.deepEqual([0, 1, 2, 3].map((p) => nextPlayer(own, p as Player, 4, 1)), [1, 2, 3, 0], "Ncho: anticlockwise");
  assert.deepEqual([0, 1, 2, 3].map((p) => nextPlayer(own, p as Player, 4, -1)), [3, 0, 1, 2], "Aka-Hausa: clockwise");
  const noTwo: Player[] = [0, 0, 0, 1, 1, 1, 1, 3, 3, 3, 3, 0]; // Computer 2 is out
  assert.equal(nextPlayer(noTwo, 1, 4, 1), 3);
  assert.equal(nextPlayer(noTwo, 3, 4, -1), 1);
  assert.deepEqual(playersIn(noTwo, 4), [0, 1, 3]);
  // From the start: you move, then Computer 1 (Ncho) or Computer 3 (Aka-Hausa).
  assert.equal(applyMove(initialState(undefined, 0, "ncho", { players: 4 }), 0).turn, 1);
  assert.equal(applyMove(initialState(undefined, 0, "akahausa", { players: 4 }), 0).turn, 3);
  assert.deepEqual(tieOrder(1, 4, 1), [2, 3, 0, 1]);
  assert.deepEqual(tieOrder(1, 4, -1), [0, 3, 2, 1]);
});

// --- Captures ---
ok("a 4 on the way goes to that hole's owner; your last seed's 4 is yours, on anyone's holes", () => {
  // Hole 1 (5): 2→1, 3 goes 3→4 on the way (Computer 1's: it takes 4), 4→1, 5→1, 6 makes 4 with the last seed
  // (Computer 2's hole): you take it.
  const pits = [1, 5, 0, 3, 0, 0, 3, 1, 0, 2, 2, 0];
  const s = applyMove(at(pits), 1);
  assert.deepEqual(s.last?.captures, [{ hole: 3, to: 1, step: 1, last: false }, { hole: 6, to: 0, step: 4, last: true }]);
  assert.deepEqual(s.stores, [4, 4, 0, 0]);
  assert.deepEqual(s.last?.gains, [4, 4, 0, 0]);
  assert.equal(s.turn, 1);
  assert.equal(sumOf(s), 17);
  // A computer's 4 on the way in your hole goes to you.
  const c = applyMove(at([3, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2], { turn: 3 }), 11); // 0: 3→4 (yours), 1→1
  assert.deepEqual(c.stores, [4, 0, 0, 0]);
  assert.equal(c.turn, 0);
});
ok("the last 8 with 4 players: the 4's taker takes them all (here Computer 2, on the way)", () => {
  // 8 on the board. Your hole 2 (4): 3→1, 4→1, 5→1, 6 goes 3→4... that's the last seed: you take all 8.
  const mine = applyMove(at([0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 0, 1], { stores: [10, 10, 10, 10] }), 2);
  assert.equal(mine.last?.end, "sweep");
  assert.deepEqual(mine.lastRound?.finalStores, [18, 10, 10, 10]);
  assert.equal(mine.lastRound?.reason, "sweep");
  // Your hole 2 (3): 3→1, 4 goes 3→4 on the way (Computer 1's): it takes all 8.
  const theirs = applyMove(at([0, 0, 3, 0, 3, 0, 0, 0, 0, 0, 0, 2], { stores: [10, 10, 10, 10] }), 2);
  assert.deepEqual(theirs.last?.sweep, { to: 1, seeds: 4, step: 1, holes: [3, 11] });
  assert.deepEqual(theirs.lastRound?.finalStores, [10, 18, 10, 10]);
  assert.deepEqual(theirs.lastRound?.finalPits, zeros(12));
});

// --- End of a round ---
ok("a round ends when the player to move has no seeds in their holes", () => {
  // You sow hole 0 (1) → 1. Computer 1 (next) has none: the round ends and everyone counts.
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0], { stores: [8, 10, 6, 8] }), 0);
  const r = s.lastRound!;
  assert.equal(r.reason, "no-seeds");
  assert.deepEqual(r.counted, [1, 0, 9, 6]);
  assert.deepEqual(r.totals, [9, 10, 15, 14]);
  assert.equal(sumOf(s), 48);
  assert.deepEqual(s.pits, Array(12).fill(4));
});
ok("refill: holes a player can't fill go to whoever has the most seeds to spare", () => {
  const own = startingOwner(6, 4);
  // You 8 (fill 0, 1), Computer 1 16 (3 holes, 4 spare), Computers 2 and 3 12 each: your hole 2 goes to Computer 1.
  const a = endRound(zeros(12), own, [8, 16, 12, 12], 0, { players: 4 });
  assert.deepEqual(a.conquered, [{ hole: 2, from: 0, to: 1 }]);
  assert.deepEqual(a.houses, [2, 4, 3, 3]);
  assert.deepEqual(a.pits, Array(12).fill(4));
  assert.equal(a.nextStarter, 0, "fewest houses starts the next round");
  assert.deepEqual(a.eliminated, []);
  // A tie for most to spare goes to the first in turn order after the round's starter.
  const b = endRound(zeros(12), own, [4, 16, 16, 12], 0, { players: 4 });
  assert.deepEqual(b.conquered, [{ hole: 1, from: 0, to: 1 }, { hole: 2, from: 0, to: 2 }]);
  assert.deepEqual(b.houses, [1, 4, 4, 3]);
  const c = endRound(zeros(12), own, [4, 16, 16, 12], 1, { players: 4 }); // Computer 1 started: Computer 2 is first
  assert.deepEqual(c.conquered, [{ hole: 1, from: 0, to: 2 }, { hole: 2, from: 0, to: 1 }]);
});
ok("refill: leftover seeds fill the last empty holes, largest remainders first", () => {
  // You 10 (2 over), C1 14 (2 over), C2 13 (1 over), C3 11 (3 over). Holes 2 and 11 are still empty, 8 seeds pooled:
  // C3 (3) keeps its own hole 11, then C1 (2, ahead of you on the tie) takes your hole 2.
  const r = endRound(zeros(12), startingOwner(6, 4), [10, 14, 13, 11], 0, { players: 4 });
  assert.deepEqual(r.leftovers, [{ hole: 2, to: 1, seeds: 4 }, { hole: 11, to: 3, seeds: 4 }]);
  assert.deepEqual(r.conquered, [{ hole: 2, from: 0, to: 1 }]);
  assert.deepEqual(r.houses, [2, 4, 3, 3]);
  assert.deepEqual(r.stores, [0, 0, 0, 0]);
});
ok("a player left with no houses is out, and turns skip them", () => {
  // Computer 2 counts only 2: all three of its holes are conquered.
  const own = startingOwner(6, 4);
  const r = endRound(zeros(12), own, [16, 14, 2, 16], 0, { players: 4 });
  assert.deepEqual(r.houses, [4, 4, 0, 4]);
  assert.deepEqual(r.eliminated, [2]);
  assert.deepEqual(r.conquered.map((x) => x.to), [3, 0, 1]);
  assert.equal(r.nextStarter, 1, "equal houses: first after the starter, skipping the player who's out");
  // Through a real move: the round ends, Computer 2 is out, and play skips it.
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [15, 14, 2, 16] }), 0);
  assert.deepEqual(s.lastRound?.eliminated, [2]);
  assert.equal(housesOf(s.owner, 2), 0);
  assert.equal(s.over, false);
  assert.equal(nextPlayer(s.owner, 1, 4, 1), 3);
});
ok("the game ends when one player has every house; or after the rounds, most houses wins", () => {
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [47, 0, 0, 0], roundsTarget: "all" }), 0);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "all-houses");
  assert.equal(s.winner, 0);
  assert.deepEqual(s.lastRound?.eliminated, [1, 2, 3]);
  const t = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [11, 8, 16, 12], round: 3 }), 0);
  assert.equal(t.over, true);
  assert.equal(t.endReason, "rounds");
  assert.equal(t.winner, 2);
  const u = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [15, 8, 16, 8], round: 3 }), 0);
  assert.equal(u.winner, "draw", "two players level on most houses");
});
ok("between rounds the game carries on by itself unless it's your turn to start", () => {
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [15, 14, 2, 16] }), 0);
  assert.notEqual(s.turn, 0);
  assert.equal(autoStartsNextRound(s), true);
  const you = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [7, 14, 12, 14] }), 0);
  assert.equal(you.turn, 0);
  assert.equal(autoStartsNextRound(you), false);
});

// --- Computer ---
ok("the computers look further with 4 players; one takes a free 4 and the last 8", () => {
  for (const level of ["easy", "medium", "hard"] as const) assert.equal(depthFor("ncho", level, 6, 4), FOUR_PLAYER_DEPTH[level]);
  assert.equal(depthFor("akahausa", "hard", 6, 4), FOUR_PLAYER_DEPTH.hard + 1);
  // Computer 2: hole 8 (1) → 9 makes 4 with the last seed (8 on the board: all of them); hole 6 does nothing.
  const s = at([0, 0, 2, 0, 0, 0, 1, 0, 1, 3, 0, 1], { turn: 2, stores: [10, 10, 10, 10] });
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(s, level, seededRng(4)), 8, level);
});

function playOut(variant: NchoVariant, rounds: RoundsTarget, seed: number, levels: readonly Level[]) {
  const rng = seededRng(seed);
  const dir = directionOf(variant);
  let s = initialState(rng, (seed % 4) as Player, variant, { players: 4, rounds });
  let slowest = 0;
  let roundsSeen = 0;
  const out = new Set<Player>();
  while (!s.over) {
    const level = levels[(seed + s.turn) % levels.length];
    assert.ok(!out.has(s.turn), "a player who is out never moves");
    assert.ok(housesOf(s.owner, s.turn) > 0);
    const t = performance.now();
    const h = chooseMove(s, level, rng);
    slowest = Math.max(slowest, performance.now() - t);
    assert.ok(legalMoves(s).includes(h));
    const next = applyMove(s, h);
    const m = next.last!;
    for (const c of m.captures) assert.equal(c.to, c.last ? s.turn : s.owner[c.hole], "4s go to the mover (last seed) or the hole's owner");
    const onBoard = (next.lastRound ? next.lastRound.finalPits : next.pits).reduce((a, b) => a + b, 0);
    assert.notEqual(onBoard, 4, "never a lone 4 on the board");
    if (next.lastRound) {
      roundsSeen++;
      const r = next.lastRound;
      assert.equal(r.houses.reduce((a, b) => a + b, 0), 12);
      assert.deepEqual(next.pits, Array(12).fill(4));
      for (const p of r.eliminated) { out.add(p); assert.equal(r.houses[p], 0); }
      for (const p of out) assert.equal(housesOf(next.owner, p), 0, "out for good");
      if (!next.over) assert.ok(housesOf(next.owner, next.turn) > 0, "the next round starts with a player who's in");
    } else {
      assert.deepEqual(next.owner, s.owner, "ownership only changes between rounds");
      assert.equal(next.turn, nextPlayer(s.owner, s.turn, 4, dir), "turns follow the sowing direction");
    }
    s = next;
    assert.equal(sumOf(s), 48);
    assert.equal(s.stores.length, 4);
    assert.ok(s.plies < 100000, "game must finish");
  }
  const houses = [0, 1, 2, 3].map((p) => housesOf(s.owner, p as Player));
  const top = Math.max(...houses);
  const leaders = houses.flatMap((x, p) => (x === top ? [p] : []));
  assert.equal(s.winner, leaders.length === 1 ? leaders[0] : "draw");
  if (s.endReason === "all-houses") assert.equal(top, 12);
  if (rounds !== "all") assert.ok(s.round <= rounds);
  return { slowest, plies: s.plies, rounds: roundsSeen, reason: s.endReason, houses: houses.join("-"), out: out.size };
}

for (const variant of ["ncho", "akahausa"] as const) {
  for (const rounds of [3, "all"] as const) {
    ok(`4 computers: ${variant}, rounds ${rounds}`, () => {
      const summary: string[] = [];
      for (let g = 1; g <= 3; g++) {
        const r = playOut(variant, rounds, g * 5 + (variant === "ncho" ? 0 : 1), ["easy", "medium", "hard"]);
        summary.push(`${r.plies} moves/${r.rounds} rounds/${r.reason} ${r.houses} (${r.out} out)`);
      }
      console.log(`        ${summary.join(", ")}`);
    });
  }
}

ok("4 players: hard moves stay under 300ms", () => {
  const slowest = Math.max(playOut("ncho", 3, 41, ["hard"]).slowest, playOut("akahausa", 3, 42, ["hard"]).slowest);
  console.log(`        slowest hard move: ${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 300, `slowest move ${slowest.toFixed(0)}ms`);
});

console.log(`ncho4: all ${checks} tests passed`);
