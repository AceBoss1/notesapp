"use client";

// A practice loss, by the computer player that won (owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top human").
// The games only kept wins; this adds one small saved map per game, arcade-<slug>-lost = { "<computer>": losses }, so the server can
// credit that computer a win on the game's leaderboard (lib/arcade/boards.ts). Nothing in the game reads it back, so play is unchanged.
// Tournament games never call this: they aren't practice.
import { arcadeStore } from "./store";
import { lostKey } from "./boards";

export function recordLoss(slug: string, npc: string): void {
  try {
    const key = lostKey(slug);
    let map: Record<string, number> = {};
    try {
      const o = JSON.parse(arcadeStore.getItem(key) || "{}");
      if (o && typeof o === "object" && !Array.isArray(o)) map = o;
    } catch { /* a bad value starts afresh */ }
    map[npc] = (Number(map[npc]) || 0) + 1;
    arcadeStore.setItem(key, JSON.stringify(map));
  } catch { /* storage blocked: the game goes on */ }
}
