// Placeholder: replaced by the real replay for Achi (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const ACHI_TOURNAMENT: TournamentGame = {
  slug: "achi", name: "Achi", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
