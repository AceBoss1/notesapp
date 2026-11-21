// Placeholder: replaced by the real replay for Chess (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const CHESS_TOURNAMENT: TournamentGame = {
  slug: "chess", name: "Chess", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
