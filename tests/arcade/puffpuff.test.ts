// Puff-Puff Rush (lib/arcade/puffpuff.ts): walls, buffered turns, eating, levels, pepper soup, goats, lives,
// goat movement, determinism, purity, and a long autopilot run.
// Run: npx -y tsx tests/arcade/puffpuff.test.ts
import assert from "node:assert/strict";
import {
  CLEARED_MS, DIRS, DYING_MS, MAZES, POINTS, READY_MS, START_LIVES, VEC, botDirection, cellAt, initialState, step, walkable,
  type Dir, type Goat, type PuffState,
} from "../../lib/arcade/puffpuff";

let checks = 0;
const ok = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${name}`); };

const countItems = (s: PuffState) => s.items.filter((v) => v > 0).length;
const tile = (s: PuffState, x: number, y: number) => s.items[y * s.maze.width + x];

/** Playing, with every goat shut in the pen for a long time, so a test only sees what it sets up. */
function quiet(over: Partial<PuffState> = {}): PuffState {
  const s = initialState({ seed: 7 });
  const goats = s.goats.map((g) => ({ ...g, ...s.maze.penCenter, mode: "pen" as const, dir: null, prog: 0, releaseMs: 1e9 }));
  return { ...s, phase: "playing", phaseMs: 0, goats, ...over };
}
const withPlayer = (s: PuffState, x: number, y: number, dir: Dir | null, nextDir: Dir | null = null): PuffState =>
  ({ ...s, player: { x, y, dir, prog: 0, nextDir } });
const withGoat = (s: PuffState, i: number, g: Partial<Goat>): PuffState =>
  ({ ...s, goats: s.goats.map((old, j) => (j === i ? { ...old, ...g } : old)) });
const run = (s: PuffState, ms: number, dir?: Dir) => {
  let out = step(s, Math.min(ms, 16), { dir });
  for (let t = 16; t < ms; t += 16) out = step(out, Math.min(16, ms - t));
  return out;
};

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

console.log("Puff-Puff Rush");

// --- The mazes ---
ok("three mazes, each mirror-symmetric, fully connected, with no dead ends", () => {
  assert.equal(MAZES.length, 3);
  for (const m of MAZES) {
    for (const row of m.rows) assert.equal(row, row.split("").reverse().join(""), `${m.name} is symmetric`);
    const seen = new Set<string>([`${m.playerStart.x},${m.playerStart.y}`]);
    const queue = [m.playerStart];
    for (let i = 0; i < queue.length; i++) {
      for (const d of DIRS) {
        const nx = (queue[i].x + VEC[d].x + m.width) % m.width;
        const ny = queue[i].y + VEC[d].y;
        if (walkable(m, nx, ny) && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); queue.push({ x: nx, y: ny }); }
      }
    }
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (!walkable(m, x, y)) continue;
      assert.ok(seen.has(`${x},${y}`), `${m.name}: ${x},${y} reachable`);
      assert.ok(DIRS.filter((d) => walkable(m, x + VEC[d].x, y + VEC[d].y)).length >= 2, `${m.name}: ${x},${y} not a dead end`);
    }
  }
});

ok("a new game: level 1, 3 lives, score 0, get-ready phase, every puff-puff in place", () => {
  const s = initialState({ seed: 1 });
  assert.equal(s.level, 1);
  assert.equal(s.lives, START_LIVES);
  assert.equal(s.score, 0);
  assert.equal(s.phase, "ready");
  assert.equal(s.itemsLeft, countItems(s));
  assert.ok(s.itemsLeft > 150);
  const r = run(s, READY_MS + 20);
  assert.equal(r.phase, "playing");
});

// --- Movement ---
ok("walls block movement: riding into a stall stops the bike", () => {
  // Morning market: the bike starts at 9,15 and the tile above (9,14) is a wall.
  const s0 = quiet();
  assert.equal(cellAt(s0.maze, 9, 14), "#");
  const s = run(withPlayer(s0, 9, 15, "up"), 600);
  assert.deepEqual([s.player.x, s.player.y, s.player.prog], [9, 15, 0]);
});

ok("the bike never leaves the lanes or enters the pen", () => {
  const s0 = quiet();
  const m = s0.maze;
  // Right below the pen gate column at 9,7: pressing down must not go through the gate.
  const s = run(withPlayer(s0, 9, 7, "down"), 500);
  assert.deepEqual([s.player.x, s.player.y], [9, 7]);
  assert.ok(walkable(m, s.player.x, s.player.y));
});

ok("buffered turns wait for the next junction, then apply", () => {
  // Row 15 runs left from 6,15; 6,14 and 5,14 are walls, 4,14 is open.
  const s0 = quiet();
  assert.equal(cellAt(s0.maze, 6, 14), "#");
  assert.equal(cellAt(s0.maze, 5, 14), "#");
  assert.equal(cellAt(s0.maze, 4, 14), ".");
  let s = step(withPlayer(s0, 6, 15, "left"), 16, { dir: "up" });
  assert.equal(s.player.dir, "left");
  assert.equal(s.player.nextDir, "up");
  s = run(s, 150); // about one tile: at 5,15, still can't turn
  assert.equal(s.player.dir, "left");
  assert.equal(s.player.nextDir, "up");
  s = run(s, 300);
  assert.equal(s.player.x, 4);
  assert.equal(s.player.dir, "up");
  assert.ok(s.player.y < 15 || s.player.prog > 0);
});

ok("turning straight back works mid-tile", () => {
  let s = run(withPlayer(quiet(), 6, 15, "left"), 70);
  assert.ok(s.player.prog > 0);
  s = step(s, 16, { dir: "right" });
  assert.equal(s.player.dir, "right");
});

ok("side tunnel wraps round to the other edge", () => {
  // Morning market row 9 is open at both edges.
  const s0 = quiet();
  assert.equal(cellAt(s0.maze, 0, 9), " ");
  const s = run(withPlayer(s0, 1, 9, "left"), 300);
  assert.ok(s.player.x >= 16, `wrapped to the right side, at ${s.player.x}`);
});

// --- Eating and levels ---
ok("eating a puff-puff scores 10 and removes it", () => {
  const s0 = withPlayer(quiet(), 6, 15, "left");
  assert.equal(tile(s0, 5, 15), 1);
  const s = run(s0, 200);
  assert.equal(tile(s, 5, 15), 0);
  assert.ok(s.score >= POINTS.dot);
  assert.equal(s.itemsLeft, s0.itemsLeft - (s0.score === s.score ? 0 : s.score / POINTS.dot));
  assert.equal(s.itemsLeft, countItems(s));
});

ok("clearing every puff-puff finishes the market and moves on to the next one", () => {
  const base = quiet();
  const items = base.items.map(() => 0);
  items[15 * base.maze.width + 5] = 1; // the last one, right in front of the bike
  let s = withPlayer({ ...base, items, itemsLeft: 1, score: 990 }, 6, 15, "left");
  s = run(s, 200);
  assert.equal(s.phase, "cleared");
  assert.equal(s.score, 1000);
  s = run(s, CLEARED_MS + 50);
  assert.equal(s.level, 2);
  assert.equal(s.maze.name, MAZES[1].name);
  assert.equal(s.phase, "ready");
  assert.equal(s.score, 1000);
  assert.equal(s.lives, START_LIVES);
  assert.equal(s.itemsLeft, countItems(s));
  assert.ok(s.itemsLeft > 150);
});

ok("the clear event fires once", () => {
  const base = quiet();
  const items = base.items.map(() => 0);
  items[15 * base.maze.width + 5] = 1;
  let s = withPlayer({ ...base, items, itemsLeft: 1 }, 6, 15, "left");
  let clears = 0;
  for (let i = 0; i < 300; i++) { s = step(s, 16); clears += s.events.filter((e) => e === "clear").length; }
  assert.equal(clears, 1);
});

// --- Pepper soup and goats ---
ok("pepper soup scares the goats, and a scared goat is worth points and goes home", () => {
  // Morning market soup at 1,2; the bike comes up from 1,3.
  let s = quiet();
  assert.equal(tile(s, 1, 2), 2);
  s = withGoat(s, 0, { x: 15, y: 19, mode: "active", dir: "left", prog: 0, releaseMs: 0 });
  s = withGoat(s, 1, { x: 11, y: 19, mode: "active", dir: "left", prog: 0, releaseMs: 0 });
  s = withPlayer(s, 1, 3, "up");
  s = run(s, 160);
  assert.ok(s.events.includes("soup") || s.scaredMs > 0);
  assert.equal(tile(s, 1, 2), 0);
  assert.ok(s.scaredMs > 0);
  assert.equal(s.goats[0].scared, true);
  assert.equal(s.goats[1].scared, true);
  const before = s.score;
  // Put a scared goat right on the bike.
  s = withGoat(s, 0, { x: s.player.x, y: s.player.y, prog: 0, dir: null });
  s = step(s, 16);
  assert.ok(s.events.includes("goat"));
  assert.equal(s.score - before >= POINTS.goat, true);
  assert.equal(s.goats[0].mode, "returning");
  assert.equal(s.goats[0].scared, false);
  // A second one in the same bowl is worth double.
  const mid = s.score;
  s = withGoat(s, 1, { x: s.player.x, y: s.player.y, prog: 0, dir: null });
  s = step(s, 16);
  assert.ok(s.score - mid >= POINTS.goat * 2);
  // The goat heads back to the pen and comes out again.
  let sawLeaving = false;
  for (let i = 0; i < 400 && s.goats[0].mode !== "active"; i++) {
    s = step(s, 16);
    if (s.goats[0].mode === "leaving") sawLeaving = true;
  }
  assert.ok(sawLeaving, "went through the pen");
  assert.equal(s.goats[0].mode, "active");
});

ok("the scare wears off", () => {
  let s = withPlayer(quiet(), 1, 3, "up");
  s = withGoat(s, 0, { x: 15, y: 19, mode: "active", dir: "left", prog: 0 });
  s = run(s, 160);
  assert.equal(s.goats[0].scared, true);
  s = run(s, 8000);
  assert.equal(s.scaredMs, 0);
  assert.ok(s.goats.every((g) => !g.scared));
});

ok("being caught costs a life; everyone goes back to the start; puff-puff stay eaten", () => {
  let s = withPlayer(quiet(), 6, 15, "left");
  s = run(s, 200); // eat 5,15
  assert.equal(tile(s, 5, 15), 0);
  s = withGoat(s, 0, { x: s.player.x, y: s.player.y, mode: "active", dir: null, prog: 0 });
  s = step(s, 16);
  assert.ok(s.events.includes("caught"));
  assert.equal(s.lives, START_LIVES - 1);
  assert.equal(s.phase, "dying");
  s = run(s, DYING_MS + 32);
  assert.equal(s.phase, "ready");
  assert.deepEqual([s.player.x, s.player.y], [s.maze.playerStart.x, s.maze.playerStart.y]);
  assert.equal(tile(s, 5, 15), 0);
});

ok("game over when the last life goes", () => {
  let s = withPlayer(quiet({ lives: 1 }), 6, 15, "left");
  s = withGoat(s, 0, { x: 6, y: 15, mode: "active", dir: null, prog: 0 });
  s = step(s, 16);
  assert.equal(s.lives, 0);
  s = run(s, DYING_MS + 32);
  assert.equal(s.phase, "over");
  const frozen = step(s, 500, { dir: "up" });
  assert.equal(frozen.phase, "over");
  assert.deepEqual(frozen.player, s.player);
});

ok("three catches from a new game ends it", () => {
  let s = { ...initialState({ seed: 3 }) };
  let catches = 0;
  for (let i = 0; i < 20000 && s.phase !== "over"; i++) {
    if (s.phase === "playing") {
      const g = s.goats.find((x) => x.mode === "active" && !x.scared);
      if (g) s = { ...s, player: { ...s.player, x: g.x, y: g.y, prog: g.prog, dir: g.dir } };
    }
    s = step(s, 16);
    if (s.events.includes("caught")) catches++;
  }
  assert.equal(s.phase, "over");
  assert.equal(catches, 3);
  assert.equal(s.lives, 0);
});

// --- Goat brains, determinism, purity, a long run ---
function checkGoats(s: PuffState) {
  for (const g of s.goats) {
    assert.ok(walkable(s.maze, g.x, g.y, true), `${g.name} on a wall at ${g.x},${g.y}`);
    if (g.mode === "active") assert.ok(walkable(s.maze, g.x, g.y, false), `${g.name} active inside the pen at ${g.x},${g.y}`);
    if (g.dir && g.prog > 0) {
      assert.ok(walkable(s.maze, g.x + VEC[g.dir].x, g.y + VEC[g.dir].y, true), `${g.name} heading into a wall from ${g.x},${g.y}`);
    }
  }
}

function botGame(seed: number, steps: number, level = 1, check = true) {
  let s = initialState({ seed, level });
  let maxLevel = level;
  for (let i = 0; i < steps; i++) {
    const before = s.score;
    s = step(s, 16, { dir: botDirection(s) ?? undefined });
    if (check) {
      checkGoats(s);
      assert.ok(walkable(s.maze, s.player.x, s.player.y), "bike on a lane");
      assert.ok(s.score >= before);
      assert.ok(s.lives >= 0);
      assert.equal(s.itemsLeft, countItems(s));
    }
    maxLevel = Math.max(maxLevel, s.level);
    if (s.phase === "over") break;
  }
  return { s, maxLevel };
}

ok("goats never walk through walls (all four, all mazes, many seeds)", () => {
  for (let level = 1; level <= 3; level++) for (const seed of [1, 2, 3]) botGame(seed, 3000, level);
});

ok("each goat behaves differently from the same start", () => {
  const { s } = botGame(5, 1500);
  const spots = new Set(s.goats.map((g) => `${g.x},${g.y}`));
  assert.ok(spots.size >= 3, "goats spread out");
});

ok("same seed, same game", () => {
  const a = botGame(42, 2500, 1, false).s;
  const b = botGame(42, 2500, 1, false).s;
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});

ok("step() is pure: never changes the state it is given", () => {
  let s = initialState({ seed: 9 });
  for (let i = 0; i < 300; i++) s = step(s, 16, { dir: botDirection(s) ?? undefined });
  const snap = JSON.stringify(s);
  deepFreeze(s);
  const a = step(s, 16, { dir: "up" });
  const b = step(s, 16, { dir: "up" });
  assert.equal(JSON.stringify(s), snap);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(a, s);
});

ok("autopilot plays 10,000 steps of level 1 without breaking the engine", () => {
  let s = initialState({ seed: 2026 });
  let restarts = 0;
  let best = 0;
  let levels = 1;
  for (let i = 0; i < 10000; i++) {
    s = step(s, 16, { dir: botDirection(s) ?? undefined });
    checkGoats(s);
    assert.ok(Number.isFinite(s.score) && s.score >= 0);
    assert.equal(s.itemsLeft, countItems(s));
    levels = Math.max(levels, s.level);
    if (s.phase === "over") { best = Math.max(best, s.score); restarts++; s = initialState({ seed: 2026 + restarts }); }
  }
  best = Math.max(best, s.score);
  console.log(`      (best ${best}, games ended ${restarts}, highest level ${levels})`);
  assert.ok(best > 500, "the autopilot eats plenty");
});

console.log(`\n${checks} checks passed`);
