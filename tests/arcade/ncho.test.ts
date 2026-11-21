// Ncho (lib/arcade/ncho.ts), the owner's rules of 21 Nov 2026: owned holes, relay sowing, the mover's last-seed 4, 4s made on the way going to the hole's owner,
// rounds with counting, refilling and conquered houses, the end of the game, and computer play on both board sizes.
// Run: npx -y tsx tests/arcade/ncho.test.ts
import assert from "node:assert/strict";
import {
  AKAHAUSA_DEPTH, LEVEL_DEPTH, LONG_BOARD_DEPTH, MAX_SOWINGS, applyMove, chooseMove, depthFor, endRound, holeCount,
  housesOf, initialState, legalMoves, moveCap, seededRng, sow, startingOwner, totalSeeds,
  type HolesPerSide, type Level, type NchoState, type NchoVariant, type Player, type RoundsTarget,
} from "../../lib/arcade/ncho";

const at = (pits: number[], over: Partial<NchoState> = {}, variant: NchoVariant = "ncho"): NchoState => {
  const holesPerSide = (pits.length / 2) as HolesPerSide;
  return { ...initialState(undefined, 0, variant, { holesPerSide }), pits, ...over };
};
const sum = (s: { pits: number[]; stores: [number, number] }) => s.pits.reduce((a, b) => a + b, 0) + s.stores[0] + s.stores[1];
const zeros = (n: number) => Array(n).fill(0) as number[];
let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };

