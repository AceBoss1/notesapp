// Snake's pure rules (lib/arcade/snake.ts) and its tournament replay (lib/arcade/replay-snake.ts); owner, 21 Nov 2026: "start tournaments".
// Run: npx -y tsx tests/arcade/replay-snake.test.ts
import assert from "node:assert/strict";
import {
  BASE_INTERVAL, OPPOSITE, START_FOOD, VECTORS, createSnake, intervalMs, levelOf, nextRandom, placeFood, step, turn,
  type Point, type SnakeDir, type SnakePace, type SnakeState,
} from "../../lib/arcade/snake";
import { SNAKE_MAX_TICKS, SNAKE_TOURNAMENT, encodeSnakeTick, replaySnake } from "../../lib/arcade/replay-snake";
import { compareRank } from "../../lib/arcade/tournament-games";

const DIRS: SnakeDir[] = ["up", "down", "left", "right"];

// ---------- the old component's logic, copied from SnakeGame.tsx before the move, with its Math.random swapped for a given rand ----------
function oldGame(rand: () => number, pace: SnakePace) {
  const BOARD_SIZE = 20;
  const makeFood = (snake: Point[]): Point => {
    const open: Point[] = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) if (!snake.some((p) => p.x === x && p.y === y)) open.push({ x, y });
    return open[Math.floor(rand() * open.length)] ?? { x: 0, y: 0 };
  };
  let snake: Point[] = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  let food = makeFood(snake);
  let score = 0, over = false, queued: SnakeDir = "right";
  return {
    get: () => ({ snake, food, score, over, queued }),
    interval: () => Math.max(72, ({ chill: 210, classic: 145, fast: 105 })[pace] - Math.floor(score / 50) * 8),
    turn(next: SnakeDir) { if (next !== OPPOSITE[queued]) queued = next; },
    tick() {
      if (over) return;
      const v = VECTORS[queued];
      const head = { x: snake[0].x + v.x, y: snake[0].y + v.y };
      const ate = head.x === food.x && head.y === food.y;
      const body = ate ? snake : snake.slice(0, -1);
      const collided = head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE || body.some((p) => p.x === head.x && p.y === head.y);
      if (collided) { over = true; return; }
      const next = [head, ...snake.slice(0, ate ? undefined : -1)];
      if (ate) { score += 10; food = makeFood(next); }
      snake = next;
    },
  };
}
const seededRand = (seed: number) => { let s = seed >>> 0; return () => { const [v, n] = nextRandom(s); s = n; return v; }; };

// The new rules play exactly like the old component, turn for turn and snack for snack, over many random games.
for (let g = 0; g < 200; g++) {
  const pace: SnakePace = (["chill", "classic", "fast"] as const)[g % 3];
  const seed = 1000 + g;
  const old = oldGame(seededRand(seed), pace);
  let s = createSnake(seed, pace);
  const pick = seededRand(seed * 7 + 1);
  for (let t = 0; t < 600 && !s.over; t++) {
    // A few key presses per tick, some of them doubled up inside one tick, as fingers do.
    const presses = Math.floor(pick() * 3);
    for (let k = 0; k < presses; k++) { const d = DIRS[Math.floor(pick() * 4)]; old.turn(d); s = turn(s, d); }
    assert.equal(intervalMs(s.pace, s.score), old.interval(), "same speed");
    old.tick(); s = step(s);
    const o = old.get();
    assert.deepEqual(s.snake, o.snake, `game ${g} tick ${t}: same snake`);
    assert.equal(s.over, o.over);
    if (!s.over) assert.deepEqual(s.food, o.food, "same snack");
    assert.equal(s.score, o.score);
  }
}

// Walls: heading right from the start, the head leaves the board after 12 moves (x 8 → 19, then 20).
{
  let s = createSnake(5, "classic", { x: 0, y: 0 });
  for (let i = 0; i < 11; i++) s = step(s);
  assert.equal(s.over, false);
  assert.deepEqual(s.snake[0], { x: 19, y: 10 });
  s = step(s);
  assert.equal(s.over, true);
  assert.equal(s.cause, "wall");
  assert.deepEqual(s.snake[0], { x: 19, y: 10 }, "the board stays as it was at the crash");
  assert.equal(step(s), s, "nothing moves after the end");
  assert.equal(turn(s, "up"), s);
}

