// Puff-Puff Rush: our own maze-chase game. Ride a delivery bike round the market lanes, collect every puff-puff,
// and keep clear of the goats. Pepper soup sends the goats running scared for a few seconds.
// Pure and deterministic: no React, no DOM, no Math.random. All randomness comes from a seed kept in the state,
// so step(state, dt, input) always gives the same result for the same arguments and never mutates its input.

export type Dir = "up" | "down" | "left" | "right";
export type Speed = "chill" | "normal" | "fast";
export type Phase = "ready" | "playing" | "dying" | "cleared" | "over";
export type GoatMode = "pen" | "leaving" | "active" | "returning";
export type GoatKind = "chaser" | "cutter" | "wanderer" | "shy";
export type GameEvent = "dot" | "soup" | "goat" | "caught" | "clear" | "bonus" | "bonusShow" | "over" | "start";

export type Point = { x: number; y: number };

export type Maze = {
  name: string;
  width: number;
  height: number;
  rows: readonly string[]; // '#' wall, '.' puff-puff, 'o' pepper soup, ' ' lane, '-' pen gate, 'g' pen, 'P' bike start, 'Z' zobo spot
  playerStart: Point;
  goatStarts: readonly Point[]; // first is just outside the gate, the rest inside the pen
  exitTile: Point; // the lane tile just above the gate
  penCenter: Point;
  bonusTile: Point;
};

export type Actor = { x: number; y: number; dir: Dir | null; prog: number }; // prog: 0..1 of the way to the next tile in `dir`
export type Player = Actor & { nextDir: Dir | null };
export type Goat = Actor & { kind: GoatKind; name: string; mode: GoatMode; scared: boolean; releaseMs: number };
export type Popup = { x: number; y: number; text: string; ms: number };

export type PuffState = {
  maze: Maze;
  level: number;
  speed: Speed;
  score: number;
  lives: number;
  phase: Phase;
  phaseMs: number; // time left in a timed phase (ready / dying / cleared)
  rng: number; // seed for the next random number
  items: readonly number[]; // per tile: 0 nothing, 1 puff-puff, 2 pepper soup
  itemsLeft: number;
  eaten: number; // puff-puff and soup eaten this level (the zobo appears at set counts)
  player: Player;
  goats: readonly Goat[];
  modeIndex: number; // place in the scatter/chase schedule
  modeMs: number; // time left in the current schedule slot
  scaredMs: number;
  chain: number; // goats sent home on this bowl of soup
  bonus: { ms: number; value: number } | null;
  bonusShown: number;
  popups: readonly Popup[];
  events: readonly GameEvent[]; // what happened during the last step (the UI plays sounds from these)
  timeMs: number;
};

export type Input = { dir?: Dir | null };

// --- Constants ---

export const DIRS: readonly Dir[] = ["up", "left", "down", "right"]; // also the tie-break order for goats
export const VEC: Record<Dir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export const SPEED_FACTOR: Record<Speed, number> = { chill: 0.78, normal: 1, fast: 1.22 };
export const PLAYER_TPS = 7; // tiles per second at Normal
export const START_LIVES = 3;
export const READY_MS = 1600;
export const DYING_MS = 1400;
export const CLEARED_MS = 2400;
export const BONUS_MS = 9000;
export const BONUS_AT = [60, 140]; // the zobo shows after this many items eaten
export const POINTS = { dot: 10, soup: 50, goat: 200 } as const;
// Scatter / chase schedule in ms: goats roam to their own corner, then hunt, a few times, then hunt for good.
export const MODE_SCHEDULE: readonly { mode: "scatter" | "chase"; ms: number }[] = [
  { mode: "scatter", ms: 6000 }, { mode: "chase", ms: 20000 },
  { mode: "scatter", ms: 6000 }, { mode: "chase", ms: 20000 },
  { mode: "scatter", ms: 4000 }, { mode: "chase", ms: Infinity },
];
const SUBSTEP_MS = 16; // nobody moves more than a fraction of a tile per substep, so collisions can't be skipped
const MAX_STEP_MS = 250;