// --- Setup ---
ok("standard board: 12 holes of 4 (48 seeds), each owns their row, empty stores, round 1 of 3", () => {
  const s = initialState();
  assert.equal(s.holesPerSide, 6);
  assert.equal(s.variant, "ncho");
  assert.deepEqual(s.pits, Array(12).fill(4));
  assert.deepEqual(s.owner, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.equal(totalSeeds(6), 48);
  assert.deepEqual(s.stores, [0, 0]);
  assert.equal(s.turn, 0);
  assert.equal(s.round, 1);
  assert.equal(s.roundsTarget, 3, "3 rounds by default");
  assert.equal(s.over, false);
  assert.deepEqual(legalMoves(s), [0, 1, 2, 3, 4, 5]);
  assert.equal("chain" in s, false, "the old chain option is gone");
});
ok("Nchokoroto board: 24 holes of 4 (96 seeds); rounds and first player honoured", () => {
  const s = initialState(undefined, 1, "akahausa", { holesPerSide: 12, rounds: "all" });
  assert.equal(s.holesPerSide, 12);
  assert.equal(holeCount(12), 24);
  assert.deepEqual(s.pits, Array(24).fill(4));
  assert.deepEqual(s.owner, startingOwner(12));
  assert.equal(housesOf(s.owner, 0), 12);
  assert.equal(sum(s), 96);
  assert.equal(totalSeeds(12), 96);
  assert.equal(s.turn, 1);
  assert.equal(s.roundStarter, 1);
  assert.equal(s.roundsTarget, "all");
  assert.deepEqual(legalMoves(s), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  assert.equal(initialState(undefined, 0, "ncho", { rounds: 7 }).roundsTarget, 7);
});

// --- Legal moves ---
ok("only non-empty holes you own are legal", () => {
  const s = at([0, 3, 0, 1, 0, 0, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(legalMoves(s), [1, 3]);
  assert.throws(() => applyMove(s, 0), /Illegal/, "empty hole");
  assert.throws(() => applyMove(s, 6), /Illegal/, "opponent's hole");
  assert.deepEqual(legalMoves({ ...s, turn: 1 }), [6, 7, 8, 9, 10, 11]);
});
ok("conquered holes are playable by their new owner, not by the row they sit on", () => {
  const owner: Player[] = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]; // the computer conquered hole 5
  const s = at([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], { owner });
  assert.deepEqual(legalMoves(s), [0, 1, 2, 3, 4]);
  assert.throws(() => applyMove(s, 5), /Illegal/);
  const t = { ...s, turn: 1 as Player };
  assert.deepEqual(legalMoves(t), [5, 6, 7, 8, 9, 10, 11]);
  const after = applyMove(t, 5); // sows 6, 7, 8, 9 (all become 5): relays from 9
  assert.equal(after.last?.player, 1);
  assert.deepEqual(after.last?.sowings[0], { from: 5, seeds: 4, path: [6, 7, 8, 9] });
});

// --- Relay sowing ---
ok("last seed into an empty hole ends the turn", () => {
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4]), 0);
  assert.equal(s.last?.end, "empty");
  assert.equal(s.last?.relays, 0);
  assert.deepEqual(s.last?.path, [1]);
  assert.equal(s.last?.made, 1);
  assert.deepEqual(s.pits.slice(0, 2), [0, 1]);
  assert.equal(s.turn, 1);
});
ok("relay: last seed into a non-empty, non-4 hole lifts them all and keeps going, across both sides", () => {
  // Hole 5 (2): 6→2, 7→3. Lift 3 from 7: 8→1, 9→1, 10→2. Lift 2 from 10: 11→1, 0→1 (was empty): ends.
  const s = applyMove(at([0, 0, 0, 0, 0, 2, 1, 2, 0, 0, 1, 0]), 5);
  const m = s.last!;
  assert.deepEqual(m.sowings, [
    { from: 5, seeds: 2, path: [6, 7] },
    { from: 7, seeds: 3, path: [8, 9, 10] },
    { from: 10, seeds: 2, path: [11, 0] },
  ]);
  assert.deepEqual(m.path, [6, 7, 8, 9, 10, 11, 0]);
  assert.equal(m.relays, 2);
  assert.equal(m.end, "empty");
  assert.equal(m.lastHole, 0);
  assert.deepEqual(s.pits, [1, 0, 0, 0, 0, 0, 2, 0, 1, 1, 0, 1]);
  assert.equal(m.amount, 0);
  assert.deepEqual(s.stores, [0, 0]);
});
ok("making exactly 4 ends the turn and the mover takes them, on either side", () => {
  // Your own side: hole 0 (2): 1→1, 2→4. You take 4.
  const own = applyMove(at([2, 0, 3, 0, 0, 0, 4, 4, 4, 4, 4, 4]), 0);
  assert.equal(own.last?.end, "four");
  assert.deepEqual(own.last?.captured, [2]);
  assert.equal(own.last?.amount, 4);
  assert.equal(own.stores[0], 4);
  assert.equal(own.pits[2], 0);
  // Their side, after a relay: hole 4 (2): 5→2, 6→2; lift 2 from 6: 7→3, 8→4. You take their 4.
  const theirs = applyMove(at([0, 0, 0, 0, 2, 1, 1, 2, 3, 0, 0, 0]), 4);
  assert.equal(theirs.last?.relays, 1);
  assert.deepEqual(theirs.last?.captured, [8]);
  assert.equal(theirs.pits[7], 3);
  assert.equal(theirs.stores[0], 4);
  // The computer on its own row: hole 6 (1) → 7 makes 4.
  const comp = applyMove(at([1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0, 0], { turn: 1 }), 6);
  assert.deepEqual(comp.last?.captured, [7]);
  assert.deepEqual(comp.stores, [0, 4]);
});
ok("a 4 made on the way goes at once to the hole's owner: the opponent's hole to the opponent", () => {
  // Hole 4 (3): 5→1, 6 goes 3→4 on the way (the computer's hole: it takes 4), 7→1 (was empty): turn ends.
  const s = applyMove(at([0, 0, 0, 0, 3, 0, 3, 0, 2, 2, 2, 2]), 4);
  assert.deepEqual(s.last?.captures, [{ hole: 6, to: 1, step: 1, last: false }]);
  assert.equal(s.last?.amount, 0, "the mover took nothing");
  assert.deepEqual(s.last?.gains, [0, 4]);
  assert.deepEqual(s.stores, [0, 4]);
  assert.deepEqual(s.pits.slice(4, 8), [0, 1, 0, 1]);
  assert.equal(s.last?.end, "empty");
  assert.equal(sum(s), 14);
});
ok("a 4 made on the way in your own hole goes to you", () => {
  // Hole 0 (2): 1 goes 3→4 on the way (yours: you take 4), 2→1: ends.
  const s = applyMove(at([2, 3, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4]), 0);
  assert.deepEqual(s.last?.captures, [{ hole: 1, to: 0, step: 0, last: false }]);
  assert.deepEqual(s.stores, [4, 0]);
  assert.equal(s.pits[1], 0);
  assert.equal(s.last?.end, "empty");
  // The computer making a 4 on the way in YOUR hole gives it to you.
  const c = applyMove(at([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], { turn: 1 }), 11); // 0: 3→4 (yours), 1→1
  assert.deepEqual(c.stores, [4, 0]);
  assert.equal(c.last?.amount, 0);
});
ok("a 4 made on the way in a conquered hole goes to its current owner", () => {
  // Ncho: the computer owns hole 5 (conquered). You sow hole 3 (3): 4→1, 5 goes 3→4 (the computer's now), 6→1.
  const owner: Player[] = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1];
  const s = applyMove(at([0, 0, 0, 3, 0, 3, 0, 2, 2, 2, 2, 2], { owner }), 3);
  assert.deepEqual(s.last?.captures, [{ hole: 5, to: 1, step: 1, last: false }]);
  assert.deepEqual(s.stores, [0, 4]);
  // Aka-Hausa: you own hole 6 (conquered, on the computer's row). It sows hole 7 (2) clockwise: 6 goes 3→4 (yours), 5→1.
  const own2: Player[] = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
  const a = applyMove(at([2, 2, 2, 2, 2, 0, 3, 2, 0, 0, 0, 0], { owner: own2, turn: 1 }, "akahausa"), 7);
  assert.deepEqual(a.last?.captures, [{ hole: 6, to: 0, step: 0, last: false }]);
  assert.deepEqual(a.stores, [4, 0]);
  assert.equal(a.last?.end, "empty");
});
ok("the last seed's 4 goes to the mover; a hand ending in a hole emptied on the way finds it empty", () => {
  // The computer's last seed makes 4 in your hole 0: the computer takes it (not you, the owner).
  const s = applyMove(at([3, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 1], { turn: 1 }), 11);
  assert.deepEqual(s.last?.captures, [{ hole: 0, to: 1, step: 0, last: true }]);
  assert.equal(s.last?.amount, 4);
  assert.deepEqual(s.stores, [0, 4]);
  // 13 seeds from hole 0: hole 1 goes 3→4 at the first seed (yours: taken), and the 13th seed lands there again,
  // finds it empty (now 1) and the turn ends.
  const p = zeros(12); p[0] = 13; p[1] = 3;
  const r = sow(p, startingOwner(6), 0, 0);
  assert.equal(r.move.end, "empty");
  assert.equal(r.move.lastHole, 1);
  assert.deepEqual(r.move.captures, [{ hole: 1, to: 0, step: 0, last: false }]);
  assert.deepEqual(r.pits, Array(12).fill(1));
  assert.deepEqual(r.move.gains, [4, 0]);
});
ok("a big sowing goes round without skipping the hole it was lifted from", () => {
  const pits = zeros(12); pits[0] = 12; // the 12th seed lands back in hole 0, which was emptied: ends
  const r = sow(pits, startingOwner(6), 0, 0);
  assert.equal(r.move.path.length, 12);
  assert.equal(r.move.path[11], 0);
  assert.equal(r.move.end, "empty");
  assert.deepEqual(r.pits, Array(12).fill(1));
});
ok(`relay cap: at most ${MAX_SOWINGS} sowings in a turn, then the turn just ends`, () => {
  assert.equal(MAX_SOWINGS, 300);
  const pits = [0, 0, 0, 0, 0, 2, 1, 2, 0, 0, 1, 0];
  const r = sow(pits, startingOwner(6), 0, 5, "ncho", 2);
  assert.equal(r.move.end, "cap");
  assert.equal(r.move.sowings.length, 2);
  assert.equal(r.pits[10], 2, "the hole the next relay would lift stays put");
  assert.equal(r.pits.reduce((a, b) => a + b, 0), 6);
  // Fuzz: relays always stop within the cap and conserve seeds.
  const rng = seededRng(5);
  for (let i = 0; i < 3000; i++) {
    const n = i % 2 ? 12 : 24;
    const p = Array.from({ length: n }, () => Math.floor(rng() * 7));
    const h = Math.floor(rng() * n);
    if (p[h] === 0) p[h] = 1;
    const own = Array.from({ length: n }, () => (rng() < 0.5 ? 0 : 1)) as Player[];
    const out = sow(p, own, (i % 2) as Player, h, i % 3 ? "ncho" : "akahausa");
    assert.ok(out.move.sowings.length <= MAX_SOWINGS);
    assert.equal(out.pits.reduce((a, b) => a + b, 0) + out.move.gains[0] + out.move.gains[1], p.reduce((a, b) => a + b, 0), "seeds conserved");
    for (const c of out.move.captures) assert.equal(c.to, c.last ? (i % 2) : own[c.hole]);
    assert.ok(out.move.end === "cap" || out.move.made === 1 || out.move.made === 4);
  }
});
ok("both variants mirror each other: Ncho anticlockwise, Aka-Hausa clockwise", () => {
  const a = applyMove(initialState(), 3);
  assert.deepEqual(a.last?.sowings[0].path, [4, 5, 6, 7]);
  const c = applyMove(initialState(undefined, 0, "akahausa"), 3);
  assert.deepEqual(c.last?.sowings[0].path, [2, 1, 0, 11]);
  assert.deepEqual(applyMove(initialState(undefined, 0, "akahausa", { holesPerSide: 12 }), 0).last?.sowings[0].path, [23, 22, 21, 20]);
  // Reflect the board left-right (keeps each row): every Ncho move matches its mirrored Aka-Hausa move hole for hole.
  const rng = seededRng(11);
  for (const half of [6, 12]) {
    const n = half * 2;
    const m = (h: number) => (half - 1 - h + n) % n;
    for (let i = 0; i < 300; i++) {
      const pits = Array.from({ length: n }, () => Math.floor(rng() * 6));
      const h = Math.floor(rng() * half);
      if (pits[h] === 0) pits[h] = 3;
      const mp = zeros(n); pits.forEach((x, j) => { mp[m(j)] = x; });
      const x = applyMove(at(pits), h);
      const y = applyMove(at(mp, {}, "akahausa"), m(h));
      assert.deepEqual(y.last!.path, x.last!.path.map(m));
      assert.equal(y.last!.end, x.last!.end);
      assert.deepEqual(y.stores, x.stores);
      if (x.lastRound === null) assert.deepEqual(y.pits, x.pits.map((_, j) => x.pits[m(j)]));
    }
  }
});