// Turning: a straight reversal is ignored; it's checked against the queued turn, as the game always did.
{
  const s = createSnake(5, "classic");
  assert.equal(turn(s, "left").queued, "right", "can't reverse");
  const up = turn(s, "up");
  assert.equal(up.queued, "up");
  assert.equal(turn(up, "left").queued, "left", "two quick turns in one tick: the second is checked against the first");
  assert.equal(step(turn(up, "left")).cause, "self", "…and running back into your own neck ends the run");
}

// Growth and scoring: eat a snack straight ahead, grow by one, +10, and the next snack lands on a free square.
{
  let s = createSnake(9, "classic", { x: 9, y: 10 });
  s = step(s);
  assert.equal(s.score, 10);
  assert.equal(s.snake.length, 4);
  assert.deepEqual(s.snake[0], { x: 9, y: 10 });
  assert.ok(!s.snake.some((p) => p.x === s.food.x && p.y === s.food.y), "the new snack isn't on the snake");
  s = step(s);
  assert.equal(s.snake.length, 4, "no snack, no growth");
}

// Self-collision: a long snake curling round bites itself; following its own tail into the square the tail leaves is fine.
{
  const base = createSnake(1, "classic", { x: 0, y: 0 });
  const long: SnakeState = { ...base, snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }], dir: "right", queued: "down" };
  assert.equal(step(long).cause, "self", "down into its own body");
  const loop: SnakeState = { ...base, snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }], dir: "right", queued: "down" };
  const moved = step(loop);
  assert.equal(moved.over, false, "the tail's square is free as it moves on");
  assert.deepEqual(moved.snake[0], { x: 5, y: 6 });
}

// Speed and levels: 8 ms quicker every 50 points, never under 72 ms; level up every 50.
assert.equal(intervalMs("classic", 0), BASE_INTERVAL.classic);
assert.equal(intervalMs("classic", 49), 145);
assert.equal(intervalMs("classic", 50), 137);
assert.equal(intervalMs("chill", 300), 162);
assert.equal(intervalMs("fast", 1000), 72);
assert.equal(levelOf(0), 1);
assert.equal(levelOf(150), 4);

// The opening board's snack is the fixed one; a seed places its own.
assert.deepEqual(createSnake(3, "classic", START_FOOD).food, START_FOOD);
assert.deepEqual(placeFood(createSnake(3, "classic").snake, 3).food, createSnake(3, "classic").food);

// ---------- the tournament replay ----------
// A bot that plays like a person would through the component: turns via turn(), then the encoder records the tick, then the step.
function botRun(seed: number, pace: SnakePace, maxTicks = 5000): { recording: string; end: SnakeState; foods: Point[] } {
  let s = createSnake(seed, pace);
  let rec = "";
  const foods: Point[] = [s.food];
  const safe = (st: SnakeState, d: SnakeDir) => !step({ ...st, queued: d }).over;
  for (let t = 0; t < maxTicks && !s.over; t++) {
    const h = s.snake[0];
    const want: SnakeDir[] = [];
    if (s.food.x > h.x) want.push("right"); if (s.food.x < h.x) want.push("left");
    if (s.food.y > h.y) want.push("down"); if (s.food.y < h.y) want.push("up");
    const options = [...want, s.dir, ...DIRS].filter((d) => d !== OPPOSITE[s.dir]);
    const d = options.find((x) => safe(s, x)) ?? s.dir;
    s = turn(s, d);
    rec += encodeSnakeTick(s);
    const before = s.score;
    s = step(s);
    if (s.score > before) foods.push(s.food);
  }
  return { recording: rec, end: s, foods };
}

