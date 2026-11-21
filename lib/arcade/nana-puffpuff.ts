// Nana for Puff-Puff Rush (owner, 21 Nov 2026: "a free Nana for arcade … it won't be available for tournaments"). A goat chase is
// real time, so Nana coaches between games (which goat got you and how, what the pepper soup did for you) and gives a tip only while
// the game is paused: the way botDirection would ride from the frozen board, with the goats around you as the why. Pure: it only reads
// PuffState and never writes to it, so the goats and the seeded randomness play out exactly as they would without her.
import { type NanaTake, type NanaTip } from "./nana";
import { DIRS, VEC, actorPos, botDirection, walkable, type Dir, type GoatKind, type Point, type PuffState } from "./puffpuff";

export type PuffCatch = {
  goat: string;
  kind: GoatKind;
  market: string;
  head_on: boolean; // you rode into it, rather than it creeping up from behind or the side
  soupsLeft: number; // bowls still on the board
  soupJustEnded: boolean; // the goats had stopped being scared less than 2.5 s before
};

/** What Nana keeps an eye on during a game, updated once per frame by watchPuff. */
export type PuffWatch = {
  catches: PuffCatch[];
  bowls: number[]; // goats sent home on each bowl of pepper soup, in order
  farBowls: number; // bowls eaten with no hungry goat within 6 tiles
  zoboShown: number;
  zoboTaken: number;
  cleared: number;
  scaredEndedAt: number | null; // timeMs when the last soup wore off
};

export const newPuffWatch = (): PuffWatch => ({ catches: [], bowls: [], farBowls: 0, zoboShown: 0, zoboTaken: 0, cleared: 0, scaredEndedAt: null });

const SOUP_NEAR = 6;
const JUST_ENDED_MS = 2500;

export function tileDist(s: PuffState, a: Point, b: Point): number {
  let dx = Math.abs(a.x - b.x);
  dx = Math.min(dx, s.maze.width - dx); // side tunnels
  return dx + Math.abs(a.y - b.y);
}

/** Goats out in the market and not scared, nearest first. */
function hungryGoats(s: PuffState) {
  const pp = actorPos(s.player);
  return s.goats
    .filter((g) => g.mode === "active" && !g.scared)
    .map((g) => ({ g, d: tileDist(s, pp, actorPos(g)) }))
    .sort((a, b) => a.d - b.d);
}

/** One frame's worth of watching: `prev` is the state before step(), `next` after. Returns a new watch; never touches the game. */
export function watchPuff(w: PuffWatch, prev: PuffState, next: PuffState): PuffWatch {
  if (!next.events.length && !(prev.scaredMs > 0 && next.scaredMs === 0)) return w;
  const out: PuffWatch = { ...w, catches: w.catches, bowls: w.bowls };
  if (prev.scaredMs > 0 && next.scaredMs === 0) out.scaredEndedAt = next.timeMs;
  for (const e of next.events) {
    if (e === "soup") {
      out.bowls = [...out.bowls, 0];
      const near = hungryGoats(prev).concat(prev.goats.filter((g) => g.mode === "active" && g.scared).map((g) => ({ g, d: tileDist(prev, actorPos(prev.player), actorPos(g)) })));
      if (!near.some((n) => n.d <= SOUP_NEAR)) out.farBowls += 1;
    } else if (e === "goat" && out.bowls.length) {
      out.bowls = [...out.bowls.slice(0, -1), out.bowls[out.bowls.length - 1] + 1];
    } else if (e === "bonusShow") out.zoboShown += 1;
    else if (e === "bonus") out.zoboTaken += 1;
    else if (e === "clear") out.cleared += 1;
    else if (e === "caught") {
      // The goat that got you: the nearest hungry one, on the board as it stood when you were caught.
      const g = hungryGoats(next)[0]?.g ?? hungryGoats(prev)[0]?.g;
      if (!g) continue;
      const pp = actorPos(next.player);
      const gp = actorPos(g);
      const dir = prev.player.dir;
      const head_on = dir ? (gp.x - pp.x) * VEC[dir].x + (gp.y - pp.y) * VEC[dir].y > 0 : false;
      out.catches = [...out.catches, {
        goat: g.name, kind: g.kind, market: next.maze.name, head_on,
        soupsLeft: next.items.filter((v) => v === 2).length,
        soupJustEnded: out.scaredEndedAt !== null && next.timeMs - out.scaredEndedAt < JUST_ENDED_MS,
      }];
    }
  }
  return out;
}

export type PuffStats = { score: number; bestBefore: number; level: number; over: boolean; itemsLeft: number; watch: PuffWatch };

export function puffStats(s: PuffState, watch: PuffWatch, bestBefore: number): PuffStats {
  return { score: s.score, bestBefore, level: s.level, over: s.phase === "over", itemsLeft: s.itemsLeft, watch };
}

// How each goat hunts (lib/arcade/puffpuff.ts chaseTarget), in a sentence a player can use.
export const GOAT_HABIT: Record<GoatKind, string> = {
  chaser: "heads straight for you, so keep a corner between you and him",
  cutter: "aims a few tiles in front of you, so a sudden turn shakes him off",
  wanderer: "wanders half the time, so he's hard to read: give him room",
  shy: "follows from afar and backs off when close, so watch him in the long lanes",
};

