// Whot tournament replays (lib/arcade/replay-whot.ts; owner, 21 Nov 2026: "start tournaments"): whole games recorded with the same
// encoder the UI uses replay to the same result; same seed, same deal; tampered recordings are refused; ranking follows doc §3.
// Run: npx -y tsx tests/arcade/replay-whot.test.ts
import assert from "node:assert/strict";
import { applyMove, computerMove, legalMoves, type WhotMove, type WhotState } from "../../lib/arcade/whot";
import {
  WHOT_TOURNAMENT, decodeWhotMoves, encodeWhotMove, replayWhot, whotComputerTurns, whotTourneyStart,
} from "../../lib/arcade/replay-whot";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };
const LEVEL = WHOT_TOURNAMENT.levels[0];

// Plays a whole game the way WhotGame does: you move (here a bot picks), the recording gets encodeWhotMove(m), the computer answers.
// `pick` chooses your move from the legal ones; `stopAfter` leaves the game unfinished.
function play(seed: number, pick: (s: WhotState, moves: WhotMove[]) => WhotMove, stopAfter = Infinity) {
  let s = whotComputerTurns(whotTourneyStart(seed, LEVEL));
  const rec: string[] = [];
  while (s.phase !== "over" && rec.length < stopAfter) {
    assert.equal(s.turn, 0, "it's always your turn when the computer has finished");
    const m = pick(s, legalMoves(s));
    rec.push(encodeWhotMove(m));
    s = applyMove(s, m);
    // The UI's computer turn, one move at a time.
    while (s.phase !== "over" && s.turn === 1) s = applyMove(s, computerMove(s));
  }
  return { state: s, recording: rec.join(",") };
}
const smart = (s: WhotState) => computerMove(s); // you play like the computer does
const dumb = (_s: WhotState, moves: WhotMove[]) => moves[moves.length - 1]; // always market (or the last shape)

// Same seed, same deal; a different seed, a different one. You always lead.
{
  const a = whotTourneyStart(1234, LEVEL); const b = whotTourneyStart(1234, LEVEL); const c = whotTourneyStart(1235, LEVEL);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.hands, c.hands);
  assert.equal(a.turn, 0);
  assert.equal(a.hands[0].length, 5); assert.equal(a.hands[1].length, 5);
}

// The format round-trips and has one spelling per game.
{
  const moves: WhotMove[] = [{ type: "play", index: 0 }, { type: "draw" }, { type: "play", index: 12 }, { type: "call", shape: "square" }, { type: "call", shape: "star" }];
  const rec = moves.map(encodeWhotMove).join(",");
  assert.equal(rec, "0,m,12,Q,S");
  assert.deepEqual(decodeWhotMoves(rec), moves);
  assert.deepEqual(decodeWhotMoves(""), []);
  for (const bad of ["01", "1,,2", "x", "1,", " 1", "100", "M", 42, null, "c"]) assert.equal(decodeWhotMoves(bad), null, `refuses ${JSON.stringify(bad)}`);
}

// Whole games, many seeds, two styles: the replay reproduces the end exactly, and the result is a finished game.
let wins = 0; let losses = 0;
const results: Ok[] = [];
for (let seed = 1; seed <= 150; seed++) {
  for (const pick of [smart, dumb]) {
    const g = play(seed, pick);
    const rec = replayWhot(seed, LEVEL, g.recording);
    assert.ok(rec.ok);
    if (rec.ok) assert.deepEqual(rec.state, g.state, `seed ${seed}: the replay ends where the game did`);
    assert.ok(g.recording.length <= WHOT_TOURNAMENT.maxRecording);
    const r = ok(WHOT_TOURNAMENT.replay(seed, LEVEL, g.recording));
    assert.equal(r.finished, true);
    const won = g.state.winner === 0;
    if (won) wins++; else losses++;
    assert.equal(r.rank[0], won ? 1 : 0);
    assert.equal(r.rank[1], won ? g.state.hands[1].length : -g.state.hands[0].length);
    assert.equal(r.rank[2], -g.recording.split(",").length);
    assert.match(r.summary, won ? /^Won with \d+ cards? left to the computer, \d+ moves?$/ : /^Lost, \d+ cards? left in your hand$/);
    assert.equal(r.ms, undefined);
    results.push(r);
  }
}
assert.ok(wins > 20 && losses > 20, `both wins (${wins}) and losses (${losses}) were tested`);

