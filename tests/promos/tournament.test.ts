// The tournament's recorded runs (lib/arcade/run-replay.ts): a run played step by step like the browser does (whole-millisecond steps,
// inputs at random moments) and replayed from its recording gives exactly the same score; broken or padded recordings are refused.
// Run: npx -y tsx tests/promos/tournament.test.ts → "tournament replay: ok".
import assert from "node:assert/strict";
import { createRun, score, step, type RunInput } from "../../lib/arcade/run";
import { RUN_INPUTS, encodeStep, replayRun, stepDt } from "../../lib/arcade/run-replay";
import { DAVIDO_AT_34 as C, RUN_GRACE_MS, publicStatus, emptyCounts, tournamentPlaying } from "../../lib/promos";

let seedRng = 7;
const rnd = () => { seedRng = (seedRng * 1103515245 + 12345) >>> 0; return seedRng / 4294967296; };
const T = C.tournament!;

let played = 0, longest = 0;
for (let game = 0; game < 40; game++) {
  // The browser: frames of 8–40 ms (a slow phone to a fast screen), a dodge now and then.
  let s = createRun(T.seed, T.level);
  const rec: number[] = [];
  let frames = 0;
  while (!s.over && frames < 60_000) {
    const raw = 8 + rnd() * 32;
    const input: RunInput = rnd() < 0.04 ? RUN_INPUTS[1 + Math.floor(rnd() * 4)] : "none";
    const d = stepDt(raw);
    rec.push(encodeStep(d, input));
    s = step(s, d, input);
    frames++;
  }
  const r = replayRun(T.seed, T.level, rec.join(","));
  assert.ok(r.ok, "replays");
  if (r.ok) {
    assert.equal(r.score, score(s), `game ${game}: same score`);
    assert.equal(r.metres, Math.floor(s.distance));
    assert.equal(r.coins, s.coins);
    assert.equal(r.state.over, s.over);
    longest = Math.max(longest, r.ms);
  }
  played++;
}
// The same inputs on another seed score differently (the street is the seed).
{
  let a = createRun(T.seed, T.level), b = createRun(T.seed + 1, T.level);
  for (let i = 0; i < 3000 && !(a.over && b.over); i++) { a = step(a, 16); b = step(b, 16); }
  assert.notDeepEqual(a.obstacles.slice(0, 3).map((o) => [o.kind, o.lane]), b.obstacles.slice(0, 3).map((o) => [o.kind, o.lane]));
}

// Refused: not a recording, a step out of range, anything after the crash, too long.
assert.equal(replayRun(T.seed, T.level, "").ok, false);
assert.equal(replayRun(T.seed, T.level, "85,abc").ok, false);
assert.equal(replayRun(T.seed, T.level, 42).ok, false);
assert.equal(replayRun(T.seed, T.level, "4").ok, false, "0 ms step");
assert.equal(replayRun(T.seed, T.level, "255").ok, false, "51 ms step");
{
  let s = createRun(T.seed, T.level); const rec: number[] = [];
  while (!s.over) { rec.push(encodeStep(16, "none")); s = step(s, 16, "none"); }
  assert.equal(replayRun(T.seed, T.level, rec.join(",")).ok, true, "running straight ahead ends in a crash");
  assert.match((replayRun(T.seed, T.level, [...rec, 80].join(",")) as { error: string }).error, /after the crash/);
}
assert.equal(replayRun(T.seed, T.level, Array(200_001).fill(80).join(",")).ok, false);

// The play window: 21 Nov 2026, 22:00 to midnight, Lagos time.
assert.equal(tournamentPlaying(C, new Date("2026-11-21T20:59:00Z")), false);
assert.equal(tournamentPlaying(C, new Date("2026-11-21T21:00:00Z")), true, "10 PM Lagos");
assert.equal(tournamentPlaying(C, new Date("2026-11-21T22:59:59Z")), true);
assert.equal(tournamentPlaying(C, new Date("2026-11-21T23:00:00Z")), false, "midnight Lagos");
assert.equal(RUN_GRACE_MS, 900_000);
assert.equal(publicStatus(C, emptyCounts(), new Date("2026-11-21T21:30:00Z")).tournament!.playing, true);
assert.equal(T.tries, 3);

console.log(`tournament replay: ok (${played} runs, longest ${Math.round(longest / 1000)} s)`);
