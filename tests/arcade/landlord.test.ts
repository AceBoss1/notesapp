// Naija Landlord (lib/arcade/landlord.ts): board, rent, building, cards, paying up, bankruptcy and full computer games.
// Run: npx -y tsx tests/arcade/landlord.test.ts
import assert from "node:assert/strict";
import {
  BOARD, BOARD_SIZE, CITIES, HOLDUP, LEKKI, ROUND_CAP, SALARY, START_CASH,
  aiAction, applyAction, buildable, canBuild, citySquares, createGame, legalActions, netWorth, rentFor, squareCell,
  type Action, type State,
} from "../../lib/arcade/landlord";

// Seeded rng (mulberry32) and a scripted one that returns given dice.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const die = (n: number) => (n - 1) / 6 + 0.01;
function scripted(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}
const dice = (a: number, b: number, ...extra: number[]) => scripted([die(a), die(b), ...extra]);
const idx = (name: string) => BOARD.findIndex((s) => s.name === name);

// Board: 24 squares, 6 per side on a 7×7 ring, every cell distinct, every city 2–3 plots.
assert.equal(BOARD.length, BOARD_SIZE);
assert.equal(new Set(BOARD.map((_, i) => `${squareCell(i).row},${squareCell(i).col}`)).size, 24);
assert.ok(BOARD.every((_, i) => { const c = squareCell(i); return c.row === 1 || c.row === 7 || c.col === 1 || c.col === 7; }));
for (const id of Object.keys(CITIES)) { const n = citySquares(id as keyof typeof CITIES).length; assert.ok(n >= 2 && n <= 3, id); }
assert.equal(BOARD[0].kind, "start");
assert.equal(BOARD[HOLDUP].kind, "holdup");
assert.equal(BOARD.filter((s) => s.kind === "market").length, 2);
assert.equal(BOARD.filter((s) => s.kind === "fortune").length, 2);
assert.equal(BOARD[LEKKI].name, "Lekki");

// Start of game.
const g0 = createGame(seeded(1));
assert.equal(g0.players.length, 4);
assert.ok(g0.players.every((p) => p.cash === START_CASH && p.pos === 0));
assert.ok(g0.players[0].human && !g0.players[1].human);
assert.deepEqual(legalActions(g0), [{ type: "roll" }]);
assert.throws(() => applyAction(g0, { type: "buy" }), /Illegal/);

// Roll 3+4 from Start: Ring Road (7), unowned, so a buy choice.
let s = applyAction(g0, { type: "roll" }, dice(3, 4));
assert.equal(s.players[0].pos, 7);
assert.equal(s.phase, "buy");
assert.equal(g0.players[0].pos, 0, "apply never mutates");
const bought = applyAction(s, { type: "buy" });
assert.equal(bought.owner[7], 0);
assert.equal(bought.players[0].cash, START_CASH - 100);
assert.equal(bought.turn, 1, "turn passes after buying");
const skipped = applyAction(s, { type: "skip" });
assert.equal(skipped.owner[7], null);
assert.equal(skipped.turn, 1);

// Rent: base, doubled for a full city, raised by flats.
function withOwner(state: State, squares: number[], who: number): State {
  const t = structuredClone(state);
  squares.forEach((i) => { t.owner[i] = who; });
  return t;
}
const ringRoad = idx("Ring Road"), bodija = idx("Bodija");
let r = withOwner(g0, [ringRoad], 1);
assert.equal(rentFor(r, ringRoad), 20);
r = withOwner(g0, [ringRoad, bodija], 1);
assert.equal(rentFor(r, ringRoad), 40, "full city doubles base rent");
r.flats[ringRoad] = 1;
assert.equal(rentFor(r, ringRoad), 200);
// Landing on someone's plot pays rent.
const paid = applyAction(r, { type: "roll" }, dice(3, 4));
assert.equal(paid.players[0].cash, START_CASH - 200);
assert.equal(paid.players[1].cash, START_CASH + 200);
// Parks: rent doubles with both.
const parks = BOARD.flatMap((b, i) => (b.kind === "park" ? [i] : []));
assert.equal(rentFor(withOwner(g0, [parks[0]], 2), parks[0]), 30);
assert.equal(rentFor(withOwner(g0, parks, 2), parks[0]), 60);

