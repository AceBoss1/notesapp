// Placeholder: replaced by the real replay for Naija Landlord (see lib/arcade/tournament-games.ts).
import type { TournamentGame } from "./tournament-games";

export const LANDLORD_TOURNAMENT: TournamentGame = {
  slug: "landlord", name: "Naija Landlord", levels: ["medium"], rankedBy: "", maxRecording: 0,
  replay: () => ({ ok: false, error: "Not ready yet." }),
};
