// Ncho and Aka-Hausa tournament replay (lib/arcade/replay-ncho.ts); owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho,
// Landlord, Spades, Draughts, Achi and Puff-Puff". Run: npx -y tsx tests/arcade/replay-ncho.test.ts
import assert from "node:assert/strict";
import { applyMove, chooseMove, legalMoves, seededRng, type Level, type NchoState, type NchoVariant } from "../../lib/arcade/ncho";
import {
  AKAHAUSA_TOURNAMENT, NCHO_TOURNAMENT, encodeNcho, nchoTourneyReply, nchoTourneyStart, replayNcho,
} from "../../lib/arcade/replay-ncho";
import { compareRank } from "../../lib/arcade/tournament-games";

const tournamentOf = (v: NchoVariant) => (v === "akahausa" ? AKAHAUSA_TOURNAMENT : NCHO_TOURNAMENT);

// Plays a game the way the component does: the human (a bot here) sows, the computer answers with nchoTourneyReply, round changes
// carry on by themselves. Recorded through the same encoder the component uses.
function botGame(seed: number, level: Level, variant: NchoVariant, human: (s: NchoState) => number, maxMoves = Infinity) {
  let s = nchoTourneyStart(seed, level, variant);
  const holes: number[] = [];
  const replies: number[] = [];
  while (!s.over && holes.length < maxMoves) {
    if (s.turn === 0) { const h = human(s); holes.push(h); s = applyMove(s, h); }
    else { const r = nchoTourneyReply(s, level, seed); replies.push(r); s = applyMove(s, r); }
  }
  return { recording: encodeNcho(holes), state: s, holes, replies };
}
const randomHuman = (seed: number) => { const rng = seededRng(seed); return (s: NchoState) => { const l = legalMoves(s); return l[Math.floor(rng() * l.length)]; }; };
const strongHuman = (s: NchoState) => chooseMove(s, "hard", () => 0);

// The start: 2 players, 3 rounds, you sow first; Aka-Hausa really sows clockwise.
for (const v of ["ncho", "akahausa"] as const) {
  const s = nchoTourneyStart(1, "medium", v);
  assert.equal(s.players, 2);
  assert.equal(s.roundsTarget, 3);
  assert.equal(s.turn, 0);
  assert.equal(s.variant, v);
}
{
  const a = applyMove(nchoTourneyStart(1, "medium", "ncho"), 0);
  const b = applyMove(nchoTourneyStart(1, "medium", "akahausa"), 0);
  assert.equal(a.last!.path[0], 1, "Ncho sows up the indexes (anticlockwise)");
  assert.equal(b.last!.path[0], 11, "Aka-Hausa sows down them (clockwise)");
  assert.equal(AKAHAUSA_TOURNAMENT.slug, "akahausa");
  assert.equal(NCHO_TOURNAMENT.slug, "ncho");
  assert.deepEqual(NCHO_TOURNAMENT.levels, ["medium", "easy", "hard"]);
}

// Same seed, same position → same computer sowing; the seed matters for the easy level's slips.
{
  const s = applyMove(nchoTourneyStart(5, "easy", "ncho"), 2);
  for (const level of ["easy", "medium", "hard"] as const) {
    const a = nchoTourneyReply(s, level, 99);
    for (let i = 0; i < 3; i++) assert.equal(nchoTourneyReply(s, level, 99), a, `${level}: same reply`);
  }
  const seen = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) seen.add(botGame(seed, "easy", "ncho", randomHuman(7), 6).replies.join(","));
  assert.ok(seen.size > 1, "different seeds steer easy differently");
}