// Building: only with a whole city, evenly, max 3, only on your turn.
let b = withOwner(g0, [ringRoad], 0);
assert.equal(canBuild(b, 0, ringRoad), false, "needs the whole city");
b = withOwner(g0, [ringRoad, bodija], 0);
assert.deepEqual(buildable(b).sort(), [ringRoad, bodija].sort());
b = applyAction(b, { type: "build", square: ringRoad });
assert.equal(b.flats[ringRoad], 1);
assert.equal(b.players[0].cash, START_CASH - CITIES.ibadan.flatCost);
assert.equal(canBuild(b, 0, ringRoad), false, "must build evenly");
assert.throws(() => applyAction(b, { type: "build", square: ringRoad }), /Illegal/);
b = applyAction(b, { type: "build", square: bodija });
for (let k = 0; k < 4; k++) for (const sq of [ringRoad, bodija]) if (canBuild(b, 0, sq)) b = applyAction(b, { type: "build", square: sq });
assert.deepEqual([b.flats[ringRoad], b.flats[bodija]], [3, 3], "at most three flats");
assert.equal(canBuild(withOwner(g0, [ringRoad, bodija], 1), 1, ringRoad), false, "not your turn");

// Passing Start pays salary: player at 20 rolls 2+3 → 1 (Ogui).
const late = structuredClone(g0); late.players[0].pos = 20;
const passed = applyAction(late, { type: "roll" }, dice(2, 3));
assert.equal(passed.players[0].pos, 1);
assert.equal(passed.players[0].cash, START_CASH + SALARY);

// Traffic Hold-up: miss the next turn.
const held = applyAction(g0, { type: "roll" }, dice(2, 4));
assert.equal(held.players[0].pos, HOLDUP);
assert.ok(held.players[0].held);
let h = held;
let guard = 0;
while (h.round === 1 && guard++ < 50) h = applyAction(h, aiAction(h), dice(1, 2));
assert.equal(h.turn, 1, "player 0 skipped, play wraps to Chidi");
assert.equal(h.players[0].held, false);

// Doubles roll again; three doubles go to Hold-up.
const dbl = applyAction(g0, { type: "roll" }, dice(1, 1)); // Independence Layout (2): buy phase, then roll again
assert.equal(dbl.phase, "buy");
const again = applyAction(dbl, { type: "skip" });
assert.equal(again.turn, 0);
assert.equal(again.phase, "roll");
let three = structuredClone(g0);
three.doubles = 2;
three = applyAction(three, { type: "roll" }, dice(5, 5));
assert.equal(three.players[0].pos, HOLDUP);
assert.ok(three.players[0].held);
assert.equal(three.turn, 1);

// Tax office: pay 10% of cash. Player at 12 rolls 3+3 → 18.
const taxed = structuredClone(g0); taxed.players[0].pos = 12;
const afterTax = applyAction(taxed, { type: "roll" }, dice(3, 3));
assert.equal(afterTax.players[0].cash, START_CASH - 150);

// Cards: Fortune at 10 from 4 with 3+3; card index from the next rng value.
const atFour = structuredClone(g0); atFour.players[0].pos = 4;
const lift = applyAction(atFour, { type: "roll" }, dice(2, 4, 5 / 9 + 0.01)); // card 5: lift to Lekki
assert.equal(lift.players[0].pos, LEKKI);
assert.equal(lift.phase, "buy");
const bday = applyAction(atFour, { type: "roll" }, dice(2, 4, 0)); // card 0: everyone sends ₦20k
assert.equal(bday.players[0].cash, START_CASH + 60);
assert.equal(bday.players[2].cash, START_CASH - 20);

