// Ludo (lib/arcade/ludo.ts): board geometry, rolling, moving, captures, safe squares, exact finish, the win and the computer player.
// Run: npx -y tsx tests/arcade/ludo.test.ts
import assert from "node:assert/strict";
import {
  HOME, HOME_COLUMN, LAST_TRACK, PLAYERS, SAFE, START, STARS, TRACK, YARD, YARD_ORIGIN,
  absSquare, applyMove, applyRoll, autoStep, chooseMove, legalMoves, newGame, rollDie, seedCell, seededRng, threatAt,
  type LudoState,
} from "../../lib/arcade/ludo";

const withSeeds = (seeds: number[][], extra: Partial<LudoState> = {}): LudoState => ({ ...newGame(), seeds, ...extra });
const key = ([r, c]: [number, number]) => `${r},${c}`;

// Geometry: 52 distinct track squares on the cross arms, home columns lead to the centre, nothing overlaps a yard.
assert.equal(TRACK.length, 52);
assert.equal(new Set(TRACK.map(key)).size, 52);
const inYard = ([r, c]: [number, number]) => YARD_ORIGIN.some(([yr, yc]) => r >= yr && r < yr + 6 && c >= yc && c < yc + 6);
const inCentre = ([r, c]: [number, number]) => r >= 6 && r <= 8 && c >= 6 && c <= 8;
assert.ok(TRACK.every((cell) => !inYard(cell) && !inCentre(cell)));
for (let i = 0; i < 52; i++) {
  const [r1, c1] = TRACK[i]; const [r2, c2] = TRACK[(i + 1) % 52];
  assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2) <= 2, true, `track step ${i} is adjacent`);
}
const homeCells = HOME_COLUMN.flat().map(key);
assert.equal(new Set([...homeCells, ...TRACK.map(key)]).size, 52 + 20, "home columns don't overlap the track");
for (let p = 0; p < PLAYERS; p++) {
  // The last track square sits right next to the first home-column square.
  const [r1, c1] = seedCell(p, LAST_TRACK)!; const [r2, c2] = seedCell(p, LAST_TRACK + 1)!;
  assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2), 1, `player ${p} turns into home`);
  // Start square is right beside the player's own yard.
  const [sr, sc] = TRACK[START[p]]; const [yr, yc] = YARD_ORIGIN[p];
  assert.ok(sr >= yr - 1 && sr <= yr + 6 && sc >= yc - 1 && sc <= yc + 6, `player ${p} starts by its yard`);
}
assert.equal(SAFE.size, 8);
assert.deepEqual(STARS, [48, 9, 22, 35]);
assert.equal(seedCell(0, YARD), null);
assert.equal(seedCell(0, HOME), null);

// Dice.
const rng = seededRng(7);
for (let i = 0; i < 500; i++) { const d = rollDie(rng); assert.ok(d >= 1 && d <= 6); }
assert.equal(rollDie(() => 0.9999999), 6);
assert.equal(rollDie(() => 0), 1);

// Start: everyone in the yard, your turn. A non-six with everything in the yard passes.
let s = newGame();
assert.equal(s.turn, 0);
assert.equal(s.phase, "roll");
assert.ok(s.seeds.every((row) => row.every((p) => p === YARD)));
s = applyRoll(s, 4);
assert.equal(s.turn, 1);
assert.equal(s.phase, "roll");
assert.deepEqual(s.last, { kind: "pass", player: 0, die: 4 });
assert.throws(() => applyMove(s, 0), /Not time to move/);

// A six brings a seed out onto the start square and gives another roll.
s = applyRoll(newGame(), 6);
assert.equal(s.phase, "move");
assert.deepEqual(legalMoves(s), [0, 1, 2, 3]);
const before = JSON.stringify(s);
const out = applyMove(s, 2);
assert.equal(JSON.stringify(s), before, "applyMove doesn't mutate");
assert.equal(out.seeds[0][2], 0);
assert.equal(absSquare(0, 0), START[0]);
assert.equal(out.turn, 0);
assert.equal(out.phase, "roll");
assert.equal(out.sixes, 1);
assert.equal(out.last?.kind === "move" && out.last.bonus, true);

// A normal roll moves the seed on and passes the turn.
let t = applyMove(applyRoll(out, 3), 2);
assert.equal(t.seeds[0][2], 3);
assert.equal(t.turn, 1);
assert.equal(t.sixes, 0);

