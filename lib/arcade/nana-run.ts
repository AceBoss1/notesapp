// Nana for Naija Run (owner, 21 Nov 2026: "a free Nana for arcade … it won't be available for tournaments"). Run is real time, so a
// hint mid-dash would only get you killed: Nana coaches between runs, from what the run already knows (what you hit, the coins and
// peppers you passed, where you ran), and gives a tip only while the run is paused, read off the frozen street with the same look-ahead
// botInput uses. Pure: it only reads RunState and never feeds anything back into it, so it can't change a run or its random street
// (and RunGame doesn't call any of it in tournament mode).
import { type NanaTake, type NanaTip } from "./nana";
import { OBSTACLES, RUNNER_HALF, botInput, type Lane, type ObstacleKind, type RunInput, type RunState, type Speed } from "./run";

export const LANE_NAME: Record<Lane, string> = { 0: "left", 1: "middle", 2: "right" };

/** What Nana keeps an eye on while you run, updated once per frame by watchRun. */
export type RunWatch = {
  coinsMissed: number;
  peppers: number;
  peppersMissed: number;
  smashes: number;
  laneMs: [number, number, number];
  safeLane: Lane | null; // at the crash: the lane with nothing blocking it, if there was one
};

export const newRunWatch = (): RunWatch => ({ coinsMissed: 0, peppers: 0, peppersMissed: 0, smashes: 0, laneMs: [0, 0, 0], safeLane: null });

/** Lanes ordered nearest first, with how far ahead (m) the first block (danfo, wheelbarrow) is in each; Infinity when none in sight. */
function blocksAhead(s: RunState, look: number): { lane: Lane; at: number; kind: ObstacleKind | null }[] {
  return ([0, 1, 2] as Lane[]).map((lane) => {
    const first = s.obstacles
      .filter((o) => !o.hit && o.lane === lane && OBSTACLES[o.kind].clear === "block" && o.z + OBSTACLES[o.kind].length >= s.distance - RUNNER_HALF && o.z <= s.distance + look)
      .sort((a, b) => a.z - b.z)[0];
    return { lane, at: first ? Math.max(0, first.z - s.distance) : Infinity, kind: first?.kind ?? null };
  });
}

/** The lane botInput would head for: nearest with no block in sight, else the one whose block is furthest off. */
export function safestLane(s: RunState, look = s.speed * 1.5 + 6): Lane {
  const lanes = blocksAhead(s, look).sort((a, b) => (b.at - a.at) || (Math.abs(a.lane - s.lane) - Math.abs(b.lane - s.lane)));
  return lanes[0].lane;
}

/** One frame's worth of watching: `prev` is the state before step(), `next` after. Returns a new watch; never touches the run. */
export function watchRun(w: RunWatch, prev: RunState, next: RunState, dtMs: number): RunWatch {
  let { coinsMissed, peppers, peppersMissed, smashes, safeLane } = w;
  const laneMs: [number, number, number] = [...w.laneMs];
  laneMs[next.lane] += dtMs;
  // step() drops pickups once they're behind the runner; any that go untaken were missed.
  const kept = new Set(next.pickups.map((p) => p.id));
  for (const p of prev.pickups) {
    if (p.taken || kept.has(p.id)) continue;
    if (p.kind === "coin") coinsMissed += 1; else peppersMissed += 1;
  }
  for (const e of next.events) {
    if (e === "pepper") peppers += 1;
    else if (e === "smash") smashes += 1;
  }
  if (next.over && !prev.over) safeLane = safestLane(prev);
  return { coinsMissed, peppers, peppersMissed, smashes, laneMs, safeLane };
}

export type RunStats = {
  level: Speed;
  metres: number;
  score: number;
  coins: number;
  bestBefore: number;
  crashedInto: ObstacleKind | null;
  crashLane: Lane;
  pose: "jump" | "slide" | "run"; // what the runner was doing when they hit it
  watch: RunWatch;
};

export function runStats(s: RunState, watch: RunWatch, bestBefore: number): RunStats {
  return {
    level: s.level, metres: Math.floor(s.distance), score: Math.floor(s.points), coins: s.coins, bestBefore,
    crashedInto: s.crashedInto, crashLane: s.lane, pose: s.jumpMs >= 0 ? "jump" : s.slideMs >= 0 ? "slide" : "run", watch,
  };
}

function crashAdvice(st: RunStats): string {
  const k = st.crashedInto;
  if (!k) return "";
  const what = OBSTACLES[k].label;
  const clear = OBSTACLES[k].clear;
  if (clear === "low") {
    if (st.pose === "slide") return `You slid into ${what}. Holes and puddles want a jump (up, W, space or a tap), not a slide.`;
    if (st.pose === "jump") return `You jumped, but came down in ${what}. Jump a beat later, when it's about a body-length away.`;
    return `${cap(what)} caught you on foot. Up, W, space or a tap jumps it; go just before you reach it.`;
  }
  if (clear === "high") {
    if (st.pose === "jump") return `You jumped into ${what}. Duck under those instead: down, S or a swipe down.`;
    if (st.pose === "slide") return `Your slide ran out under ${what}. Slide a touch later so it lasts all the way through.`;
    return `${cap(what)} got you standing up. Slide under it: down, S or a swipe down.`;
  }
  const safe = st.watch.safeLane;
  const tip = safe !== null && safe !== st.crashLane ? ` The ${LANE_NAME[safe]} lane was clear: move as soon as you see one coming.` : " Change lane as soon as you see one coming.";
  return `Straight into ${what} in the ${LANE_NAME[st.crashLane]} lane. You can't jump or slide those.${tip}`;
}