// Can't pay: sell flats at half, then plots at half, then bankrupt with assets back to the bank.
const poor = withOwner(g0, [ringRoad, bodija], 0);
poor.flats[ringRoad] = 1; poor.flats[bodija] = 1;
poor.players[0].cash = 10;
const lekkiOwned = withOwner(poor, [LEKKI], 1);
lekkiOwned.players[0].pos = 18;
const sold = applyAction(lekkiOwned, { type: "roll" }, dice(2, 3)); // 23 Lekki, rent 56
assert.equal(sold.players[0].pos, LEKKI);
assert.equal(sold.flats[ringRoad] + sold.flats[bodija], 1, "sold one flat (₦50k) to cover ₦56k");
assert.equal(sold.players[0].cash, 10 + 50 - 56);
const broke = structuredClone(lekkiOwned);
broke.flats[ringRoad] = 0; broke.flats[bodija] = 0; broke.owner[ringRoad] = null; broke.owner[bodija] = null;
broke.flats[LEKKI] = 3; broke.owner[idx("Ikoyi")] = 1; broke.owner[idx("Yaba")] = 1; // rent 56×60
broke.players[0].cash = 100;
const out = applyAction(broke, { type: "roll" }, dice(2, 3));
assert.ok(out.players[0].out);
assert.equal(out.players[1].cash, START_CASH + 100, "creditor gets what was left");
assert.ok(out.owner.every((o) => o !== 0));
assert.equal(out.turn, 1);

// Last player standing wins.
const duel = createGame(seeded(2), 2);
const d2 = withOwner(duel, [idx("Ikoyi"), idx("Yaba"), LEKKI], 1);
d2.flats[LEKKI] = 3; d2.players[0].cash = 5; d2.players[0].pos = 18;
const won = applyAction(d2, { type: "roll" }, dice(2, 3));
assert.equal(won.phase, "over");
assert.equal(won.winner, 1);
assert.equal(won.endReason, "last");
assert.deepEqual(legalActions(won), []);

// Turn cap: richest net worth wins.
const capped = createGame(seeded(3), 2);
capped.round = ROUND_CAP; capped.turn = 1; capped.players[1].cash = 900; capped.players[1].pos = 1;
const capEnd = applyAction(capped, { type: "roll" }, dice(1, 2)); // any square; the turn then wraps past the cap
const finished = capEnd.phase === "buy" ? applyAction(capEnd, { type: "skip" }) : capEnd;
assert.equal(finished.phase, "over");
assert.equal(finished.endReason, "cap");
assert.equal(finished.winner, netWorth(finished, 0) >= netWorth(finished, 1) ? 0 : 1);

// Computer: buys when it keeps a cushion, skips when it wouldn't, builds on a whole city.
const aiBuy = applyAction(createGame(seeded(4)), { type: "roll" }, dice(3, 4));
assert.deepEqual(aiAction(aiBuy), { type: "buy" });
const aiPoor = structuredClone(aiBuy); aiPoor.players[0].cash = 150;
assert.deepEqual(aiAction(aiPoor), { type: "skip" });
const aiBuild = withOwner(g0, [ringRoad, bodija], 0);
assert.equal(aiAction(aiBuild).type, "build");

// Full games between computer players finish without an illegal move.
function playOut(state: State, rng: () => number): State {
  let t = state;
  for (let n = 0; n < 20000 && t.phase !== "over"; n++) {
    const a: Action = aiAction(t);
    assert.ok(legalActions(t).some((l) => JSON.stringify(l) === JSON.stringify(a)), "computer picks a legal action");
    t = applyAction(t, a, rng);
    assert.ok(t.players.every((p) => p.cash >= 0));
  }
  return t;
}
let lastWins = 0;
for (let seed = 1; seed <= 30; seed++) {
  const end = playOut(createGame(seeded(seed), seed % 2 ? 2 : 4), seeded(seed * 7));
  assert.equal(end.phase, "over", `seed ${seed} finished`);
  assert.ok(end.winner !== null && !end.players[end.winner].out);
  if (end.endReason === "last") lastWins++;
}
assert.ok(lastWins > 0, "some games end with one landlord left");

console.log(`landlord tests passed (${lastWins}/30 games ended with one landlord left)`);
