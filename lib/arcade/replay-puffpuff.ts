// Placeholder: replaced by the real replay for Puff-Puff Rush (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const PUFFPUFF_TOURNAMENT: TournamentGame = {
  slug: "puffpuff", name: "Puff-Puff Rush", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
