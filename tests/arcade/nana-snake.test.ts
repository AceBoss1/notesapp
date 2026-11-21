// Nana for Snake (lib/arcade/nana-snake.ts): her coaching after a run. Snake has no pause, so there's no tip to test.
// Run: npx -y tsx tests/arcade/nana-snake.test.ts
import assert from "node:assert/strict";
import { onSnakeEdge, snakeCoach, snakeLevel, type SnakeStats } from "../../lib/arcade/nana-snake";

const run = (extra: Partial<SnakeStats>): SnakeStats => ({
  cause: "wall", heading: "up", length: 6, score: 30, bestBefore: 100, pace: "classic", intervalMs: 145, foodOnEdge: false, ...extra,
});

// Before the first run: a welcome.
assert.match(snakeCoach(null).text, /After each run/);

// The board's edges and the speed-up levels.
assert.equal(onSnakeEdge({ x: 0, y: 7 }), true);
assert.equal(onSnakeEdge({ x: 19, y: 19 }), true);
assert.equal(onSnakeEdge({ x: 5, y: 7 }), false);
assert.equal(snakeLevel(0), 1);
assert.equal(snakeLevel(49), 1);
assert.equal(snakeLevel(150), 4);

// Into a wall: which one, and how to handle edges; a snack by the wall gets its own advice.
{
  const t = snakeCoach(run({ heading: "left" }));
  assert.match(t.text, /^You ran into the left wall at length 6\. Turn a square early near the edges: at classic speed you move every 145 ms\.$/);
  assert.equal(t.tone, "risky", "under 50 points");
  const edge = snakeCoach(run({ heading: "down", foodOnEdge: true, score: 80, length: 11 }));
  assert.match(edge.text, /bottom wall at length 11\. The snack was by the wall: come at edge snacks along the wall/);
  assert.equal(edge.tone, "fine");
}

// Your own tail: a short snake means a too-tight U-turn; a long one means plan the sweep.
{
  const short = snakeCoach(run({ cause: "self", length: 7, score: 40 }));
  assert.match(short.text, /You bit your own tail at length 7\. That's usually a quick U-turn/);
  const long = snakeCoach(run({ cause: "self", length: 28, score: 250, bestBefore: 400, pace: "fast", intervalMs: 65 }));
  assert.match(long.text, /At length 28 your own tail got you\. Now your body is the danger: sweep the board in wide rows/);
  assert.match(long.text, /you reached level 6\.$/);
  assert.equal(long.tone, "good", "200 points or more");
}

// A new best leads the take.
{
  const t = snakeCoach(run({ score: 160, bestBefore: 120, length: 19, cause: "self" }));
  assert.match(t.text, /^New best: 160\. At length 19/);
  assert.equal(t.tone, "good");
  assert.equal(t.text.split(/(?<=\.) /).length, 3, "three sentences at most");
  // The first ever run isn't a "new best" (there was nothing to beat).
  assert.doesNotMatch(snakeCoach(run({ score: 60, bestBefore: 0 })).text, /New best/);
}

console.log("nana-snake: all tests passed");
