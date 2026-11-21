// Snake for Notes Arcade: the pure rules, moved out of components/games/SnakeGame.tsx so a tournament run can be replayed on the server
// with the very same code (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §3, "same food positions for everyone").
// No React, no DOM, no Math.random: the food comes from a seeded generator carried in the state, so one seed gives one food sequence.
//
// The rules are exactly the ones the game played before the move: a 20 × 20 board, three squares long at the start heading right,
// +10 a snack, a move every 210 / 145 / 105 ms (chill / classic / fast) getting 8 ms quicker every 50 points down to 72 ms, and death on a
// wall or your own body (the square the tail is leaving is free, unless you've just eaten).

export type SnakeDir = "up" | "down" | "left" | "right";
export type SnakePace = "chill" | "classic" | "fast";
export type Point = { x: number; y: number };

export const SNAKE_BOARD = 20;
export const SNAKE_PACES: SnakePace[] = ["chill", "classic", "fast"];
export const BASE_INTERVAL: Record<SnakePace, number> = { chill: 210, classic: 145, fast: 105 };
export const MIN_INTERVAL = 72;
export const FOOD_POINTS = 10;
export const START_SNAKE: readonly Point[] = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
/** Where the snack sits on the very first board a visitor sees, before any game has started (kept from the old component). */
export const START_FOOD: Point = { x: 14, y: 10 };

export const VECTORS: Record<SnakeDir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE: Record<SnakeDir, SnakeDir> = { up: "down", down: "up", left: "right", right: "left" };

export type SnakeState = {
  pace: SnakePace;
  snake: Point[]; // head first
  dir: SnakeDir; // the way the head moved on the last tick
  queued: SnakeDir; // the way it will move on the next tick
  food: Point;
  score: number;
  rng: number; // mulberry32 state
  ticks: number;
  ms: number; // game time so far: the sum of each tick's interval
  over: boolean;
  cause: "wall" | "self" | null;
};

// mulberry32, the same generator as lib/arcade/run.ts. Returns [value in 0..1, next state].
export function nextRandom(s: number): [number, number] {
  const a = (s + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** A random seed for a normal (non-tournament) game. Only the component calls this; the rules never touch Math.random. */
export const randomSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;

/** A free square for the snack, picked by the seeded generator; returns the new generator state too. */
export function placeFood(snake: readonly Point[], rng: number): { food: Point; rng: number } {
  const open: Point[] = [];
  for (let y = 0; y < SNAKE_BOARD; y += 1) {
    for (let x = 0; x < SNAKE_BOARD; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) open.push({ x, y });
    }
  }
  const [v, next] = nextRandom(rng);
  return { food: open[Math.floor(v * open.length)] ?? { x: 0, y: 0 }, rng: next };
}

/** The ms between moves at this pace and score: 8 ms quicker every 50 points, never under 72 ms. */
export const intervalMs = (pace: SnakePace, score: number) => Math.max(MIN_INTERVAL, BASE_INTERVAL[pace] - Math.floor(score / 50) * 8);

/** The board's level, shown under it: up one every 50 points. */
export const levelOf = (score: number) => Math.floor(score / 50) + 1;

/**
 * A new game from a seed. The first snack is placed by the seed, so every tournament entrant gets the same food. `firstFood` keeps the
 * fixed snack of the page's opening board (normal play only).
 */
export function createSnake(seed: number, pace: SnakePace, firstFood?: Point): SnakeState {
  const snake = START_SNAKE.map((p) => ({ ...p }));
  let rng = seed >>> 0;
  let food: Point;
  if (firstFood) food = { ...firstFood };
  else ({ food, rng } = placeFood(snake, rng));
  return { pace, snake, dir: "right", queued: "right", food, score: 0, rng, ticks: 0, ms: 0, over: false, cause: null };
}

/**
 * A turn from the keys or the touch pad. As the game always did, it's checked against the turn already queued (not the way the head
 * last moved), and a straight reversal of that is ignored. Returns the same state when the turn is ignored.
 */
export function turn(s: SnakeState, next: SnakeDir): SnakeState {
  if (s.over || next === OPPOSITE[s.queued] || next === s.queued) return s;
  return { ...s, queued: next };
}

/** One tick: the head moves the queued way; it eats, grows and scores, or dies on a wall or its own body. */
export function step(s: SnakeState): SnakeState {
  if (s.over) return s;
  const dir = s.queued;
  const ms = s.ms + intervalMs(s.pace, s.score);
  const ticks = s.ticks + 1;
  const v = VECTORS[dir];
  const head = { x: s.snake[0].x + v.x, y: s.snake[0].y + v.y };
  const ate = head.x === s.food.x && head.y === s.food.y;
  const body = ate ? s.snake : s.snake.slice(0, -1);
  const wall = head.x < 0 || head.x >= SNAKE_BOARD || head.y < 0 || head.y >= SNAKE_BOARD;
  if (wall || body.some((part) => part.x === head.x && part.y === head.y)) {
    return { ...s, dir, ticks, ms, over: true, cause: wall ? "wall" : "self" };
  }
  const snake = [head, ...body];
  if (!ate) return { ...s, snake, dir, ticks, ms };
  const placed = placeFood(snake, s.rng);
  return { ...s, snake, dir, ticks, ms, score: s.score + FOOD_POINTS, food: placed.food, rng: placed.rng };
}
