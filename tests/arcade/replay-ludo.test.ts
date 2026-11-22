// Ludo tournament replays (lib/arcade/replay-ludo.ts; owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord…"): whole
// games recorded with the same encoder the UI uses replay to the same result; same seed, same dice; tampered recordings are refused;
// ranking follows doc §3; every game ends in bounded time.
// Run: npx -y tsx tests/arcade/replay-ludo.test.ts
import assert from "node:assert/strict";
import { HOME, applyAction, applyRoll, chooseAction, legalActions, type LudoAction, type LudoState } from "../../lib/arcade/ludo";
import {
  LUDO_ROLL_CAP, LUDO_TOURNAMENT, decodeLudoMoves, encodeLudoMove, ludoTourneyAction, ludoTourneyAdvance, ludoTourneyDice,
  ludoTourneyOver, ludoTourneyStart, replayLudo,
} from "../../lib/arcade/replay-ludo";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };
const LEVEL = LUDO_TOURNAMENT.levels[0];

// Plays a whole game the way LudoGame does, one step at a time: every roll is ludoTourneyDice(seed, state.rolls), the computers play
// chooseAction, and when you have dice a bot picks your move, which goes through ludoTourneyAction and is recorded with encodeLudoMove.
function play(seed: number, pick: (s: LudoState, actions: LudoAction[]) => LudoAction, stopAfter = Infinity) {
  let s = ludoTourneyStart(seed, LEVEL);
  const rec: string[] = [];
  let turns = 0;
  while (!ludoTourneyOver(s) && rec.length < stopAfter) {
    if (s.phase === "roll") {
      if (s.turn === 0 && s.used.every(Boolean)) turns++;
      s = applyRoll(s, ludoTourneyDice(seed, s.rolls));
    } else if (s.turn !== 0) s = applyAction(s, chooseAction(s));
    else {
      const m = pick(s, legalActions(s));
      assert.equal(m.kind, "step");
      const a = ludoTourneyAction(s, m.seed, s.dice[(m as { die: number }).die]);
      assert.ok(a);
      rec.push(encodeLudoMove(s, a));
      s = applyAction(s, a);
    }
  }
  return { state: s, recording: rec.join(""), turns };
}
const smart = (s: LudoState) => chooseAction(s); // you play like the computers do
const first = (_s: LudoState, a: LudoAction[]) => a[0];
const last = (_s: LudoState, a: LudoAction[]) => a[a.length - 1];

// The setup: four players, the standard rules, you roll first, nothing random in the start.
{
  const a = ludoTourneyStart(77, LEVEL);
  assert.deepEqual(a, ludoTourneyStart(78, LEVEL));
  assert.deepEqual(a.options, { dice: 2, sixFiveHome: false, hitHome: true });
  assert.deepEqual(a.table.owner, [0, 1, 2, 3]);
  assert.equal(a.table.playToLast, false);
  assert.equal(a.turn, 0);
  assert.equal(a.rolls, 0);
  assert.deepEqual(LUDO_TOURNAMENT.levels, ["standard"]);
  assert.equal(tournamentGame("ludo"), LUDO_TOURNAMENT);
}

// Same seed, same dice sequence; another seed, another one. Dice are fair-looking and two at a time.
{
  const seq = (seed: number) => Array.from({ length: 200 }, (_, k) => ludoTourneyDice(seed, k));
  assert.deepEqual(seq(1234), seq(1234));
  assert.notDeepEqual(seq(1234), seq(1235));
  const counts = Array(7).fill(0);
  for (const r of seq(99)) { assert.equal(r.length, 2); for (const d of r) { assert.ok(d >= 1 && d <= 6); counts[d]++; } }
  for (let d = 1; d <= 6; d++) assert.ok(counts[d] > 40, `face ${d} turns up (${counts[d]} of 400)`);
}

// The format round-trips and has one spelling per game.
{
  assert.deepEqual(decodeLudoMoves("0631"), [[0, 6], [3, 1]]);
  assert.deepEqual(decodeLudoMoves(""), []);
  for (const bad of ["06 ", "4", "46", "07", "00", "0,6", "a6", " 06", "063", 42, null, undefined, ["06"]]) {
    assert.equal(decodeLudoMoves(bad), null, `refuses ${JSON.stringify(bad)}`);
  }
  assert.throws(() => encodeLudoMove(ludoTourneyStart(1, LEVEL), { kind: "home", seed: 0 }));
}

// Equal dice are interchangeable: the second of two equal dice records the same token, and ludoTourneyAction names the first.
{
  let s = ludoTourneyStart(5, LEVEL);
  s = applyRoll(applyRoll(s, [6, 6]), [3, 4]); // a double six banked, then 3 and 4
  assert.equal(s.phase, "move");
  assert.equal(encodeLudoMove(s, { kind: "step", seed: 2, die: 1 }), "26");
  assert.deepEqual(ludoTourneyAction(s, 2, 6), { kind: "step", seed: 2, die: 0 });
  assert.equal(ludoTourneyAction(s, 2, 5), null, "no 5 banked");
  assert.equal(ludoTourneyAction(s, 2, 3), null, "a 3 can't bring a seed out");
}

