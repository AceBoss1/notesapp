// Placeholder: replaced by the real replay for Draughts (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const DRAUGHTS_TOURNAMENT: TournamentGame = {
  slug: "draughts", name: "Draughts", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
