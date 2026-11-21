// Placeholder: replaced by the real replay for Ncho (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const NCHO_TOURNAMENT: TournamentGame = {
  slug: "ncho", name: "Ncho", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};

// Aka-Hausa: the same game sown clockwise; its own tournament entry (same file, so both stay in step).
export const AKAHAUSA_TOURNAMENT: TournamentGame = { ...NCHO_TOURNAMENT, slug: "akahausa", name: "Ncho Aka-Hausa" };
