// Ludo (lib/arcade/ludo.ts): board geometry, rolling, moving, captures, safe squares, exact finish, the win and the computer player,
// with 1 die (the first half) and 2 dice (the default), and the optional "6 + 5 straight home" rule.
// Run: npx -y tsx tests/arcade/ludo.test.ts
import assert from "node:assert/strict";
import {
  HOME, HOME_COLUMN, LAST_TRACK, PLAYERS, SAFE, START, STARS, TRACK, YARD, YARD_ORIGIN,
  DEFAULT_OPTIONS, absSquare, applyAction, applyMove, applyRoll, autoStep, chooseAction, diceForSeed, legalActions, legalMoves, newGame,
  rollDice, rollDie, seedCell, seededRng, straightHomeSeed, threatAt,
  type LudoAction, type LudoOptions, type LudoState,
} from "../../lib/arcade/ludo";

const ONE: Partial<LudoOptions> = { dice: 1 };
const withSeeds = (seeds: number[][], extra: Partial<LudoState> = {}, options: Partial<LudoOptions> = ONE): LudoState => ({ ...newGame(options), seeds, ...extra });
const Y = YARD;
const others = [[Y, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]];
// A "move" state with this roll waiting, for computer tests.
const waiting = (dice: number[]) => ({ phase: "move" as const, dice, used: dice.map(() => false) });
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

// Options: 2 dice by default, 6 + 5 straight home off.
assert.deepEqual(DEFAULT_OPTIONS, { dice: 2, sixFiveHome: false });
assert.deepEqual(newGame().options, { dice: 2, sixFiveHome: false });
assert.equal(rollDice(2, rng).length, 2);

// ---- 1 die ----
// Start: everyone in the yard, your turn. A non-six with everything in the yard passes.
let s = newGame(ONE);
assert.equal(s.turn, 0);
assert.equal(s.phase, "roll");
assert.ok(s.seeds.every((row) => row.every((p) => p === YARD)));
s = applyRoll(s, 4);
assert.equal(s.turn, 1);
assert.equal(s.phase, "roll");
assert.deepEqual(s.last, { kind: "pass", player: 0, dice: [4] });
assert.throws(() => applyMove(s, 0), /Not time to move/);