// Bot games in both variants, at every level: the recording replays to the identical end state and rank.
const times: string[] = [];
for (const v of ["ncho", "akahausa"] as const) {
  for (const level of ["easy", "medium", "hard"] as const) {
    for (const [name, human] of [["random", randomHuman(11)], ["strong", strongHuman]] as const) {
      const g = botGame(2026, level, v, human);
      assert.ok(g.state.over, "the game ends");
      const t0 = Date.now();
      const r = replayNcho(2026, level, v, g.recording);
      const ms = Date.now() - t0;
      times.push(`${v}/${level}/${name}: ${g.holes.length} sowings, ${ms} ms`);
      assert.ok(r.ok);
      if (!r.ok) continue;
      assert.deepEqual(r.state.pits, g.state.pits);
      assert.deepEqual(r.state.owner, g.state.owner);
      assert.deepEqual(r.state.lastRound, g.state.lastRound);
      assert.equal(r.state.winner, g.state.winner);
      assert.equal(r.state.plies, g.state.plies);
      assert.equal(r.finished, true);
      assert.equal(r.moves, g.holes.length);
      const res = tournamentOf(v).replay(2026, level, g.recording);
      assert.ok(res.ok && res.finished);
      if (!res.ok) continue;
      const lr = g.state.lastRound!;
      const hd = lr.houses[0] - lr.houses[1], sd = lr.totals[0] - lr.totals[1];
      const tier = g.state.winner === 0 ? 2 : g.state.winner === "draw" ? 1 : 0;
      assert.deepEqual(res.rank, [tier, hd, sd]);
      assert.match(res.summary, /^(Won \d+ houses to \d+|Drew \d+ houses each|Lost \d+ houses to \d+) \(seeds (\+\d+|-\d+|level)\)$/);
      assert.ok(ms < 3000, "replay is quick");
      // The other variant reads the same holes as a different game: it either fails or comes out differently.
      const crossed = tournamentOf(v === "ncho" ? "akahausa" : "ncho").replay(2026, level, g.recording);
      assert.ok(!crossed.ok || JSON.stringify(crossed) !== JSON.stringify(res) || g.holes.length < 3);
    }
  }
}
console.log(times.join("\n"));

// A strong human beats easy at least once across a few seeds (so wins are reachable), and the summary reads right.
{
  let won = false;
  for (let seed = 1; seed <= 6 && !won; seed++) {
    const g = botGame(seed, "easy", "ncho", strongHuman);
    const res = NCHO_TOURNAMENT.replay(seed, "easy", g.recording);
    if (res.ok && res.rank[0] === 2) { won = true; assert.match(res.summary, /^Won /); }
  }
  assert.ok(won, "a strong player can win against easy");
}

// Tampering and refusals.
{
  const g = botGame(77, "medium", "ncho", randomHuman(3));
  const T = NCHO_TOURNAMENT;
  assert.equal(T.replay(77, "medium", g.recording + ",0").ok, false, "a sowing after the end");
  assert.equal(T.replay(77, "nightmare", g.recording).ok, false, "unknown level");
  assert.equal(T.replay(77, "medium", "6").ok, false, "the computer's hole");
  assert.equal(T.replay(77, "medium", "12").ok, false, "no such hole");
  assert.equal(T.replay(77, "medium", "00").ok, false, "a second spelling");
  assert.equal(T.replay(77, "medium", "0,,1").ok, false);
  assert.equal(T.replay(77, "medium", "x").ok, false);
  assert.equal(T.replay(77, "medium", [0, 1]).ok, false);
  assert.equal(T.replay(77, "medium", "0,".repeat(5000)).ok, false, "too long");
  // An empty hole: sow 0, then 0 again before it refills (if the computer didn't put seeds back there).
  const s1 = computerAfter(77, [0]);
  if (s1.pits[0] === 0 && !s1.over) assert.equal(T.replay(77, "medium", "0,0").ok, false, "an empty hole");
  // Changing a sowing changes (or breaks) the game.
  const holes = g.holes.slice();
  const i = holes.findIndex((h, k) => k > 0 && h !== holes[0]);
  if (i > 0) { holes[i] = holes[0]; const t = T.replay(77, "medium", encodeNcho(holes)); assert.ok(!t.ok || JSON.stringify(t) !== JSON.stringify(T.replay(77, "medium", g.recording))); }
}
function computerAfter(seed: number, holes: number[]) {
  let s = nchoTourneyStart(seed, "medium");
  for (const h of holes) { s = applyMove(s, h); while (!s.over && s.turn !== 0) s = applyMove(s, nchoTourneyReply(s, "medium", seed)); }
  return s;
}

// Unfinished: finished false.
{
  const g = botGame(9, "medium", "akahausa", randomHuman(4), 5);
  const res = AKAHAUSA_TOURNAMENT.replay(9, "medium", g.recording);
  assert.ok(res.ok && !res.finished);
  const empty = NCHO_TOURNAMENT.replay(9, "medium", "");
  assert.ok(empty.ok && !empty.finished);
}

// Rank order: any win above any draw above any loss; then houses, then seeds.
{
  const order = [[2, 4, 10], [2, 4, 2], [2, 2, 30], [1, 0, 6], [1, 0, -4], [0, -2, 8], [0, -12, -48]];
  for (let i = 0; i + 1 < order.length; i++) assert.ok(compareRank(order[i], order[i + 1]) > 0);
}

console.log("replay-ncho: all tests passed");
