// Naija Run, recorded and replayed (owner, 21 Nov 2026: the DAVIDO-at-34 tournament runs tonight). Pure: the browser records every step of a
// tournament run as one number, and the server replays the whole run with the same code to work out the score itself, so a made-up score
// can't pass (docs/ARCADE_TOURNAMENTS.md, "Same deal"). In a recorded run the step time is whole milliseconds on both sides.
import { createRun, score, step, type RunInput, type RunState, type Speed } from "./run";

export const RUN_INPUTS: RunInput[] = ["none", "left", "right", "jump", "slide"];
export const MAX_STEP_MS = 50; // the game never steps more than this per frame
export const MAX_STEPS = 200_000; // over 2 hours of frames: far more than any run lasts

// One step: the time (1–50 ms) and the input, as dt × 5 + input.
export const encodeStep = (dtMs: number, input: RunInput) => Math.min(MAX_STEP_MS, Math.max(1, Math.round(dtMs))) * 5 + Math.max(0, RUN_INPUTS.indexOf(input));
export const stepDt = (dtMs: number) => Math.min(MAX_STEP_MS, Math.max(1, Math.round(dtMs)));

export type Replay = { ok: true; state: RunState; score: number; metres: number; coins: number; ms: number } | { ok: false; error: string };

// Replays a recording ("85,85,88,…") from the seed. The recording must stop at the crash: nothing is accepted after the run is over.
export function replayRun(seed: number, level: Speed, recording: unknown): Replay {
  if (typeof recording !== "string" || !/^\d{1,3}(,\d{1,3})*$/.test(recording)) return { ok: false, error: "That run couldn't be read." };
  const codes = recording.split(",");
  if (codes.length > MAX_STEPS) return { ok: false, error: "That run is too long." };
  let s = createRun(seed, level);
  let ms = 0;
  for (let i = 0; i < codes.length; i++) {
    if (s.over) return { ok: false, error: "That run carries on after the crash." };
    const n = Number(codes[i]);
    const dt = Math.floor(n / 5); const input = RUN_INPUTS[n % 5];
    if (dt < 1 || dt > MAX_STEP_MS) return { ok: false, error: "That run couldn't be read." };
    s = step(s, dt, input);
    ms += dt;
  }
  return { ok: true, state: s, score: score(s), metres: Math.floor(s.distance), coins: s.coins, ms };
}
