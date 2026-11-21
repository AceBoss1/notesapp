// Nana's Naija Landlord hints and takes (lib/arcade/nana-landlord.ts). Run: npx -y tsx tests/arcade/nana-landlord.test.ts
import assert from "node:assert/strict";
import { BOARD, aiAction, applyAction, createGame, legalActions, type Action, type State } from "../../lib/arcade/landlord";
import { landlordTake, landlordTip } from "../../lib/arcade/nana-landlord";

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
const dice = (a: number, b: number) => { const v = [die(a), die(b)]; let i = 0; return () => v[i++ % 2]; };
const idx = (short: string) => BOARD.findIndex((s) => s.short === short);
const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);
const clean = (t: string) => t.length > 10 && !/undefined|NaN|null/.test(t);

// Whole games: Nana's tip is always a legal action with a reason, the same every time she's asked, and every computer action
// gets a take.
let tips = 0; let takes = 0;
for (let seed = 1; seed <= 8; seed += 1) {
  const rng = seeded(seed);
  let s = createGame();
  for (let step = 0; step < 1500 && s.phase !== "over"; step += 1) {
    const before = s;
    if (s.turn === 0) {
      const t = landlordTip(s);
      assert.ok(t, "a tip on your turn");
      assert.ok(legalActions(s).some((a) => same(a, t.highlight)), `legal tip (seed ${seed})`);
      assert.ok(clean(t.tip.why) && t.tip.move, t.tip.why);
      assert.deepEqual(landlordTip(s), t, "deterministic");
      tips += 1;
      s = applyAction(s, t.highlight, rng);
    } else {
      const a = aiAction(s);
      s = applyAction(s, a, rng);
      const take = landlordTake(before, a, s);
      assert.ok(take && clean(take.text), take?.text);
      takes += 1;
    }
  }
}
assert.ok(tips > 100 && takes > 300);

const at = (over: (s: State) => void): State => { const s = createGame(); over(s); return s; };

// Buying the plot that completes a city: Nana says buy, and that it completes the set.
let s = at((g) => { g.owner[idx("Ind. Layout")] = 0; g.players[0].pos = idx("Ogui"); g.phase = "buy"; });
let t = landlordTip(s)!;
assert.deepEqual(t.highlight, { type: "buy" });
assert.equal(t.tip.move, "buy Ogui");
assert.match(t.tip.why, /complete the Enugu set/);

// Short of cash after the price: keep it for rent.
s = at((g) => { g.players[0].cash = 300; g.players[0].pos = idx("Trade Fair"); g.phase = "buy"; g.owner[idx("Lekki")] = 1; });
t = landlordTip(s)!;
assert.deepEqual(t.highlight, { type: "skip" });
assert.match(t.tip.why, /Keep N\$300k for rent you may owe/);
assert.match(t.tip.why, /Lekki/);

// Can't afford it at all.
s = at((g) => { g.players[0].cash = 100; g.players[0].pos = idx("Lekki"); g.phase = "buy"; });
assert.match(landlordTip(s)!.tip.why, /can't afford/);

// Owning a whole city with cash to spare: build a flat, and say what it does to the rent.
s = at((g) => { g.owner[idx("Ogui")] = 0; g.owner[idx("Ind. Layout")] = 0; g.players[0].cash = 1000; });
t = landlordTip(s)!;
assert.equal(t.highlight.type, "build");
assert.match(t.tip.move, /^build a flat on /);
assert.match(t.tip.why, /lifts the rent/);

// Plain roll, with a warning about a dear rent within reach.
s = at((g) => { g.owner[idx("Ring Road")] = 2; g.owner[idx("Bodija")] = 2; g.flats[idx("Bodija")] = 1; g.flats[idx("Ring Road")] = 1; g.players[0].pos = idx("Nassarawa"); });
t = landlordTip(s)!;
assert.deepEqual(t.highlight, { type: "roll" });
assert.match(t.tip.why, /Watch out: Amaka's/);
assert.equal(landlordTip({ ...s, turn: 1 }), null, "no tip on a computer's turn");

// Takes: Chidi buys into a city; completes one; pays you rent; passes.
let before = at((g) => { g.turn = 1; g.players[1].pos = idx("Ariaria"); g.phase = "buy"; });
let after = applyAction(before, { type: "buy" });
assert.match(landlordTake(before, { type: "buy" }, after)!.text, /Chidi bought Ariaria in Eastern markets: two more and Chidi owns the set/);
before = at((g) => { g.turn = 1; g.owner[idx("Ogui")] = 1; g.players[1].pos = idx("Ind. Layout"); g.phase = "buy"; });
after = applyAction(before, { type: "buy" });
const done = landlordTake(before, { type: "buy" }, after)!;
assert.match(done.text, /owns all of Enugu/);
assert.equal(done.tone, "risky");
before = at((g) => { g.turn = 1; g.owner[idx("Nassarawa")] = 0; g.players[1].pos = idx("Ogui"); });
after = applyAction(before, { type: "roll" }, dice(2, 2));
assert.match(landlordTake(before, { type: "roll" }, after)!.text, /landed on your Nassarawa and paid you N\$18k/);
before = at((g) => { g.turn = 1; g.players[1].pos = idx("GRA"); g.phase = "buy"; });
assert.match(landlordTake(before, { type: "skip" }, applyAction(before, { type: "skip" }))!.text, /passed on GRA/);
assert.equal(landlordTake(createGame(), { type: "roll" }, createGame()), null, "no take on your own move");

console.log("nana landlord: all tests passed");
