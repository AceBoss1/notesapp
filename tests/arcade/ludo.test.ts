// Ludo (lib/arcade/ludo.ts): board geometry, rolling, moving, captures, safe squares, exact finish, the win and the computer player,
// with 1 die (the first half) and 2 dice (the default), and the optional "6 + 5 straight home" rule. Sixes (double sixes with
// 2 dice) are banked and rolled again; the bank is spent in any order once the rolling stops. Only stars are safe.
// Seats: 2 v 2 yards (any two colours each, same-owner colours share squares, all 8 home wins), empty yards, and the knockout.
// Run: npx -y tsx tests/arcade/ludo.test.ts
import assert from "node:assert/strict";
import {
  HOME, HOME_COLUMN, LAST_TRACK, PLAYERS, SAFE, START, STARS, TRACK, YARD, YARD_ORIGIN,
  DEFAULT_OPTIONS, DEFAULT_TABLE, absSquare, advanceKnockout, controllers, coloursOf, finalYards, friendly, inPlay, knockoutGame, newKnockout, playOutKnockout, twoYardsTable, applyAction, applyMove, applyRoll, autoStep, chooseAction, diceForSeed, legalActions, legalMoves, newGame,
  banked, rollDice, rollDie, seedCell, seededRng, straightHomeSeed, threatAt,
  type LudoAction, type LudoOptions, type LudoState, type LudoTable,
} from "../../lib/arcade/ludo";

// Most tests play with "hit → home" off so a capturing seed stays where it landed; it has its own tests below.
const ONE: Partial<LudoOptions> = { dice: 1, hitHome: false };
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
assert.equal(SAFE.size, 4); // the stars only
assert.deepEqual(STARS, [48, 9, 22, 35]);
assert.equal(seedCell(0, YARD), null);
assert.equal(seedCell(0, HOME), null);

// Dice.
const rng = seededRng(7);
for (let i = 0; i < 500; i++) { const d = rollDie(rng); assert.ok(d >= 1 && d <= 6); }
assert.equal(rollDie(() => 0.9999999), 6);
assert.equal(rollDie(() => 0), 1);
// Options: 2 dice by default, 6 + 5 straight home off, hit → home on.
// Options: 2 dice by default, 6 + 5 straight home off.
assert.deepEqual(DEFAULT_OPTIONS, { dice: 2, sixFiveHome: false, hitHome: true });
assert.deepEqual(newGame().options, { dice: 2, sixFiveHome: false, hitHome: true });
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

// A six is banked and you roll again; nothing moves until a non-six ends the rolling.
s = applyRoll(newGame(ONE), 6);
assert.equal(s.phase, "roll", "roll again after a six");
assert.equal(s.turn, 0);
assert.deepEqual(banked(s), [6]);
assert.equal(s.sixes, 1);
s = applyRoll(s, 3);
assert.equal(s.phase, "move");
assert.deepEqual(s.dice, [6, 3]);
assert.equal(s.sixes, 0);
assert.deepEqual(legalActions(s), [0, 1, 2, 3].map((seed) => ({ kind: "step", seed, die: 0 })), "only the 6 can bring a seed out");
const before = JSON.stringify(s);
const out = applyMove(s, 2, 0);
assert.equal(JSON.stringify(s), before, "applyMove doesn't mutate");
assert.equal(out.seeds[0][2], 0);
assert.equal(absSquare(0, 0), START[0]);
assert.equal(out.turn, 0);
assert.equal(out.phase, "move", "the 3 is still to spend");
assert.deepEqual(banked(out), [3]);

// Spending the last banked roll passes the turn.
let t = applyMove(out, 2);
assert.equal(t.seeds[0][2], 3);
assert.equal(t.turn, 1);
assert.equal(t.sixes, 0);

// The bank is spent in any order, on any seeds: 6, 6, 2 with a seed out already.
s = withSeeds([[10, Y, Y, Y], ...others]);
s = applyRoll(applyRoll(applyRoll(s, 6), 6), 2);
assert.deepEqual(s.dice, [6, 6, 2]);
let v = applyMove(s, 0, 2); // the 2 first, on the seed that's out
assert.deepEqual(v.seeds[0], [12, Y, Y, Y]);
v = applyMove(applyMove(v, 1, 0), 2, 1); // then both sixes bring two seeds out
assert.deepEqual(v.seeds[0], [12, 0, 0, Y]);
assert.equal(v.turn, 1);
v = applyMove(applyMove(applyMove(s, 1, 0), 1, 1), 1, 2); // or all three on one seed
assert.deepEqual(v.seeds[0], [10, 8, Y, Y]);

