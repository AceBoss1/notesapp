// Draughts tournament replay (lib/arcade/replay-draughts.ts); owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord,
// Spades, Draughts, Achi and Puff-Puff". Run: npx -y tsx tests/arcade/replay-draughts.test.ts
import assert from "node:assert/strict";
import { applyMove, chooseMove, legalMoves, seededRng, sizeOf, type DraughtsMove, type DraughtsState } from "../../lib/arcade/draughts";
import {
  DRAUGHTS_LEVELS, DRAUGHTS_TOURNAMENT, draughtsTourneyReply, draughtsTourneyStart, encodeDraughts, encodeDraughtsMove,
  parseDraughtsLevel, replayDraughts, squareNumber,
} from "../../lib/arcade/replay-draughts";
import { compareRank } from "../../lib/arcade/tournament-games";

function botGame(seed: number, level: string, human: (s: DraughtsState) => DraughtsMove, maxMoves = Infinity) {
  const p = parseDraughtsLevel(level)!;
  let s = draughtsTourneyStart(seed, level);
  const mine: DraughtsMove[] = [];
  const replies: string[] = [];
  while (!s.over && mine.length < maxMoves) {
    const m = human(s);
    mine.push(m);
    s = applyMove(s, m);
    if (s.over) break;
    const r = draughtsTourneyReply(s, p.level, seed);
    replies.push(encodeDraughtsMove(r, sizeOf(s.board)));
    s = applyMove(s, r);
  }
  return { recording: encodeDraughts(mine, sizeOf(s.board)), state: s, mine, replies };
}
const randomHuman = (seed: number) => { const rng = seededRng(seed); return (s: DraughtsState) => { const l = legalMoves(s); return l[Math.floor(rng() * l.length)]; }; };
const botHuman = (seed: number, budget: number) => { const rng = seededRng(seed); return (s: DraughtsState) => chooseMove(s, "hard", rng, budget); };

// Levels carry the rules: African 10×10 medium first.
assert.equal(DRAUGHTS_LEVELS[0], "african10-medium");
assert.equal(DRAUGHTS_LEVELS.length, 9);
assert.deepEqual(parseDraughtsLevel("english-hard"), { board: "english", level: "hard", rules: "english", size: 8 });
assert.equal(parseDraughtsLevel("african12-medium"), null);
assert.equal(sizeOf(draughtsTourneyStart(1, "african10-medium").board), 10);
assert.equal(sizeOf(draughtsTourneyStart(1, "african8-easy").board), 8);
assert.equal(draughtsTourneyStart(1, "english-medium").rules, "english");
assert.equal(draughtsTourneyStart(1, "african10-medium").turn, 0, "you move first");
assert.equal(draughtsTourneyStart(1, "african10-medium").drawRule, true);

// Standard numbering: 1 at the top-left dark square, 50 (or 32) at the bottom right; your opening steps read as usual.
assert.equal(squareNumber(1, 10), 1);
assert.equal(squareNumber(98, 10), 50);
assert.equal(squareNumber(1, 8), 1);
assert.equal(squareNumber(62, 8), 32);
{
  const s = draughtsTourneyStart(1, "african10-medium");
  const spelled = legalMoves(s).map((m) => encodeDraughtsMove(m, 10)).sort();
  assert.ok(spelled.includes("32-28") && spelled.includes("31-26") && spelled.includes("35-30"), spelled.join(" "));
  const e = draughtsTourneyStart(1, "english-medium");
  const es = legalMoves(e).map((m) => encodeDraughtsMove(m, 8));
  assert.ok(es.includes("21-17") && es.includes("24-20"), es.join(" "));
}

// Same seed and position → same reply, at every level.
{
  for (const level of DRAUGHTS_LEVELS) {
    const p = parseDraughtsLevel(level)!;
    let s = draughtsTourneyStart(5, level);
    s = applyMove(s, legalMoves(s)[0]);
    const a = encodeDraughtsMove(draughtsTourneyReply(s, p.level, 31), sizeOf(s.board));
    for (let i = 0; i < 2; i++) assert.equal(encodeDraughtsMove(draughtsTourneyReply(s, p.level, 31), sizeOf(s.board)), a);
  }
}

