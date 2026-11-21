// Nana for Naija Run (lib/arcade/nana-run.ts): what she notices during a run, her coaching after it, and her tip while paused.
// Run: npx -y tsx tests/arcade/nana-run.test.ts
import assert from "node:assert/strict";
import { createRun, step, botInput, type Lane, type Obstacle, type ObstacleKind, type Pickup, type RunInput, type RunState } from "../../lib/arcade/run";
import { newRunWatch, runCoach, runStats, runTip, safestLane, watchRun, type RunWatch } from "../../lib/arcade/nana-run";

const empty = (extra: Partial<RunState> = {}): RunState => ({ ...createRun(7), obstacles: [], pickups: [], nextRowZ: 1e9, ...extra });
const ob = (kind: ObstacleKind, lane: Lane, z: number, id = 1): Obstacle => ({ id, kind, lane, z, hit: false });
const coin = (lane: Lane, z: number, id: number): Pickup => ({ id, kind: "coin", lane, z, taken: false });

// Play a run with Nana watching, one 16 ms frame at a time, like RunGame does.
function play(s: RunState, ms: number, first: RunInput = "none"): { s: RunState; w: RunWatch } {
  let w = newRunWatch();
  let input = first;
  for (let t = 0; t < ms && !s.over; t += 16) {
    const next = step(s, 16, input);
    w = watchRun(w, s, next, 16);
    s = next;
    input = "none";
  }
  return { s, w };
}

// Before the first run: a welcome.
assert.match(runCoach(null).text, /After each run/);

// Coins left behind in another lane are counted as missed; ones you run through are not.
{
  const { s, w } = play(empty({ pickups: [coin(0, 3, 100), coin(0, 5, 101), coin(1, 4, 102)], nextId: 200 }), 2500);
  assert.equal(s.over, false);
  assert.equal(s.coins, 1);
  assert.equal(w.coinsMissed, 2);
  assert.ok(w.laneMs[1] > 2000 && w.laneMs[0] === 0, "time is counted in the lane you ran in");
}