/** Nana's take on the game so far (when paused) or the game just ended, or a welcome before the first. */
export function puffCoach(st: PuffStats | null): NanaTake {
  if (!st) return { text: "Ride well. After each game I'll tell you which goat got you and how to time the pepper soup.", tone: "fine" };
  const w = st.watch;
  const parts: string[] = [];
  const best = st.over && st.score > st.bestBefore && st.bestBefore > 0;
  if (best) parts.push(`New best: ${st.score}.`);
  const last = w.catches[w.catches.length - 1];
  if (last) {
    const how = last.head_on ? "you rode straight into him" : "he crept up on you";
    parts.push(`${st.over ? "In the end" : "Last time"} it was ${last.goat} in ${last.market}: ${how}. ${last.goat} ${GOAT_HABIT[last.kind]}.`);
    if (last.soupJustEnded) parts.push("The soup had just worn off: when the goats start flashing white, get clear of them.");
    else if (last.soupsLeft > 0) parts.push(`You still had ${last.soupsLeft === 1 ? "a bowl" : `${last.soupsLeft} bowls`} of pepper soup on the board: when goats close in, ride for the soup.`);
    const counts = new Map<string, number>();
    for (const c of w.catches) counts.set(c.goat, (counts.get(c.goat) ?? 0) + 1);
    const repeat = [...counts].find(([, n]) => n >= 2);
    if (repeat && parts.length < 3) parts.push(`${repeat[0]} caught you ${repeat[1]} times.`);
  } else if (!st.over) {
    parts.push("No goat has caught you yet this game. Keep it up.");
  }
  const topBowl = Math.max(0, ...w.bowls);
  if (w.farBowls > 0 && parts.length < 3) parts.push(`You ate ${w.farBowls === 1 ? "a bowl" : `${w.farBowls} bowls`} of soup with no goat near. Save it for when they close in: that's 200 to 1600 a goat.`);
  else if (topBowl >= 3 && parts.length < 3) parts.push(`Lovely soup timing: ${topBowl} goats on one bowl.`);
  if (w.zoboShown > w.zoboTaken && parts.length < 3) parts.push("The zobo below the pen went begging; it's worth a detour when the goats are away.");
  if (w.cleared > 0 && parts.length < 3) parts.push(`You cleared ${w.cleared === 1 ? "a market" : `${w.cleared} markets`}.`);
  if (!parts.length) parts.push("Clean riding.");
  const tone: NanaTake["tone"] = best || w.cleared > 0 ? "good" : st.over && st.level === 1 && st.itemsLeft > 60 ? "risky" : "fine";
  return { text: parts.slice(0, 3).join(" "), tone };
}

const DIR_WORD: Record<Dir, string> = { up: "up", down: "down", left: "left", right: "right" };

/** Where a goat is from you, in words: "3 tiles to your left". */
function whereFrom(s: PuffState, at: Point): string {
  const pp = actorPos(s.player);
  let dx = at.x - pp.x;
  if (Math.abs(dx) > s.maze.width / 2) dx -= Math.sign(dx) * s.maze.width; // nearer through a tunnel
  const dy = at.y - pp.y;
  const d = Math.round(Math.abs(dx) + Math.abs(dy));
  const side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "to your left" : "to your right") : dy < 0 ? "above you" : "below you";
  return `${d} ${d === 1 ? "tile" : "tiles"} ${side}`;
}

/** Steps along the lanes to the nearest bowl of soup, or null if none is left. */
function soupSteps(s: PuffState): number | null {
  const { maze } = s;
  const key = (x: number, y: number) => y * maze.width + (((x % maze.width) + maze.width) % maze.width);
  const seen = new Set([key(s.player.x, s.player.y)]);
  let frontier: Point[] = [{ x: s.player.x, y: s.player.y }];
  for (let d = 0; frontier.length; d++) {
    const nextF: Point[] = [];
    for (const p of frontier) {
      if (s.items[key(p.x, p.y)] === 2) return d;
      for (const dir of DIRS) {
        const nx = p.x + VEC[dir].x; const ny = p.y + VEC[dir].y;
        if (!walkable(maze, nx, ny) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        nextF.push({ x: (((nx % maze.width) + maze.width) % maze.width), y: ny });
      }
    }
    frontier = nextF;
  }
  return null;
}

/** Nana's tip for a paused game: the way botDirection would ride, and why. Null when there's nothing to steer (game over, between lives). */
export function puffTip(s: PuffState): NanaTip | null {
  if (s.phase !== "playing" && s.phase !== "ready") return null;
  const dir = botDirection(s);
  if (!dir) return null;
  const move = `riding ${DIR_WORD[dir]}`;
  const hungry = hungryGoats(s);
  const near = hungry[0];
  const scared = s.goats.filter((g) => g.mode === "active" && g.scared).map((g) => ({ g, d: tileDist(s, actorPos(s.player), actorPos(g)) })).sort((a, b) => a.d - b.d)[0];
  if (scared && s.scaredMs > 1500 && scared.d <= SOUP_NEAR) {
    return { move: `going after ${scared.g.name}`, why: `${scared.g.name} is scared for ${Math.ceil(s.scaredMs / 1000)} s more and ${whereFrom(s, actorPos(scared.g))}: catch him for ${200 * 2 ** Math.min(s.chain, 3)}.` };
  }
  if (near && near.d <= 5) {
    const soup = soupSteps(s);
    const soupNote = soup !== null && soup <= 8 ? ` Pepper soup is ${soup} ${soup === 1 ? "step" : "steps"} away if he keeps coming.` : "";
    return { move, why: `${near.g.name} is ${whereFrom(s, actorPos(near.g))}, so that way keeps clear of him and on to more puff-puff.${soupNote}` };
  }
  const nx = (((s.player.x + VEC[dir].x) % s.maze.width) + s.maze.width) % s.maze.width;
  const what = s.items[(s.player.y + VEC[dir].y) * s.maze.width + nx] === 2 ? "a bowl of pepper soup" : "the nearest puff-puff";
  return { move, why: `It's the shortest way to ${what}, and ${near ? `the nearest goat, ${near.g.name}, is ${whereFrom(s, actorPos(near.g))}` : "no goat is out hunting yet"}.` };
}
