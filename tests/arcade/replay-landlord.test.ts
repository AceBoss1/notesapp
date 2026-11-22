// Naija Landlord tournament replays (lib/arcade/replay-landlord.ts; owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho,
// Landlord…"): whole games recorded with the same encoder the UI uses replay to the same result; same seed, same dice and cards;
// tampered recordings are refused; ranking follows doc §3; every game ends in bounded time.
// Run: npx -y tsx tests/arcade/replay-landlord.test.ts
import assert from "node:assert/strict";
import { ROUND_CAP, aiAction, applyAction, legalActions, netWorth, type Action, type State } from "../../lib/arcade/landlord";
import {
  LANDLORD_TOURNAMENT, decodeLandlordActions, encodeLandlordAction, landlordComputerTurns, landlordMoney, landlordTourneyOver,
  landlordTourneyRng, landlordTourneyStart, replayLandlord,
} from "../../lib/arcade/replay-landlord";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };
const LEVEL = LANDLORD_TOURNAMENT.levels[0];

// Plays a whole game the way LandlordGame does, one action at a time: the computers play aiAction, you (a bot here) pick from the legal
// actions, every action draws from landlordTourneyRng(seed, state), and your actions are recorded with encodeLandlordAction.
function play(seed: number, pick: (s: State, actions: Action[]) => Action, stopAfter = Infinity) {
  let s = landlordTourneyStart(seed, LEVEL);
  const rec: string[] = [];
  let steps = 0;
  while (!landlordTourneyOver(s) && rec.length < stopAfter) {
    const a = s.turn === 0 ? pick(s, legalActions(s)) : aiAction(s);
    if (s.turn === 0) rec.push(encodeLandlordAction(a));
    s = applyAction(s, a, landlordTourneyRng(seed, s));
    assert.ok(++steps < 50000, "bounded");
  }
  return { state: s, recording: rec.join(",") };
}
const smart = (s: State) => aiAction(s); // you play like the computers do
const eager = (_s: State, a: Action[]) => a.find((x) => x.type === "build") ?? a.find((x) => x.type === "buy") ?? a[0]; // build and buy everything
const shy = (_s: State, a: Action[]) => a.find((x) => x.type === "skip") ?? a[0]; // never buy

// The setup: you and three computers, nothing random in the start, one level.
{
  const a = landlordTourneyStart(5, LEVEL);
  assert.deepEqual(a, landlordTourneyStart(6, LEVEL));
  assert.equal(a.players.length, 4);
  assert.ok(a.players[0].human && !a.players[1].human);
  assert.equal(a.turn, 0);
  assert.deepEqual(LANDLORD_TOURNAMENT.levels, ["standard"]);
  assert.equal(tournamentGame("landlord"), LANDLORD_TOURNAMENT);
}

// Same seed, same dice and cards: the first stretch of a game (the same choices) is identical; another seed differs.
{
  const opening = (seed: number) => play(seed, smart, 25).state;
  assert.deepEqual(opening(2024), opening(2024));
  assert.notDeepEqual(opening(2024).log, opening(2025).log);
  // The rng for a roll depends only on the seed and (round, turn, doubles), so the same slot gives the same numbers in any game.
  const s = landlordTourneyStart(1, LEVEL);
  const r1 = landlordTourneyRng(1, s); const r2 = landlordTourneyRng(1, { ...s, log: ["something else"], players: s.players.map((p) => ({ ...p, cash: 7 })) });
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  assert.notEqual(landlordTourneyRng(1, s)(), landlordTourneyRng(1, { ...s, turn: 1 })());
}

// The format round-trips and has one spelling per game.
{
  const acts: Action[] = [{ type: "roll" }, { type: "buy" }, { type: "skip" }, { type: "build", square: 0 }, { type: "build", square: 31 }, { type: "build", square: 9 }];
  const rec = acts.map(encodeLandlordAction).join(",");
  assert.equal(rec, "r,b,s,0,31,9");
  assert.deepEqual(decodeLandlordActions(rec), acts);
  assert.deepEqual(decodeLandlordActions(""), []);
  for (const bad of ["32", "09", "r,,b", "R", "r,", " r", "x", "-1", 3, null, ["r"]]) assert.equal(decodeLandlordActions(bad), null, `refuses ${JSON.stringify(bad)}`);
}

// Money reads as N$, in thousands and millions.
assert.equal(landlordMoney(850), "N$850k");
assert.equal(landlordMoney(4200), "N$4.2m");
assert.equal(landlordMoney(3000), "N$3m");