// --- End of a round ---
ok("a round ends when the player to move has no seeds in holes they own; count, refill, conquer", () => {
  // You sow hole 0 → 1. The computer owns no seeds now: the round ends.
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [20, 27] }), 0);
  const r = s.lastRound!;
  assert.ok(r, "the round summary is kept");
  assert.equal(r.round, 1);
  assert.equal(r.reason, "no-seeds");
  assert.deepEqual(r.finalPits, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.counted, [1, 0]);
  assert.deepEqual(r.totals, [21, 27]);
  // You fill holes 0-4 (20) with 1 left; the computer fills its 6 (24) with 3 left. Hole 5 goes to the larger leftover.
  assert.deepEqual(r.leftover, { hole: 5, to: 1, seeds: 4 });
  assert.deepEqual(r.conquered, [{ hole: 5, from: 0, to: 1 }]);
  assert.deepEqual(r.houses, [5, 7]);
  assert.deepEqual(s.owner, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(s.pits, Array(12).fill(4));
  assert.deepEqual(s.stores, [0, 0]);
  assert.equal(s.round, 2);
  assert.equal(s.turn, 0, "the loser (fewer houses) starts the next round");
  assert.equal(s.roundStarter, 0);
  assert.equal(s.roundMoves, 0);
  assert.equal(s.over, false);
  assert.equal(sum(s), 48);
  // The next move clears the summary.
  assert.equal(applyMove(s, 0).lastRound, null);
});
ok("the move cap ends the round as if the player to move couldn't play", () => {
  assert.equal(moveCap(6), 400);
  assert.equal(moveCap(12), 800);
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 0], { stores: [15, 12], roundMoves: 399 }), 0);
  assert.equal(s.lastRound?.reason, "move-cap");
  assert.equal(s.round, 2);
  assert.equal(sum(s), 48);
});
ok("endRound: no conquest; equal houses means the player who didn't start goes first next", () => {
  const owner = startingOwner(6);
  const r = endRound(zeros(12), owner, [24, 24], 0);
  assert.deepEqual(r.houses, [6, 6]);
  assert.deepEqual(r.conquered, []);
  assert.equal(r.leftover, null);
  assert.equal(r.nextStarter, 1);
  assert.equal(endRound(zeros(12), owner, [24, 24], 1).nextStarter, 0);
  // Seeds still in owned holes are counted first.
  const c = endRound([1, 2, 0, 0, 0, 3, 5, 0, 0, 0, 0, 1], owner, [10, 26], 0);
  assert.deepEqual(c.counted, [6, 6]);
  assert.deepEqual(c.totals, [16, 32]);
});
ok("endRound: holes you can't fill are conquered and filled by the other player", () => {
  const r = endRound(zeros(12), startingOwner(6), [16, 32], 0);
  assert.deepEqual(r.conquered, [{ hole: 4, from: 0, to: 1 }, { hole: 5, from: 0, to: 1 }]);
  assert.deepEqual(r.houses, [4, 8]);
  assert.deepEqual(r.owner, [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(r.pits, Array(12).fill(4));
  assert.deepEqual(r.stores, [0, 0]);
  assert.equal(r.leftover, null);
  assert.equal(r.nextStarter, 0);
});
ok("endRound: you keep your home holes before ones you conquered earlier (board order)", () => {
  // You own 0-7 (6 and 7 conquered earlier) and have 28: you fill 0-6, so hole 7 goes back.
  const own: Player[] = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
  const r = endRound(zeros(12), own, [28, 20], 0);
  assert.deepEqual(r.conquered, [{ hole: 7, from: 0, to: 1 }]);
  assert.deepEqual(r.houses, [7, 5]);
  // The computer owns 0 and 1 as well as its row; you have 12 for holes 2-5, so hole 5 (last in your order) goes.
  const own2: Player[] = [1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  const r2 = endRound(zeros(12), own2, [12, 36], 1);
  assert.deepEqual(r2.conquered, [{ hole: 5, from: 0, to: 1 }]);
  assert.deepEqual(r2.houses, [3, 9]);
  assert.equal(sum(r2), 48);
});
ok("endRound: the leftover hole goes to the larger remainder, 2-2 to the player who didn't start", () => {
  const owner = startingOwner(6);
  // 23 + 25: you fill 5 with 3 over, they fill 6 with 1 over. Hole 5 stays yours with the combined 4.
  const a = endRound(zeros(12), owner, [23, 25], 0);
  assert.deepEqual(a.leftover, { hole: 5, to: 0, seeds: 4 });
  assert.deepEqual(a.conquered, []);
  assert.deepEqual(a.houses, [6, 6]);
  // 22 + 26: 2 over each. Starter 0 → the computer (didn't start) gets hole 5.
  const b = endRound(zeros(12), owner, [22, 26], 0);
  assert.deepEqual(b.leftover, { hole: 5, to: 1, seeds: 4 });
  assert.deepEqual(b.conquered, [{ hole: 5, from: 0, to: 1 }]);
  assert.deepEqual(b.houses, [5, 7]);
  assert.equal(b.nextStarter, 0);
  // Starter 1 → you keep it.
  const c = endRound(zeros(12), owner, [22, 26], 1);
  assert.deepEqual(c.leftover, { hole: 5, to: 0, seeds: 4 });
  assert.deepEqual(c.houses, [6, 6]);
  assert.equal(c.nextStarter, 0, "equal houses: the player who didn't start (you) starts next");
  // The computer short: 25 + 23. Its last hole in board order (11) goes to you (larger remainder 1 vs 3? no: you have 1).
  const d = endRound(zeros(12), owner, [25, 23], 0); // you: 6 filled, 1 over; it: 5 filled, 3 over → it keeps hole 11
  assert.deepEqual(d.leftover, { hole: 11, to: 1, seeds: 4 });
  assert.deepEqual(d.houses, [6, 6]);
  const e = endRound(zeros(12), owner, [27, 21], 0); // you 3 over, it 1 over → you take hole 11
  assert.deepEqual(e.leftover, { hole: 11, to: 0, seeds: 4 });
  assert.deepEqual(e.conquered, [{ hole: 11, from: 1, to: 0 }]);
  assert.deepEqual(e.houses, [7, 5]);
  // On 12 holes: 30 + 66 → you fill 7 with 2 over, it fills 16 with 2 over; 5 of your holes go, the last of them
  // to whoever didn't start.
  const f = endRound(zeros(24), startingOwner(12), [30, 66], 1);
  assert.deepEqual(f.leftover, { hole: 11, to: 0, seeds: 4 });
  assert.deepEqual(f.houses, [8, 16]);
  assert.equal(sum(f), 96);
});
ok("endRound conserves seeds (48 / 96) and fills every hole with 4, whatever the position", () => {
  const rng = seededRng(3);
  for (let i = 0; i < 2000; i++) {
    const half = i % 2 ? 6 : 12;
    const n = half * 2;
    const total = n * 4;
    const pits = zeros(n);
    const stores: [number, number] = [0, 0];
    for (let k = 0; k < total; k++) {
      const x = Math.floor(rng() * (n + 2));
      if (x < n) pits[x]++; else stores[x - n]++;
    }
    const owner = Array.from({ length: n }, () => (rng() < 0.5 ? 0 : 1)) as Player[];
    const r = endRound(pits, owner, stores, (i % 2) as Player);
    assert.equal(sum(r), total);
    assert.deepEqual(r.pits, Array(n).fill(4));
    assert.deepEqual(r.stores, [0, 0]);
    assert.equal(r.houses[0] + r.houses[1], n);
    assert.equal(r.houses[0], housesOf(r.owner, 0));
    assert.deepEqual(r.totals, [r.counted[0] + stores[0], r.counted[1] + stores[1]]);
    // Each player keeps floor(total/4) houses, give or take the one leftover hole.
    for (const p of [0, 1] as const) {
      const base = Math.floor(r.totals[p] / 4);
      assert.ok(r.houses[p] === base || r.houses[p] === base + 1);
    }
  }
});

// --- End of the game ---
ok("the game ends when one player has every house", () => {
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [47, 0], roundsTarget: "all" }), 0);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "all-houses");
  assert.equal(s.winner, 0);
  assert.deepEqual(s.lastRound?.houses, [12, 0]);
  assert.deepEqual(s.owner, Array(12).fill(0));
  assert.deepEqual(legalMoves(s), []);
  assert.throws(() => applyMove(s, 0), /Illegal/);
});
ok("the game ends after the chosen number of rounds; winner by houses", () => {
  const pos = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const s = applyMove(at(pos, { stores: [20, 27], round: 3 }), 0);
  assert.equal(s.over, true);
  assert.equal(s.endReason, "rounds");
  assert.equal(s.winner, 1, "5 houses to 7");
  // Not yet over in round 3 of 5, or with "all".
  assert.equal(applyMove(at(pos, { stores: [20, 27], round: 3, roundsTarget: 5 }), 0).over, false);
  const all = applyMove(at(pos, { stores: [20, 27], round: 3, roundsTarget: "all" }), 0);
  assert.equal(all.over, false);
  assert.equal(all.round, 4);
});
ok("equal houses at the end is a tie", () => {
  // You count 25, the computer 23: you 6 houses with 1 over, it 5 with 3 over; it keeps hole 11 → 6 each.
  const s = applyMove(at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [24, 23], round: 3 }), 0);
  assert.deepEqual(s.lastRound?.houses, [6, 6]);
  assert.equal(s.over, true);
  assert.equal(s.winner, "draw");
});