export const GOATS: readonly { kind: GoatKind; name: string }[] = [
  { kind: "chaser", name: "Oga" }, // heads straight for you
  { kind: "cutter", name: "Sharp" }, // aims a few tiles in front of you
  { kind: "wanderer", name: "Waka" }, // half the time just wanders
  { kind: "shy", name: "Shy-shy" }, // follows from afar, backs off when close
];

// --- Mazes: three of our own, each drawn as its left half; the right half is the mirror image ---
// Column 9 is the middle. A ' ' in column 0 makes a side tunnel to the other edge.

function mirror(half: string): string {
  return half + half.slice(0, half.length - 1).split("").reverse().join("");
}

export function buildMaze(name: string, halfRows: readonly string[]): Maze {
  const rows = halfRows.map(mirror);
  const width = rows[0].length;
  const height = rows.length;
  let playerStart: Point | null = null;
  let bonusTile: Point | null = null;
  let gate: Point | null = null;
  const pen: Point[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${name}: row ${y} is ${row.length} wide, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const c = row[x];
      if (c === "P") playerStart = playerStart ?? { x, y };
      else if (c === "Z") bonusTile = bonusTile ?? { x, y };
      else if (c === "-") gate = gate ?? { x, y };
      else if (c === "g") pen.push({ x, y });
    }
  });
  if (!playerStart || !bonusTile || !gate || pen.length < 3) throw new Error(`${name}: needs P, Z, a gate and a pen`);
  const g = gate as Point;
  const penCenter = { x: g.x, y: g.y + 1 };
  const inPen = pen.filter((p) => p.y === penCenter.y).sort((a, b) => a.x - b.x);
  const exitTile = { x: g.x, y: g.y - 1 };
  return {
    name, width, height, rows, playerStart, bonusTile, exitTile, penCenter,
    goatStarts: [exitTile, inPen[0], penCenter, inPen[inPen.length - 1]],
  };
}

export const MAZES: readonly Maze[] = [
  buildMaze("Morning market", [
    "##########",
    "#........#",
    "#o##.###.#",
    "#.........",
    "#.##.#.###",
    "#....#...#",
    "####.###.#",
    "####.#....",
    "####.#.##-",
    " ......#gg",
    "####.#.###",
    "####.#...Z",
    "####.#.###",
    "#........#",
    "#.##.###.#",
    "#o.#.....P",
    "##.#.#.###",
    "#....#...#",
    "#.######.#",
    "#.........",
    "##########",
  ]),
  buildMaze("Night market", [
    "##########",
    "#o...#...#",
    "#.##.#.#.#",
    "#.........",
    "##.#.###.#",
    "#..#...#.#",
    "#.####.#.#",
    "#......#..",
    "#.##.#.##-",
    "#.#..#.#gg",
    "#.#.##.###",
    "#.#.#....Z",
    "#...#.####",
    "###...#...",
    "#...#.#.##",
    "#.#.#....P",
    "#.#...##.#",
    "#o###.#..#",
    "#.....#.##",
    "#####.....",
    "##########",
  ]),
  buildMaze("Harbour market", [
    "##########",
    "#o.......#",
    "#.###.##.#",
    "#.#.......",
    "#...#.##.#",
    "###.#.#..#",
    "  #...#.##",
    "#.#.#.#...",
    "#...#.###-",
    "#.###.##gg",
    "#.....####",
    "#.###.#..Z",
    "#...#.#.##",
    "###.#....#",
    "#o..#.##.#",
    "#.#....#.P",
    "#.#.##.#.#",
    "#...#..#.#",
    "#.###.##.#",
    "#.........",
    "##########",
  ]),
];

// --- Grid helpers ---

export function cellAt(maze: Maze, x: number, y: number): string {
  if (y < 0 || y >= maze.height) return "#";
  const wx = ((x % maze.width) + maze.width) % maze.width; // side tunnels wrap
  return maze.rows[y][wx];
}

/** Can someone stand on this tile? The pen and its gate are only for goats going in or out. */
export function walkable(maze: Maze, x: number, y: number, penAccess = false): boolean {
  const c = cellAt(maze, x, y);
  if (c === "#") return false;
  if (c === "-" || c === "g") return penAccess;
  return true;
}