// Whole games, many seeds, three styles: the replay ends exactly where the game did, with the same rank every time.
const tally = { won: 0, lost: 0, bankrupt: 0 };
const results: Ok[] = [];
for (let seed = 1; seed <= 60; seed++) {
  for (const pick of [smart, eager, shy]) {
    const g = play(seed * 104729, pick);
    const r0 = replayLandlord(seed * 104729, LEVEL, g.recording);
    assert.ok(r0.ok);
    if (r0.ok) assert.deepEqual(r0.state, g.state, `seed ${seed}: the replay ends where the game did`);
    assert.ok(g.recording.length <= LANDLORD_TOURNAMENT.maxRecording, `recording ${g.recording.length} chars`);
    const r = ok(LANDLORD_TOURNAMENT.replay(seed * 104729, LEVEL, g.recording));
    assert.deepEqual(ok(LANDLORD_TOURNAMENT.replay(seed * 104729, LEVEL, g.recording)), r, "deterministic");
    assert.equal(r.finished, true);
    const s = g.state;
    assert.ok(s.round <= ROUND_CAP, "bounded by the round cap");
    const out = s.players[0].out;
    const won = s.phase === "over" && s.winner === 0;
    if (out) {
      tally.bankrupt++;
      assert.deepEqual(r.rank, [0, 0, 0, s.round]);
      assert.equal(r.summary, `Bankrupt in round ${s.round}`);
    } else {
      assert.equal(s.phase, "over");
      if (won) tally.won++; else tally.lost++;
      assert.deepEqual(r.rank, [won ? 1 : 0, 1, netWorth(s, 0), -s.round]);
      assert.match(r.summary, won ? /^Won · net worth N\$[\d.]+[km] in \d+ rounds?$/ : /^Lost to (Chidi|Amaka|Tunde) · net worth N\$[\d.]+[km] after \d+ rounds?$/);
    }
    results.push(r);
  }
}
assert.ok(tally.won > 5 && tally.lost > 5 && tally.bankrupt > 5, `wins, losses and bankruptcies were all tested: ${JSON.stringify(tally)}`);

// Rank ordering: a win above anything; standing above bankrupt; richer above poorer; bankrupt later above bankrupt sooner. And score
// never disagrees with rank.
assert.ok(compareRank([1, 1, 900, -80], [0, 1, 9000, -80]) > 0);
assert.ok(compareRank([0, 1, 0, -80], [0, 0, 0, 79]) > 0);
assert.ok(compareRank([0, 0, 0, 30], [0, 0, 0, 12]) > 0);
assert.ok(compareRank([1, 1, 5000, -20], [1, 1, 5000, -80]) > 0);
for (const a of results) for (const b of results) {
  if (compareRank(a.rank, b.rank) > 0) assert.ok(a.score >= b.score, `${a.summary} (${a.score}) vs ${b.summary} (${b.score})`);
}

// Unfinished games are replayed but marked unfinished.
{
  const g = play(77, smart, 6);
  const r = ok(LANDLORD_TOURNAMENT.replay(77, LEVEL, g.recording));
  assert.equal(r.finished, false);
  assert.match(r.summary, /^Unfinished, net worth N\$/);
  assert.equal(ok(LANDLORD_TOURNAMENT.replay(77, LEVEL, "")).finished, false, "no decisions at all");
}

// Tampering: an illegal action, an action after the end, garbage, a wrong level.
{
  const seed = 8080;
  const g = play(seed, smart);
  assert.equal(ok(LANDLORD_TOURNAMENT.replay(seed, LEVEL, g.recording)).finished, true);
  const after = LANDLORD_TOURNAMENT.replay(seed, LEVEL, `${g.recording},r`);
  assert.ok(!after.ok && /after it ended/.test(after.error));
  // Your first decision has to be a roll: buying, skipping or building before you've moved isn't allowed.
  for (const first of ["b", "s", "1", "31"]) {
    const r = LANDLORD_TOURNAMENT.replay(seed, LEVEL, first);
    assert.ok(!r.ok && /rules don't allow/.test(r.error), `refuses a first "${first}"`);
  }
  // Replace a skip with a buy where you couldn't afford (or there's nothing to buy), or a roll with a skip: refused somewhere.
  const toks = g.recording.split(",");
  let refused = 0;
  for (let i = 0; i < toks.length && refused < 5; i++) {
    if (toks[i] !== "r") continue;
    const t = [...toks]; t[i] = "s";
    const r = LANDLORD_TOURNAMENT.replay(seed, LEVEL, t.join(","));
    assert.ok(!r.ok && /rules don't allow/.test(r.error), "a skip when it's time to roll");
    refused++;
  }
  assert.ok(refused > 0);
  for (const garbage of ["roll", "r b", "r;b", 12, null, {}, "r,,"]) {
    const r = LANDLORD_TOURNAMENT.replay(seed, LEVEL, garbage);
    assert.ok(!r.ok, `refuses ${JSON.stringify(garbage)}`);
  }
  const lvl = LANDLORD_TOURNAMENT.replay(seed, "hard", g.recording);
  assert.ok(!lvl.ok && /level/.test(lvl.error));
}

// landlordComputerTurns stops on your move or the end of your try, never at a computer's turn.
{
  const s = landlordComputerTurns(3, applyAction(landlordTourneyStart(3, LEVEL), { type: "roll" }, landlordTourneyRng(3, landlordTourneyStart(3, LEVEL))));
  assert.ok(landlordTourneyOver(s) || s.turn === 0);
}

console.log("replay-landlord: all tests passed");
