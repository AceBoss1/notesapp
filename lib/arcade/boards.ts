// Per-game leaderboards for Notes Arcade (owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top human, then shares
// same notesville rich list"; 24 Nov 2026: "build ... per-game leaderboards"; docs/ARCADE_TOURNAMENTS.md §4). Pure and client-safe:
// the server (lib/arcade/boards-server.ts) and the tests use the same rules.
//
// Where the numbers come from. A signed-in member's practice progress is saved by /api/arcade/progress as small text values
// (arcadeProgress/{uid}.kv, lib/arcade/progress.ts). Each save, the server reads each game's record out of that kv with the rules
// below. Practice records are reported by the browser, so they are never taken at face value:
//   - an absolute cap per game (nothing past what the game can really score, or a lifetime nobody plays);
//   - a cap on growth per save (a win takes a whole game; a save is sent 0.8 s after a change), and a cap per Lagos day;
//   - counts (wins, losses) are credited from the change since the last save, never from the number the browser sends; the first save
//     after boards existed credits up to `firstSave` of the wins already saved (history from before the boards);
//   - guests are never on a board (they have no saves), and child profiles never get a row (lib/arcade/boards-server.ts).
// Tournaments keep their own verified boards (lib/arcade/tournaments-server.ts); these boards don't mix the two.
//
// Computer players 🤖. Board and card games: each computer opponent (by the name the game already gives it, else by level) is credited
// a win whenever a member's saved loss against it goes up (the `arcade-<slug>-lost` map that the games save through
// lib/arcade/record-loss.ts; Whot and Ace of Spades already kept a won/lost record against their one computer side). Action games
// (Snake, Naija Run, Puff-Puff) have no opponent to beat you, so their 🤖 column is the game's own autopilot, scored on a fixed seed
// (lib/arcade/boards-bots.ts).

export type Metric = "wins" | "best";
export type Caps = {
  max: number; // the most a record can ever be
  perSave: number; // the most one save can add
  firstSave: number; // wins games: the most credited from history on a member's first row
  perDay: number; // the most a record can grow in one Lagos day
};
export type Npc = { id: string; name: string };
export type Claim = { value: number; wins?: number; losses?: number };
export type BoardRule = {
  slug: string;
  metric: Metric;
  label: string; // "Wins vs the computer" / "Best score"
  keys: string[]; // the kv keys this game's record is read from (a save touching none of them leaves the board alone)
  claim: (kv: Record<string, string>) => Claim;
  lost: (kv: Record<string, string>) => Record<string, number>; // saved losses, by computer player
  npcs: Npc[];
  caps: Caps;
};

// Computers credited per member save, and per member per day: a loss takes a whole game too.
export const NPC_PER_SAVE = 3;
export const NPC_PER_DAY = 60;
export const PEOPLE_SHOWN = 20;
export const NPCS_SHOWN = 5;

const WINS_CAPS: Caps = { max: 100_000, perSave: 3, firstSave: 50, perDay: 60 };