// Whole games, many seeds, three styles: the replay ends exactly where the game did, with the same rank every time.
let wins = 0; let losses = 0;
const results: Ok[] = [];
for (let seed = 1; seed <= 120; seed++) {
  for (const pick of [smart, first, last]) {
    const g = play(seed * 7919, pick);
    const r0 = replayLudo(seed * 7919, LEVEL, g.recording);
    assert.ok(r0.ok);
    if (r0.ok) {
      assert.deepEqual(r0.state, g.state, `seed ${seed}: the replay ends where the game did`);
      assert.equal(r0.turns, g.turns);
    }
    assert.ok(g.recording.length <= LUDO_TOURNAMENT.maxRecording, `recording ${g.recording.length} chars`);
    assert.ok(g.state.rolls < LUDO_ROLL_CAP / 3, `a real game is far below the roll cap (${g.state.rolls})`);
    const r = ok(LUDO_TOURNAMENT.replay(seed * 7919, LEVEL, g.recording));
    assert.deepEqual(ok(LUDO_TOURNAMENT.replay(seed * 7919, LEVEL, g.recording)), r, "deterministic");
    assert.equal(r.finished, true);
    assert.equal(g.state.phase, "over");
    const won = g.state.winner === 0;
    const home = g.state.seeds[0].filter((p) => p === HOME).length;
    if (won) wins++; else losses++;
    assert.deepEqual(r.rank, [won ? 1 : 0, home, -g.turns]);
    if (won) assert.equal(home, 4);
    else assert.ok(home < 4);
    assert.match(r.summary, won ? /^Won with 4 seeds home in \d+ turns$/ : /^Finished (2nd|3rd|4th), \d seeds? home$/);
    results.push(r);
  }
}
assert.ok(wins > 20 && losses > 20, `both wins (${wins}) and losses (${losses}) were tested`);

// Rank ordering: wins above losses, more seeds home above fewer, then fewer turns; and score never disagrees with rank.
assert.ok(compareRank([1, 4, -40], [0, 3, -10]) > 0);
assert.ok(compareRank([0, 3, -50], [0, 2, -10]) > 0);
assert.ok(compareRank([1, 4, -30], [1, 4, -31]) > 0);
for (const a of results) for (const b of results.slice(0, 80)) {
  if (compareRank(a.rank, b.rank) > 0) assert.ok(a.score >= b.score, `${a.summary} (${a.score}) vs ${b.summary} (${b.score})`);
}

// Unfinished games are replayed but marked unfinished.
{
  const g = play(4242, smart, 5);
  const r = ok(LUDO_TOURNAMENT.replay(4242, LEVEL, g.recording));
  assert.equal(r.finished, false);
  assert.match(r.summary, /^Unfinished/);
  assert.equal(ok(LUDO_TOURNAMENT.replay(4242, LEVEL, "")).finished, false, "no moves at all");
}

// Tampering: an illegal move, a move after the end, garbage, a wrong level, a recording from another seed.
{
  const seed = 31337;
  const g = play(seed, smart);
  assert.equal(ok(LUDO_TOURNAMENT.replay(seed, LEVEL, g.recording)).finished, true);
  const after = LUDO_TOURNAMENT.replay(seed, LEVEL, `${g.recording}06`);
  assert.ok(!after.ok && /after it ended/.test(after.error));
  // Your first move needs a 6 to bring a seed out: find a game whose first move isn't a 6, and change it to a 3 (the seeds are all
  // in the yard, so a 3 can never be legal).
  let bad = 0;
  for (let s2 = 1; s2 < 60 && !bad; s2++) {
    const h = play(s2, smart, 1);
    if (!h.recording) continue;
    const r = LUDO_TOURNAMENT.replay(s2, LEVEL, `${h.recording[0]}3`);
    assert.ok(!r.ok && /rules don't allow/.test(r.error));
    bad++;
  }
  assert.equal(bad, 1);
  // A different value from the one rolled, mid-game.
  let changed = 0;
  for (let i = 2; i < g.recording.length && changed < 5; i += 2) {
    const v = Number(g.recording[i + 1]);
    const tampered = g.recording.slice(0, i) + g.recording[i] + String(v === 1 ? 2 : v - 1) + g.recording.slice(i + 2);
    const r = LUDO_TOURNAMENT.replay(seed, LEVEL, tampered);
    if (!r.ok) { assert.match(r.error, /rules don't allow|after it ended/); changed++; }
  }
  assert.ok(changed > 0, "changing the die value of a move gets refused somewhere");
  for (const garbage of ["xyz", "0", "06,", 12, null, {}, "9".repeat(10)]) {
    const r = LUDO_TOURNAMENT.replay(seed, LEVEL, garbage);
    assert.ok(!r.ok, `refuses ${JSON.stringify(garbage)}`);
  }
  const lvl = LUDO_TOURNAMENT.replay(seed, "hard", g.recording);
  assert.ok(!lvl.ok && /level/.test(lvl.error));
  // The same recording against another seed's dice falls apart (or at least doesn't give the same game).
  const other = LUDO_TOURNAMENT.replay(seed + 1, LEVEL, g.recording);
  assert.ok(!other.ok || other.summary !== ok(LUDO_TOURNAMENT.replay(seed, LEVEL, g.recording)).summary || !other.finished);
}

// ludoTourneyAdvance stops on your move or the end, and never at a computer's.
{
  const s = ludoTourneyAdvance(9, ludoTourneyStart(9, LEVEL));
  assert.ok(ludoTourneyOver(s) || (s.turn === 0 && s.phase === "move"));
}

console.log("replay-ludo: all tests passed");
