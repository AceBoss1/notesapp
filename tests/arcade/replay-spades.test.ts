// Ace of Spades tournament replays (lib/arcade/replay-spades.ts; owner, 21 Nov 2026: "add tournament versions of … Spades …"): whole
// tries recorded with the encoder SpadesGame uses replay to the same end; same seed, same deals; tampering is refused; ranking is team
// points, then tricks, then bids made.
// Run: npx -y tsx tests/arcade/replay-spades.test.ts
import assert from "node:assert/strict";
import { applyMove, computerBid, computerMove, legalCards, type SpadesMove, type SpadesState } from "../../lib/arcade/spades";
import {
  SPADES_TOURNAMENT, SPADES_TOURNEY_HANDS, decodeSpadesMoves, encodeSpadesMove, replaySpades, spadesComputerTurns, spadesTeamTotals,
  spadesTourneyOver, spadesTourneyStart,
} from "../../lib/arcade/replay-spades";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };
const LEVEL = SPADES_TOURNAMENT.levels[0];

// Plays a try the way SpadesGame does: the computer seats move one at a time, NEXT HAND deals between hands, and each of your bids and
// cards is recorded with encodeSpadesMove. `pick` chooses your move; `stopAfter` leaves the try unfinished.
function play(seed: number, pick: (s: SpadesState) => SpadesMove, stopAfter = Infinity) {
  let s = spadesTourneyStart(seed, LEVEL);
  const rec: string[] = [];
  while (!spadesTourneyOver(s) && rec.length < stopAfter) {
    if (s.phase === "handOver") { s = applyMove(s, { type: "next" }); continue; }
    if (s.turn !== 0) { s = applyMove(s, computerMove(s)); continue; }
    const m = pick(s);
    rec.push(encodeSpadesMove(m));
    s = applyMove(s, m);
  }
  return { state: s, recording: rec.join(",") };
}
const smart = (s: SpadesState) => computerMove(s); // you play like the computer seats do
const greedy = (s: SpadesState): SpadesMove => s.phase === "bid" ? { type: "bid", bid: Math.min(13, computerBid(s.hands[0]) + 3) } : { type: "play", card: legalCards(s).at(-1)! };
const nil = (s: SpadesState): SpadesMove => s.phase === "bid" ? { type: "bid", bid: 0 } : { type: "play", card: legalCards(s)[0] };

// Same seed, same deals in every hand; a different seed, different ones. You bid first in hand 1.
{
  const a = spadesTourneyStart(4321, LEVEL); const b = spadesTourneyStart(4321, LEVEL); const c = spadesTourneyStart(4322, LEVEL);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.hands, c.hands);
  assert.equal(a.turn, 0); assert.equal(a.phase, "bid");
  assert.equal(a.target, Infinity);
  // Hand 3's deal doesn't depend on how hands 1 and 2 were played.
  const deals = (pick: (s: SpadesState) => SpadesMove) => {
    let s = spadesTourneyStart(4321, LEVEL); const seen: string[] = [];
    let last = -1;
    while (!spadesTourneyOver(s)) {
      if (s.phase === "bid" && s.history.length !== last) { last = s.history.length; seen.push(JSON.stringify(s.hands)); }
      if (s.phase === "handOver") s = applyMove(s, { type: "next" });
      else s = applyMove(s, s.turn === 0 ? pick(s) : computerMove(s));
    }
    return seen;
  };
  const d1 = deals(smart); const d2 = deals(nil);
  assert.equal(d1.length, SPADES_TOURNEY_HANDS);
  assert.deepEqual(d1, d2, "every hand's deal is the same whatever you play");
  assert.equal(new Set(d1).size, SPADES_TOURNEY_HANDS, "each hand is a fresh deal");
}

// The computer seats are deterministic: the same state gives the same move.
{
  let s = spadesComputerTurns(applyMove(spadesTourneyStart(9, LEVEL), { type: "bid", bid: 3 }));
  for (let i = 0; i < 20 && !spadesTourneyOver(s); i++) {
    if (s.phase === "handOver") { s = applyMove(s, { type: "next" }); continue; }
    assert.deepEqual(computerMove(s), computerMove(s));
    s = applyMove(s, computerMove(s));
  }
}

// The format round-trips and has one spelling per game.
{
  const moves: SpadesMove[] = [{ type: "bid", bid: 4 }, { type: "bid", bid: 13 }, { type: "bid", bid: 0 }, { type: "play", card: { suit: "C", rank: 12 } }, { type: "play", card: { suit: "S", rank: 2 } }, { type: "play", card: { suit: "H", rank: 14 } }];
  const rec = moves.map(encodeSpadesMove).join(",");
  assert.equal(rec, "b4,b13,b0,C12,S2,H14");
  assert.deepEqual(decodeSpadesMoves(rec), moves);
  assert.deepEqual(decodeSpadesMoves(""), []);
  for (const bad of ["b14", "b04", "C1", "C15", "C01", "X5", "c12", "b4,", ",b4", "b4,,C2", " b4", 42, null, "next"]) {
    assert.equal(decodeSpadesMoves(bad), null, `refuses ${JSON.stringify(bad)}`);
  }
}