const wrapX = (maze: Maze, x: number) => ((x % maze.width) + maze.width) % maze.width;
const idx = (maze: Maze, x: number, y: number) => y * maze.width + wrapX(maze, x);

function initialItems(maze: Maze): number[] {
  const items: number[] = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const c = maze.rows[y][x];
      items.push(c === "." ? 1 : c === "o" ? 2 : 0);
    }
  }
  return items;
}

// --- Seeded RNG (mulberry32), kept as a number in the state ---

export function rand(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Convenience for callers who want a plain `() => number` generator from a seed. */
export function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    const [v, n] = rand(s);
    s = n;
    return v;
  };
}

// --- Setup ---

export function mazeForLevel(level: number): Maze {
  return MAZES[(level - 1) % MAZES.length];
}

function releaseTimes(level: number): number[] {
  const f = Math.max(0.35, 1 - 0.15 * (level - 1));
  return [0, 1500, 4500, 8000].map((ms) => Math.round(ms * f));
}

function freshActors(maze: Maze, level: number): { player: Player; goats: Goat[] } {
  const release = releaseTimes(level);
  return {
    player: { ...maze.playerStart, dir: "left", prog: 0, nextDir: null },
    goats: GOATS.map((g, i) => ({
      ...maze.goatStarts[i], dir: i === 0 ? "left" : null, prog: 0, kind: g.kind, name: g.name,
      mode: i === 0 ? "active" : "pen", scared: false, releaseMs: release[i],
    })),
  };
}

function startLevel(base: Omit<PuffState, "maze" | "items" | "itemsLeft" | "eaten" | "player" | "goats"> & { level: number }, maze: Maze): PuffState {
  const items = initialItems(maze);
  return {
    ...base,
    maze,
    items,
    itemsLeft: items.filter((v) => v > 0).length,
    eaten: 0,
    ...freshActors(maze, base.level),
    phase: "ready",
    phaseMs: READY_MS,
    modeIndex: 0,
    modeMs: MODE_SCHEDULE[0].ms,
    scaredMs: 0,
    chain: 0,
    bonus: null,
    bonusShown: 0,
    popups: [],
  };
}

export function initialState(opts: { seed?: number; speed?: Speed; level?: number; rng?: () => number } = {}): PuffState {
  const seed = opts.seed ?? (opts.rng ? Math.floor(opts.rng() * 2 ** 31) : 1);
  const level = opts.level ?? 1;
  return startLevel({
    level, speed: opts.speed ?? "normal", score: 0, lives: START_LIVES, phase: "ready", phaseMs: READY_MS, rng: seed,
    modeIndex: 0, modeMs: 0, scaredMs: 0, chain: 0, bonus: null, bonusShown: 0, popups: [], events: ["start"], timeMs: 0,
  }, mazeForLevel(level));
}

// --- Speeds (tiles per second) ---

export function playerSpeed(s: PuffState): number {
  return PLAYER_TPS * SPEED_FACTOR[s.speed];
}

export function goatSpeed(s: PuffState, g: Goat): number {
  const base = PLAYER_TPS * SPEED_FACTOR[s.speed];
  if (g.mode === "returning") return base * 1.8;
  if (g.scared) return base * 0.55;
  if (g.mode === "pen" || g.mode === "leaving") return base * 0.6;
  return base * Math.min(1, 0.86 + 0.05 * (s.level - 1));
}

export function scaredDuration(level: number): number {
  return Math.max(2000, 6500 - 1000 * (level - 1));
}

export function bonusValue(level: number): number {
  return [300, 500, 700, 1000, 1500][Math.min(level - 1, 4)];
}

export function currentMode(s: PuffState): "scatter" | "chase" {
  return MODE_SCHEDULE[Math.min(s.modeIndex, MODE_SCHEDULE.length - 1)].mode;
}

// --- Path finding (shortest routes for goats heading in or out of the pen) ---

const distCache = new WeakMap<Maze, Map<string, Int16Array>>();

