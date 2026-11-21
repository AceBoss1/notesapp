// Naija Run: a three-lane endless runner down a Lagos street at dusk. Pure logic only (no React, no DOM), so the
// tests can drive it frame by frame. Everything random comes from a seed kept in the state, which makes step() pure:
// the same state, time and input always give the same next state.

export type Lane = 0 | 1 | 2;
export type RunInput = "left" | "right" | "jump" | "slide" | "none";
export type Speed = "chill" | "normal" | "fast";

// How each obstacle is beaten: "low" ones are jumped, "high" ones slid under, "block" ones avoided by changing lane.
export type ObstacleKind = "pothole" | "puddle" | "awning" | "banner" | "danfo" | "barrow";
export type Clearance = "low" | "high" | "block";

export const OBSTACLES: Record<ObstacleKind, { clear: Clearance; length: number; label: string }> = {
  pothole: { clear: "low", length: 1.4, label: "a pothole" },
  puddle: { clear: "low", length: 1.8, label: "a puddle" },
  awning: { clear: "high", length: 1.2, label: "a stall awning" },
  banner: { clear: "high", length: 0.6, label: "a banner" },
  danfo: { clear: "block", length: 5.5, label: "a danfo bus" },
  barrow: { clear: "block", length: 1.6, label: "a wheelbarrow" },
};

export type Obstacle = { id: number; kind: ObstacleKind; lane: Lane; z: number; hit: boolean };
export type Pickup = { id: number; kind: "coin" | "pepper"; lane: Lane; z: number; taken: boolean };
export type RunEvent = "lane" | "jump" | "slide" | "coin" | "pepper" | "smash" | "crash" | "step";

export type RunState = {
  level: Speed;
  rng: number; // mulberry32 state
  timeMs: number;
  distance: number; // metres run
  speed: number; // metres per second, right now
  lane: Lane;
  laneFrom: Lane; // for the sideways glide the renderer draws
  laneMs: number; // ms since the last lane change
  jumpMs: number; // ms into the current jump, -1 when on the ground
  slideMs: number; // ms into the current slide, -1 when upright
  pepperMs: number; // ms of pepper left
  coins: number;
  points: number; // distance + coin points, doubled while peppered
  stride: number; // footsteps taken, for the step tick
  obstacles: Obstacle[];
  pickups: Pickup[];
  nextId: number;
  nextRowZ: number; // where the spawner places its next row
  lastPepperZ: number;
  over: boolean;
  crashedInto: ObstacleKind | null;
  events: RunEvent[]; // what happened during the last step (sounds)
};

export const LANES = 3;
export const LANE_WIDTH = 2.4; // metres, for the renderer
export const RUNNER_HALF = 0.4; // the runner's depth either side of their position
export const JUMP_MS = 640;
export const JUMP_AIR = [50, 600] as const; // inside this window a jump clears low obstacles
export const SLIDE_MS = 640;
export const LANE_GLIDE_MS = 120;
export const PEPPER_MS = 5000;
export const PEPPER_BOOST = 1.4; // speed while peppered
export const COIN_POINTS = 10;
export const STRIDE_M = 1.7;
export const VIEW_AHEAD = 110; // the spawner keeps this many metres ahead filled
const SUBSTEP_MS = 16;

export const SPEEDS: Record<Speed, { start: number; top: number }> = {
  chill: { start: 9, top: 19 },
  normal: { start: 11, top: 25 },
  fast: { start: 14, top: 31 },
};
const SPEED_RAMP_M = 2200; // speed approaches top along 1 - e^(-distance / ramp): quick at first, then gently

