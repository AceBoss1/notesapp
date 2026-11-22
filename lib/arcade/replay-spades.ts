// Ace of Spades in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and
// Puff-Puff"; docs/ARCADE_TOURNAMENTS.md §3: "Points over a set number of hands; same deals; computer partner and opponents"). Pure: no
// React, no Firestore.
//
// Every entrant plays the same SPADES_TOURNEY_HANDS hands. Hand 1 is dealt by mulberry32(tournament seed), and each later hand's deal
// comes from the seed the previous deal left in state.seed (lib/arcade/spades.ts startHand), which depends only on the tournament seed and
// never on how anyone played, so hand 3 is the same 52 cards for everybody. East deals first, so you bid and lead the first hand, and the
// deal moves round the table as in normal play. There's no target in a tournament (the game would otherwise stop at 250 and some entrants
// would play fewer hands than others): the try ends when the last hand's final trick is taken.
//
// The computer seats have one way of bidding and playing (computerBid / computerPlay read only the state; no Math.random), so the whole
// game follows from the seed plus the player's own bids and cards. That's all the browser records; the server replays the computer's
// turns, the dealing and the scoring between hands itself.
import {
  applyMove, computerMove, initialState, isLegal, mulberry32, type Card, type SpadesMove, type SpadesState, type Suit,
} from "./spades";
import type { ReplayResult, TournamentGame } from "./tournament-games";

/** The computer has a single strategy, so a Spades tournament has a single level. */
export const SPADES_LEVELS = ["standard"];
/** How many hands a tournament try lasts: long enough for skill to show over the luck of one deal, short enough for a coffee break. */
export const SPADES_TOURNEY_HANDS = 5;

/** The start both sides build: the browser to deal, the server to replay. Same seed, same deals, no target. */
export function spadesTourneyStart(seed: number, level: string): SpadesState {
  void level; // one level today; kept in the signature so a harder computer can be added without changing callers
  return initialState(mulberry32(seed), Infinity);
}

/** The try is over once the set number of hands has been scored. */
export const spadesTourneyOver = (s: SpadesState) => s.history.length >= SPADES_TOURNEY_HANDS;

// The recording: your bids and cards, in order, joined by commas, e.g. "b4,C12,C3,H14,…,b2,S9,…".
//   b<n>        bid n tricks (0 to 13)
//   <suit><r>   play that card: S H D C, then the rank 2–14 (11 jack, 12 queen, 13 king, 14 ace)
// Numbers are plain decimals with no leading zeros, so each game has exactly one spelling. "Next hand" isn't recorded: between hands
// the replay deals the next one itself, as the browser does when you press NEXT HAND.
const TOKEN = /^(?:b(?:[0-9]|1[0-3])|[SHDC](?:[2-9]|1[0-4]))$/;

export function encodeSpadesMove(m: SpadesMove): string {
  if (m.type === "bid") return `b${m.bid}`;
  if (m.type === "play") return `${m.card.suit}${m.card.rank}`;
  return ""; // "next" is never recorded
}

/** The moves in a recording, or null when it can't be read. An empty string is no moves. */
export function decodeSpadesMoves(recording: unknown): SpadesMove[] | null {
  if (typeof recording !== "string") return null;
  if (recording === "") return [];
  const out: SpadesMove[] = [];
  for (const t of recording.split(",")) {
    if (!TOKEN.test(t)) return null;
    if (t[0] === "b") out.push({ type: "bid", bid: Number(t.slice(1)) });
    else out.push({ type: "play", card: { suit: t[0] as Suit, rank: Number(t.slice(1)) } });
  }
  return out;
}

/**
 * Lets the computer seats bid and play, and deals the next hand between hands, until it's your turn or the try is over. The browser
 * does the same with pauses (and a NEXT HAND button between hands), so both reach your next turn in the identical state.
 */
export function spadesComputerTurns(s: SpadesState): SpadesState {
  let g = s;
  // At most 3 computer bids and 39 computer cards a hand, plus the deal; the cap is only a belt for the server.
  for (let i = 0; i < 500; i++) {
    if (spadesTourneyOver(g)) break;
    if (g.phase === "handOver") { g = applyMove(g, { type: "next" }); continue; }
    if (g.turn === 0 || (g.phase !== "bid" && g.phase !== "play")) break;
    g = applyMove(g, computerMove(g));
  }
  return g;
}

export type SpadesReplay = { ok: true; state: SpadesState; moves: number } | { ok: false; error: string };

const legal = (s: SpadesState, m: SpadesMove): boolean => {
  if (s.turn !== 0) return false;
  if (m.type === "bid") return s.phase === "bid";
  if (m.type === "play") return s.phase === "play" && isLegal(s, m.card as Card);
  return false;
};

/** Replays your bids and cards from the seed, the computer seats answering exactly as they do in the browser. */
export function replaySpades(seed: number, level: string, recording: unknown): SpadesReplay {
  const moves = decodeSpadesMoves(recording);
  if (!moves) return { ok: false, error: "That game couldn't be read." };
  let s = spadesComputerTurns(spadesTourneyStart(seed, level));
  for (const m of moves) {
    if (spadesTourneyOver(s)) return { ok: false, error: "That game carries on after it ended." };
    if (!legal(s, m)) return { ok: false, error: "That game has a move the rules don't allow." };
    s = spadesComputerTurns(applyMove(s, m));
  }
  return { ok: true, state: s, moves: moves.length };
}

/** Your team's totals so far: points, tricks taken, and the hands in which your team made its bid. */
export function spadesTeamTotals(s: SpadesState) {
  return {
    points: s.scores[0],
    theirs: s.scores[1],
    tricks: s.history.reduce((n, h) => n + h.tricks[0], 0),
    bidsMade: s.history.filter((h) => h.tricks[0] >= h.bids[0]).length,
  };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export const SPADES_TOURNAMENT: TournamentGame = {
  slug: "spades",
  name: "Ace of Spades",
  levels: SPADES_LEVELS,
  rankedBy: `Your team's points after ${SPADES_TOURNEY_HANDS} hands, then the most tricks your team took, then the most bids made`,
  // Per hand one bid ("b13,") and 13 cards ("C14,"): under 60 characters, so 5 hands fit in 300. 1,000 leaves room and nothing more.
  maxRecording: 1000,
  replay(seed, level, recording): ReplayResult {
    if (!SPADES_LEVELS.includes(level)) return { ok: false, error: "That level isn't one Ace of Spades has." };
    const r = replaySpades(seed, level, recording);
    if (!r.ok) return r;
    const s = r.state;
    const t = spadesTeamTotals(s);
    const finished = spadesTourneyOver(s);
    return {
      ok: true,
      finished,
      // Doc §3: points over the set hands; ties go to the team that took more tricks, then made more of its bids.
      rank: [t.points, t.tricks, t.bidsMade],
      summary: finished
        ? `Your team ${t.points} · them ${t.theirs} after ${plural(s.history.length, "hand")}`
        : `Unfinished, ${plural(s.history.length, "hand")} of ${SPADES_TOURNEY_HANDS} played`,
      score: t.points,
    };
  },
};
