// Where a tournament is in time, and whether the public may see it. Its own file (re-exported by lib/arcade/tournaments.ts) so the share
// card, the page's title and the sitemap (lib/arcade/tournament-share-server.ts) can use them without loading lib/arcade/tournaments.ts,
// which reaches the game registry and every game's replay code.
import type { Tournament } from "./tournaments";

export type Phase = "upcoming" | "playing" | "ended";

/** Where a tournament is in time. A closed tournament (or one with results) has ended whatever the clock says; a draft is never playing. */
export function phase(t: Pick<Tournament, "playFrom" | "playUntil" | "status">, now = new Date()): Phase {
  if (t.status === "closed" || t.status === "results") return "ended";
  const n = now.getTime();
  if (n < Date.parse(t.playFrom)) return "upcoming";
  if (n < Date.parse(t.playUntil)) return t.status === "open" ? "playing" : "upcoming";
  return "ended";
}

/** Shown on the public list: open, closed or with results (never a draft), and an open one only from its entryFrom. */
export function listed(t: Pick<Tournament, "status" | "entryFrom">, now = new Date()): boolean {
  if (t.status === "draft") return false;
  if (t.status === "open" && t.entryFrom && now.getTime() < Date.parse(t.entryFrom)) return false;
  return true;
}
