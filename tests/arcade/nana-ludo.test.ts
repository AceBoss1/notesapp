// Nana for Ludo (lib/arcade/nana-ludo.ts, owner, 21 Nov 2026): the hint is a legal action for whichever of your colours is to move
// (one colour or two), a capture or a finish is suggested and explained, the roll phase says roll, her take on a computer's move
// reads sensibly, and there's no hint on a computer's turn or once the game is over.
// Run: npx -y tsx tests/arcade/nana-ludo.test.ts
import assert from "node:assert/strict";
import { HOME, YARD, applyAction, applyRoll, autoStep, legalActions, newGame, seededRng, twoYardsTable, type LudoState } from "../../lib/arcade/ludo";
import { ludoTake, ludoTip } from "../../lib/arcade/nana-ludo";

let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// A position: seeds per colour, whose turn, and the dice to spend (already rolled).
function position(seeds: number[][], dice: number[], turn = 0, over: Partial<LudoState> = {}): LudoState {
  const g = newGame({ dice: dice.length === 1 ? 1 : 2, hitHome: false, ...over.options }, turn, over.table);
  return { ...g, ...over, seeds, turn, phase: "move", dice, used: dice.map(() => false) };
}
const yard = [YARD, YARD, YARD, YARD];

ok("roll phase: Nana says roll, with nothing lit up", () => {
  const t = ludoTip(newGame())!;
  assert.equal(t.highlight, null);
  assert.match(t.tip.move, /rolling the dice/);
});

ok("no hint on a computer's turn or once the game is over", () => {
  assert.equal(ludoTip(newGame({}, 1)), null);
  assert.equal(ludoTip({ ...newGame(), phase: "over" }), null);
});

ok("the hint is always legal, for every colour you own, through whole games (4 players and 2 v 2)", () => {
  for (const table of [undefined, twoYardsTable([0, 2])]) {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = seededRng(seed);
      let g = newGame({}, 0, table);
      let hints = 0;
      for (let i = 0; i < 1500 && g.phase !== "over"; i++) {
        if (g.table.owner[g.turn] === 0 && g.phase === "move") {
          const t = ludoTip(g)!;
          assert.ok(t.highlight, "a seed to light up");
          const h = t.highlight;
          assert.equal(h.player, g.turn);
          const legal = legalActions(g).some((a) => (h.die === null ? a.kind === "home" && a.seed === h.seed : a.kind === "step" && a.seed === h.seed && g.dice[a.die] === g.dice[h.die]));
          assert.ok(legal, "legal hint");
          assert.ok(/\.$/.test(t.tip.why));
          hints++;
        }
        const before = g;
        g = autoStep(g, rng);
        if (before.table.owner[before.turn] !== 0 && g.last !== before.last) {
          const take = ludoTake(before, g);
          assert.ok(take && take.text.length > 0, "a take after each computer action");
        }
      }
      assert.ok(hints > 10);
    }
  }
});

ok("a capture is suggested and the why names the colour hit", () => {
  // Green's seed at progress 10 is on square 50; with the 2 it reaches progress 12 = square 0, where Gold's seed sits (Gold's
  // progress 38 = (14 + 38) % 52 = square 0, not a star).
  const g = position([[10, YARD, YARD, YARD], yard, [38, YARD, YARD, YARD], yard], [2, 3]);
  const t = ludoTip(g)!;
  assert.deepEqual([t.highlight?.seed, g.dice[t.highlight!.die!]], [0, 2]);
  assert.match(t.tip.why, /captures Gold's seed/);
  assert.doesNotMatch(t.tip.why, /roll again/, "a capture earns no bonus roll");
  assert.match(t.tip.move, /your seed 10 steps along with the 2/);
});

ok("finishing all four is suggested and the why says you win", () => {
  const g = position([[HOME, HOME, HOME, 53], [5, YARD, YARD, YARD], yard, yard], [3, 1]);
  const t = ludoTip(g)!;
  assert.equal(t.highlight?.seed, 3);
  assert.equal(t.highlight?.to, HOME);
  assert.match(t.tip.why, /last seed home, so you win/);
});

ok("2 v 2: the tip names your colour when you play two", () => {
  const g = position([yard, yard, [20, YARD, YARD, YARD], yard], [4], 2, { table: twoYardsTable([0, 2]) });
  const t = ludoTip(g)!;
  assert.match(t.tip.move, /your gold seed 20 steps along with the 4/);
});

ok("take: a computer captures your seed, and Nana says so", () => {
  // Coral at progress 5 = square 6; your green seed on square 8 = progress 20. Coral rolls a 2 (and a 1 that can't be used first).
  const before = position([[20, YARD, YARD, YARD], [5, YARD, YARD, YARD], yard, yard], [2], 1, { options: { dice: 1, hitHome: false, sixFiveHome: false } });
  const action = legalActions(before).find((a) => a.kind === "step" && a.seed === 0)!;
  const after = applyAction(before, action);
  const take = ludoTake(before, after)!;
  assert.match(take.text, /^Coral captured your seed\./);
  assert.match(take.text, /Bring it back out with a 6/);
  assert.equal(take.tone, "good");
});

ok("take: a pass, and nothing for your own move", () => {
  const g = newGame({ dice: 1 }, 1);
  const after = applyRoll(g, 3);
  assert.match(ludoTake(g, after)!.text, /Coral rolled 3 and couldn't move/);
  const mineBefore = position([[10, YARD, YARD, YARD], yard, yard, yard], [3]);
  assert.equal(ludoTake(mineBefore, applyAction(mineBefore, legalActions(mineBefore)[0])), null);
  assert.ok(same(ludoTake(g, g), null));
});

console.log(`nana-ludo: all tests passed (${checks} checks)`);
