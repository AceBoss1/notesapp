// The 🤖 column for the action games on the per-game leaderboards (lib/arcade/boards.ts; owner, Nov 2026: "each game has leaderboard
// makeup of top npc 🤖 and top human"). Snake, Naija Run and Puff-Puff have no computer opponent to beat you, so their computer players
// are each game's own autopilot, one per speed, playing the real rules on a fixed seed: Naija Run's careful runner (botInput) and
// Puff-Puff's (botDirection), both already in the game code, and a small path-finding snake written here. Deterministic, so the
// numbers only change when a game's rules do; worked out once per server (well under a second) and kept.
import { createSnake, step as snakeStep, turn, SNAKE_BOARD, VECTORS, type SnakeDir, type SnakePace, type SnakeState } from "./snake";
import { botInput, createRun, score as runScore, step as runStep, type Speed as RunSpeed } from "./run";
import { botDirection, initialState as puffStart, step as puffStep, type Speed as PuffSpeed } from "./puffpuff";

const SEED = 20261124; // the day the boards were built
const SNAKE_MAX_TICKS = 8_000;
export const RUN_AUTOPILOT_MS = 120_000; // the careful runner rarely crashes, so its run is two minutes long
const PUFF_MAX_MS = 10 * 60_000;
const DT = 16;

const DIRS: SnakeDir[] = ["up", "right", "down", "left"];
const DX = DIRS.map((d) => VECTORS[d].x), DY = DIRS.map((d) => VECTORS[d].y);
const key = (x: number, y: number) => y * SNAKE_BOARD + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SNAKE_BOARD && y < SNAKE_BOARD;

const CELLS = SNAKE_BOARD * SNAKE_BOARD;
const seenBuf = new Uint8Array(CELLS);
const firstBuf = new Int8Array(CELLS);
const queue = new Int16Array(CELLS);

/** How many squares the head could still reach from (x, y) with this body in the way. Typed arrays: it runs every tick. */
function room(x: number, y: number, blocked: Uint8Array): number {
  seenBuf.fill(0);
  let head = 0, tail = 0;
  seenBuf[key(x, y)] = 1; queue[tail++] = key(x, y);
  while (head < tail) {
    const k = queue[head++], cx = k % SNAKE_BOARD, cy = (k - cx) / SNAKE_BOARD;
    for (let i = 0; i < 4; i++) {
      const nx = cx + DX[i], ny = cy + DY[i], nk = key(nx, ny);
      if (inside(nx, ny) && !blocked[nk] && !seenBuf[nk]) { seenBuf[nk] = 1; queue[tail++] = nk; }
    }
  }
  return tail;
}

/** The snake autopilot: the shortest safe way to the snack, unless it boxes the snake in; otherwise the move with the most room. */
export function snakeBotDir(s: SnakeState): SnakeDir {
  const head = s.snake[0];
  const blocked = new Uint8Array(CELLS);
  for (let i = 0; i < s.snake.length - 1; i++) blocked[key(s.snake[i].x, s.snake[i].y)] = 1; // the tail moves out of the way
  const options = DIRS.filter((d) => {
    const nx = head.x + VECTORS[d].x, ny = head.y + VECTORS[d].y;
    return inside(nx, ny) && !blocked[key(nx, ny)];
  });
  if (!options.length) return s.dir;
  // Breadth-first to the snack; firstBuf holds the first step (index in DIRS, -1 unseen) that reaches each square.
  firstBuf.fill(-1);
  firstBuf[key(head.x, head.y)] = 4;
  let qh = 0, qt = 0;
  for (const d of options) {
    const nk = key(head.x + VECTORS[d].x, head.y + VECTORS[d].y);
    firstBuf[nk] = DIRS.indexOf(d); queue[qt++] = nk;
  }
  const food = key(s.food.x, s.food.y);
  while (qh < qt) {
    const k = queue[qh++];
    if (k === food) {
      const d = DIRS[firstBuf[k]];
      if (room(head.x + VECTORS[d].x, head.y + VECTORS[d].y, blocked) >= s.snake.length) return d;
      break;
    }
    const cx = k % SNAKE_BOARD, cy = (k - cx) / SNAKE_BOARD;
    for (let i = 0; i < 4; i++) {
      const nx = cx + DX[i], ny = cy + DY[i], nk = key(nx, ny);
      if (inside(nx, ny) && !blocked[nk] && firstBuf[nk] === -1) { firstBuf[nk] = firstBuf[k]; queue[qt++] = nk; }
    }
  }
  return options.map((d) => ({ d, r: room(head.x + VECTORS[d].x, head.y + VECTORS[d].y, blocked) })).sort((a, b) => b.r - a.r)[0].d;
}

export function snakeAutopilot(pace: SnakePace, seed = SEED): number {
  let s = createSnake(seed, pace);
  for (let t = 0; t < SNAKE_MAX_TICKS && !s.over; t++) s = snakeStep(turn(s, snakeBotDir(s)));
  return s.score;
}

export function runAutopilot(speed: RunSpeed, seed = SEED): number {
  let s = createRun(seed, speed);
  for (let ms = 0; ms < RUN_AUTOPILOT_MS && !s.over; ms += DT) s = runStep(s, DT, botInput(s));
  return runScore(s);
}

export function puffAutopilot(speed: PuffSpeed, seed = SEED): number {
  let s = puffStart({ seed, speed });
  for (let ms = 0; ms < PUFF_MAX_MS && s.phase !== "over"; ms += DT) s = puffStep(s, DT, { dir: botDirection(s) });
  return s.score;
}

const memo = new Map<string, Record<string, number>>();

/** The autopilot scores for an action game, by speed (the NPC ids in lib/arcade/boards.ts); {} for any other game. */
export function autopilotScores(slug: string): Record<string, number> {
  const hit = memo.get(slug);
  if (hit) return hit;
  let out: Record<string, number> = {};
  // The snake's speed changes the clock, not the moves, so each pace's autopilot plays its own seed (else all three would tie).
  if (slug === "snake") out = { chill: snakeAutopilot("chill", SEED), classic: snakeAutopilot("classic", SEED + 1), fast: snakeAutopilot("fast", SEED + 2) };
  else if (slug === "run") out = { chill: runAutopilot("chill"), normal: runAutopilot("normal"), fast: runAutopilot("fast") };
  else if (slug === "puffpuff") out = { chill: puffAutopilot("chill"), normal: puffAutopilot("normal"), fast: puffAutopilot("fast") };
  memo.set(slug, out);
  return out;
}
