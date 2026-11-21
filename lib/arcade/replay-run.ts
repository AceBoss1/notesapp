// Placeholder: replaced by the real replay for Naija Run (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const RUN_TOURNAMENT: TournamentGame = {
  slug: "run", name: "Naija Run", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
