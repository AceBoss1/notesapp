// Naija Landlord in tournaments (owner, 21 Nov 2026: "add tournament versions of Ludo, Ncho, Landlord, Spades, Draughts, Achi and
// Puff-Puff"; docs/ARCADE_TOURNAMENTS.md §3, "Same deal"). Pure: no React, no Firestore.
//
// One setup for every tournament: the normal game, you against three computer landlords (Chidi, Amaka, Tunde), you roll first, and the
// game's own cap of ROUND_CAP (80) rounds, after which the richest by net worth wins. So every try ends in bounded time. A try also
// ends the moment you go bankrupt: your placing is settled then, and the computers playing on would change nothing about your result.
//
// Dice and cards: every roll in the game happens at a distinct (round, whose turn, doubles already thrown this turn), so each roll's
// random numbers come from mulberry32(the tournament seed mixed with those three). The dice, and any Market or Fortune card drawn on the
// square they lead to, are the same for every entrant at the same point in the game, and the browser and the server agree without
// keeping a count. The computers' choices come from lib/arcade/landlord.ts aiAction, which reads only the state, so the whole game
// follows from the seed plus your own decisions. That's all the browser records.
import { ROUND_CAP, aiAction, applyAction, createGame, legalActions, netWorth, type Action, type State } from "./landlord";
import type { ReplayResult, TournamentGame } from "./tournament-games";

/** The computers have a single strategy, so a Landlord tournament has a single level. */
export const LANDLORD_LEVELS = ["standard"];

/** Players at the table: you and three computers, the game's default. */
export const LANDLORD_TOURNEY_PLAYERS = 4;

/** The start both sides build: the browser to play, the server to replay. */
export function landlordTourneyStart(seed: number, level: string): State {
  void seed; // the board starts empty; the seed decides the dice and cards (landlordTourneyRng)
  void level; // one level today; kept in the signature so a harder computer can be added without changing callers
  return createGame(() => 0, LANDLORD_TOURNEY_PLAYERS);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The random numbers for the next action from this state (only a roll uses any: its dice, then any card it leads to). */
export function landlordTourneyRng(seed: number, s: State): () => number {
  let h = seed >>> 0;
  for (const n of [s.round, s.turn, s.doubles]) {
    h = Math.imul(h ^ (n + 0x9e3779b9), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return mulberry32(h);
}

/** Your try is over: the game ended (last landlord standing or the round cap), or you went bankrupt. */
export const landlordTourneyOver = (s: State) => s.phase === "over" || s.players[0].out;

/** Plays the computers' turns until it's your move or your try is over. The browser does the same, one action at a time. */
export function landlordComputerTurns(seed: number, s: State): State {
  let g = s;
  // Every computer action is a roll (the round count only grows, to the cap), a buy or skip, or a flat (cash only shrinks), so this
  // ends; the iteration cap is only a belt for the server.
  for (let i = 0; i < 100000 && !landlordTourneyOver(g) && g.turn !== 0; i++) g = applyAction(g, aiAction(g), landlordTourneyRng(seed, g));
  return g;
}

// The recording: your decisions joined by commas, e.g. "r,b,r,s,12,r".
//   r          roll the dice
//   b          buy the plot or park you're standing on
//   s          skip buying it
//   a number   build a flat on that square (0-31, plain decimals with no leading zeros, so each game has exactly one spelling)
const TOKEN = /^(?:r|b|s|0|[1-9]|[12]\d|3[01])$/;

export function encodeLandlordAction(a: Action): string {
  if (a.type === "roll") return "r";
  if (a.type === "buy") return "b";
  if (a.type === "skip") return "s";
  return String(a.square);
}

/** The decisions in a recording, or null when it can't be read. An empty string is no decisions. */
export function decodeLandlordActions(recording: unknown): Action[] | null {
  if (typeof recording !== "string") return null;
  if (recording === "") return [];
  const out: Action[] = [];
  for (const t of recording.split(",")) {
    if (!TOKEN.test(t)) return null;
    out.push(t === "r" ? { type: "roll" } : t === "b" ? { type: "buy" } : t === "s" ? { type: "skip" } : { type: "build", square: Number(t) });
  }
  return out;
}

const same = (a: Action, b: Action) => a.type === b.type && (a.type !== "build" || (b.type === "build" && a.square === b.square));

export type LandlordReplay = { ok: true; state: State; moves: number } | { ok: false; error: string };

/** Replays your decisions from the seed, the computers answering exactly as they do in the browser. */
export function replayLandlord(seed: number, level: string, recording: unknown): LandlordReplay {
  const actions = decodeLandlordActions(recording);
  if (!actions) return { ok: false, error: "That game couldn't be read." };
  let s = landlordComputerTurns(seed, landlordTourneyStart(seed, level));
  for (const a of actions) {
    if (landlordTourneyOver(s)) return { ok: false, error: "That game carries on after it ended." };
    if (!legalActions(s).some((l) => same(l, a))) return { ok: false, error: "That game has a move the rules don't allow." };
    s = landlordComputerTurns(seed, applyAction(s, a, landlordTourneyRng(seed, s)));
  }
  return { ok: true, state: s, moves: actions.length };
}

/** N$ in the game's thousands, short: N$850k, N$4.2m. Notesville money, never real naira. */
export function landlordMoney(k: number): string {
  if (k < 1000) return `N$${k}k`;
  const m = Math.round(k / 100) / 10;
  return `N$${Number.isInteger(m) ? m : m.toFixed(1)}m`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export const LANDLORD_TOURNAMENT: TournamentGame = {
  slug: "landlord",
  name: "Naija Landlord",
  levels: LANDLORD_LEVELS,
  rankedBy: `Wins first (last landlord standing, or the richest by net worth after ${ROUND_CAP} rounds), then still standing, then net worth, then the fewest rounds; going bankrupt later beats going bankrupt sooner. You against three computer landlords`,
  // Up to three characters a decision and a handful of decisions a round: 80 rounds stay well under 4,000 characters.
  maxRecording: 6000,
  replay(seed, level, recording): ReplayResult {
    if (!LANDLORD_LEVELS.includes(level)) return { ok: false, error: "That level isn't one Naija Landlord has." };
    const r = replayLandlord(seed, level, recording);
    if (!r.ok) return r;
    const s = r.state;
    const finished = landlordTourneyOver(s);
    const out = s.players[0].out;
    const won = s.phase === "over" && s.winner === 0;
    const worth = netWorth(s, 0);
    const rounds = s.round;
    // Doc §3: the win first, then net worth, then the fewest rounds. A bankrupt try has no net worth, so between two of those the one
    // that lasted longer ranks higher (and any landlord still standing ranks above any bankrupt one).
    const rank = out ? [0, 0, 0, rounds] : [won ? 1 : 0, 1, worth, -rounds];
    // Points for the leaderboard, never out of order with `rank`: a win is 1,000,000 plus net worth (in N$k), a landlord still standing
    // at the end 1,000 plus net worth, and a bankruptcy the round it came in (at most 80).
    const score = out ? rounds : (won ? 1_000_000 : 1_000) + Math.min(worth, 998_999);
    const summary = !finished
      ? `Unfinished, net worth ${landlordMoney(worth)} in round ${rounds}`
      : out
        ? `Bankrupt in round ${rounds}`
        : won
          ? `Won · net worth ${landlordMoney(worth)} in ${plural(rounds, "round")}`
          : `Lost to ${s.players[s.winner ?? 1].name} · net worth ${landlordMoney(worth)} after ${plural(rounds, "round")}`;
    return { ok: true, finished, rank, summary, score };
  },
};
