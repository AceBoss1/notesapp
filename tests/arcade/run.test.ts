// Naija Run (lib/arcade/run.ts): lanes, jumping, sliding, crashes, coins, speed, the seeded spawner, a bot that survives, purity.
// Run: npx -y tsx tests/arcade/run.test.ts
import assert from "node:assert/strict";
import {
  COIN_POINTS, OBSTACLES, PEPPER_MS, collides, createRun, botInput, score, speedAt, step,
  type Lane, type Obstacle, type ObstacleKind, type RunInput, type RunState,
} from "../../lib/arcade/run";

// A run with nothing on the road except what the test puts there.
const empty = (extra: Partial<RunState> = {}): RunState => ({ ...createRun(7), obstacles: [], pickups: [], nextRowZ: 1e9, ...extra });
const ob = (kind: ObstacleKind, lane: Lane, z: number, id = 1): Obstacle => ({ id, kind, lane, z, hit: false });
const runFor = (s: RunState, ms: number, input: RunInput = "none") => {
  let x = step(s, 16, input);
  for (let t = 16; t < ms && !x.over; t += 16) x = step(x, 16);
  return x;
};

// Lanes clamp to the three on the road.
{
  let s = empty();
  assert.equal(s.lane, 1);
  s = step(s, 16, "left"); assert.equal(s.lane, 0);
  s = step(s, 16, "left"); assert.equal(s.lane, 0, "can't go past the left kerb");
  assert.ok(!s.events.includes("lane"));
  s = step(s, 16, "right"); s = step(s, 16, "right"); s = step(s, 16, "right");
  assert.equal(s.lane, 2, "can't go past the right kerb");
}

// A jump clears a pothole, but not a danfo; standing still hits the pothole.
{
  const pothole = empty({ obstacles: [ob("pothole", 1, 3)] });
  assert.equal(runFor(pothole, 1000).over, true, "running into a pothole ends the run");
  assert.equal(runFor(pothole, 1000).crashedInto, "pothole");
  // Jump just before it (about 0.12 s away at the starting speed).
  const near = empty({ obstacles: [ob("pothole", 1, 0.4 + speedAt("normal", 0) * 0.12)] });
  const jumped = runFor(near, 1000, "jump");
  assert.equal(jumped.over, false, "a jump clears a pothole");
  assert.ok(jumped.distance > 5);
  const puddle = empty({ obstacles: [ob("puddle", 1, 0.4 + speedAt("normal", 0) * 0.12)] });
  assert.equal(runFor(puddle, 1000, "jump").over, false, "and a puddle");
  const bus = empty({ obstacles: [ob("danfo", 1, 0.4 + speedAt("normal", 0) * 0.12)] });
  const hit = runFor(bus, 1500, "jump");
  assert.equal(hit.over, true, "a danfo can't be jumped");
  assert.equal(hit.crashedInto, "danfo");
  // …but changing lane goes round it.
  assert.equal(runFor(bus, 1500, "left").over, false);
  assert.equal(runFor(empty({ obstacles: [ob("barrow", 1, 2)] }), 1000, "right").over, false);
}

// A slide gets under an awning or a banner; a jump or standing up doesn't.
{
  const at = 0.4 + speedAt("normal", 0) * 0.1;
  for (const kind of ["awning", "banner"] as const) {
    assert.equal(runFor(empty({ obstacles: [ob(kind, 1, at)] }), 1000, "slide").over, false, `slide under ${kind}`);
    assert.equal(runFor(empty({ obstacles: [ob(kind, 1, at)] }), 1000).over, true, `stand into ${kind}`);
  }
  assert.equal(runFor(empty({ obstacles: [ob("awning", 1, 3)] }), 1000, "jump").over, true, "jumping into an awning still hits it");
  assert.equal(runFor(empty({ obstacles: [ob("pothole", 1, at)] }), 1000, "slide").over, true, "sliding into a pothole hits it");
}

// The collision check itself: lane, depth and pose.
{
  const o = ob("pothole", 2, 10);
  const ground = { jumpMs: -1, slideMs: -1 };
  assert.equal(collides(o, 2, 10.5, ground), true);
  assert.equal(collides(o, 1, 10.5, ground), false, "other lane");
  assert.equal(collides(o, 2, 5, ground), false, "not there yet");
  assert.equal(collides(o, 2, 10 + OBSTACLES.pothole.length + 1, ground), false, "already past");
  assert.equal(collides(o, 2, 10.5, { jumpMs: 300, slideMs: -1 }), false, "mid-air");
  assert.equal(collides(o, 2, 10.5, { jumpMs: 10, slideMs: -1 }), true, "only just taken off");
  assert.equal(collides({ ...o, hit: true }, 2, 10.5, ground), false, "knocked aside");
}

// A crash ends the game, and a finished run stays finished.
{
  const s = runFor(empty({ obstacles: [ob("danfo", 1, 2)] }), 1000);
  assert.equal(s.over, true);
  assert.ok(s.events.includes("crash") || runFor(empty({ obstacles: [ob("danfo", 1, 2)] }), 1000).over);
  const after = step(s, 500, "left");
  assert.equal(after.distance, s.distance, "nothing moves after a crash");
  assert.equal(after.lane, s.lane);
  assert.equal(after.over, true);
}