{
  const run = botRun(424242, "classic");
  assert.ok(run.end.over, "the bot's run ends");
  assert.ok(run.end.score >= 50, `the bot eats a fair bit (${run.end.score})`);
  const r = SNAKE_TOURNAMENT.replay(424242, "classic", run.recording);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.finished, true);
    assert.equal(r.score, run.end.score);
    assert.deepEqual(r.rank, [run.end.score, -run.end.ticks]);
    assert.equal(r.summary, `${run.end.score} points, length ${run.end.snake.length}`);
    assert.equal(r.ms, run.end.ms);
    // ms is the sum of each tick's interval: at least ticks × the fastest interval, at most ticks × the base one.
    assert.ok(r.ms! >= run.end.ticks * 72 && r.ms! <= run.end.ticks * 145);
  }
  const back = replaySnake(424242, "classic", run.recording);
  assert.ok(back.ok && JSON.stringify(back.state) === JSON.stringify(run.end), "the replay ends in the identical state");

  // Same seed, same snacks for everyone; another seed, other snacks.
  assert.deepEqual(botRun(424242, "classic").foods, run.foods);
  assert.notDeepEqual(botRun(7, "classic").foods.slice(0, 5), run.foods.slice(0, 5));
  assert.deepEqual(createSnake(99, "fast").food, createSnake(99, "chill").food, "the speed doesn't change the snacks");

  // Every speed replays.
  for (const pace of ["chill", "fast"] as const) {
    const b = botRun(31337, pace);
    const rr = SNAKE_TOURNAMENT.replay(31337, pace, b.recording);
    assert.ok(rr.ok && rr.finished && rr.score === b.end.score);
  }

  // Tampering: anything after the crash, garbage, the wrong seed, an unknown speed, or an over-long run.
  assert.deepEqual(SNAKE_TOURNAMENT.replay(424242, "classic", run.recording + "-"), { ok: false, error: "That run carries on after the snake died." });
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "classic", run.recording + "U").ok, false);
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "classic", "--x--").ok, false);
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "classic", 12345).ok, false);
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "classic", null).ok, false);
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "turbo", run.recording).ok, false);
  assert.equal(SNAKE_TOURNAMENT.replay(424242, "classic", "-".repeat(SNAKE_MAX_TICKS + 1)).ok, false);
  assert.ok(SNAKE_TOURNAMENT.maxRecording >= SNAKE_MAX_TICKS);
  const other = SNAKE_TOURNAMENT.replay(1, "classic", run.recording);
  assert.ok(!other.ok || other.score !== run.end.score || !other.finished, "the same moves on another seed don't give the same run");

  // Unfinished: a run cut short (still alive) is not finished.
  const cut = SNAKE_TOURNAMENT.replay(424242, "classic", run.recording.slice(0, 20));
  assert.ok(cut.ok && cut.finished === false);
  const empty = SNAKE_TOURNAMENT.replay(424242, "classic", "");
  assert.ok(empty.ok && empty.finished === false && empty.score === 0);
}

// Ranking: a higher score wins; on the same score, fewer ticks wins.
{
  const r = (score: number, ticks: number) => [score, -ticks];
  assert.ok(compareRank(r(420, 900), r(410, 300)) > 0);
  assert.ok(compareRank(r(420, 800), r(420, 900)) > 0);
  assert.equal(compareRank(r(420, 800), r(420, 800)), 0);
  // And straight off two real replays.
  const a = botRun(5, "classic"), b = botRun(6, "classic");
  const ra = SNAKE_TOURNAMENT.replay(5, "classic", a.recording), rb = SNAKE_TOURNAMENT.replay(6, "classic", b.recording);
  assert.ok(ra.ok && rb.ok);
  if (ra.ok && rb.ok && a.end.score !== b.end.score) assert.equal(Math.sign(compareRank(ra.rank, rb.rank)), Math.sign(a.end.score - b.end.score));
}

// A straight reversal letter (only by tampering) just runs into the neck, as two quick turns would in the game.
{
  const r = replaySnake(3, "classic", "L");
  assert.ok(r.ok && r.state.over && r.state.cause === "self");
}

console.log("replay-snake: all tests passed");
