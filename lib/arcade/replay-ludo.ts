// Placeholder: replaced by the real replay for Ludo (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const LUDO_TOURNAMENT: TournamentGame = {
  slug: "ludo", name: "Ludo", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