/** A whole, non-negative number from a saved value; anything else is 0. */
export function count(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d{1,12}\s*$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function json(v: string | undefined): Record<string, unknown> {
  if (!v) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The key a game keeps its losses in, by computer player: { "hard": 3, "chidi": 1 } (lib/arcade/record-loss.ts writes it). */
export const lostKey = (slug: string) => `arcade-${slug}-lost`;

/** A saved losses map, cleaned: only the game's own computer players, whole numbers. */
export function lostMap(v: string | undefined, npcs: Npc[]): Record<string, number> {
  const o = json(v);
  const out: Record<string, number> = {};
  for (const n of npcs) if (o[n.id] !== undefined) out[n.id] = count(o[n.id]);
  return out;
}
const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

const LEVEL_NPCS = (what: string): Npc[] => [
  { id: "easy", name: `${what} · Easy` },
  { id: "medium", name: `${what} · Medium` },
  { id: "hard", name: `${what} · Hard` },
];

// Wins counted in plain number keys, losses in the lost map.
function winsGame(slug: string, winKeys: string[], npcs: Npc[]): BoardRule {
  const lk = lostKey(slug);
  return {
    slug, metric: "wins", label: "Wins vs the computer", keys: [...winKeys, lk], npcs, caps: WINS_CAPS,
    lost: (kv) => lostMap(kv[lk], npcs),
    claim: (kv) => {
      const wins = winKeys.reduce((a, k) => a + count(kv[k]), 0);
      return { value: wins, wins, losses: sum(lostMap(kv[lk], npcs)) };
    },
  };
}

// Whot and Ace of Spades: one JSON record { won, lost } against their one computer side (no level in practice).
function recordGame(slug: string, key: string, npc: Npc): BoardRule {
  return {
    slug, metric: "wins", label: "Wins vs the computer", keys: [key], npcs: [npc], caps: WINS_CAPS,
    lost: (kv) => (kv[key] === undefined ? {} : { [npc.id]: count(json(kv[key]).lost) }),
    claim: (kv) => {
      const r = json(kv[key]);
      return { value: count(r.won), wins: count(r.won), losses: count(r.lost) };
    },
  };
}

// Action games: the best score in any of the keys (Naija Run keeps one per speed).
function bestGame(slug: string, keys: string[], npcs: Npc[], caps: Omit<Caps, "firstSave">): BoardRule {
  return {
    slug, metric: "best", label: "Best score", keys, npcs, caps: { ...caps, firstSave: caps.perSave },
    lost: () => ({}),
    claim: (kv) => ({ value: Math.max(0, ...keys.map((k) => count(kv[k]))) }),
  };
}

// Snake: 20 × 20 board, 3 squares to start, 10 a snack, so 3,970 fills the board (lib/arcade/snake.ts).
export const SNAKE_MAX = (20 * 20 - 3) * 10;

export const BOARD_RULES: BoardRule[] = [
  bestGame("snake", ["arcade-snake-best"], [
    { id: "chill", name: "Autopilot · Chill" }, { id: "classic", name: "Autopilot · Classic" }, { id: "fast", name: "Autopilot · Fast" },
  ], { max: SNAKE_MAX, perSave: 1_500, perDay: SNAKE_MAX }),
  // Ludo: the computers are the colours they play (components/games/LudoGame.tsx NAMES); in 2 v 2 the computer may hold Green.
  winsGame("ludo", ["notes-arcade-ludo-wins"], [{ id: "green", name: "Green" }, { id: "coral", name: "Coral" }, { id: "gold", name: "Gold" }, { id: "blue", name: "Blue" }]),
  recordGame("whot", "notes-arcade-whot-record", { id: "computer", name: "The computer" }),
  recordGame("spades", "notes-arcade-spades-record", { id: "eastwest", name: "East & West" }),
  // Naija Landlord: the three computer landlords (lib/arcade/landlord.ts NAMES).
  winsGame("landlord", ["notes-arcade-landlord-wins"], [{ id: "chidi", name: "Chidi" }, { id: "amaka", name: "Amaka" }, { id: "tunde", name: "Tunde" }]),
  // Ncho and Aka-Hausa: the 2-player and 4-player wins together; the computers by level (all three seats share the level in 4 players).
  winsGame("ncho", ["arcade-ncho-wins", "arcade-ncho-wins-4p"], LEVEL_NPCS("Computer")),
  winsGame("akahausa", ["arcade-akahausa-wins", "arcade-akahausa-wins-4p"], LEVEL_NPCS("Computer")),
  // Chess keeps its wins inside its saved choices { level, side, wins }.
  (() => {
    const base = winsGame("chess", [], LEVEL_NPCS("Computer"));
    return {
      ...base,
      keys: ["notes-arcade-chess", lostKey("chess")],
      claim: (kv: Record<string, string>) => {
        const wins = count(json(kv["notes-arcade-chess"]).wins);
        return { value: wins, wins, losses: sum(base.lost(kv)) };
      },
    };
  })(),
  winsGame("draughts", ["arcade-draughts-wins"], LEVEL_NPCS("Computer")),
  winsGame("achi", ["arcade-achi-wins"], LEVEL_NPCS("Computer")),
  // Naija Run: a run has no end, so the cap is generous (the autopilot makes about 6,000 in a 3-minute fast run).
  bestGame("run", ["notes-arcade-run-best-chill", "notes-arcade-run-best-normal", "notes-arcade-run-best-fast"], [
    { id: "chill", name: "Autopilot · Chill" }, { id: "normal", name: "Autopilot · Normal" }, { id: "fast", name: "Autopilot · Fast" },
  ], { max: 250_000, perSave: 25_000, perDay: 75_000 }),
  bestGame("puffpuff", ["arcade-puffpuff-best"], [
    { id: "chill", name: "Autopilot · Chill" }, { id: "normal", name: "Autopilot · Normal" }, { id: "fast", name: "Autopilot · Fast" },
  ], { max: 500_000, perSave: 40_000, perDay: 120_000 }),
];

export const boardRule = (slug: string) => BOARD_RULES.find((r) => r.slug === slug);

/** The games a save touches: any of their keys in the update. */
export const touchedBoards = (update: Record<string, string>) => BOARD_RULES.filter((r) => r.keys.some((k) => k in update));

/** The Lagos calendar day (UTC+1, no summer time) for the daily caps. */
export const lagosDay = (now: Date) => new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);

export type PersonRecord = { value: number; wins?: number; losses?: number; day: string; dayGain: number; dayNpc: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * One save, one game: the member's new record (null when there's nothing to keep) and the wins to credit each computer player.
 * `prev` is the member's row as it was (null before their first), `before`/`after` the saved kv either side of this save.
 */
export function creditSave(rule: BoardRule, prev: PersonRecord | null, before: Record<string, string>, after: Record<string, string>, today: string):
  { record: PersonRecord | null; npc: Record<string, number> } {
  const { caps } = rule;
  const was = rule.claim(before), now = rule.claim(after);
  const sameDay = prev?.day === today;
  const dayGain = sameDay ? prev!.dayGain : 0;
  const dayNpc = sameDay ? prev!.dayNpc : 0;
  const prevValue = clamp(count(prev?.value), 0, caps.max);
  const roomToday = Math.max(0, caps.perDay - dayGain);
  let value: number;
  const record: PersonRecord = { value: 0, day: today, dayGain, dayNpc };
  if (rule.metric === "wins") {
    const gain = prev ? clamp(now.value - was.value, 0, caps.perSave) : Math.min(now.value, caps.firstSave);
    value = prevValue + Math.min(gain, roomToday, caps.max - prevValue);
    // Losses are only shown, never ranked: the same change-since-last-save rule, without the daily cap.
    const prevLosses = clamp(count(prev?.losses), 0, caps.max);
    const lossGain = prev ? clamp((now.losses ?? 0) - (was.losses ?? 0), 0, caps.perSave) : Math.min(now.losses ?? 0, caps.firstSave);
    record.wins = value;
    record.losses = Math.min(caps.max, prevLosses + lossGain);
  } else {
    // A best score: a new best counts once it's in the save, climbing at most perSave a save and perDay a day, never past max.
    value = Math.max(prevValue, Math.min(now.value, caps.max, prevValue + caps.perSave, prevValue + roomToday));
  }
  record.value = value;
  record.dayGain = dayGain + (value - prevValue);

  // Computer players: the rise in each saved loss count since the last save, NPC_PER_SAVE at most a save, NPC_PER_DAY a day.
  const npc: Record<string, number> = {};
  let budget = Math.min(NPC_PER_SAVE, Math.max(0, NPC_PER_DAY - dayNpc));
  const lostBefore = rule.lost(before), lostAfter = rule.lost(after);
  for (const n of rule.npcs) {
    const d = Math.min(budget, Math.max(0, (lostAfter[n.id] ?? 0) - (lostBefore[n.id] ?? 0)));
    if (d > 0) { npc[n.id] = d; budget -= d; }
  }
  record.dayNpc = dayNpc + sum(npc);

  const keep = !!prev || record.value > 0 || (record.losses ?? 0) > 0 || record.dayNpc > dayNpc;
  return { record: keep ? record : null, npc };
}

// What the API returns (GET /api/arcade/boards/[slug]).
export type BoardNpcRow = { id: string; name: string; value: number };
export type BoardPersonRow = { rank: number; name: string; username: string; value: number; wins?: number; losses?: number; you?: boolean };
export type BoardView = {
  game: string;
  metric: Metric;
  label: string;
  npcLabel: string; // what the 🤖 number means
  npcs: BoardNpcRow[];
  people: BoardPersonRow[];
  // hidden: the viewer is in teen mode (or kept hidden), so only they and friends who follow them back see their row.
  me?: { rank: number | null; value: number; hidden?: true } | null;
};
