// Placeholder: replaced by the real replay for Whot (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const WHOT_TOURNAMENT: TournamentGame = {
  slug: "whot", name: "Whot", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