// Whole tries, many seeds, three styles: the replay ends exactly where the game did, and the rank and summary follow it.
const results: Ok[] = [];
for (let seed = 1; seed <= 40; seed++) {
  for (const pick of [smart, greedy, nil]) {
    const g = play(seed * 7919, pick);
    assert.ok(spadesTourneyOver(g.state));
    assert.equal(g.state.history.length, SPADES_TOURNEY_HANDS);
    assert.equal(g.state.phase, "handOver", "no target in a tournament: it simply stops after the last hand");
    const rep = replaySpades(seed * 7919, LEVEL, g.recording);
    assert.ok(rep.ok);
    if (rep.ok) assert.deepEqual(rep.state, g.state, `seed ${seed}: the replay ends where the game did`);
    assert.ok(g.recording.length <= SPADES_TOURNAMENT.maxRecording, `recording ${g.recording.length} fits`);
    const r = ok(SPADES_TOURNAMENT.replay(seed * 7919, LEVEL, g.recording));
    const t = spadesTeamTotals(g.state);
    assert.equal(r.finished, true);
    assert.deepEqual(r.rank, [t.points, t.tricks, t.bidsMade]);
    assert.equal(r.score, g.state.scores[0]);
    assert.equal(r.summary, `Your team ${g.state.scores[0]} · them ${g.state.scores[1]} after ${SPADES_TOURNEY_HANDS} hands`);
    assert.equal(r.ms, undefined);
    // 5 bids and 65 cards: every move you made is in the recording, nothing else.
    assert.equal(g.recording.split(",").length, SPADES_TOURNEY_HANDS * 14);
    results.push(r);
  }
}
assert.ok(results.some((r) => r.score > 0) && results.some((r) => r.score < 0), "good and bad tries were both tested");

// Rank ordering: more points first; then tricks; then bids made.
assert.ok(compareRank([120, 30, 4], [110, 40, 5]) > 0);
assert.ok(compareRank([120, 31, 1], [120, 30, 5]) > 0);
assert.ok(compareRank([120, 30, 3], [120, 30, 2]) > 0);
assert.ok(compareRank([-20, 10, 0], [5, 0, 0]) < 0);

// Unfinished: readable, but not finished.
{
  const g = play(55, smart, 20);
  const r = ok(SPADES_TOURNAMENT.replay(55, LEVEL, g.recording));
  assert.equal(r.finished, false);
  assert.match(r.summary, /^Unfinished, \d hands? of 5 played$/);
  const empty = ok(SPADES_TOURNAMENT.replay(55, LEVEL, ""));
  assert.equal(empty.finished, false);
}

// Tampering is refused.
{
  const seed = 2024;
  const g = play(seed, smart);
  const toks = g.recording.split(",");
  const refused = (rec: unknown, why: RegExp, level = LEVEL) => {
    const r = SPADES_TOURNAMENT.replay(seed, level, rec);
    assert.equal(r.ok, false, `refuses ${String(rec).slice(0, 40)}`);
    if (!r.ok) assert.match(r.error, why);
  };
  // A move after the last hand.
  refused(`${g.recording},b3`, /after it ended/);
  refused(`${g.recording},${toks[1]}`, /after it ended/);
  // A card you don't hold (one from West's hand).
  const start = spadesComputerTurns(spadesTourneyStart(seed, LEVEL));
  const notMine = start.hands[1][0];
  refused([toks[0], encodeSpadesMove({ type: "play", card: notMine }), ...toks.slice(2)].join(","), /rules don't allow/);
  // A card when you must bid, and a bid when you must play.
  refused([toks[1], ...toks.slice(1)].join(","), /rules don't allow/);
  refused([toks[0], "b2", ...toks.slice(1)].join(","), /rules don't allow/);
  // Not following suit when you could: find a trick where you follow, and swap in an off-suit card you hold.
  {
    let s = spadesComputerTurns(applyMove(start, decodeSpadesMoves(toks[0])![0]));
    let i = 1;
    let done = false;
    for (; i < toks.length && !done; i++) {
      const m = decodeSpadesMoves(toks[i])![0];
      if (s.phase === "play" && s.trick.length > 0) {
        const led = s.trick[0].card.suit;
        const off = s.hands[0].find((c) => c.suit !== led);
        if (s.hands[0].some((c) => c.suit === led) && off) {
          refused([...toks.slice(0, i), encodeSpadesMove({ type: "play", card: off }), ...toks.slice(i + 1)].join(","), /rules don't allow/);
          done = true;
        }
      }
      s = spadesComputerTurns(applyMove(s, m));
    }
    assert.ok(done, "found a trick to revoke in");
  }
  // Garbage, the wrong type, and an unknown level.
  refused("hello", /couldn't be read/);
  refused(["b4"], /couldn't be read/);
  refused(null, /couldn't be read/);
  refused(g.recording, /level/, "hard");
}

// Bounded: the registry has the real thing, and a real try is far under the limit.
{
  const reg = tournamentGame("spades");
  assert.equal(reg, SPADES_TOURNAMENT);
  assert.ok(SPADES_TOURNAMENT.rankedBy.length > 0);
  assert.deepEqual(SPADES_TOURNAMENT.levels, ["standard"]);
  const longest = Math.max(...[1, 2, 3, 4, 5].map((s) => play(s, greedy).recording.length));
  assert.ok(longest * 2 < SPADES_TOURNAMENT.maxRecording);
}

console.log("replay-spades: all tests passed");