// Score never disagrees with rank: a higher rank never has a lower score.
for (const a of results) for (const b of results.slice(0, 60)) {
  if (compareRank(a.rank, b.rank) > 0) assert.ok(a.score >= b.score, `${a.summary} (${a.score}) vs ${b.summary} (${b.score})`);
}

// Ranking: a win beats any loss; more cards left to the computer beats fewer; then fewer moves.
{
  const win1 = [1, 1, -40]; const win4 = [1, 4, -60]; const win4fast = [1, 4, -20]; const loss1 = [0, -1, -10];
  assert.ok(compareRank(win1, loss1) > 0);
  assert.ok(compareRank(win4, win1) > 0);
  assert.ok(compareRank(win4fast, win4) > 0);
  const best = results.filter((r) => r.rank[0] === 1).sort((a, b) => compareRank(b.rank, a.rank))[0];
  const worst = results.filter((r) => r.rank[0] === 0).sort((a, b) => compareRank(a.rank, b.rank))[0];
  assert.ok(compareRank(best.rank, worst.rank) > 0 && best.score > worst.score);
}

// Unfinished: a game stopped part-way replays fine but isn't finished.
{
  const g = play(7, smart, 2);
  assert.equal(g.state.phase === "over", false);
  const r = ok(WHOT_TOURNAMENT.replay(7, LEVEL, g.recording));
  assert.equal(r.finished, false);
  assert.equal(ok(WHOT_TOURNAMENT.replay(7, LEVEL, "")).finished, false, "no moves at all");
}

// Tampering is refused.
{
  const seed = 42;
  const g = play(seed, smart);
  // A move after the end.
  const after = WHOT_TOURNAMENT.replay(seed, LEVEL, `${g.recording},m`);
  assert.equal(after.ok, false);
  if (!after.ok) assert.match(after.error, /after it ended/);
  // Garbage, and the wrong type.
  for (const bad of ["hello", "1;2", { moves: [] }, 7, undefined]) assert.equal(WHOT_TOURNAMENT.replay(seed, LEVEL, bad).ok, false);
  // A card you can't play: find the first position where some card in hand isn't legal, and play it.
  let s = whotComputerTurns(whotTourneyStart(seed, LEVEL));
  const prefix: string[] = [];
  for (const t of g.recording.split(",")) {
    const legal = legalMoves(s);
    const illegal = s.phase === "play" ? s.hands[0].findIndex((_c, i) => !legal.some((m) => m.type === "play" && m.index === i)) : -1;
    if (illegal >= 0) {
      const r = WHOT_TOURNAMENT.replay(seed, LEVEL, [...prefix, String(illegal)].join(","));
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.error, /rules don't allow/);
      break;
    }
    prefix.push(t);
    s = whotComputerTurns(applyMove(s, decodeWhotMoves(t)![0]));
  }
  assert.ok(prefix.length < g.recording.split(",").length, "found an illegal card to try");
  // A card beyond your hand, and a shape call when there's nothing to call.
  assert.equal(WHOT_TOURNAMENT.replay(seed, LEVEL, "40").ok, false);
  const start = whotTourneyStart(seed, LEVEL);
  if (start.phase === "play") assert.equal(WHOT_TOURNAMENT.replay(seed, LEVEL, "C").ok, false);
  // An unknown level.
  assert.equal(WHOT_TOURNAMENT.replay(seed, "hard", g.recording).ok, false);
}

// The same game is worth the same everywhere: replaying twice gives identical results (pure, deterministic).
{
  const g = play(99, smart);
  assert.deepEqual(WHOT_TOURNAMENT.replay(99, LEVEL, g.recording), WHOT_TOURNAMENT.replay(99, LEVEL, g.recording));
}

// It's registered.
assert.equal(tournamentGame("whot"), WHOT_TOURNAMENT);
assert.deepEqual(WHOT_TOURNAMENT.levels, ["standard"]);

console.log("replay-whot: all tests passed");