// --- Purity ---
ok("applyMove never mutates its input (also across a round end)", () => {
  for (const s of [
    at([0, 0, 0, 0, 0, 2, 1, 2, 0, 0, 1, 0]),
    at([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { stores: [20, 27] }),
  ]) {
    const snap = JSON.stringify(s);
    const next = applyMove(s, s.pits.findIndex((x) => x > 0));
    assert.equal(JSON.stringify(s), snap);
    assert.notEqual(next.pits, s.pits);
    assert.notEqual(next.stores, s.stores);
  }
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
ok("the computer takes an obvious 4", () => {
  // Hole 6 (1) → 7 makes 4 for the computer; hole 9 (1) lands in empty 10 and does nothing.
  const s = at([1, 1, 1, 1, 1, 1, 1, 3, 0, 1, 0, 0], { turn: 1, stores: [17, 18] });
  for (const level of ["medium", "hard"] as const) assert.equal(chooseMove(s, level, seededRng(1)), 6, level);
});

function playOut(holesPerSide: HolesPerSide, variant: NchoVariant, rounds: RoundsTarget, seed: number, levels: readonly Level[]) {
  const rng = seededRng(seed);
  const n = holeCount(holesPerSide);
  const dir = variant === "akahausa" ? -1 : 1;
  let s = initialState(rng, (seed % 2) as Player, variant, { holesPerSide, rounds });
  let slowest = 0;
  let roundsSeen = 0;
  while (!s.over) {
    const level = levels[(seed + s.turn) % levels.length];
    const t = performance.now();
    const h = chooseMove(s, level, rng);
    slowest = Math.max(slowest, performance.now() - t);
    assert.ok(legalMoves(s).includes(h));
    assert.equal(s.owner[h], s.turn);
    const before = JSON.stringify(s);
    const next = applyMove(s, h);
    assert.equal(JSON.stringify(s), before, "never mutates");
    const m = next.last!;
    // Each sowing starts where the last one ended and steps one hole at a time in the sowing direction.
    let from = h;
    for (const lap of m.sowings) {
      assert.equal(lap.from, from);
      let pos = lap.from;
      for (const p of lap.path) { assert.equal(p, (pos + dir + n) % n); pos = p; }
      assert.equal(lap.path.length, lap.seeds);
      from = pos;
    }
    assert.equal(m.sowings[0].seeds, s.pits[h]);
    assert.ok(m.sowings.length <= 300);
    assert.equal(m.amount, m.end === "four" ? 4 : 0);
    assert.equal(m.gains[0] + m.gains[1], 4 * m.captures.length);
    if (next.lastRound) {
      roundsSeen++;
      assert.equal(next.lastRound.round, s.round);
      assert.equal(sum({ pits: next.lastRound.finalPits, stores: next.lastRound.finalStores }), totalSeeds(holesPerSide));
      assert.deepEqual(next.pits, Array(n).fill(4));
      if (!next.over) assert.equal(next.round, s.round + 1);
    } else {
      assert.deepEqual(next.owner, s.owner, "ownership only changes between rounds");
    }
    s = next;
    assert.equal(sum(s), totalSeeds(holesPerSide));
    assert.ok(s.pits.every((x) => x >= 0) && s.pits.length === n);
    assert.ok(s.plies < 100000, "game must finish");
  }
  assert.ok(s.winner !== null && s.endReason !== null);
  const [a, b] = [housesOf(s.owner, 0), housesOf(s.owner, 1)];
  assert.equal(s.winner, a > b ? 0 : b > a ? 1 : "draw");
  if (rounds !== "all") assert.ok(s.round <= rounds && (s.round === rounds || s.endReason === "all-houses"));
  else assert.ok(s.endReason === "all-houses" || s.endReason === "round-cap");
  return { slowest, plies: s.plies, rounds: roundsSeen, reason: s.endReason, houses: `${a}-${b}` };
}

for (const holesPerSide of [6, 12] as const) {
  for (const variant of ["ncho", "akahausa"] as const) {
    for (const rounds of [3, "all"] as const) {
      ok(`computer v computer: ${holesPerSide} holes, ${variant}, rounds ${rounds}`, () => {
        const games = holesPerSide === 6 ? 3 : 2;
        const levels = holesPerSide === 6 ? (["easy", "medium", "hard"] as const) : (["easy", "medium"] as const);
        const summary: string[] = [];
        for (let g = 1; g <= games; g++) {
          const r = playOut(holesPerSide, variant, rounds, g * 7 + holesPerSide, levels);
          summary.push(`${r.plies} moves/${r.rounds} rounds/${r.reason} ${r.houses}`);
        }
        console.log(`        ${summary.join(", ")}`);
      });
    }
  }
}

ok("hard moves stay under 300ms on 12 holes (both variants)", () => {
  let slowest = 0;
  for (const variant of ["ncho", "akahausa"] as const) {
    const r = playOut(12, variant, 3, 99, ["hard"]);
    slowest = Math.max(slowest, r.slowest);
  }
  const six = Math.max(playOut(6, "akahausa", 3, 98, ["hard"]).slowest, playOut(6, "ncho", 3, 97, ["hard"]).slowest);
  console.log(`        slowest hard move: ${slowest.toFixed(1)}ms on 12 holes, ${six.toFixed(1)}ms on 6 holes`);
  assert.ok(slowest < 300, `slowest move ${slowest.toFixed(0)}ms`);
  assert.ok(six < 300, `slowest 6-hole move ${six.toFixed(0)}ms`);
});

console.log(`ncho: all ${checks} tests passed`);
