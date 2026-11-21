// Naija Run in tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md §3, "Same deal"). A thin wrapper over
// lib/arcade/run-replay.ts, the replay the DAVIDO-at-34 tournament already scores with, so a run is checked exactly the same way in both.
// Same seed, same street: every entrant meets the same obstacles at the same speed; the recording is every step's time and input.
import { MAX_STEPS, replayRun } from "./run-replay";
import type { Speed } from "./run";
import type { ReplayResult, TournamentGame } from "./tournament-games";

// "normal" first: it's the default, and the speed the DAVIDO tournament ran at.
export const RUN_LEVELS: Speed[] = ["normal", "chill", "fast"];

const n = (x: number) => x.toLocaleString("en-US");

export const RUN_TOURNAMENT: TournamentGame = {
  slug: "run",
  name: "Naija Run",
  levels: RUN_LEVELS,
  rankedBy: "Highest score, then the furthest run",
  // Each step is at most four characters ("250,"), and run-replay.ts refuses more than MAX_STEPS steps.
  maxRecording: MAX_STEPS * 4,
  replay(seed, level, recording): ReplayResult {
    if (!(RUN_LEVELS as string[]).includes(level)) return { ok: false, error: "That speed isn't one Naija Run has." };
    const r = replayRun(seed, level as Speed, recording);
    if (!r.ok) return r;
    return {
      ok: true,
      finished: r.state.over, // a run ends at the crash; one sent before it is unfinished
      rank: [r.score, r.metres],
      summary: `${n(r.score)} points · ${n(r.metres)} m`,
      score: r.score,
      ms: r.ms,
    };
  },
};
