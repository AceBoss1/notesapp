// Placeholder: replaced by the real replay for Ace of Spades (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const SPADES_TOURNAMENT: TournamentGame = {
  slug: "spades", name: "Ace of Spades", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