/** Steps from every tile to `target`, moving only through goat-walkable tiles (pen included). -1 = unreachable. */
export function distanceMap(maze: Maze, target: Point): Int16Array {
  let perMaze = distCache.get(maze);
  if (!perMaze) distCache.set(maze, (perMaze = new Map()));
  const key = `${target.x},${target.y}`;
  const cached = perMaze.get(key);
  if (cached) return cached;
  const dist = new Int16Array(maze.width * maze.height).fill(-1);
  const queue: Point[] = [target];
  dist[idx(maze, target.x, target.y)] = 0;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const d = dist[idx(maze, p.x, p.y)];
    for (const dir of DIRS) {
      const nx = wrapX(maze, p.x + VEC[dir].x);
      const ny = p.y + VEC[dir].y;
      if (!walkable(maze, nx, ny, true) || dist[idx(maze, nx, ny)] >= 0) continue;
      dist[idx(maze, nx, ny)] = d + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  perMaze.set(key, dist);
  return dist;
}

// --- Goat brains ---

const penAccess = (g: Goat) => g.mode !== "active";

function scatterCorner(maze: Maze, kind: GoatKind): Point {
  switch (kind) {
    case "chaser": return { x: maze.width - 2, y: -2 };
    case "cutter": return { x: 1, y: -2 };
    case "wanderer": return { x: maze.width - 1, y: maze.height + 1 };
    default: return { x: 0, y: maze.height + 1 };
  }
}

function chaseTarget(s: PuffState, g: Goat): Point {
  const p = s.player;
  switch (g.kind) {
    case "chaser": return { x: p.x, y: p.y };
    case "cutter": {
      const v = p.dir ? VEC[p.dir] : { x: 0, y: 0 };
      return { x: p.x + v.x * 4, y: p.y + v.y * 4 };
    }
    case "shy": {
      const d2 = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
      return d2 > 64 ? { x: p.x, y: p.y } : scatterCorner(s.maze, "shy");
    }
    default: return { x: p.x, y: p.y };
  }
}

/** Pick the goat's next direction on arriving at a tile. Returns the direction and the new rng seed. */
export function chooseGoatDir(s: PuffState, g: Goat, seed: number): [Dir | null, number] {
  const maze = s.maze;
  const access = penAccess(g);
  const open = DIRS.filter((d) => walkable(maze, g.x + VEC[d].x, g.y + VEC[d].y, access));
  if (open.length === 0) return [null, seed];
  // Going in or out of the pen: follow the shortest route (reversing is fine).
  if (g.mode === "returning" || g.mode === "leaving") {
    const dist = distanceMap(maze, g.mode === "returning" ? maze.penCenter : maze.exitTile);
    let best: Dir = open[0];
    let bestD = Infinity;
    for (const d of open) {
      const v = dist[idx(maze, g.x + VEC[d].x, g.y + VEC[d].y)];
      if (v >= 0 && v < bestD) { bestD = v; best = d; }
    }
    return [best, seed];
  }
  // Out in the market: never turn straight back unless it's a dead end.
  const forward = g.dir ? open.filter((d) => d !== OPPOSITE[g.dir as Dir]) : open;
  const options = forward.length ? forward : open;
  let wander = g.scared;
  if (!wander && g.kind === "wanderer" && currentMode(s) === "chase") {
    const [r, n] = rand(seed);
    seed = n;
    wander = r < 0.5;
  }
  if (wander) {
    const [r, n] = rand(seed);
    return [options[Math.floor(r * options.length)], n];
  }
  const target = currentMode(s) === "chase" ? chaseTarget(s, g) : scatterCorner(maze, g.kind);
  let best = options[0];
  let bestD = Infinity;
  for (const d of options) {
    const dx = g.x + VEC[d].x - target.x;
    const dy = g.y + VEC[d].y - target.y;
    const dd = dx * dx + dy * dy;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return [best, seed];
}

// --- Moving ---

function reverseActor<T extends Actor>(maze: Maze, a: T): T {
  if (!a.dir) return a;
  const back = OPPOSITE[a.dir];
  if (a.prog > 0) {
    // Turn round mid-tile: the tile we were heading to becomes the one we're leaving.
    return { ...a, x: wrapX(maze, a.x + VEC[a.dir].x), y: a.y + VEC[a.dir].y, prog: 1 - a.prog, dir: back };
  }
  return { ...a, dir: back };
}

/** Position on the board in tile units (the middle of tile x,y is x,y). */
export function actorPos(a: Actor): Point {
  if (!a.dir) return { x: a.x, y: a.y };
  return { x: a.x + VEC[a.dir].x * a.prog, y: a.y + VEC[a.dir].y * a.prog };
}

type Work = {
  s: PuffState;
  items: number[] | null; // copied on first write
  events: GameEvent[];
  popups: Popup[];
};

function itemsOf(w: Work): readonly number[] {
  return w.items ?? w.s.items;
}

function eatAt(w: Work, x: number, y: number) {
  const s = w.s;
  const i = idx(s.maze, x, y);
  const item = itemsOf(w)[i];
  if (item > 0) {
    if (!w.items) w.items = s.items.slice();
    w.items[i] = 0;
    const eaten = s.eaten + 1;
    let next: PuffState = { ...s, itemsLeft: s.itemsLeft - 1, eaten, score: s.score + (item === 1 ? POINTS.dot : POINTS.soup) };
    if (item === 1) w.events.push("dot");
    else {
      w.events.push("soup");
      next = {
        ...next, scaredMs: scaredDuration(s.level), chain: 0,
        goats: next.goats.map((g) => (g.mode === "returning" ? g : g.mode === "active" ? { ...reverseActor(s.maze, g), scared: true } : { ...g, scared: true })),
      };
    }
    if (next.bonusShown < BONUS_AT.length && eaten >= BONUS_AT[next.bonusShown]) {
      next = { ...next, bonus: { ms: BONUS_MS, value: bonusValue(s.level) }, bonusShown: next.bonusShown + 1 };
      w.events.push("bonusShow");
    }
    w.s = next;
  }
  const b = w.s.bonus;
  if (b && x === s.maze.bonusTile.x && y === s.maze.bonusTile.y) {
    w.s = { ...w.s, score: w.s.score + b.value, bonus: null };
    w.events.push("bonus");
    w.popups.push({ x, y, text: String(b.value), ms: 1200 });
  }
}

function movePlayer(w: Work, dt: number, wanted: Dir | null) {
  const s = w.s;
  const maze = s.maze;
  let p: Player = { ...s.player, nextDir: wanted ?? s.player.nextDir };
  const can = (x: number, y: number, d: Dir) => walkable(maze, x + VEC[d].x, y + VEC[d].y);
  // Turning straight back is allowed at any moment.
  if (p.nextDir && p.dir && p.nextDir === OPPOSITE[p.dir] && p.prog > 0) {
    p = { ...reverseActor(maze, p), nextDir: null };
  }
  const atCentre = () => {
    if (p.nextDir && can(p.x, p.y, p.nextDir)) p = { ...p, dir: p.nextDir, nextDir: null };
  };
  if (p.prog === 0) atCentre();
  if (!p.dir || (p.prog === 0 && !can(p.x, p.y, p.dir))) {
    w.s = { ...w.s, player: p };
    return;
  }
  let prog = p.prog + playerSpeed(s) * dt / 1000;
  while (prog >= 1 && p.dir) {
    prog -= 1;
    p = { ...p, x: wrapX(maze, p.x + VEC[p.dir].x), y: p.y + VEC[p.dir].y, prog: 0 };
    w.s = { ...w.s, player: p };
    eatAt(w, p.x, p.y);
    atCentre();
    if (!p.dir || !can(p.x, p.y, p.dir)) { prog = 0; break; } // bumped into a stall: stop and wait for a turn
  }
  w.s = { ...w.s, player: { ...p, prog } };
}

function moveGoat(w: Work, i: number, dt: number) {
  const s = w.s;
  const maze = s.maze;
  let g = s.goats[i];
  let seed = s.rng;
  if (g.mode === "pen") {
    const releaseMs = g.releaseMs - dt;
    g = releaseMs <= 0 ? { ...g, releaseMs: 0, mode: "leaving", dir: null, prog: 0 } : { ...g, releaseMs };
    if (g.mode === "pen") { w.s = { ...s, goats: replace(s.goats, i, g) }; return; }
  }
  if (!g.dir) {
    const [d, n] = chooseGoatDir(s, g, seed);
    seed = n;
    g = { ...g, dir: d, prog: 0 };
    if (!d) { w.s = { ...s, rng: seed, goats: replace(s.goats, i, g) }; return; }
  }
  let prog = g.prog + goatSpeed(s, g) * dt / 1000;
  while (prog >= 1 && g.dir) {
    prog -= 1;
    g = { ...g, x: wrapX(maze, g.x + VEC[g.dir].x), y: g.y + VEC[g.dir].y, prog: 0 };
    if (g.mode === "returning" && g.x === maze.penCenter.x && g.y === maze.penCenter.y) {
      g = { ...g, mode: "leaving", dir: null };
    } else if (g.mode === "leaving" && g.x === maze.exitTile.x && g.y === maze.exitTile.y) {
      g = { ...g, mode: "active", dir: null };
    }
    const [d, n] = chooseGoatDir({ ...s, rng: seed }, g, seed);
    seed = n;
    g = { ...g, dir: d };
  }
  w.s = { ...s, rng: seed, goats: replace(s.goats, i, { ...g, prog: g.dir ? prog : 0 }) };
}

function replace<T>(arr: readonly T[], i: number, v: T): T[] {
  const out = arr.slice();
  out[i] = v;
  return out;
}

function wrapDist(maze: Maze, a: Point, b: Point): number {
  let dx = Math.abs(a.x - b.x);
  dx = Math.min(dx, maze.width - dx);
  return dx + Math.abs(a.y - b.y);
}

function collide(w: Work) {
  const s = w.s;
  const pp = actorPos(s.player);
  for (let i = 0; i < s.goats.length; i++) {
    const g = s.goats[i];
    if (g.mode === "returning" || g.mode === "pen") continue;
    if (wrapDist(s.maze, pp, actorPos(g)) >= 0.7) continue;
    if (g.scared) {
      const pts = POINTS.goat * 2 ** Math.min(s.chain, 3);
      w.s = { ...w.s, score: w.s.score + pts, chain: w.s.chain + 1, goats: replace(w.s.goats, i, { ...g, scared: false, mode: "returning" }) };
      w.events.push("goat");
      w.popups.push({ x: Math.round(pp.x), y: Math.round(pp.y), text: String(pts), ms: 1000 });
    } else {
      w.s = { ...w.s, lives: w.s.lives - 1, phase: "dying", phaseMs: DYING_MS, bonus: null };
      w.events.push("caught");
      return;
    }
  }
}

function tickTimers(w: Work, dt: number) {
  let s = w.s;
  // Scatter/chase only counts down while the goats aren't scared.
  if (s.scaredMs > 0) {
    const scaredMs = Math.max(0, s.scaredMs - dt);
    s = { ...s, scaredMs };
    if (scaredMs === 0) s = { ...s, chain: 0, goats: s.goats.map((g) => (g.scared ? { ...g, scared: false } : g)) };
  } else if (Number.isFinite(s.modeMs)) {
    const modeMs = s.modeMs - dt;
    if (modeMs <= 0 && s.modeIndex < MODE_SCHEDULE.length - 1) {
      const modeIndex = s.modeIndex + 1;
      // A change of plan: goats out in the market turn round, so you can see it happen.
      s = { ...s, modeIndex, modeMs: MODE_SCHEDULE[modeIndex].ms, goats: s.goats.map((g) => (g.mode === "active" ? reverseActor(s.maze, g) : g)) };
    } else s = { ...s, modeMs };
  }
  if (s.bonus) {
    const ms = s.bonus.ms - dt;
    s = { ...s, bonus: ms > 0 ? { ...s.bonus, ms } : null };
  }
  w.s = s;
}

function playingSubstep(w: Work, dt: number, wanted: Dir | null) {
  tickTimers(w, dt);
  movePlayer(w, dt, wanted);
  collide(w);
  if (w.s.phase !== "playing") return;
  for (let i = 0; i < w.s.goats.length; i++) moveGoat(w, i, dt);
  collide(w);
  if (w.s.phase !== "playing") return;
  if (w.s.itemsLeft <= 0) {
    w.s = { ...w.s, phase: "cleared", phaseMs: CLEARED_MS, bonus: null };
    w.events.push("clear");
  }
}

/** Load the next market, keeping score and lives. */
export function nextLevel(s: PuffState): PuffState {
  const level = s.level + 1;
  return { ...startLevel({ ...s, level }, mazeForLevel(level)), events: [] };
}

/** After being caught: everyone back to their start, puff-puff left where they were. */
export function resetAfterCatch(s: PuffState): PuffState {
  return { ...s, ...freshActors(s.maze, s.level), phase: "ready", phaseMs: READY_MS, scaredMs: 0, chain: 0, bonus: null, modeIndex: 0, modeMs: MODE_SCHEDULE[0].ms };
}

/** Advance the game by dtMs. Pure: returns a new state and never changes `state`. */
export function step(state: PuffState, dtMs: number, input: Input = {}): PuffState {
  const w: Work = { s: { ...state, events: [] }, items: null, events: [], popups: [] };
  let left = Math.max(0, Math.min(MAX_STEP_MS, dtMs));
  let wanted: Dir | null = input.dir ?? null;
  // A turn pressed during "get ready" is remembered for the first move.
  if (wanted && w.s.phase === "ready") {
    w.s = { ...w.s, player: { ...w.s.player, nextDir: wanted } };
    wanted = null;
  }
  while (left > 0) {
    const dt = Math.min(SUBSTEP_MS, left);
    left -= dt;
    const s = w.s;
    if (s.phase === "over") break;
    if (s.phase === "ready" || s.phase === "dying" || s.phase === "cleared") {
      const phaseMs = s.phaseMs - dt;
      if (phaseMs > 0) { w.s = { ...s, phaseMs }; continue; }
      if (s.phase === "ready") w.s = { ...s, phase: "playing", phaseMs: 0 };
      else if (s.phase === "dying") {
        if (s.lives <= 0) { w.s = { ...s, phase: "over", phaseMs: 0 }; w.events.push("over"); }
        else w.s = resetAfterCatch(s);
      } else {
        w.s = nextLevel({ ...s, items: itemsOf(w) });
        w.items = null;
      }
      continue;
    }
    playingSubstep(w, dt, wanted);
    wanted = null;
  }
  const elapsed = Math.max(0, Math.min(MAX_STEP_MS, dtMs));
  const popups = [...w.s.popups.map((p) => ({ ...p, ms: p.ms - elapsed })).filter((p) => p.ms > 0), ...w.popups];
  return { ...w.s, items: w.items ?? w.s.items, popups, events: w.events, timeMs: state.timeMs + elapsed };
}

// --- A simple autopilot (tests, and handy for demos): head for the nearest puff-puff, avoid hungry goats ---

export function botDirection(s: PuffState): Dir | null {
  const maze = s.maze;
  const danger = new Set<number>();
  for (const g of s.goats) {
    if (g.mode !== "active" || g.scared) continue;
    const gp = actorPos(g);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add(idx(maze, Math.round(gp.x) + dx, Math.round(gp.y) + dy));
    }
  }
  const start = { x: s.player.x, y: s.player.y };
  const seen = new Map<number, Dir | null>([[idx(maze, start.x, start.y), null]]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const first = seen.get(idx(maze, p.x, p.y)) ?? null;
    if (i > 0 && s.items[idx(maze, p.x, p.y)] > 0) return first;
    for (const d of DIRS) {
      const nx = wrapX(maze, p.x + VEC[d].x);
      const ny = p.y + VEC[d].y;
      const k = idx(maze, nx, ny);
      if (!walkable(maze, nx, ny) || seen.has(k) || danger.has(k)) continue;
      seen.set(k, first ?? d);
      queue.push({ x: nx, y: ny });
    }
  }
  // Boxed in: go any open way that isn't straight into a goat.
  return DIRS.find((d) => walkable(maze, start.x + VEC[d].x, start.y + VEC[d].y) && !danger.has(idx(maze, start.x + VEC[d].x, start.y + VEC[d].y))) ?? null;
}
