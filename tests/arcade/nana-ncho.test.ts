// Nana for Ncho and Aka-Hausa (lib/arcade/nana-ncho.ts, owner, 21 Nov 2026): the hint is a legal hole for 2 and 4 players and both
// directions, a capture is suggested and explained, her take on a computer's sowing reads sensibly, and there's no hint when there's
// nothing to play.
// Run: npx -y tsx tests/arcade/nana-ncho.test.ts
import assert from "node:assert/strict";
import { applyMove, chooseMove, initialState, legalMoves, seededRng, type NchoState, type NchoVariant, type PlayerCount } from "../../lib/arcade/ncho";
import { holeLabel, nchoTake, nchoTip } from "../../lib/arcade/nana-ncho";

let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };

ok("hole labels match the board: bottom row left to right, top row drawn from 11 down", () => {
  assert.equal(holeLabel(0, 6), "bottom-row hole 1 from the left");
  assert.equal(holeLabel(5, 6), "bottom-row hole 6 from the left");
  assert.equal(holeLabel(11, 6), "top-row hole 1 from the left");
  assert.equal(holeLabel(6, 6), "top-row hole 6 from the left");
});

ok("the hint is a legal hole on your turn, 2 and 4 players, both directions", () => {
  const setups: [NchoVariant, PlayerCount][] = [["ncho", 2], ["akahausa", 2], ["ncho", 4], ["akahausa", 4]];
  for (const [variant, players] of setups) {
    const rng = seededRng(players * 10 + (variant === "ncho" ? 1 : 2));
    let s = initialState(undefined, 0, variant, { players, rounds: 3 });
    let hints = 0;
    for (let i = 0; i < 24 && !s.over; i++) {
      if (s.lastRound) s = { ...s, lastRound: null }; // the UI's "next round"
      if (s.turn === 0 && legalMoves(s).length) {
        const t = nchoTip(s);
        assert.ok(t, "a hint on your turn");
        assert.ok(legalMoves(s).includes(t.highlight), `legal hole ${t.highlight}`);
        assert.ok(t.tip.move.includes("hole") && /\.$/.test(t.tip.why));
        hints++;
      }
      const before = s;
      s = applyMove(s, chooseMove(s, "easy", rng));
      if (before.turn !== 0) {
        const take = nchoTake(before, s);
        assert.ok(take && take.text.length > 0, "a take after each computer move");
        assert.ok(["good", "fine", "risky"].includes(take.tone));
      }
    }
    assert.ok(hints > 0, `${variant} ${players}p gave hints`);
  }
});

// A quiet board for set-ups: everything empty, then the pits a test needs.
const board = (pits: Record<number, number>, over: Partial<NchoState> = {}): NchoState => {
  const s = initialState(undefined, 0, "ncho");
  const p = Array(12).fill(0);
  for (const [h, n] of Object.entries(pits)) p[Number(h)] = n;
  // The rest of the 48 seeds sit in the stores, so the round-end count stays true.
  const rest = 48 - p.reduce((a, b) => a + b, 0);
  return { ...s, pits: p, stores: [Math.floor(rest / 2), rest - Math.floor(rest / 2)], ...over };
};

ok("a last seed making 4 is suggested and the why says so", () => {
  // Hole 0 has 2 seeds: they land in 1 and 2; hole 2 holds 3, so the last seed makes 4. Hole 2's own seeds would end in an empty hole.
  const s = board({ 0: 2, 2: 3, 7: 2, 8: 2, 9: 2, 10: 2 });
  const t = nchoTip(s)!;
  assert.equal(t.highlight, 0);
  assert.match(t.tip.why, /the last seed lands on a 4, so you take it/i);
  assert.match(t.tip.move, /bottom-row hole 1 from the left \(2 seeds\)/);
});

ok("a 4 on the computer's row is explained as its hole", () => {
  // Hole 5 has 2 seeds: 6 then 7; hole 7 holds 3, so the last seed makes 4 in the computer's hole.
  const s = board({ 5: 2, 7: 3, 1: 1, 9: 6, 10: 6, 11: 7 });
  const t = nchoTip(s)!;
  assert.equal(t.highlight, 5);
  assert.match(t.tip.why, /lands on a 4 in the computer's hole, so you take it/);
});

ok("no hint between rounds, once the game is over, or with nothing to play", () => {
  const s = initialState(undefined, 0, "ncho");
  assert.equal(nchoTip({ ...s, over: true }), null);
  assert.equal(nchoTip({ ...s, pits: s.pits.map((x, h) => (h < 6 ? 0 : x)) }), null);
  const fake = { ...s, lastRound: {} as NchoState["lastRound"] };
  assert.equal(nchoTip(fake), null);
});

ok("take: the computer's last seed makes 4 in your hole", () => {
  // The computer sows hole 11's 2 seeds into 0 and 1; hole 1 holds 3, so its last seed makes 4 on your row.
  const before = board({ 11: 2, 1: 3, 0: 0, 3: 2, 4: 2, 7: 1 }, { turn: 1 });
  const after = applyMove(before, 11);
  const take = nchoTake(before, after)!;
  assert.match(take.text, /The computer's last seed made 4 in your hole, so it took them\./);
  assert.equal(take.tone, "good");
});

ok("take: a quiet move that gives you a 4 is rated risky and Nana points it out", () => {
  // Hole 6 has 1 seed: it lands in 7, empty, so the turn ends. Your hole 0 (2 seeds) then makes 4 in hole 2 (3 seeds).
  const before = board({ 6: 1, 11: 2, 1: 3, 0: 2, 2: 3, 9: 1 }, { turn: 1 });
  const after = applyMove(before, 6);
  const take = nchoTake(before, after)!;
  assert.match(take.text, /without taking a 4/);
  assert.match(take.text, /The last 8 are yours to take now/, "your 4 on the way leaves 8, so your last-seed 4 takes them all");
  assert.equal(take.tone, "risky", "it passed up a 4 of its own");
});

ok("take: null for your own move", () => {
  const s = initialState(undefined, 0, "ncho");
  assert.equal(nchoTake(s, applyMove(s, 0)), null);
});

console.log(`nana-ncho: all tests passed (${checks} checks)`);