// A six brings a seed out onto the start square and gives another roll.
s = applyRoll(newGame(ONE), 6);
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
assert.throws(() => applyMove({ ...t, phase: "move", dice: [1], used: [false], turn: 0 }, 0), /Illegal/);

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
s = withSeeds([[YARD, 53, 2, 20], [44, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], waiting([3]));
assert.equal(chooseAction(s).seed, 2, "capture first");
s = withSeeds([[YARD, 50, 2, 20], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], waiting([6]));
assert.equal(chooseAction(s).seed, 1, "finish before leaving the yard");
s = withSeeds([[YARD, 10, 2, 20], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], waiting([6]));
assert.equal(chooseAction(s).seed, 0, "leave the yard on a six");
// A threatened seed runs: player 0's seed at progress 4 (square 44), player 1 two behind on square 42 (its progress 41).
s = withSeeds([[4, 20, YARD, YARD], [41, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]], waiting([5]));
assert.equal(threatAt(s, 0, 44), 1);
assert.equal(chooseAction(s).seed, 0, "move the seed in danger");

// 1 die, 6 + 5 straight home: a 6 that brings a seed out, then a 5 on the bonus roll, may send that seed home.
const ONE_HOME: Partial<LudoOptions> = { dice: 1, sixFiveHome: true };
s = applyMove(applyRoll(newGame(ONE_HOME), 6), 2);
assert.equal(s.released, 2);
t = applyRoll(s, 5);
assert.equal(straightHomeSeed(t), 2);
assert.deepEqual(legalActions(t), [{ kind: "step", seed: 2, die: 0 }, { kind: "home", seed: 2 }], "a choice, not forced");
assert.equal(chooseAction(t).kind, "home", "the computer takes it");
let h = applyAction(t, { kind: "home", seed: 2 });
assert.equal(h.seeds[0][2], HOME);
assert.equal(h.turn, 1, "a 5 gives no bonus roll");
assert.deepEqual(h.last, { kind: "straight-home", player: 0, seed: 2, bonus: false });
h = applyMove(t, 2); // or just move it 5
assert.equal(h.seeds[0][2], 5);
// Option off: the same 6 then 5 is just a 6 and a 5.
t = applyRoll(applyMove(applyRoll(newGame(ONE), 6), 2), 5);
assert.equal(straightHomeSeed(t), null);
assert.ok(legalActions(t).every((a) => a.kind === "step"));
// The 6 spent on a seed already out: nothing to send home.
s = withSeeds([[10, Y, Y, Y], ...others], {}, ONE_HOME);
t = applyRoll(applyMove(applyRoll(s, 6), 0), 5);
assert.equal(straightHomeSeed(t), null);
// A 5 that doesn't follow a 6 (a fresh turn) doesn't count.
s = withSeeds([[0, Y, Y, Y], ...others], {}, ONE_HOME);
assert.equal(straightHomeSeed(applyRoll(s, 5)), null);
// Seeds near home can't use the 5, but the seed just brought out can, or it can go straight home.
s = withSeeds([[HOME, HOME, 53, Y], ...others], {}, ONE_HOME);
t = applyRoll(applyMove(applyRoll(s, 6), 3), 5);
assert.equal(t.phase, "move");
assert.deepEqual(legalActions(t), [{ kind: "step", seed: 3, die: 0 }, { kind: "home", seed: 3 }]);

// ---- 2 dice (the default) ----
const TWO: Partial<LudoOptions> = { dice: 2 };
const TWO_HOME: Partial<LudoOptions> = { dice: 2, sixFiveHome: true };
assert.throws(() => applyRoll(newGame(), 4), /Bad die/);
assert.throws(() => applyRoll(newGame(), [4, 7]), /Bad die/);
// No 6 with everything in the yard: pass.
s = applyRoll(newGame(), [4, 3]);
assert.deepEqual(s.last, { kind: "pass", player: 0, dice: [4, 3] });
assert.equal(s.turn, 1);

// Each die is used separately: on two different seeds…
s = withSeeds([[10, 20, Y, Y], ...others], {}, TWO);
t = applyRoll(s, [3, 4]);
assert.deepEqual(legalActions(t), [
  { kind: "step", seed: 0, die: 0 }, { kind: "step", seed: 1, die: 0 },
  { kind: "step", seed: 0, die: 1 }, { kind: "step", seed: 1, die: 1 },
]);
let u = applyMove(t, 1, 1);
assert.equal(u.seeds[0][1], 24);
assert.equal(u.phase, "move");
assert.equal(u.turn, 0, "the other die is still to use");
assert.deepEqual(u.used, [false, true]);
assert.deepEqual(legalActions(u), [{ kind: "step", seed: 0, die: 0 }, { kind: "step", seed: 1, die: 0 }]);
assert.throws(() => applyMove(u, 0, 1), /Illegal/, "a spent die can't be used again");
u = applyMove(u, 0, 0);
assert.deepEqual(u.seeds[0], [13, 24, Y, Y]);
assert.equal(u.turn, 1);
assert.deepEqual(u.last?.kind === "move" && u.last.forfeited, []);
// …or both on the same seed, in either order.
assert.deepEqual(applyMove(applyMove(t, 0, 0), 0, 1).seeds[0], [17, 20, Y, Y]);
assert.deepEqual(applyMove(applyMove(t, 0, 1), 0, 0).seeds[0], [17, 20, Y, Y]);
assert.deepEqual(diceForSeed(t, 0), [0, 1]);

// A 6 on either die brings a seed out; a single 6 gives no extra roll.
for (const roll of [[6, 3], [3, 6]]) {
  const six = roll.indexOf(6);
  t = applyRoll(newGame(), roll);
  assert.deepEqual(legalMoves(t), [0, 1, 2, 3]);
  assert.ok(legalActions(t).every((a) => a.kind === "step" && a.die === six), "only the 6 can be used first");
  u = applyMove(t, 0, six);
  assert.equal(u.seeds[0][0], 0);
  assert.equal(u.phase, "move");
  assert.deepEqual(legalActions(u), [{ kind: "step", seed: 0, die: 1 - six }], "then the 3 moves the seed that came out");
  u = applyMove(u, 0);
  assert.equal(u.seeds[0][0], 3);
  assert.equal(u.turn, 1, "a single 6 doesn't give another roll");
  assert.equal(u.sixes, 0);
}

// A double 6 gives another roll.
t = applyRoll(newGame(), [6, 6]);
assert.deepEqual(legalActions(t), [0, 1, 2, 3].map((seed) => ({ kind: "step", seed, die: 0 })), "equal dice offered once");
u = applyMove(applyMove(t, 0), 1);
assert.deepEqual(u.seeds[0], [0, 0, Y, Y]);
assert.equal(u.turn, 0);
assert.equal(u.phase, "roll");
assert.equal(u.sixes, 1);
assert.equal(u.last?.kind === "move" && u.last.bonus, true);

// Three double 6s in a row lose the turn.
s = withSeeds([[0, 10, Y, Y], ...others], {}, TWO);
s = applyMove(applyMove(applyRoll(s, [6, 6]), 0), 0);
s = applyMove(applyMove(applyRoll(s, [6, 6]), 0), 0);
assert.equal(s.sixes, 2);
assert.equal(s.turn, 0);
s = applyRoll(s, [6, 6]);
assert.deepEqual(s.last, { kind: "three-sixes", player: 0 });
assert.equal(s.turn, 1);
assert.equal(s.sixes, 0);
assert.deepEqual(s.seeds[0], [24, 10, Y, Y], "the third double 6 moves nothing");
// A double 6, then anything else, resets the count.
s = withSeeds([[0, 10, Y, Y], ...others], {}, TWO);
s = applyMove(applyMove(applyRoll(s, [6, 6]), 0), 0);
s = applyMove(applyMove(applyRoll(s, [6, 2]), 0), 0);
assert.equal(s.turn, 1);
assert.equal(s.sixes, 0);

// A die that can't be used is forfeited.
s = withSeeds([[54, Y, Y, Y], ...others], {}, TWO);
t = applyRoll(s, [2, 3]);
assert.deepEqual(legalActions(t), [{ kind: "step", seed: 0, die: 0 }], "54 + 3 overshoots");
u = applyMove(t, 0);
assert.equal(u.seeds[0][0], HOME);
assert.equal(u.turn, 1);
assert.deepEqual(u.used, [true, true]);
assert.deepEqual(u.last?.kind === "move" && u.last.forfeited, [3]);
assert.deepEqual(applyRoll(s, [3, 4]).last, { kind: "pass", player: 0, dice: [3, 4] });

// Capture with one die: the other die is still used, then the bonus roll.
// Player 0 at progress 2 (square 42); player 1 on square 45 (its progress 44).
s = withSeeds([[2, Y, Y, Y], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, TWO);
t = applyRoll(s, [3, 6]);
const smart = chooseAction(t);
assert.deepEqual(smart, { kind: "step", seed: 0, die: 0 }, "the computer puts the 3 on the capture");
u = applyAction(t, smart);
assert.equal(u.seeds[1][0], Y);
assert.equal(u.captures[0], 1);
assert.equal(u.phase, "move", "the 6 is still to use");
assert.equal(u.last?.kind === "move" && u.last.bonus, false);
assert.deepEqual(chooseAction(u), { kind: "step", seed: 1, die: 1 }, "then brings a seed out with the 6");
u = applyAction(u, chooseAction(u));
assert.equal(u.turn, 0, "capture bonus after the other die is used");
assert.equal(u.phase, "roll");
assert.equal(u.last?.kind === "move" && u.last.bonus, true);
// Capture bonus even when the other die is forfeited.
s = withSeeds([[2, HOME, HOME, HOME], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, TWO);
u = applyMove(applyRoll(s, [3, 4]), 0, 0);
assert.equal(u.seeds[0][0], 5);
assert.equal(u.phase, "move");
u = applyMove(u, 0);
assert.equal(u.turn, 0);
// Capture with the last die is a bonus roll too.
u = applyMove(applyMove(applyRoll(s, [1, 2]), 0, 1), 0);
assert.equal(u.seeds[0][0], 5);
assert.equal(u.seeds[1][0], Y);
assert.equal(u.turn, 0);

// 6 + 5 straight home with 2 dice: only when the option is on, a choice, the computer takes it.
t = applyRoll(newGame(TWO), [6, 5]);
assert.equal(straightHomeSeed(t), null, "off by default");
assert.ok(legalActions(t).every((a) => a.kind === "step"));
assert.throws(() => applyAction(t, { kind: "home", seed: 0 }), /Illegal/);
for (const roll of [[6, 5], [5, 6]]) {
  s = withSeeds([[Y, Y, 30, Y], ...others], {}, TWO_HOME);
  t = applyRoll(s, roll);
  const acts = legalActions(t);
  assert.deepEqual(acts.at(-1), { kind: "home", seed: 0 });
  assert.ok(acts.some((a) => a.kind === "step"), "normal moves are still on offer");
  assert.deepEqual(chooseAction(t), { kind: "home", seed: 0 }, "the computer takes it");
  h = applyAction(t, { kind: "home", seed: 0 });
  assert.deepEqual(h.seeds[0], [HOME, Y, 30, Y]);
  assert.deepEqual(h.used, [true, true]);
  assert.equal(h.turn, 1);
  assert.deepEqual(h.last, { kind: "straight-home", player: 0, seed: 0, bonus: false });
  // Not forced: use the dice normally, and once one die is spent the offer is gone.
  u = applyMove(t, 0, roll.indexOf(6));
  assert.equal(straightHomeSeed(u), null);
  u = applyMove(u, 2);
  assert.deepEqual(u.seeds[0], [0, Y, 35, Y]);
}
assert.equal(straightHomeSeed(applyRoll(withSeeds([[10, 20, 30, 40], ...others], {}, TWO_HOME), [6, 5])), null, "needs a seed in the yard");
assert.equal(straightHomeSeed(applyRoll(withSeeds([[Y, 20, 30, 40], ...others], {}, TWO_HOME), [6, 4])), null, "needs a 6 and a 5");
// The last seed home this way wins.
h = applyAction(applyRoll(withSeeds([[HOME, HOME, HOME, Y], ...others], {}, TWO_HOME), [5, 6]), { kind: "home", seed: 3 });
assert.equal(h.phase, "over");
assert.equal(h.winner, 0);
// A capture still beats it: player 0's seed at progress 2 (square 42) + 5 lands on player 1 at its progress 46 (square 47).
assert.equal(absSquare(1, 46), 47);
s = withSeeds([[Y, 2, Y, Y], [46, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, TWO_HOME);
t = applyRoll(s, [6, 5]);
assert.equal(chooseAction(t).kind, "step", "capture first");
u = applyAction(t, chooseAction(t));
u = applyAction(u, chooseAction(u));
assert.equal(u.captures[0], 1);
assert.equal(u.turn, 0);

// Purity: rolling and acting never change the state passed in.
for (const opts of [ONE, ONE_HOME, TWO, TWO_HOME]) {
  const r = seededRng(99);
  let state = newGame(opts);
  for (let i = 0; i < 400 && state.phase !== "over"; i++) {
    const snap = JSON.stringify(state);
    const next = autoStep(state, r);
    assert.equal(JSON.stringify(state), snap, "autoStep doesn't mutate");
    if (state.phase === "move") for (const a of legalActions(state)) { applyAction(state, a); assert.equal(JSON.stringify(state), snap); }
    state = next;
  }
}

// Full games between four computer players always finish, with only legal moves, in both modes, option on and off.
for (const opts of [ONE, ONE_HOME, TWO, TWO_HOME]) {
  let straight = 0;
  for (let g = 1; g <= 25; g++) {
    const r = seededRng(g * 101 + opts.dice! * 7 + (opts.sixFiveHome ? 3 : 0));
    let state = newGame(opts);
    let steps = 0;
    while (state.phase !== "over" && steps < 20000) {
      if (state.phase === "move") {
        const choice: LudoAction = chooseAction(state);
        assert.ok(legalActions(state).some((a) => JSON.stringify(a) === JSON.stringify(choice)));
        if (choice.kind === "home") straight++;
      }
      const before = state;
      state = autoStep(state, r);
      if (before.phase === "roll") assert.equal(state.dice.length, opts.dice);
      for (const row of state.seeds) for (const p of row) assert.ok(p >= YARD && p <= HOME);
      steps++;
    }
    assert.equal(state.phase, "over", `game ${g} finished (${JSON.stringify(opts)})`);
    assert.ok(state.winner !== null && state.seeds[state.winner].every((p) => p === HOME));
  }
  if (opts.sixFiveHome) assert.ok(straight > 0, `6 + 5 straight home came up (${JSON.stringify(opts)})`);
  else assert.equal(straight, 0);
  console.log(`  ${opts.dice} ${opts.dice === 1 ? "die" : "dice"}, 6+5 home ${opts.sixFiveHome ? "on" : "off"}: 25 games finished, ${straight} straight-home moves`);
}

console.log("ludo tests passed");