// A danfo in your lane: the coaching names it, says you can't jump it, and points at the clear lane.
{
  const start = empty({ obstacles: [ob("danfo", 1, 6), ob("barrow", 2, 4, 2)] });
  assert.equal(safestLane(start), 0, "the left lane has nothing in it");
  const { s, w } = play(start, 2000);
  assert.equal(s.crashedInto, "danfo");
  assert.equal(w.safeLane, 0);
  const take = runCoach(runStats(s, w, 500));
  assert.match(take.text, /danfo bus in the middle lane/);
  assert.match(take.text, /can't jump or slide/);
  assert.match(take.text, /left lane was clear/);
  assert.equal(take.tone, "risky", "a short run");
}

// Sliding into a pothole: the advice is to jump, not slide.
{
  const { s, w } = play(empty({ obstacles: [ob("pothole", 1, 2)] }), 1500, "slide");
  assert.equal(s.crashedInto, "pothole");
  const st = runStats(s, w, 0);
  assert.equal(st.pose, "slide");
  assert.match(runCoach(st).text, /You slid into a pothole\. Holes and puddles want a jump/);
}

// Jumping into an awning: duck instead. Standing into a banner: slide.
{
  const { s, w } = play(empty({ obstacles: [ob("awning", 1, 3)] }), 1500, "jump");
  assert.match(runCoach(runStats(s, w, 0)).text, /jumped into a stall awning\. Duck under/);
  const b = play(empty({ obstacles: [ob("banner", 1, 3)] }), 1500);
  assert.match(runCoach(runStats(b.s, b.w, 0)).text, /A banner got you standing up\. Slide under it/);
}

// A long run with a new best, coins left on the road, a missed pepper and hugging the left kerb.
{
  const s: RunState = { ...empty(), distance: 1200.4, points: 1650, coins: 3, over: true, crashedInto: "barrow", lane: 0 };
  const w: RunWatch = { coinsMissed: 14, peppers: 0, peppersMissed: 1, smashes: 0, laneMs: [70_000, 10_000, 5_000], safeLane: 1 };
  const take = runCoach(runStats(s, w, 1200));
  assert.equal(take.tone, "good");
  assert.match(take.text, /^New best: 1650, 1200 m\./);
  assert.match(take.text, /middle lane was clear/);
  assert.match(take.text, /You left 14 coins on the road/);
  assert.ok(take.text.split(". ").length >= 3);
  // Without the best and the coins, the pepper and the kerb get a word.
  const plain = runCoach(runStats(s, { ...w, coinsMissed: 0 }, 5000));
  assert.match(plain.text, /You passed a pepper/);
  assert.equal(plain.tone, "good", "over a kilometre is a good run");
  const kerb = runCoach(runStats(s, { ...w, coinsMissed: 0, peppersMissed: 0 }, 5000));
  assert.match(kerb.text, /most of the run in the left lane/);
}

// Paused tips: change lane for a block, jump a low one, slide a high one, follow the coins when the road is clear.
{
  const bus = empty({ obstacles: [ob("danfo", 1, 20)] });
  const before = JSON.stringify(bus);
  const tip = runTip(bus);
  assert.ok(tip);
  assert.match(tip.move, /^the (left|right) lane$/);
  assert.match(tip.why, /Your lane has a danfo bus coming in 20 m; the (left|right) one is clear\./);
  assert.equal(JSON.stringify(bus), before, "a tip never changes the run");

  // Both sides blocked, the right one further off.
  const boxed = runTip(empty({ obstacles: [ob("danfo", 1, 15), ob("barrow", 0, 18, 2), ob("danfo", 2, 30, 3)] }));
  assert.ok(boxed);
  assert.equal(boxed.move, "the right lane");
  assert.match(boxed.why, /further off \(30 m\)/);

  // From the left kerb with only the right lane free: one lane at a time.
  const far = runTip(empty({ lane: 0, laneFrom: 0, obstacles: [ob("danfo", 0, 15), ob("barrow", 1, 30, 2)] }));
  assert.ok(far);
  assert.equal(far.move, "the right lane (one lane at a time)");

  assert.equal(runTip(empty({ obstacles: [ob("pothole", 1, 12)] }))?.move, "a jump");
  assert.match(runTip(empty({ obstacles: [ob("pothole", 1, 12)] }))!.why, /A pothole is 12 m ahead/);
  assert.equal(runTip(empty({ obstacles: [ob("awning", 1, 9)] }))?.move, "a slide");

  const coins = runTip(empty({ pickups: [coin(2, 10, 5), coin(2, 12, 6), coin(2, 14, 7)] }));
  assert.ok(coins);
  assert.equal(coins.move, "the right lane");
  assert.match(coins.why, /3 coins are lined up there/);

  const pepper = runTip(empty({ pickups: [{ id: 9, kind: "pepper", lane: 0, z: 15, taken: false }] }));
  assert.equal(pepper?.move, "the left lane");

  const quiet = runTip(empty());
  assert.equal(quiet?.move, "staying in the middle lane");
  assert.match(quiet!.why, /Nothing's in your way/);

  assert.equal(runTip({ ...bus, over: true }), null, "no tips once the run is over");
}

// Watching changes nothing: a bot run with Nana watching every frame gives the same street as one without.
{
  let a = createRun(42); let b = createRun(42); let w = newRunWatch();
  for (let i = 0; i < 3000 && !a.over; i += 1) {
    const ia = botInput(a);
    const na = step(a, 16, ia);
    w = watchRun(w, a, na, 16);
    runTip(na);
    a = na;
    b = step(b, 16, botInput(b));
  }
  assert.deepEqual(a, b);
  assert.ok(w.laneMs[0] + w.laneMs[1] + w.laneMs[2] > 0);
}

console.log("nana-run: all tests passed");