// mulberry32: tiny, fast and good enough for a game. Returns [value in 0..1, next state].
export function nextRandom(s: number): [number, number] {
  const a = (s + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export function speedAt(level: Speed, distance: number): number {
  const { start, top } = SPEEDS[level];
  return start + (top - start) * (1 - Math.exp(-Math.max(0, distance) / SPEED_RAMP_M));
}

export function score(s: RunState): number {
  return Math.floor(s.points);
}

export function createRun(seed = 1, level: Speed = "normal"): RunState {
  const base: RunState = {
    level, rng: seed >>> 0, timeMs: 0, distance: 0, speed: speedAt(level, 0),
    lane: 1, laneFrom: 1, laneMs: LANE_GLIDE_MS, jumpMs: -1, slideMs: -1, pepperMs: 0,
    coins: 0, points: 0, stride: 0, obstacles: [], pickups: [], nextId: 1,
    nextRowZ: 40, // a clear run-up before the first row
    lastPepperZ: 0, over: false, crashedInto: null, events: [],
  };
  return spawnAhead(base);
}

// Is the runner off the ground enough to clear a pothole, or low enough to pass under an awning?
export function isAirborne(s: Pick<RunState, "jumpMs">): boolean {
  return s.jumpMs >= JUMP_AIR[0] && s.jumpMs <= JUMP_AIR[1];
}
export function isLow(s: Pick<RunState, "slideMs">): boolean {
  return s.slideMs >= 0 && s.slideMs <= SLIDE_MS;
}
// 0..1 jump height for drawing (a simple arc).
export function jumpHeight(s: Pick<RunState, "jumpMs">): number {
  if (s.jumpMs < 0) return 0;
  const t = Math.min(1, s.jumpMs / JUMP_MS);
  return 4 * t * (1 - t);
}

// Does this obstacle stop a runner standing in `lane` at `distance` in this pose?
export function collides(o: Obstacle, lane: Lane, distance: number, pose: { jumpMs: number; slideMs: number }): boolean {
  if (o.hit || o.lane !== lane) return false;
  const len = OBSTACLES[o.kind].length;
  if (distance + RUNNER_HALF < o.z || distance - RUNNER_HALF > o.z + len) return false;
  const clear = OBSTACLES[o.kind].clear;
  if (clear === "low") return !isAirborne(pose);
  if (clear === "high") return !isLow(pose);
  return true;
}

function applyInput(s: RunState, input: RunInput, events: RunEvent[]): RunState {
  if (input === "left" || input === "right") {
    const lane = Math.max(0, Math.min(LANES - 1, s.lane + (input === "left" ? -1 : 1))) as Lane;
    if (lane === s.lane) return s;
    events.push("lane");
    return { ...s, laneFrom: s.lane, lane, laneMs: 0 };
  }
  if (input === "jump") {
    if (s.jumpMs >= 0) return s; // no double jump
    events.push("jump");
    return { ...s, jumpMs: 0, slideMs: -1 };
  }
  if (input === "slide") {
    if (s.slideMs >= 0) return s;
    events.push("slide");
    return { ...s, slideMs: 0, jumpMs: -1 }; // sliding mid-air drops you straight down
  }
  return s;
}

// The spawner: rows of obstacles, never all three lanes blocked, spaced so there is always time to react.
function spawnAhead(s: RunState): RunState {
  if (s.nextRowZ > s.distance + VIEW_AHEAD) return s;
  let rng = s.rng;
  const rand = () => { const [v, n] = nextRandom(rng); rng = n; return v; };
  const obstacles = s.obstacles.slice();
  const pickups = s.pickups.slice();
  let { nextId, nextRowZ, lastPepperZ } = s;
  while (nextRowZ <= s.distance + VIEW_AHEAD) {
    const z = nextRowZ;
    const v = speedAt(s.level, z);
    // One, sometimes two, lanes get something; one lane is always left completely clear.
    const free = Math.floor(rand() * 3) as Lane;
    const others = ([0, 1, 2] as Lane[]).filter((l) => l !== free);
    const count = rand() < 0.45 + Math.min(0.35, z / 4000) ? 2 : 1;
    const used = count === 2 ? others : [others[Math.floor(rand() * 2)]];
    let longest = 0;
    for (const lane of used) {
      const r = rand();
      const kind: ObstacleKind = r < 0.16 ? "pothole" : r < 0.3 ? "puddle" : r < 0.46 ? "awning" : r < 0.6 ? "banner" : r < 0.82 ? "danfo" : "barrow";
      obstacles.push({ id: nextId++, kind, lane, z, hit: false });
      longest = Math.max(longest, OBSTACLES[kind].length);
    }
    // Coins: a short line down the clear lane; now and then a pepper instead, if one hasn't shown for a while.
    if (z - lastPepperZ > 450 && rand() < 0.3) {
      pickups.push({ id: nextId++, kind: "pepper", lane: free, z: z + 1, taken: false });
      lastPepperZ = z;
    } else if (rand() < 0.7) {
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i += 1) pickups.push({ id: nextId++, kind: "coin", lane: free, z: z - 4 + i * 2.2, taken: false });
    }
    // Gap to the next row: the longest obstacle, about a second of running, and a little variety.
    nextRowZ = z + longest + v * (1.05 + rand() * 0.7) + 6;
  }
  return { ...s, rng, obstacles, pickups, nextId, nextRowZ, lastPepperZ };
}

// One small slice of time (≤ SUBSTEP_MS), so fast runners never skip through an obstacle.
function tick(s: RunState, dt: number, events: RunEvent[]): RunState {
  const peppered = s.pepperMs > 0;
  const speed = speedAt(s.level, s.distance) * (peppered ? PEPPER_BOOST : 1);
  const moved = (speed * dt) / 1000;
  const distance = s.distance + moved;
  const mult = peppered ? 2 : 1;
  let points = s.points + moved * mult;
  let jumpMs = s.jumpMs >= 0 ? s.jumpMs + dt : -1;
  if (jumpMs > JUMP_MS) jumpMs = -1;
  let slideMs = s.slideMs >= 0 ? s.slideMs + dt : -1;
  if (slideMs > SLIDE_MS) slideMs = -1;
  const pepperMs = Math.max(0, s.pepperMs - dt);
  const stride = Math.floor(distance / STRIDE_M);
  if (stride > s.stride && jumpMs < 0 && slideMs < 0) events.push("step");

  const pose = { jumpMs, slideMs };
  let obstacles = s.obstacles;
  let crashedInto: ObstacleKind | null = null;
  for (const o of s.obstacles) {
    if (!collides(o, s.lane, distance, pose)) continue;
    if (peppered) {
      // Pepper power: barge straight through and knock it aside.
      obstacles = obstacles.map((x) => (x.id === o.id ? { ...x, hit: true } : x));
      events.push("smash");
    } else {
      crashedInto = o.kind;
      break;
    }
  }

  let coins = s.coins;
  let pepperLeft = pepperMs;
  let pickups = s.pickups;
  for (const p of s.pickups) {
    if (p.taken || p.lane !== s.lane || Math.abs(p.z - distance) > RUNNER_HALF + 0.5) continue;
    pickups = pickups.map((x) => (x.id === p.id ? { ...x, taken: true } : x));
    if (p.kind === "coin") { coins += 1; points += COIN_POINTS * mult; events.push("coin"); }
    else { pepperLeft = PEPPER_MS; events.push("pepper"); }
  }

  const next: RunState = {
    ...s, timeMs: s.timeMs + dt, distance, speed, jumpMs, slideMs, pepperMs: pepperLeft, coins, points, stride,
    laneMs: Math.min(LANE_GLIDE_MS, s.laneMs + dt), obstacles, pickups,
  };
  if (crashedInto) {
    events.push("crash");
    return { ...next, over: true, crashedInto };
  }
  return next;
}

// Advance the run by dtMs with one input applied at the start. Never mutates `state`.
export function step(state: RunState, dtMs: number, input: RunInput = "none"): RunState {
  if (state.over) return state.events.length ? { ...state, events: [] } : state;
  const events: RunEvent[] = [];
  let s = applyInput(state, input, events);
  let left = Math.max(0, Math.min(dtMs, 250)); // a long stall (tab switch) never teleports the runner
  while (left > 0 && !s.over) {
    const dt = Math.min(SUBSTEP_MS, left);
    s = tick(s, dt, events);
    left -= dt;
  }
  // Tidy up what's behind, then fill the road ahead.
  const behind = s.distance - 12;
  s = {
    ...s,
    obstacles: s.obstacles.filter((o) => o.z + OBSTACLES[o.kind].length > behind),
    pickups: s.pickups.filter((p) => p.z > behind),
  };
  s = spawnAhead(s);
  return { ...s, events };
}

// A careful runner who sees everything: used by the tests (and handy as an attract-mode demo).
export function botInput(s: RunState): RunInput {
  const ahead = (lane: Lane, from: number, to: number) =>
    s.obstacles.filter((o) => !o.hit && o.lane === lane && o.z + OBSTACLES[o.kind].length >= s.distance + from && o.z <= s.distance + to);
  const look = s.speed * 0.9 + 4;
  const mine = ahead(s.lane, -RUNNER_HALF, look).sort((a, b) => a.z - b.z)[0];
  if (mine && OBSTACLES[mine.kind].clear === "block") {
    // Head for the nearest lane with no block coming, one lane at a time, never into something right alongside.
    const okAhead = (l: Lane) => ahead(l, -RUNNER_HALF - 1, look).every((o) => OBSTACLES[o.kind].clear !== "block");
    const clearNow = (l: Lane) => ahead(l, -RUNNER_HALF - 0.3, RUNNER_HALF + s.speed * 0.05).length === 0;
    const targets = ([0, 1, 2] as Lane[]).filter((l) => l !== s.lane && okAhead(l)).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane));
    const target = targets[0];
    if (target === undefined) return "none";
    const next = (s.lane + (target < s.lane ? -1 : 1)) as Lane;
    if (!clearNow(next)) return "none";
    return target < s.lane ? "left" : "right";
  }
  if (mine) {
    const gap = mine.z - (s.distance + RUNNER_HALF);
    const lead = (s.speed * 120) / 1000; // start about 120 ms before reaching it
    if (gap <= lead + 0.3) {
      if (OBSTACLES[mine.kind].clear === "low" && s.jumpMs < 0) return "jump";
      if (OBSTACLES[mine.kind].clear === "high" && s.slideMs < 0) return "slide";
    }
  }
  return "none";
}