/** Nana's take on the last run, or a word of welcome before the first. */
export function runCoach(st: RunStats | null): NanaTake {
  if (!st) return { text: "Off you go. After each run I'll tell you what tripped you up and how to get further.", tone: "fine" };
  const parts: string[] = [];
  const best = st.score > st.bestBefore && st.bestBefore > 0;
  if (best) parts.push(`New best: ${st.score}, ${st.metres} m.`);
  parts.push(crashAdvice(st));
  const w = st.watch;
  // Coins are laid down the lane the spawner keeps clear, so following them is also the safe line.
  if (w.coinsMissed >= 5 && w.coinsMissed > st.coins) parts.push(`You left ${w.coinsMissed} coins on the road. They line the clear lane, so following them keeps you safe too.`);
  if (w.peppersMissed > 0) parts.push(`You passed ${w.peppersMissed === 1 ? "a pepper" : `${w.peppersMissed} peppers`}: grab one for 5 seconds of double points, barging through anything.`);
  else if (w.peppers > 0 && w.smashes === 0 && parts.length < 3) parts.push("Next pepper, steer at the obstacles: you barge through them while it lasts.");
  const total = w.laneMs[0] + w.laneMs[1] + w.laneMs[2];
  if (total > 0 && parts.length < 3) {
    const edge = ([0, 2] as Lane[]).find((l) => w.laneMs[l] / total > 0.6);
    if (edge !== undefined) parts.push(`You spent most of the run in the ${LANE_NAME[edge]} lane; from the middle you can dodge either way.`);
  }
  if (st.metres < 150 && parts.length < 3) parts.push("The first stretch is the slowest, so take your time there.");
  const tone: NanaTake["tone"] = best || st.metres >= 1000 ? "good" : st.metres < 300 ? "risky" : "fine";
  return { text: parts.filter(Boolean).slice(0, 3).join(" "), tone };
}

/** Nana's tip for a paused run: what to do first when you carry on, and why. Null once the run is over. */
export function runTip(s: RunState): NanaTip | null {
  if (s.over) return null;
  const look = s.speed * 2.5 + 10; // about two and a half seconds of street
  const mine = s.obstacles
    .filter((o) => !o.hit && o.lane === s.lane && o.z + OBSTACLES[o.kind].length >= s.distance - RUNNER_HALF && o.z <= s.distance + look)
    .sort((a, b) => a.z - b.z)[0];
  const peppered = s.pepperMs > 0;
  const pepperNote = peppered ? ` You've ${Math.ceil(s.pepperMs / 1000)} s of pepper left, so you'd barge through it anyway.` : "";
  const bot: RunInput = botInput(s);
  if (mine) {
    const m = Math.max(0, Math.round(mine.z - s.distance));
    const what = OBSTACLES[mine.kind].label;
    const clear = OBSTACLES[mine.kind].clear;
    if (clear === "low") return { move: "a jump", why: `${cap(what)} is ${m} m ahead in your lane: jump just before you reach it.${pepperNote}` };
    if (clear === "high") return { move: "a slide", why: `${cap(what)} is ${m} m ahead in your lane: slide under it.${pepperNote}` };
    const lanes = blocksAhead(s, look);
    let target = bot === "left" ? (s.lane - 1) as Lane : bot === "right" ? (s.lane + 1) as Lane : safestLane(s, look);
    if (target === s.lane) target = lanes.filter((l) => l.lane !== s.lane).sort((a, b) => b.at - a.at)[0].lane;
    const there = lanes[target];
    const route = Math.abs(target - s.lane) === 2 ? " (one lane at a time)" : "";
    const after = there.at === Infinity ? `the ${LANE_NAME[target]} one is clear` : `the ${LANE_NAME[target]} one's ${OBSTACLES[there.kind as ObstacleKind].label} is further off (${Math.round(there.at)} m)`;
    return { move: `the ${LANE_NAME[target]} lane${route}`, why: `Your lane has ${what} coming in ${m} m; ${after}.${pepperNote}` };
  }
  // Nothing in your way: point at the coins, which sit in the lane the spawner keeps clear.
  const coinsIn = (l: Lane) => s.pickups.filter((p) => !p.taken && p.kind === "coin" && p.lane === l && p.z > s.distance && p.z <= s.distance + look).length;
  const pepper = s.pickups.find((p) => !p.taken && p.kind === "pepper" && p.z > s.distance && p.z <= s.distance + look);
  const clearLane = (l: Lane) => !s.obstacles.some((o) => !o.hit && o.lane === l && o.z + OBSTACLES[o.kind].length >= s.distance - RUNNER_HALF && o.z <= s.distance + look);
  if (pepper && clearLane(pepper.lane)) {
    return { move: pepper.lane === s.lane ? `staying in the ${LANE_NAME[s.lane]} lane` : `the ${LANE_NAME[pepper.lane]} lane`, why: `A pepper is ${Math.round(pepper.z - s.distance)} m ahead there: double points and you barge through anything.` };
  }
  const best = ([0, 1, 2] as Lane[]).filter(clearLane).sort((a, b) => (coinsIn(b) - coinsIn(a)) || (Math.abs(a - s.lane) - Math.abs(b - s.lane)))[0];
  if (best !== undefined && best !== s.lane && coinsIn(best) > coinsIn(s.lane)) {
    return { move: `the ${LANE_NAME[best]} lane`, why: `${coinsIn(best)} coins are lined up there and nothing's in the way.` };
  }
  const n = coinsIn(s.lane);
  return { move: `staying in the ${LANE_NAME[s.lane]} lane`, why: `Nothing's in your way for the next ${Math.round(look)} m${n ? `, and there are ${n} coins to grab` : ""}.` };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