// Bot games on every rule set and level replay to the identical end state and rank. Multi-jumps are spelled with every landing.
const times: string[] = [];
let sawMultiJump = false;
const tiers = new Set<number>();
for (const level of DRAUGHTS_LEVELS) {
  // One game per level keeps the suite quick: a thinking bot on easy and medium (it wins some), random moves against hard.
  const players = level.endsWith("hard") ? [["random", randomHuman(13)] as const] : [["bot", botHuman(17, 3000)] as const];
  for (const [name, human] of players) {
    const g = botGame(2026, level, human);
    assert.ok(g.state.over);
    if (g.mine.some((m) => m.path.length > 1)) sawMultiJump = true;
    const t0 = Date.now();
    const r = replayDraughts(2026, level, g.recording);
    const ms = Date.now() - t0;
    times.push(`${level}/${name}: ${g.mine.length} moves, ${ms} ms`);
    assert.ok(r.ok, r.ok ? "" : r.error);
    if (!r.ok) continue;
    assert.deepEqual(r.state.board, g.state.board);
    assert.equal(r.state.winner, g.state.winner);
    assert.equal(r.state.moves, g.state.moves);
    assert.equal(r.moves, g.mine.length);
    const res = DRAUGHTS_TOURNAMENT.replay(2026, level, g.recording);
    assert.ok(res.ok && res.finished);
    if (!res.ok) continue;
    const tier = g.state.winner === 0 ? 2 : g.state.winner === "draw" ? 1 : 0;
    tiers.add(tier);
    const pieces = g.state.board.filter((c) => c && c.side === 0).length;
    assert.deepEqual(res.rank, [tier, tier === 2 ? -g.mine.length : g.mine.length, pieces]);
    if (tier === 2) assert.equal(res.summary, `Won in ${g.mine.length} moves with ${pieces} piece${pieces === 1 ? "" : "s"} left`);
    assert.ok(ms < 8000, "replay is reasonably quick");
    assert.equal(DRAUGHTS_TOURNAMENT.replay(2026, level, g.recording + ",resign").ok, false, "resigning a finished game");
    // Another rule set reads the same moves as a different game: refused, or a different result.
    if (level.endsWith("easy")) {
      const otherLevel = level.startsWith("english") ? "african8-easy" : "english-easy";
      const x = DRAUGHTS_TOURNAMENT.replay(2026, otherLevel, g.recording);
      assert.ok(!x.ok || JSON.stringify(x) !== JSON.stringify(res));
    }
  }
}
assert.ok(sawMultiJump, "some game had a multi-jump");
assert.ok(tiers.has(2) && tiers.has(0), "wins and losses both happen");
console.log(times.join("\n"));

// Tampering and refusals.
{
  const T = DRAUGHTS_TOURNAMENT;
  const g = botGame(4, "african10-easy", randomHuman(2));
  assert.equal(T.replay(4, "african10-easy", g.recording + ",32-28").ok, false, "after the end");
  assert.equal(T.replay(4, "african10-medium", "32-26").ok, false, "not a diagonal step");
  assert.equal(T.replay(4, "african10-medium", "18-23").ok, false, "a computer's piece");
  assert.equal(T.replay(4, "african10-medium", "32x28").ok, false, "a step spelled as a capture");
  assert.equal(T.replay(4, "african10-medium", "032-28").ok, false);
  assert.equal(T.replay(4, "african10-medium", "32-28,,33-29").ok, false);
  assert.equal(T.replay(4, "african10-medium", "e3-d4").ok, false);
  assert.equal(T.replay(4, "african10-medium", ["32-28"]).ok, false);
  assert.equal(T.replay(4, "african10-medium", "resign,32-28").ok, false);
  assert.equal(T.replay(4, "medium", "32-28").ok, false, "unknown level");
  assert.equal(T.replay(4, "african10-medium", "32-28,".repeat(4000)).ok, false, "too long");
  // A capture with a landing left out: refused (every landing must be listed).
  const jump = g.mine.find((m) => m.path.length > 1);
  if (jump) {
    const i = g.mine.indexOf(jump);
    const toks = g.recording.split(",");
    const parts = toks[i].split("x");
    toks[i] = [parts[0], parts[parts.length - 1]].join("x");
    assert.equal(T.replay(4, "african10-easy", toks.join(",")).ok, false, "a multi-jump with landings missing");
  }
  const res = T.replay(4, "african10-medium", "32-28,resign");
  assert.ok(res.ok && res.finished);
  if (res.ok) { assert.deepEqual(res.rank, [0, 1, 20]); assert.equal(res.summary, "Resigned after 1 move"); }
  const u = T.replay(4, "african10-medium", "32-28");
  assert.ok(u.ok && !u.finished);
  const e = T.replay(4, "english-medium", "");
  assert.ok(e.ok && !e.finished);
}

// Rank order: quick win, slow win, slow win with fewer pieces, long draw, long loss, quick loss.
{
  const order = [[2, -20, 5], [2, -40, 9], [2, -40, 3], [1, 90, 2], [0, 60, 0], [0, 12, 4]];
  for (let i = 0; i + 1 < order.length; i++) assert.ok(compareRank(order[i], order[i + 1]) > 0);
}

console.log("replay-draughts: all tests passed");
