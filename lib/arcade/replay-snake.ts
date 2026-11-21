// Placeholder: replaced by the real replay for Snake (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const SNAKE_TOURNAMENT: TournamentGame = {
  slug: "snake", name: "Snake", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