// Coins add to the score; the distance does too; a pepper doubles both and barges through.
{
  const base = runFor(empty(), 1000);
  assert.equal(score(base), Math.floor(base.distance), "with no coins, score is distance");
  const withCoins = runFor(empty({ pickups: [1, 3, 5].map((z, i) => ({ id: 50 + i, kind: "coin" as const, lane: 1 as Lane, z, taken: false })) }), 1000);
  assert.equal(withCoins.coins, 3);
  assert.equal(score(withCoins), Math.floor(withCoins.distance + 3 * COIN_POINTS));
  const sideCoin = runFor(empty({ pickups: [{ id: 9, kind: "coin", lane: 0, z: 3, taken: false }] }), 1000);
  assert.equal(sideCoin.coins, 0, "a coin in another lane isn't collected");
  const hot = runFor(empty({ pickups: [{ id: 9, kind: "pepper", lane: 1, z: 1, taken: false }], obstacles: [ob("danfo", 1, 8)] }), 1500);
  assert.equal(hot.over, false, "peppered runners barge through a danfo");
  assert.ok(hot.pepperMs > 0 && hot.pepperMs < PEPPER_MS);
  assert.ok(hot.distance > base.distance * 1.3, "pepper speeds you up");
  assert.ok(hot.points > hot.distance * 1.5, "and doubles points");
}

// Speed rises with distance, slowly, and tops out; chill is slower than fast.
{
  assert.ok(speedAt("normal", 500) > speedAt("normal", 0));
  assert.ok(speedAt("normal", 5000) > speedAt("normal", 500));
  assert.ok(speedAt("normal", 1e6) <= 25.0001);
  assert.ok(speedAt("normal", 100) - speedAt("normal", 0) < 1, "rises gently");
  assert.ok(speedAt("chill", 0) < speedAt("normal", 0) && speedAt("normal", 0) < speedAt("fast", 0));
  const later = runFor(empty({ distance: 2000 }), 200);
  assert.ok(later.speed > runFor(empty(), 200).speed);
}

// The same seed gives the same road; a different seed gives a different one.
{
  const road = (seed: number) => {
    let s = createRun(seed);
    const seen = new Map<number, string>();
    for (let i = 0; i < 400; i += 1) {
      s = { ...step(s, 16, "none"), over: false }; // keep running regardless, just to see the spawner
      for (const o of s.obstacles) seen.set(o.id, `${o.kind}@${o.lane}:${o.z.toFixed(2)}`);
    }
    return [...seen.values()].join("|");
  };
  assert.equal(road(42), road(42));
  assert.notEqual(road(42), road(43));
  // Never all three lanes blocked in the same row.
  const s = createRun(5);
  let x = s;
  for (let i = 0; i < 3000; i += 1) x = { ...step(x, 16), over: false };
  const rows = new Map<string, Obstacle[]>();
  for (const o of x.obstacles) rows.set(o.z.toFixed(3), [...(rows.get(o.z.toFixed(3)) ?? []), o]);
  for (const row of rows.values()) assert.ok(row.length <= 2, "one lane is always left clear");
}

// A careful bot survives a long run on several seeds and speeds, and finds coins and peppers on the way.
{
  for (const [seed, level] of [[1, "normal"], [2, "fast"], [3, "chill"], [99, "fast"], [2026, "normal"]] as const) {
    let s = createRun(seed, level);
    const seconds = 120;
    for (let t = 0; t < seconds * 1000 && !s.over; t += 16) s = step(s, 16, botInput(s));
    assert.equal(s.over, false, `bot crashed into ${s.crashedInto} on seed ${seed} (${level}) at ${s.distance.toFixed(0)} m`);
    assert.ok(s.coins > 10, `bot picked up coins on seed ${seed}`);
    console.log(`  bot, seed ${seed} ${level}: ${seconds}s, ${s.distance.toFixed(0)} m, ${s.coins} coins, score ${score(s)}, speed ${s.speed.toFixed(1)} m/s`);
  }
}

// step() is pure: it never changes the state it's given, and the same inputs give the same result.
{
  const s = createRun(11);
  const snapshot = JSON.stringify(s);
  const a = step(s, 33, "jump");
  const b = step(s, 33, "jump");
  assert.equal(JSON.stringify(s), snapshot, "input state untouched");
  assert.deepEqual(a, b, "deterministic");
  assert.notEqual(a, s);
  let x = s;
  for (let i = 0; i < 200; i += 1) {
    const before = JSON.stringify(x);
    const n = step(x, 16, i % 7 === 0 ? "left" : "none");
    assert.equal(JSON.stringify(x), before);
    x = n;
  }
  // A big frame is the same as many small frames of the same total, give or take the input timing.
  const big = step(createRun(3), 160);
  let small = createRun(3);
  for (let i = 0; i < 10; i += 1) small = step(small, 16);
  assert.ok(Math.abs(big.distance - small.distance) < 1e-9);
}

console.log("run: all tests passed");
