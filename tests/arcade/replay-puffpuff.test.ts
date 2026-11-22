// Puff-Puff Rush tournament replays (lib/arcade/replay-puffpuff.ts; owner, 21 Nov 2026: "add tournament versions of … Puff-Puff"):
// runs recorded frame by frame as PuffPuffGame records them (uneven frame times through encodePuffStep, then stepped with puffStepDt)
// replay to the same end; same seed, same goats; tampering is refused; ranking is score, then markets, then the quickest; tries are bounded.
// Run: npx -y tsx tests/arcade/replay-puffpuff.test.ts
import assert from "node:assert/strict";
import { botDirection, step, type Dir, type PuffState } from "../../lib/arcade/puffpuff";
import {
  PUFFPUFF_TOURNAMENT, PUFF_MAX_STEPS, PUFF_TOURNEY_MARKETS, PUFF_TOURNEY_MAX_MS, encodePuffStep, puffMarkets, puffStepDt,
  puffTourneyEnd, puffTourneyStart, replayPuff,
} from "../../lib/arcade/replay-puffpuff";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };

// The PuffPuffGame loop in tournament mode: each frame's raw time (wobbling like a real browser's, now and then a long stall) goes
// through encodePuffStep, the frame is stepped with puffStepDt, and the run stops on the frame puffTourneyEnd turns non-null.
// `skill` is how often the bot steers (1 = every frame).
function play(seed: number, level: string, skill: number, maxSteps = PUFF_MAX_STEPS) {
  let s: PuffState = puffTourneyStart(seed, level);
  const rec: string[] = [];
  let r = seed;
  const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
  while (!puffTourneyEnd(s) && rec.length < maxSteps) {
    const raw = rand() < 0.01 ? 80 + rand() * 300 : 6 + rand() * 20.7; // fractions, like performance.now()
    const dir: Dir | null = rand() < skill ? botDirection(s) : null;
    rec.push(encodePuffStep(raw, dir));
    s = step(s, puffStepDt(raw), dir ? { dir } : {});
  }
  return { state: s, recording: rec.join("") };
}

// The encoder: two characters a frame, clamped to 1–100 ms, one spelling.
{
  assert.equal(encodePuffStep(1, null), "05");
  assert.equal(encodePuffStep(0, null), "05");
  assert.equal(encodePuffStep(16.4, "up"), (16 * 5 + 1).toString(36));
  assert.equal(encodePuffStep(16.6, "right"), (17 * 5 + 4).toString(36));
  assert.equal(encodePuffStep(999, "left"), (100 * 5 + 2).toString(36));
  assert.equal(puffStepDt(250), 100); assert.equal(puffStepDt(-3), 1); assert.equal(puffStepDt(7.5), 8);
}

// Same seed, same maze and goats; a different seed, different goat choices (the wanderer's coin flips).
{
  const a = puffTourneyStart(99, "normal"); const b = puffTourneyStart(99, "normal");
  assert.deepEqual(a, b);
  assert.equal(a.maze.name, "Morning market");
  const ride = (seed: number) => { let s = puffTourneyStart(seed, "normal"); for (let i = 0; i < 4000 && s.phase !== "over"; i++) s = step(s, 16); return s; };
  assert.deepEqual(ride(99), ride(99));
  const differ = [100, 101, 102, 103, 104].some((seed) => JSON.stringify(ride(seed).goats) !== JSON.stringify(ride(99).goats));
  assert.ok(differ, "the seed steers the goats");
  assert.equal(puffTourneyStart(1, "fast").speed, "fast");
}

// Whole runs at every speed replay to exactly where the game ended.
const results: Ok[] = [];
let caught = 0;
for (const level of PUFFPUFF_TOURNAMENT.levels) {
  for (let seed = 1; seed <= 3; seed++) {
    for (const skill of [0.02, 0.6, 1]) {
      const g = play(seed * 31, level, skill);
      const end = puffTourneyEnd(g.state);
      assert.ok(end, "every run ends");
      if (end === "caught") caught++;
      assert.ok(g.recording.length <= PUFFPUFF_TOURNAMENT.maxRecording);
      const rep = replayPuff(seed * 31, level, g.recording);
      assert.ok(rep.ok);
      if (rep.ok) assert.deepEqual(rep.state, g.state, `seed ${seed} ${level} ${skill}: the replay ends where the game did`);
      const r = ok(PUFFPUFF_TOURNAMENT.replay(seed * 31, level, g.recording));
      const m = puffMarkets(g.state);
      assert.equal(r.finished, true);
      assert.equal(r.score, g.state.score);
      assert.equal(r.ms, g.state.timeMs);
      assert.deepEqual(r.rank, [g.state.score, m, -Math.round(g.state.timeMs / 1000)]);
      assert.equal(r.summary, `${g.state.score.toLocaleString("en-US")} points · ${m} ${m === 1 ? "market" : "markets"}`);
      // ms is the sum of the recorded frames, so the server's "no more game time than real time" check is honest.
      let sum = 0; for (let i = 0; i < g.recording.length; i += 2) sum += Math.floor(parseInt(g.recording.slice(i, i + 2), 36) / 5);
      assert.equal(r.ms, sum);
      results.push(r);
    }
  }
}
assert.ok(caught > 3, `runs that ended at the last life were tested (${caught})`);
// (The test autopilot never clears a whole market, so the markets and time endings are checked directly below.)
assert.ok(results.some((r) => r.score > 1000), "a decent score was tested");