// Three sixes in a row: the turn is lost, and the bank with it.
s = withSeeds([[0, 10, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
s = applyRoll(applyRoll(s, 6), 6);
assert.equal(s.sixes, 2);
assert.equal(s.turn, 0);
s = applyRoll(s, 6);
assert.equal(s.turn, 1);
assert.equal(s.sixes, 0);
assert.deepEqual(banked(s), []);
assert.deepEqual(s.last, { kind: "three-sixes", player: 0 });
assert.deepEqual(s.seeds[0], [0, 10, YARD, YARD], "nothing moves");

// Exact roll to finish.
s = withSeeds([[54, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
t = applyRoll(s, 3);
assert.equal(t.last?.kind, "pass", "54 + 3 overshoots home");
t = applyRoll(s, 2);
assert.deepEqual(legalMoves(t), [0]);
t = applyMove(t, 0);
assert.equal(t.seeds[0][0], HOME);
assert.throws(() => applyMove({ ...t, phase: "move", dice: [1], used: [false], turn: 0 }, 0), /Illegal/);

// Capture: land on another colour on a plain square, it goes back to its yard. No bonus roll for a capture.
// Player 0 at progress 2 (square 42). Player 1 sits on square 45 = its progress 44.
assert.equal(absSquare(1, 44), 45);
s = withSeeds([[2, YARD, YARD, YARD], [44, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
assert.equal(threatAt(s, 1, 45), 1, "player 0 threatens it");
t = applyMove(applyRoll(s, 3), 0);
assert.equal(t.seeds[0][0], 5);
assert.equal(t.seeds[1][0], YARD);
assert.equal(t.turn, 1, "a capture earns no bonus roll: next player");
assert.equal(t.captures[0], 1);
assert.deepEqual(t.last?.kind === "move" && t.last.captured, [{ player: 1, seed: 0 }]);

// Stars are safe: both seeds share it.
// Player 0's star is square 48 (its progress 8). Player 1 sits there at its progress 47.
assert.ok(SAFE.has(48));
assert.equal(SAFE.size, 4, "only the four stars are safe");
assert.ok(START.every((sq) => !SAFE.has(sq)), "start squares aren't safe");
s = withSeeds([[5, YARD, YARD, YARD], [47, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
t = applyMove(applyRoll(s, 3), 0);
assert.equal(t.seeds[1][0], 47);
assert.equal(t.turn, 1);
// Start squares aren't safe: bringing a seed out sends a visitor on your start square back to its yard…
s = withSeeds([[YARD, YARD, YARD, YARD], [39, YARD, YARD, YARD], [YARD, YARD, YARD, YARD], [YARD, YARD, YARD, YARD]]);
assert.equal(absSquare(1, 39), START[0]);
assert.equal(threatAt(s, 1, START[0]), 1, "your yard threatens your start square");
t = applyMove(applyRoll(applyRoll(s, 6), 1), 0, 0);
assert.equal(t.seeds[1][0], YARD);
assert.equal(t.seeds[0][0], 0);
assert.equal(t.phase, "move", "no bonus roll: spend the 1 still banked");
assert.deepEqual(banked(t), [1]);
// …and the last seed to land on someone's start square sends the one sitting there home (coral lands on blue's start).
assert.equal(absSquare(3, 0), START[3]);
assert.equal(absSquare(1, 26), START[3]);
s = withSeeds([[Y, Y, Y, Y], [24, Y, Y, Y], [Y, Y, Y, Y], [0, Y, Y, Y]], { turn: 1 });
t = applyMove(applyRoll(s, 2), 0);
assert.equal(t.seeds[3][0], YARD, "blue back to its yard");
assert.equal(t.seeds[1][0], 26);
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

// 1 die, 6 + 5 straight home: a 6 then a 5 (both banked) may send a seed from the yard straight home.
const ONE_HOME: Partial<LudoOptions> = { dice: 1, sixFiveHome: true, hitHome: false };
t = applyRoll(applyRoll(newGame(ONE_HOME), 6), 5);
assert.equal(straightHomeSeed(t), 0);
assert.deepEqual(legalActions(t), [0, 1, 2, 3].map((seed) => ({ kind: "step", seed, die: 0 })).concat([{ kind: "home", seed: 0 } as never]), "a choice, not forced");
assert.equal(chooseAction(t).kind, "home", "the computer takes it");
let h = applyAction(t, { kind: "home", seed: 0 });
assert.equal(h.seeds[0][0], HOME);
assert.equal(h.turn, 1, "both rolls spent");
assert.deepEqual(h.last, { kind: "straight-home", player: 0, seed: 0 });
h = applyMove(applyMove(t, 2, 0), 2); // or bring a seed out and move it 5
assert.equal(h.seeds[0][2], 5);
// Option off: the same 6 then 5 is just a 6 and a 5.
t = applyRoll(applyRoll(newGame(ONE), 6), 5);
assert.equal(straightHomeSeed(t), null);
assert.ok(legalActions(t).every((a) => a.kind === "step"));
// Once the 6 is spent, the offer is gone.
assert.equal(straightHomeSeed(applyMove(applyRoll(applyRoll(newGame(ONE_HOME), 6), 5), 1, 0)), null);
// A 5 without a 6 doesn't count, nor with nothing in the yard.
assert.equal(straightHomeSeed(applyRoll(withSeeds([[0, Y, Y, Y], ...others], {}, ONE_HOME), 5)), null);
assert.equal(straightHomeSeed(applyRoll(applyRoll(withSeeds([[10, 20, 30, 40], ...others], {}, ONE_HOME), 6), 5)), null);

// ---- 2 dice (the default) ----
const TWO: Partial<LudoOptions> = { dice: 2, hitHome: false };
const TWO_HOME: Partial<LudoOptions> = { dice: 2, sixFiveHome: true, hitHome: false };
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

// A double 6 is banked and the dice roll again.
t = applyRoll(newGame(), [6, 6]);
assert.equal(t.phase, "roll");
assert.equal(t.turn, 0);
assert.deepEqual(banked(t), [6, 6]);
assert.equal(t.sixes, 1);
t = applyRoll(t, [3, 2]);
assert.equal(t.phase, "move");
assert.deepEqual(t.dice, [6, 6, 3, 2]);
assert.deepEqual(legalActions(t), [0, 1, 2, 3].map((seed) => ({ kind: "step", seed, die: 0 })), "equal dice offered once; only 6s usable yet");
u = applyMove(applyMove(t, 0, 0), 1, 1);
assert.deepEqual(u.seeds[0], [0, 0, Y, Y]);
assert.equal(u.phase, "move", "3 and 2 still banked");
u = applyMove(applyMove(u, 0, 2), 1, 3);
assert.deepEqual(u.seeds[0], [3, 2, Y, Y]);
assert.equal(u.turn, 1);

// Three double 6s in a row lose the turn and the bank.
s = withSeeds([[0, 10, Y, Y], ...others], {}, TWO);
s = applyRoll(applyRoll(s, [6, 6]), [6, 6]);
assert.equal(s.sixes, 2);
assert.equal(s.turn, 0);
s = applyRoll(s, [6, 6]);
assert.deepEqual(s.last, { kind: "three-sixes", player: 0 });
assert.equal(s.turn, 1);
assert.equal(s.sixes, 0);
assert.deepEqual(banked(s), []);
assert.deepEqual(s.seeds[0], [0, 10, Y, Y], "nothing moves");
// A double 6, then anything else, ends the rolling and resets the count.
s = withSeeds([[0, 10, Y, Y], ...others], {}, TWO);
s = applyRoll(applyRoll(s, [6, 6]), [6, 2]);
assert.equal(s.phase, "move");
assert.equal(s.sixes, 0);
assert.deepEqual(s.dice, [6, 6, 6, 2]);

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

// Capture with 2 dice: no bonus roll; you just spend the die you have left.
// Player 0 at progress 2 (square 42); player 1 on square 45 (its progress 44).
s = withSeeds([[2, Y, Y, Y], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, TWO);
t = applyRoll(s, [3, 6]);
const smart = chooseAction(t);
assert.deepEqual(smart, { kind: "step", seed: 0, die: 0 }, "the computer puts the 3 on the capture");
u = applyAction(t, smart);
assert.equal(u.seeds[1][0], Y);
assert.equal(u.captures[0], 1);
assert.equal(u.turn, 0);
assert.equal(u.phase, "move", "capture: no bonus roll, spend the 6");
assert.deepEqual(banked(u), [6], "the 6 is still to spend");
// A capture with the last die ends the turn.
s = withSeeds([[2, HOME, HOME, HOME], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, TWO);
u = applyMove(applyMove(applyRoll(s, [1, 2]), 0, 1), 0);
assert.equal(u.seeds[0][0], 5);
assert.equal(u.seeds[1][0], Y);
assert.equal(u.turn, 1, "next player: a capture earns no bonus roll");
assert.equal(u.phase, "roll");

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
  assert.deepEqual(h.last, { kind: "straight-home", player: 0, seed: 0 });
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
if (u.phase === "move" && u.turn === 0) u = applyAction(u, chooseAction(u)); // the other die (either order)
assert.equal(u.captures[0], 1, "the capture is taken this turn");
assert.equal(u.turn, 1, "then the turn passes: no bonus roll");

// "Hit → home" (on by default): the capturing seed goes straight home, the victim to its yard. Still no bonus roll.
assert.equal(DEFAULT_OPTIONS.hitHome, true);
{
  const HIT: Partial<LudoOptions> = { dice: 1, hitHome: true };
  s = withSeeds([[2, 20, Y, Y], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, HIT);
  t = applyMove(applyRoll(s, 3), 0);
  assert.equal(t.seeds[0][0], HOME, "the hitter is home");
  assert.equal(t.seeds[1][0], Y, "the victim is in its yard");
  assert.equal(t.turn, 1, "no bonus roll: next player");
  assert.ok(t.last?.kind === "move" && t.last.hitHome && t.last.to === 5);
  // A hit that brings your last seed home wins.
  s = withSeeds([[2, HOME, HOME, HOME], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, HIT);
  t = applyMove(applyRoll(s, 3), 0);
  assert.equal(t.phase, "over");
  assert.equal(t.winner, 0);
  // Off: the hitter stays where it landed.
  t = applyMove(applyRoll(withSeeds([[2, 20, Y, Y], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], {}, ONE), 3), 0);
  assert.equal(t.seeds[0][0], 5);
  assert.ok(t.last?.kind === "move" && !t.last.hitHome);
  // The computer counts the trip home: a capture is worth even more.
  s = withSeeds([[Y, 53, 2, 20], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], waiting([3]), HIT);
  assert.equal(chooseAction(s).seed, 2);
}

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
for (const opts of [ONE, ONE_HOME, TWO, TWO_HOME, { dice: 2 } as Partial<LudoOptions>, { dice: 1, hitHome: true } as Partial<LudoOptions>]) {
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
      if (before.phase === "roll") assert.equal(state.dice.length, banked(before).length + opts.dice!, "a roll adds to the bank");
      for (const row of state.seeds) for (const p of row) assert.ok(p >= YARD && p <= HOME);
      steps++;
    }
    assert.equal(state.phase, "over", `game ${g} finished (${JSON.stringify(opts)})`);
    assert.ok(state.winner !== null && state.seeds[state.winner].every((p) => p === HOME));
  }
  if (opts.sixFiveHome) assert.ok(straight > 0, `6 + 5 straight home came up (${JSON.stringify(opts)})`);
  else assert.equal(straight, 0);
  console.log(`  ${opts.dice} ${opts.dice === 1 ? "die" : "dice"}, 6+5 home ${opts.sixFiveHome ? "on" : "off"}, hit home ${opts.hitHome === false ? "off" : "on"}: 25 games finished, ${straight} straight-home moves`);
}


// ---- Who plays which colour: 2 v 2 yards, empty yards, knockout ----
{
  const H = HOME;
  // The default table: four separate players, all yards in play, first to finish wins.
  assert.deepEqual(DEFAULT_TABLE, { owner: [0, 1, 2, 3], active: [true, true, true, true], playToLast: false });
  assert.deepEqual(newGame().table, DEFAULT_TABLE);
  assert.deepEqual(controllers(newGame()), [0, 1, 2, 3]);
  assert.throws(() => newGame({}, 0, { owner: [0, 0, 0, 0] }), /two controllers/);
  const table = (s0: LudoState, t0: Partial<LudoTable>): LudoState => ({ ...s0, table: { ...s0.table, ...t0 } });

  // Any two yards: all six pairs, opposite or side by side. The person is controller 0, the computer controller 1.
  const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (const pair of pairs) {
    const g = newGame(ONE, 0, twoYardsTable(pair));
    assert.deepEqual(controllers(g), [0, 1]);
    assert.deepEqual(coloursOf(g, 0), pair);
    assert.deepEqual(coloursOf(g, 1), [0, 1, 2, 3].filter((c) => !pair.includes(c)));
    assert.equal(g.turn, 0, "green always rolls first, whoever plays it");
  }
  assert.throws(() => twoYardsTable([1, 1]), /two different/);
  assert.throws(() => twoYardsTable([0]), /two different/);
  assert.throws(() => twoYardsTable([0, 4]), /two different/);

  // Your own colours share squares: green (progress 2, square 42) + 3 lands on coral (progress 44, square 45), no capture.
  s = withSeeds([[2, Y, Y, Y], [44, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], { table: twoYardsTable([0, 1]) });
  assert.equal(threatAt(s, 1, 45), 0, "your other colour isn't a threat");
  t = applyMove(applyRoll(s, 3), 0);
  assert.equal(t.seeds[0][0], 5);
  assert.equal(t.seeds[1][0], 44, "coral stays: same owner");
  assert.equal(t.captures[0], 0);
  assert.equal(t.turn, 1, "coral's turn (still yours)");
  // Against the other side's colour it's a capture as usual (you own green and gold here).
  t = applyMove(applyRoll({ ...s, table: twoYardsTable([0, 2]) }, 3), 0);
  assert.equal(t.seeds[1][0], Y);
  assert.equal(t.captures[0], 1, "capture");
  assert.equal(t.turn, 1, "no bonus roll");
  // The computer (coral + blue) doesn't count its partner as a threat: blue two behind coral.
  assert.equal(absSquare(3, 34), 9);
  s = withSeeds([[Y, Y, Y, Y], [10, Y, Y, Y], [Y, Y, Y, Y], [34, Y, Y, Y]]);
  assert.equal(threatAt(s, 1, 11), 1, "four players: blue threatens coral");
  assert.equal(threatAt(table(s, twoYardsTable([0, 2])), 1, 11), 0, "2 v 2: blue is coral's partner");
  // …and never "captures" it: coral at progress 8 (square 9) with a 2 would land on blue's square 11 (blue progress 36).
  s = withSeeds([[Y, Y, Y, Y], [8, 30, Y, Y], [Y, Y, Y, Y], [36, Y, Y, Y]], { turn: 1, table: twoYardsTable([0, 2]), ...waiting([2]) });
  u = applyMove(s, 0);
  assert.equal(u.seeds[3][0], 36);
  assert.equal(u.captures[1], 0);

  // 2 v 2: one colour home isn't a win; it drops out of the turn order and the partner plays on. All 8 home wins.
  s = withSeeds([[H, H, H, 55], [10, Y, Y, Y], [Y, Y, Y, Y], [Y, Y, Y, Y]], { table: twoYardsTable([0, 1]) });
  t = applyMove(applyRoll(s, 1), 3);
  assert.equal(t.phase, "roll", "not over: coral still has seeds out");
  assert.equal(t.winner, null);
  assert.deepEqual(t.order, []);
  assert.equal(t.turn, 1);
  t = applyRoll({ ...t, turn: 3 }, 4); // blue (computer) can't move: next is coral, green is skipped (all home)
  assert.equal(t.turn, 1);
  t = applyRoll(applyMove(applyRoll(t, 4), 0), 4); // coral 10 → 14, gold passes
  assert.equal(t.seeds[1][0], 14);
  assert.equal(t.turn, 3);
  t = applyRoll(t, 4);
  assert.equal(t.turn, 1, "green skipped again");
  s = withSeeds([[H, H, H, H], [H, H, 55, H], [Y, Y, Y, Y], [Y, Y, Y, Y]], { turn: 1, table: twoYardsTable([0, 1]) });
  t = applyMove(applyRoll(s, 1), 2);
  assert.equal(t.phase, "over");
  assert.equal(t.winner, 0, "the person wins with all 8 home");
  assert.equal(t.loser, 1);
  assert.deepEqual(t.order, [0]);
  // The computer's partner colour finishing first: same rule for controller 1.
  s = withSeeds([[Y, Y, Y, Y], [H, H, H, H], [Y, Y, Y, Y], [H, 55, H, H]], { turn: 3, table: twoYardsTable([0, 2]) });
  t = applyAction(applyRoll(s, 1), chooseAction(applyRoll(s, 1)));
  assert.equal(t.winner, 1);

  // An empty yard is skipped in turn order and never threatens or gets captured.
  const three: Partial<LudoTable> = { active: [true, true, false, true], playToLast: true };
  s = newGame(ONE, 0, three);
  assert.deepEqual(controllers(s), [0, 1, 3]);
  s = applyRoll(applyRoll(s, 4), 4);
  assert.equal(s.turn, 3, "coral passes straight to blue: gold's yard is empty");
  s = applyRoll(s, 4);
  assert.equal(s.turn, 0);
  assert.equal(newGame(ONE, 2, three).turn, 3, "an empty first yard hands the first turn on");
  assert.equal(threatAt(newGame(ONE, 0, three), 1, START[2]), 0, "an empty yard doesn't threaten its start square");
  assert.equal(threatAt(newGame(ONE), 1, START[2]), 1);

  // Playing to the last: the game carries on after the first finish until one player is left, who is the loser.
  s = withSeeds([[Y, Y, Y, Y], [Y, Y, Y, Y], [H, H, H, 55], [Y, Y, Y, Y]], { turn: 2, table: { ...DEFAULT_TABLE, playToLast: true } });
  t = applyMove(applyRoll(s, 1), 3);
  assert.equal(t.phase, "roll", "gold is home but the game goes on");
  assert.deepEqual(t.order, [2]);
  assert.equal(t.turn, 3);
  t = applyRoll(applyRoll(t, 4), 4); // blue and green pass
  assert.equal(t.turn, 1);
  t = applyRoll(t, 4);
  assert.equal(t.turn, 3, "gold is skipped: finished");

  // Knockout. Round 1: gold, green, blue finish; coral is last and out.
  let ko = newKnockout();
  assert.deepEqual(ko, { round: 1, alive: [0, 1, 2, 3], out: [], champion: null, results: [] });
  let g = knockoutGame(ko, ONE);
  assert.deepEqual(g.table, { owner: [0, 1, 2, 3], active: [true, true, true, true], playToLast: true });
  const finishVia = (state: LudoState, colour: number): LudoState => {
    const rows = state.seeds.map((r) => [...r]);
    rows[colour] = [H, H, H, 55];
    return applyMove(applyRoll({ ...state, seeds: rows, turn: colour, phase: "roll", dice: [], used: [], sixes: 0 }, 1), 3);
  };
  g = finishVia(g, 2);
  g = finishVia(g, 0);
  assert.equal(g.phase, "roll");
  assert.deepEqual(g.order, [2, 0]);
  g = finishVia(g, 3);
  assert.equal(g.phase, "over");
  assert.deepEqual(g.order, [2, 0, 3], "finishing order: 1st gold, 2nd green, 3rd blue");
  assert.equal(g.winner, 2);
  assert.equal(g.loser, 1, "coral is last");
  assert.throws(() => advanceKnockout(ko, newGame()), /isn't over/);
  ko = advanceKnockout(ko, g);
  assert.deepEqual(ko.alive, [0, 2, 3]);
  assert.deepEqual(ko.out, [1]);
  assert.equal(ko.round, 2);
  // Round 2: three players, coral's yard empty and skipped.
  g = knockoutGame(ko, ONE);
  assert.deepEqual(g.table.active, [true, false, true, true]);
  assert.deepEqual(g.seeds, newGame().seeds, "a fresh game");
  g = applyRoll(g, 4);
  assert.equal(g.turn, 2, "green passes to gold, skipping coral");
  g = finishVia(g, 3);
  assert.equal(g.phase, "roll");
  g = finishVia(g, 2);
  assert.equal(g.phase, "over");
  assert.equal(g.loser, 0, "green is last this time");
  ko = advanceKnockout(ko, g);
  assert.deepEqual(ko.alive, [2, 3]);
  assert.deepEqual(ko.out, [1, 0]);
  assert.equal(ko.round, 3);
  // Final: two yards each. Side by side (gold, blue) take their opposite yards; opposite finalists take the next yard on.
  assert.deepEqual(finalYards([2, 3]), [2, 3, 2, 3]);
  assert.deepEqual(finalYards([0, 2]), [0, 0, 2, 2]);
  assert.deepEqual(finalYards([0, 1]), [0, 1, 0, 1]);
  assert.deepEqual(finalYards([1, 3]), [3, 1, 1, 3]);
  g = knockoutGame(ko, ONE);
  assert.deepEqual(g.table, { owner: [2, 3, 2, 3], active: [true, true, true, true], playToLast: false });
  assert.deepEqual(coloursOf(knockoutGame(ko, ONE, [3, 3, 2, 2]), 2), [2, 3], "finalists can split the yards another way");
  assert.throws(() => knockoutGame(ko, ONE, [2, 2, 2, 3]), /two yards/);
  g = finishVia(g, 1); // blue's player gets coral home: 4 of 8
  assert.equal(g.phase, "roll");
  g = finishVia(g, 3); // and blue: all 8
  assert.equal(g.phase, "over");
  assert.equal(g.winner, 3);
  assert.equal(g.loser, 2);
  ko = advanceKnockout(ko, g);
  assert.equal(ko.champion, 3);
  assert.deepEqual(ko.out, [1, 0, 2]);
  assert.deepEqual(ko.results.map((r) => r.loser), [1, 0, 2]);
  assert.throws(() => knockoutGame(ko), /over/);
  assert.throws(() => advanceKnockout(ko, g), /isn't over/);

  // Full computer-only games finish in every mode, with only legal moves and no capture between same-owner colours.
  const run = (start: LudoState, r: () => number): LudoState => {
    let state = start;
    let steps = 0;
    while (state.phase !== "over" && steps < 40000) {
      if (state.phase === "move") {
        const choice = chooseAction(state);
        assert.ok(legalActions(state).some((a) => JSON.stringify(a) === JSON.stringify(choice)));
      }
      assert.ok(inPlay(state, state.turn), "the colour to play is in play");
      const before = state;
      state = autoStep(state, r);
      const e = state.last;
      if (e && e !== before.last && e.kind === "move") for (const c of e.captured) assert.ok(!friendly(state, c.player, e.player), "never your own colour");
      steps++;
    }
    assert.equal(state.phase, "over");
    return state;
  };
  let games = 0;
  for (const pair of pairs) for (const opts of [ONE, TWO, {} as Partial<LudoOptions>]) {
    const end = run(newGame(opts, 0, twoYardsTable(pair)), seededRng(pair[0] * 31 + pair[1] * 7 + (opts.dice ?? 3)));
    assert.ok(end.winner === 0 || end.winner === 1);
    assert.ok(coloursOf(end, end.winner).every((c) => end.seeds[c].every((p) => p === H)), "all 8 home");
    assert.equal(end.loser, 1 - end.winner);
    assert.ok(coloursOf(end, end.loser!).some((c) => end.seeds[c].some((p) => p !== H)));
    games++;
  }
  console.log(`  2 v 2 yards: ${games} computer games finished (every pair of yards)`);
  const champions = new Set<number>();
  for (let k = 1; k <= 12; k++) {
    const r = seededRng(k * 977);
    const opts = k % 2 ? ONE : ({} as Partial<LudoOptions>);
    let kk = newKnockout();
    while (kk.champion === null) {
      const end = run(knockoutGame(kk, opts), r);
      if (kk.round < 3) {
        assert.equal(end.order.length, kk.alive.length - 1, "everyone but the last finished");
        for (const c of end.order) assert.ok(end.seeds[c].every((p) => p === H));
        assert.ok(!end.order.includes(end.loser!) && kk.alive.includes(end.loser!));
        if (kk.round === 2) assert.ok(end.seeds[kk.out[0]].every((p) => p === Y), "the empty yard stays empty");
      } else {
        assert.equal(end.order.length, 1);
      }
      kk = advanceKnockout(kk, end);
    }
    assert.equal(kk.out.length, 3);
    assert.equal(new Set([...kk.out, kk.champion]).size, 4, "everyone placed once");
    assert.deepEqual(kk.results.map((x) => x.round), [1, 2, 3]);
    champions.add(kk.champion);
    // The quick "play out the rest" gives a full result too.
    const quick = playOutKnockout(newKnockout(), opts, seededRng(k));
    assert.ok(quick.champion !== null && quick.out.length === 3);
  }
  console.log(`  knockout: 12 computer knockouts finished, champions ${[...champions].sort().join(", ")}`);
}

console.log("ludo tests passed");
