// Nana in Notes Arcade (owner, 21 Nov 2026): "a free Nana for arcade [that won't cost us nor the players] where Nana suggests moves or
// analyze opponent moves, it won't be available for tournaments, mostly friendly trainings and competing player to player can have it
// turned off in their duel rules".
//
// Free means no AI service at all: every hint and every comment comes from the game's own engine running in the player's browser (the
// same code the computer opponent plays with), so a hint costs nothing to us or to the player and works offline. Pure: no React or DOM.
//
// When Nana may help:
//   - Practice against the computer: yes, unless the player switches her off for that game (remembered per game).
//   - Tournaments: never. The tournament pages don't show her at all.
//   - Player-to-player duels (coming): only when the duel's rules allow her (`DuelRules.nana`); both players see the same rule, and the
//     person who sets up the duel chooses. Off by default for a duel, so nobody gets help the other didn't agree to.

export type NanaContext =
  | { mode: "practice" } // against the computer
  | { mode: "tournament" }
  | { mode: "duel"; rules: DuelRules };

/** The rules two players agree before a duel. Only Nana for now; more (time per move, rematch) come with player-to-player. */
export type DuelRules = { nana: boolean };
export const DEFAULT_DUEL_RULES: DuelRules = { nana: false };

export type NanaAvailability = { available: true } | { available: false; reason: string };

export function nanaAvailability(ctx: NanaContext): NanaAvailability {
  if (ctx.mode === "tournament") return { available: false, reason: "Nana sits out tournaments, so everyone plays on their own." };
  if (ctx.mode === "duel" && !ctx.rules.nana) return { available: false, reason: "Nana is off in this duel's rules." };
  return { available: true };
}

/** A hint: what Nana would play, in words, and why. The game highlights the move itself. */
export type NanaTip = { move: string; why: string };

/** Nana's take on a move someone just made: what it was for, and how it compares with what she'd have played. */
export type NanaTake = { text: string; tone: "good" | "fine" | "risky" };

/** Where a player's on/off choice for Nana is kept (in the Arcade store, so members keep it across visits). */
export const nanaKey = (slug: string) => `arcade-nana-${slug}`;

/**
 * How a move compares with the best one, from scores the engine gives both (higher is better for the mover).
 * `margin` is how far below the best still counts as fine.
 */
export function rateMove(score: number, best: number, margin: number): NanaTake["tone"] {
  if (score >= best) return "good";
  return best - score <= margin ? "fine" : "risky";
}

/** Join reasons into one sentence: ["a", "b", "c"] → "a, b and c". */
export function listText(parts: string[]): string {
  const p = parts.filter(Boolean);
  if (p.length <= 1) return p[0] ?? "";
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}