// Rank ordering: score first; then markets; then fewer seconds.
assert.ok(compareRank([8450, 3, -300], [8440, 9, -10]) > 0);
assert.ok(compareRank([8450, 4, -400], [8450, 3, -100]) > 0);
assert.ok(compareRank([8450, 3, -200], [8450, 3, -201]) > 0);
assert.equal(ok(PUFFPUFF_TOURNAMENT.replay(5, "normal", "")).summary, "0 points · 0 markets");

// Unfinished: readable, but not finished.
{
  const g = play(7, "normal", 1, 300);
  const r = ok(PUFFPUFF_TOURNAMENT.replay(7, "normal", g.recording));
  assert.equal(r.finished, false);
  assert.equal(ok(PUFFPUFF_TOURNAMENT.replay(7, "normal", "")).finished, false);
}

// The end conditions: markets and the game-time cap end a try even if you never lose your last life.
{
  const s = puffTourneyStart(1, "normal");
  assert.equal(puffTourneyEnd(s), null);
  assert.equal(puffTourneyEnd({ ...s, timeMs: PUFF_TOURNEY_MAX_MS }), "time");
  assert.equal(puffTourneyEnd({ ...s, level: PUFF_TOURNEY_MARKETS, phase: "cleared" }), "markets");
  assert.equal(puffTourneyEnd({ ...s, level: PUFF_TOURNEY_MARKETS, phase: "playing" }), null);
  assert.equal(puffTourneyEnd({ ...s, phase: "over" }), "caught");
  // Riding nowhere at all: the goats get you long before the cap (and the cap would end it regardless).
  const idle = play(3, "chill", 0);
  assert.equal(puffTourneyEnd(idle.state), "caught");
  // The cap fits inside the step limit even at 240 frames a second.
  assert.ok((PUFF_TOURNEY_MAX_MS / 4.17) < PUFF_MAX_STEPS);
}

// Tampering is refused.
{
  const seed = 31; const level = "normal";
  const g = play(seed, level, 0.6);
  const refused = (rec: unknown, why: RegExp, lv = level) => {
    const r = PUFFPUFF_TOURNAMENT.replay(seed, lv, rec);
    assert.equal(r.ok, false, `refuses ${String(rec).slice(0, 30)}`);
    if (!r.ok) assert.match(r.error, why);
  };
  refused(`${g.recording}${encodePuffStep(16, "up")}`, /after it ended/);
  refused(`${g.recording}05`, /after it ended/);
  refused(g.recording.slice(0, -1), /couldn't be read/); // odd length
  refused(`00${g.recording}`, /couldn't be read/); // a 0 ms frame
  refused(`zz${g.recording}`, /couldn't be read/); // over 100 ms
  refused(`${g.recording.slice(0, 10)}A5`, /couldn't be read/); // capitals aren't the format
  refused("hello!", /couldn't be read/);
  refused(12345, /couldn't be read/);
  refused(null, /couldn't be read/);
  refused("05".repeat(PUFF_MAX_STEPS + 1), /too long/);
  refused(g.recording, /speed/, "medium");
  refused(g.recording, /speed/, "insane");
}

// Bounded: the registry has the real thing; the recording limit matches the step limit.
{
  assert.equal(tournamentGame("puffpuff"), PUFFPUFF_TOURNAMENT);
  assert.deepEqual(PUFFPUFF_TOURNAMENT.levels, ["normal", "chill", "fast"]);
  assert.equal(PUFFPUFF_TOURNAMENT.maxRecording, PUFF_MAX_STEPS * 2);
  assert.ok(PUFFPUFF_TOURNAMENT.rankedBy.length > 0);
}

console.log("replay-puffpuff: all tests passed");
