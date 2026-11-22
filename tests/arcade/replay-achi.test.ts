// Achi tournament replay (lib/arcade/replay-achi.ts); owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades,
// Draughts, Achi and Puff-Puff". Run: npx -y tsx tests/arcade/replay-achi.test.ts
import assert from "node:assert/strict";
import { applyMove, chooseMove, legalMoves, seededRng, type AchiState, type Level, type Move } from "../../lib/arcade/achi";
import { ACHI_TOURNAMENT, achiTourneyReply, achiTourneyStart, encodeAchi, encodeAchiMove, replayAchi } from "../../lib/arcade/replay-achi";
import { compareRank } from "../../lib/arcade/tournament-games";

function botGame(seed: number, level: Level, human: (s: AchiState) => Move, maxTurns = Infinity) {
  let s = achiTourneyStart(seed, level);
  const mine: Move[] = [];
  const replies: string[] = [];
  while (s.winner === null && mine.length < maxTurns) {
    const m = human(s);
    mine.push(m);
    s = applyMove(s, m);
    if (s.winner !== null) break;
    const r = achiTourneyReply(s, level, seed);
    replies.push(encodeAchiMove(r));
    s = applyMove(s, r);
  }
  return { recording: encodeAchi(mine), state: s, mine, replies };
}
const randomHuman = (seed: number) => { const rng = seededRng(seed); return (s: AchiState) => { const l = legalMoves(s); return l[Math.floor(rng() * l.length)]; }; };
const perfectHuman = (s: AchiState) => chooseMove(s, "hard", () => 0);
const mediumHuman = (seed: number) => { const rng = seededRng(seed); return (s: AchiState) => chooseMove(s, "medium", rng); };

// Spelling.
assert.equal(encodeAchiMove({ kind: "place", to: 4 }), "p4");
assert.equal(encodeAchiMove({ kind: "move", from: 3, to: 4 }), "m3-4");
assert.equal(encodeAchi([{ kind: "place", to: 0 }], true), "p0,resign");
assert.equal(achiTourneyStart(1, "medium").turn, 0, "you place first");
assert.deepEqual(ACHI_TOURNAMENT.levels, ["medium", "easy", "hard"]);

// Same seed and position → same reply; the seed steers easy.
{
  const s = applyMove(achiTourneyStart(3, "easy"), { kind: "place", to: 0 });
  for (const level of ["easy", "medium", "hard"] as const) {
    const a = encodeAchiMove(achiTourneyReply(s, level, 42));
    for (let i = 0; i < 3; i++) assert.equal(encodeAchiMove(achiTourneyReply(s, level, 42)), a);
  }
  const seen = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) seen.add(encodeAchiMove(achiTourneyReply(s, "easy", seed)));
  assert.ok(seen.size > 1);
}

// Bot games at every level replay to the identical end state and rank.
const times: string[] = [];
const outcomes = new Set<number>();
for (const level of ["easy", "medium", "hard"] as const) {
  for (let seed = 1; seed <= 12; seed++) {
    for (const [name, human] of [["random", randomHuman(seed * 7)], ["perfect", perfectHuman], ["medium", mediumHuman(seed)]] as const) {
      const g = botGame(seed, level, human);
      assert.ok(g.state.winner !== null);
      const t0 = Date.now();
      const r = replayAchi(seed, level, g.recording);
      const ms = Date.now() - t0;
      if (seed === 1) times.push(`${level}/${name}: ${g.mine.length} turns, ${ms} ms`);
      assert.ok(r.ok);
      if (!r.ok) continue;
      assert.deepEqual(r.state.board, g.state.board);
      assert.equal(r.state.winner, g.state.winner);
      assert.equal(r.state.plies, g.state.plies);
      assert.equal(r.turns, g.mine.length);
      const res = ACHI_TOURNAMENT.replay(seed, level, g.recording);
      assert.ok(res.ok && res.finished);
      if (!res.ok) continue;
      const tier = g.state.winner === 0 ? 2 : g.state.winner === "draw" ? 1 : 0;
      outcomes.add(tier);
      assert.deepEqual(res.rank, [tier, tier === 2 ? -g.mine.length : g.mine.length]);
      if (tier === 2) assert.equal(res.summary, `Won in ${g.mine.length} turn${g.mine.length === 1 ? "" : "s"}`);
      // The first player wins with perfect play (lib/arcade/achi.ts solve), and you place first: flawless play beats even hard, in 5 turns.
      if (level === "hard" && name === "perfect") assert.deepEqual([tier, g.mine.length], [2, 5]);
      // Resigning a finished game is refused.
      assert.equal(ACHI_TOURNAMENT.replay(seed, level, g.recording + ",resign").ok, false);
      assert.equal(ACHI_TOURNAMENT.replay(seed, level, g.recording + ",p0").ok, false);
    }
  }
}
assert.ok(outcomes.has(2) && outcomes.has(1) && outcomes.has(0), "wins, draws and losses all happen");
console.log(times.join("\n"));

// Resign, tampering, unfinished.
{
  const T = ACHI_TOURNAMENT;
  const r = T.replay(1, "medium", "p4,resign");
  assert.ok(r.ok && r.finished);
  if (r.ok) { assert.deepEqual(r.rank, [0, 1]); assert.equal(r.summary, "Resigned after 1 turn"); }
  assert.ok((() => { const x = T.replay(1, "medium", "resign"); return x.ok && x.finished && x.rank[0] === 0; })());
  assert.equal(T.replay(1, "medium", "resign,p4").ok, false);
  assert.equal(T.replay(1, "medium", "p9").ok, false);
  assert.equal(T.replay(1, "medium", "m0-1").ok, false, "moving while placing");
  assert.equal(T.replay(1, "medium", "p4,p4").ok, false, "a taken point");
  assert.equal(T.replay(1, "medium", "P4").ok, false);
  assert.equal(T.replay(1, "medium", "p4,,p0").ok, false);
  assert.equal(T.replay(1, "medium", 4).ok, false);
  assert.equal(T.replay(1, "impossible", "p4").ok, false, "unknown level");
  assert.equal(T.replay(1, "medium", "p4,".repeat(100)).ok, false, "too long");
  const u = T.replay(1, "medium", "p4");
  assert.ok(u.ok && !u.finished);
  const e = T.replay(1, "medium", "");
  assert.ok(e.ok && !e.finished);
}

// Rank order: a quick win, a slow win, a long draw, a short draw, a long loss, a quick loss.
{
  const order = [[2, -4], [2, -9], [1, 30], [1, 8], [0, 20], [0, 3]];
  for (let i = 0; i + 1 < order.length; i++) assert.ok(compareRank(order[i], order[i + 1]) > 0);
}

console.log("replay-achi: all tests passed");
