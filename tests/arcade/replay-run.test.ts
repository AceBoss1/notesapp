// Naija Run tournament replays (lib/arcade/replay-run.ts; owner, 21 Nov 2026: "start tournaments"): runs recorded with encodeStep and
// stepDt, as RunGame records them, replay to the same score; same seed, same street; tampering is refused; ranking is score then metres.
// Run: npx -y tsx tests/arcade/replay-run.test.ts
import assert from "node:assert/strict";
import { botInput, createRun, score, step, type RunInput, type RunState, type Speed } from "../../lib/arcade/run";
import { encodeStep, stepDt } from "../../lib/arcade/run-replay";
import { RUN_TOURNAMENT } from "../../lib/arcade/replay-run";
import { compareRank, tournamentGame, type ReplayResult } from "../../lib/arcade/tournament-games";

type Ok = Extract<ReplayResult, { ok: true }>;
const ok = (r: ReplayResult): Ok => { assert.ok(r.ok, r.ok ? "" : r.error); return r as Ok; };

// The RunGame loop in tournament mode: each frame's time goes through stepDt, the step is recorded with encodeStep, then stepped.
// Frame times wobble like a real browser's; `skill` is how often the bot looks at the road (1 = always).
function play(seed: number, level: Speed, skill: number, maxSteps = 60_000) {
  let s: RunState = createRun(seed, level);
  const rec: number[] = [];
  let r = seed;
  const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
  while (!s.over && rec.length < maxSteps) {
    const dt = stepDt(12 + rand() * 10);
    const input: RunInput = rand() < skill ? botInput(s) : "none";
    rec.push(encodeStep(dt, input));
    s = step(s, dt, input);
  }
  return { state: s, recording: rec.join(",") };
}

// Same seed, same street.
{
  const a = createRun(77, "normal"); const b = createRun(77, "normal"); const c = createRun(78, "normal");
  const ahead = (s: RunState) => step(s, 50).obstacles.map((o) => [o.kind, o.lane, o.z]);
  assert.deepEqual(ahead(a), ahead(b));
  assert.notDeepEqual(ahead(a), ahead(c));
}

// Whole runs at every speed replay to exactly the score the player saw.
const results: Ok[] = [];
for (const level of RUN_TOURNAMENT.levels as Speed[]) {
  for (let seed = 1; seed <= 6; seed++) {
    for (const skill of [0.05, 0.3]) {
      const g = play(seed * 101, level, skill);
      assert.ok(g.state.over, "the bot crashes eventually");
      assert.ok(g.recording.length <= RUN_TOURNAMENT.maxRecording);
      const r = ok(RUN_TOURNAMENT.replay(seed * 101, level, g.recording));
      assert.equal(r.finished, true);
      assert.equal(r.score, score(g.state));
      assert.deepEqual(r.rank, [score(g.state), Math.floor(g.state.distance)]);
      assert.equal(r.summary, `${score(g.state).toLocaleString("en-US")} points · ${Math.floor(g.state.distance).toLocaleString("en-US")} m`);
      assert.ok(typeof r.ms === "number" && r.ms > 0);
      results.push(r);
    }
  }
}
assert.equal(RUN_TOURNAMENT.levels[0], "normal", "the default is the DAVIDO tournament's speed");

// Summary formatting.
{
  const big = results.find((r) => r.score >= 1000);
  if (big) assert.match(big.summary, /^\d{1,3}(,\d{3})+ points · [\d,]+ m$/);
}

// Ranking: a higher score ranks higher; on equal scores, the longer run.
{
  assert.ok(compareRank([4120, 1880], [4000, 2500]) > 0);
  assert.ok(compareRank([4120, 1880], [4120, 1700]) > 0);
  for (const a of results) for (const b of results) if (compareRank(a.rank, b.rank) > 0) assert.ok(a.score >= b.score);
}

// Unfinished: a run sent before the crash replays but isn't finished.
{
  const g = play(5, "normal", 1, 300);
  assert.equal(g.state.over, false);
  const r = ok(RUN_TOURNAMENT.replay(5, "normal", g.recording));
  assert.equal(r.finished, false);
}

// Tampering is refused.
{
  const g = play(9, "normal", 0.5);
  assert.equal(RUN_TOURNAMENT.replay(9, "normal", `${g.recording},80`).ok, false, "steps after the crash");
  for (const bad of ["", "abc", "1000", "85,,85", "4", 85, null, ["85"]]) assert.equal(RUN_TOURNAMENT.replay(9, "normal", bad).ok, false, `refuses ${JSON.stringify(bad)}`);
  assert.equal(RUN_TOURNAMENT.replay(9, "turbo", g.recording).ok, false, "unknown speed");
  assert.equal(RUN_TOURNAMENT.replay(9, "toString", g.recording).ok, false, "not a speed");
}

// Pure: replaying twice gives identical results.
{
  const g = play(3, "fast", 0.3);
  assert.deepEqual(RUN_TOURNAMENT.replay(3, "fast", g.recording), RUN_TOURNAMENT.replay(3, "fast", g.recording));
}

assert.equal(tournamentGame("run"), RUN_TOURNAMENT);
console.log("replay-run: all tests passed");