// Three sixes in a row: the turn is lost.
s = withSeeds([[0, 10, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
s = applyMove(applyRoll(s, 6), 0);
s = applyMove(applyRoll(s, 6), 0);
assert.equal(s.sixes, 2);
assert.equal(s.turn, 0);
s = applyRoll(s, 6);
assert.equal(s.turn, 1);
assert.equal(s.sixes, 0);
assert.deepEqual(s.last, { kind: "three-sixes", player: 0 });
assert.deepEqual(s.seeds[0], [12, 10, YARD, YARD], "the third six moves nothing");

// Exact roll to finish.
s = withSeeds([[54, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
t = applyRoll(s, 3);
assert.equal(t.last?.kind, "pass", "54 + 3 overshoots home");
t = applyRoll(s, 2);
assert.deepEqual(legalMoves(t), [0]);
t = applyMove(t, 0);
assert.equal(t.seeds[0][0], HOME);
assert.throws(() => applyMove({ ...t, phase: "move", die: 1, turn: 0 }, 0), /Illegal/);

// Capture: land on another colour on a plain square, it goes back to its yard and you roll again.
// Player 0 at progress 2 (square 42). Player 1 sits on square 45 = its progress 44.
assert.equal(absSquare(1, 44), 45);
s = withSeeds([[2, YARD, YARD, YARD], [44, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
assert.equal(threatAt(s, 1, 45), 1, "player 0 threatens it");
t = applyMove(applyRoll(s, 3), 0);
assert.equal(t.seeds[0][0], 5);
assert.equal(t.seeds[1][0], YARD);
assert.equal(t.turn, 0, "capture gives a bonus roll");
assert.equal(t.captures[0], 1);
assert.deepEqual(t.last?.kind === "move" && t.last.captured, [{ player: 1, seed: 0 }]);

// Safe squares: no capture on a star or a start square; both seeds share it.
// Player 0's star is square 48 (its progress 8). Player 1 sits there at its progress 47.
assert.ok(SAFE.has(48));
s = withSeeds([[5, YARD, YARD, YARD], [47, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
t = applyMove(applyRoll(s, 3), 0);
assert.equal(t.seeds[1][0], 47);
assert.equal(t.turn, 1);
// Bringing a seed out onto your start square doesn't capture a visitor there either.
s = withSeeds([[YARD, YARD, YARD, YARD], [39, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
assert.equal(absSquare(1, 39), START[0]);
t = applyMove(applyRoll(s, 6), 0);
assert.equal(t.seeds[1][0], 39);
// Seeds in a home column can't be captured: they're off the shared track.
assert.equal(absSquare(1, 52), null);

// Winning: the last seed home ends the game.
s = withSeeds([[HOME, HOME, HOME, 55], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
t = applyMove(applyRoll(s, 1), 3);
assert.equal(t.phase, "over");
assert.equal(t.winner, 0);
assert.throws(() => applyRoll(t, 3), /Not time to roll/);

// Computer player: capture > finish > leave yard > advance.
s = withSeeds([[YARD, 53, 2, 20], [44, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], { phase: "move", die: 3 });
assert.equal(chooseMove(s), 2, "capture first");
s = withSeeds([[YARD, 50, 2, 20], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], { phase: "move", die: 6 });
assert.equal(chooseMove(s), 1, "finish before leaving the yard");
s = withSeeds([[YARD, 10, 2, 20], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], { phase: "move", die: 6 });
assert.equal(chooseMove(s), 0, "leave the yard on a six");
// A threatened seed runs: player 0's seed at progress 4 (square 44), player 1 two behind on square 42 (its progress 41).
s = withSeeds([[4, 20, YARD, YARD], [41, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], { phase: "move", die: 5 });
assert.equal(threatAt(s, 0, 44), 1);
assert.equal(chooseMove(s), 0, "move the seed in danger");

// Full games between four computer players always finish, with only legal moves.
for (let g = 1; g <= 40; g++) {
  const r = seededRng(g * 101);
  let state = newGame();
  let steps = 0;
  while (state.phase !== "over" && steps < 20000) {
    if (state.phase === "move") {
      const choice = chooseMove(state);
      assert.ok(legalMoves(state).includes(choice));
    }
    state = autoStep(state, r);
    for (const row of state.seeds) for (const p of row) assert.ok(p >= YARD && p <= HOME);
    steps++;
  }
  assert.equal(state.phase, "over", `game ${g} finished`);
  assert.ok(state.winner !== null && state.seeds[state.winner].every((p) => p === HOME));
}

console.log("ludo tests passed");
