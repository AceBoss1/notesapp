// Nana for Achi (lib/arcade/nana-achi.ts, owner, 21 Nov 2026): the hint is a legal move, it takes a win and blocks a line and
// says so, her take on the computer's move reads sensibly, and there's no hint when the game is over.
// Run: npx -y tsx tests/arcade/nana-achi.test.ts
import assert from "node:assert/strict";
import { applyMove, chooseMove, initialState, isLegal, seededRng, type AchiState, type Cell, type Move, type Player } from "../../lib/arcade/achi";
import { achiTake, achiTip, winningMoves } from "../../lib/arcade/nana-achi";

let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };
// "x" = you (0), "o" = computer (1), "." = empty; rows top to bottom.
const B = (rows: string): Cell[] => rows.replace(/[\s/]/g, "").split("").map((c) => (c === "x" ? 0 : c === "o" ? 1 : null));
const at = (rows: string, turn: Player = 0): AchiState => ({ ...initialState(turn), board: B(rows), seen: {} });
const toMove = (h: { from: number | null; to: number }): Move => (h.from === null ? { kind: "place", to: h.to } : { kind: "move", from: h.from, to: h.to });

ok("the hint is always a legal move, in every position of some random games", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = seededRng(seed);
    let s = initialState(seed % 2 === 0 ? 0 : 1);
    for (let i = 0; i < 40 && s.winner === null; i++) {
      if (s.turn === 0) {
        const t = achiTip(s);
        assert.ok(t, "a hint on your turn");
        assert.ok(isLegal(s, toMove(t.highlight)), `legal hint ${JSON.stringify(t.highlight)}`);
        assert.ok(t.tip.move.length > 0 && t.tip.why.length > 0);
        assert.ok(/[.]$/.test(t.tip.why), "why is a sentence");
      }
      s = applyMove(s, chooseMove(s, "medium", rng));
    }
  }
});

ok("placing: she takes the win and says it fills your line", () => {
  const s = at("x x . / o o . / . . .");
  const t = achiTip(s)!;
  assert.deepEqual(t.highlight, { from: null, to: 2 });
  assert.match(t.tip.why, /fills your top row, so you win/);
  assert.equal(t.tip.move, "placing on the top right");
});

ok("placing: no win, so she blocks the computer's line and says so", () => {
  const s = at("x . . / o o . / x . .");
  const t = achiTip(s)!;
  assert.deepEqual(t.highlight, { from: null, to: 5 });
  assert.match(t.tip.why, /blocks the computer's middle row/);
});

ok("moving: she slides into the win", () => {
  // You: 0, 1, 5. Sliding 5 → 2 fills the top row.
  const s = at("x x . / o o x / o . .");
  const t = achiTip(s)!;
  assert.deepEqual(t.highlight, { from: 5, to: 2 });
  assert.match(t.tip.why, /fills your top row/);
  assert.equal(t.tip.move, "sliding right middle to top right");
});

ok("no hint once the game is over", () => {
  const s = applyMove(at("x x . / o o . / . . ."), { kind: "place", to: 2 });
  assert.equal(s.winner, 0);
  assert.equal(achiTip(s), null);
});

ok("take: the computer blocks your line", () => {
  const before = at("x x . / . o . / . . .", 1);
  const m: Move = { kind: "place", to: 2 };
  const take = achiTake(before, m, applyMove(before, m))!;
  assert.match(take.text, /The computer blocked your top row\./);
  assert.ok(["good", "fine", "risky"].includes(take.tone));
});

ok("take: the computer sets up a line and Nana says where to block", () => {
  const before = at("x . . / . o . / . . x", 1);
  const m: Move = { kind: "place", to: 1 };
  const after = applyMove(before, m);
  assert.ok(winningMoves(after, 1).length > 0);
  const take = achiTake(before, m, after)!;
  assert.match(take.text, /block the bottom middle next/);
});

ok("take: the computer wins", () => {
  const before = at("x x . / o o . / x . .", 1);
  const m: Move = { kind: "place", to: 5 };
  const take = achiTake(before, m, applyMove(before, m))!;
  assert.match(take.text, /filled its middle row/);
  assert.equal(take.tone, "good");
});

ok("take: a slip by the computer is rated risky", () => {
  // The computer could win at 5 but places at 8 instead.
  const before = at("x x . / o o . / x . .", 1);
  const m: Move = { kind: "place", to: 8 };
  const take = achiTake(before, m, applyMove(before, m))!;
  assert.equal(take.tone, "risky");
  assert.match(take.text, /The computer placed on the bottom right\. Watch the middle row/);
});

ok("take: null for a move that isn't legal", () => {
  const before = at("x x . / o o . / x . .", 1);
  assert.equal(achiTake(before, { kind: "place", to: 0 }, before), null);
});

console.log(`nana-achi: all tests passed (${checks} checks)`);
