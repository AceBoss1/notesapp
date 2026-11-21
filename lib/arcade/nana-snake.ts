// Nana for Snake (owner, 21 Nov 2026: "a free Nana for arcade … it won't be available for tournaments"). Snake has no pause and moves
// every tick, so there's no moment for a hint: Nana coaches after each run instead, from what ended it (a wall or your own tail), how
// long you'd grown and how fast it was going. Pure and tiny, so the game only has to hand over a few numbers when the run ends.
import type { NanaTake } from "./nana";

export type SnakeDir = "up" | "down" | "left" | "right";
export type SnakePace = "chill" | "classic" | "fast";

export const SNAKE_BOARD = 20;
const PACE_WORD: Record<SnakePace, string> = { chill: "chill", classic: "classic", fast: "fast" };
const WALL_NAME: Record<SnakeDir, string> = { up: "top", down: "bottom", left: "left", right: "right" };

export type SnakeStats = {
  cause: "wall" | "self";
  heading: SnakeDir; // the way the head was going when it hit
  length: number;
  score: number;
  bestBefore: number;
  pace: SnakePace;
  intervalMs: number; // ms per move at the end
  foodOnEdge: boolean; // the snack sat against a wall
};

/** Is this square against a wall of the 20 × 20 board? */
export const onSnakeEdge = (p: { x: number; y: number }) => p.x === 0 || p.y === 0 || p.x === SNAKE_BOARD - 1 || p.y === SNAKE_BOARD - 1;

/** The board's speed-up: level goes up every 50 points (the game's own rule, in SnakeGame.tsx). */
export const snakeLevel = (score: number) => Math.floor(score / 50) + 1;

/** Nana's take on the last run, or a welcome before the first. */
export function snakeCoach(st: SnakeStats | null): NanaTake {
  if (!st) return { text: "Eat, grow, don't bump. After each run I'll tell you what ended it and how to last longer.", tone: "fine" };
  const parts: string[] = [];
  const best = st.score > st.bestBefore && st.bestBefore > 0;
  if (best) parts.push(`New best: ${st.score}.`);
  if (st.cause === "wall") {
    parts.push(`You ran into the ${WALL_NAME[st.heading]} wall at length ${st.length}.`);
    parts.push(st.foodOnEdge
      ? "The snack was by the wall: come at edge snacks along the wall, not straight at it, so there's room to turn."
      : `Turn a square early near the edges: at ${PACE_WORD[st.pace]} speed you move every ${st.intervalMs} ms.`);
  } else if (st.length < 10) {
    parts.push(`You bit your own tail at length ${st.length}.`);
    parts.push("That's usually a quick U-turn: you can't reverse, so turn one square wider.");
  } else {
    parts.push(`At length ${st.length} your own tail got you.`);
    parts.push("Now your body is the danger: sweep the board in wide rows, back and forth, and keep an open path to the free side.");
  }
  const level = snakeLevel(st.score);
  if (level >= 3 && parts.length < 3) parts.push(`It speeds up every 50 points; you reached level ${level}.`);
  const tone: NanaTake["tone"] = best || st.score >= 200 ? "good" : st.score < 50 ? "risky" : "fine";
  return { text: parts.slice(0, 3).join(" "), tone };
}
