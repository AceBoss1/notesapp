// Notes Arcade tournaments, Phase 1 (docs/ARCADE_TOURNAMENTS.md §6; owner, 21 Nov 2026: "start tournaments"). The tournament itself and
// its rules, pure: no Firestore, no React. lib/arcade/tournaments-server.ts stores them; the pages and Admin read the same helpers.
//
// Format 1, "same deal": every entrant plays the same game against the computer from the same seed at the same level, up to `tries` times,
// and the best try counts (ranked by the game's own rank tuple, lib/arcade/tournament-games.ts compareRank).
//
// The rules that don't move (§1 and the owner's decisions of 21 Nov 2026, §8):
//   - only signed-in members with a confirmed email enter; entry is always free;
//   - prize tournaments are 18+ only (§8.2); a "practice" tournament (no prizes) lets teens in; kids' accounts never enter;
//   - the dashboard won't open a prize tournament for entries until admin has ticked the legal check (§8.5);
//   - Nana sits out tournaments (lib/arcade/nana.ts, mode "tournament").

// validateDraft takes the registry as an argument (the server passes TOURNAMENT_GAMES, tests their own). The public pages import only
// types from here, and lagosWhen from ./lagos-time, so their bundles don't carry every game's replay code.
import { compareRank, type TournamentGame } from "./tournament-games";
import { lagosWhen } from "./lagos-time";
import { listed, phase, type Phase } from "./tournament-phase";

export { lagosWhen, listed, phase };
export type { Phase };

export type TournamentStatus = "draft" | "open" | "closed" | "results";
/** "adults": 18+ only (every prize tournament). "practice": teens may play too, and there are no prizes (owner, 21 Nov 2026, §8.2). */
export type AgeRule = "adults" | "practice";
export type Sponsor = { name: string; logo: string; link: string; words: string };
export type Prize = { place: string; prize: string };

export type Tournament = {
  id: string;
  game: string; // a slug in TOURNAMENT_GAMES
  name: string;
  format: "same-deal";
  level: string; // one of the game's levels
  seed: number; // never shown before the tournament plays, except to admins
  tries: number; // 1–10, the best counts
  playFrom: string; // ISO
  playUntil: string; // ISO
  entryFrom?: string; // ISO: listed under "Coming up" from then (left out: as soon as it's opened)
  status: TournamentStatus;
  sponsor?: Sponsor;
  prizes: Prize[];
  prize: boolean; // a prize tournament
  ageRule: AgeRule;
  legalChecked: boolean; // §8.5
  resultsCheckedAt?: string;
  prizesSentAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // Counters kept by the server.
  entrants?: number;
  runs?: number;
  finished?: number;
  // views: the tournament page, once per visitor per Lagos day (owner, 24 Nov 2026: "page-view counts in the sponsor's report").
  sponsorStats?: { impressions?: number; clicks?: number; views?: number };
  // Who was told in Messages that they placed (§5; owner, 24 Nov 2026: "telling winners in Messages"), so nobody is told twice.
  winners?: Winner[];
  winnersNotifiedAt?: string; // the last time Admin told winners
};

/** One player told they placed: the place they were told, the prize (none in a tournament without prizes), when, and how. */
export type Winner = { uid: string; username: string; place: number; prize: string; at: string; dm: boolean };

/** What the public sees: everything but the seed, who made it, the internal ticks and counts, and the winners' account ids. */
export type PublicTournament = Omit<Tournament, "seed" | "createdBy" | "legalChecked" | "sponsorStats" | "runs" | "finished" | "winners"> & { phase: Phase };

export const publicTournament = (t: Tournament, now = new Date()): PublicTournament => {
  const { seed: _s, createdBy: _c, legalChecked: _l, sponsorStats: _st, runs: _r, finished: _f, winners: _w, ...rest } = t; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...rest, phase: phase(t, now) };
};

// Who may play a try. The server reads these from the account (users/{uid}, the token and the kids' uid prefix) inside its transaction.
export type Member = {
  signedIn: boolean;
  emailVerified: boolean;
  kid: boolean; // a kids' account (lib/kids.ts)
  teen: boolean;
  suspended: boolean;
  username: string;
};
export type Check = { ok: true } | { ok: false; status: number; message: string };


/** Can this member start a try now? (Tries left and the open run are the server's to check, from the entry.) */
export function canEnter(t: Tournament, m: Member, now = new Date()): Check {
  const no = (status: number, message: string): Check => ({ ok: false, status, message });
  if (!m.signedIn) return no(401, "Sign in to enter. Tournaments are for signed-in #NotesApp members (entry is free).");
  if (t.status === "draft") return no(404, "That tournament doesn't exist.");
  const p = phase(t, now);
  if (p === "upcoming") return no(409, `The ${t.name} starts ${lagosWhen(t.playFrom)} (Lagos time). Practise until then.`);
  if (p === "ended") return no(409, `The ${t.name} has ended. Watch the leaderboard for the results.`);
  // §8.5: never play a prize tournament that hasn't had its legal check, even if something opened it by hand.
  if (t.prize && !t.legalChecked) return no(409, `The ${t.name} isn't open yet.`);
  if (!m.emailVerified) return no(403, "Verify your email first (check your inbox), then play.");
  if (m.kid) return no(403, "Tournaments aren't open to kids' accounts.");
  if (m.suspended) return no(403, "Your account can't do that right now.");
  if (!m.username) return no(400, "Finish setting up your profile first.");
  if (m.teen && t.ageRule !== "practice") return no(403, "Prize tournaments are for members aged 18 and over. Look out for practice tournaments.");
  return { ok: true };
}

// ---- Admin drafts ----

export type TournamentDraft = Pick<Tournament, "game" | "name" | "level" | "tries" | "playFrom" | "playUntil" | "prizes" | "prize" | "ageRule" | "legalChecked"> & {
  entryFrom?: string;
  sponsor?: Sponsor;
};
export type DraftCheck = { ok: true; value: TournamentDraft } | { ok: false; error: string };

const MAX_WINDOW_DAYS = 31; // a Month package is the longest single tournament (§8.3); a Season is several tournaments
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isHttps = (v: string) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Checks what Admin sent and returns a clean draft. `games` is the registry (TOURNAMENT_GAMES; tests pass their own). */
export function validateDraft(input: unknown, games: readonly TournamentGame[]): DraftCheck {
  const bad = (error: string): DraftCheck => ({ ok: false, error });
  const x = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const game = games.find((g) => g.slug === x.game);
  if (!game) return bad("Pick a game that has tournaments.");
  const name = str(x.name, 80);
  if (name.length < 3) return bad("Give the tournament a name (3 to 80 characters).");
  const level = typeof x.level === "string" && x.level ? x.level : game.levels[0];
  if (!game.levels.includes(level)) return bad(`${game.name} tournaments can be played at: ${game.levels.join(", ")}.`);
  const tries = Number(x.tries);
  if (!Number.isInteger(tries) || tries < 1 || tries > 10) return bad("Tries must be a whole number from 1 to 10.");
  if (!isIso(x.playFrom) || !isIso(x.playUntil)) return bad("Set when play starts and ends.");
  const from = Date.parse(x.playFrom), until = Date.parse(x.playUntil);
  if (until <= from) return bad("Play must end after it starts.");
  if (until - from < 15 * 60_000) return bad("Give players at least 15 minutes.");
  if (until - from > MAX_WINDOW_DAYS * 86_400_000) return bad(`One tournament runs ${MAX_WINDOW_DAYS} days at most; run a Season as several tournaments.`);
  let entryFrom: string | undefined;
  if (x.entryFrom !== undefined && x.entryFrom !== null && x.entryFrom !== "") {
    if (!isIso(x.entryFrom)) return bad("The listing date isn't a date.");
    if (Date.parse(x.entryFrom) > from) return bad("List the tournament before play starts.");
    entryFrom = new Date(x.entryFrom).toISOString();
  }
  let sponsor: Sponsor | undefined;
  if (x.sponsor && typeof x.sponsor === "object") {
    const s = x.sponsor as Record<string, unknown>;
    const sp = { name: str(s.name, 60), logo: str(s.logo, 500), link: str(s.link, 500), words: str(s.words, 280) };
    if (sp.name || sp.logo || sp.link || sp.words) {
      if (!sp.name) return bad("Give the sponsor's name.");
      if (!sp.link || !isHttps(sp.link)) return bad("The sponsor's link must start with https://.");
      if (sp.logo && !isHttps(sp.logo) && !sp.logo.startsWith("/")) return bad("The sponsor's logo must be an https:// address (or a path on our site).");
      sponsor = sp;
    }
  }
  const prizes: Prize[] = [];
  if (x.prizes !== undefined && !Array.isArray(x.prizes)) return bad("Prizes must be a list.");
  for (const p of (Array.isArray(x.prizes) ? x.prizes : []).slice(0, 20)) {
    const pr = { place: str((p as Prize)?.place, 40), prize: str((p as Prize)?.prize, 200) };
    if (!pr.place && !pr.prize) continue;
    if (!pr.place || !pr.prize) return bad("Each prize needs a place (\"1st\") and what it is.");
    prizes.push(pr);
  }
  if (prizes.length > 10) return bad("Ten prizes at most.");
  const prize = x.prize === true;
  const ageRule: AgeRule = x.ageRule === "practice" ? "practice" : "adults";
  // §8.2: prize tournaments are 18+ only; practice tournaments (teens welcome) have no prizes.
  if (prize && ageRule !== "adults") return bad("Prize tournaments are for adults (18+) only. Make it a practice tournament with no prizes to let teens in.");
  if (!prize && prizes.length) return bad("Only a prize tournament lists prizes. Tick \"prize tournament\" or remove the prizes.");
  if (prize && !prizes.length) return bad("List the prizes before entry opens (§5): at least one.");
  return {
    ok: true,
    value: {
      game: game.slug, name, level, tries, playFrom: new Date(from).toISOString(), playUntil: new Date(until).toISOString(), prizes, prize, ageRule,
      legalChecked: x.legalChecked === true, ...(entryFrom ? { entryFrom } : {}), ...(sponsor ? { sponsor } : {}),
    },
  };
}

/** Why Admin can't open it yet, or null. §8.5: a prize tournament opens only after the legal check is ticked. */
export function openBlocker(t: Tournament, now = new Date()): string | null {
  if (t.status === "results") return "Results are out; this tournament is finished.";
  if (Date.parse(t.playUntil) <= now.getTime()) return "Its play window is over. Change the dates first.";
  if (t.prize && !t.legalChecked) return "Tick the legal check first: admin has checked the promotion-approval question and the Terms clause for tournaments (owner, 21 Nov 2026).";
  return null;
}

// ---- The leaderboard ----

export type Best = { rank: number[]; rankKey: string; summary: string; score: number; at: string };
/** Best first by the game's rank; on a tie, whoever got there first. */
export function sortEntries<T extends { best?: Best | null }>(entries: T[]): T[] {
  return entries.filter((e) => e.best).sort((a, b) => compareRank(b.best!.rank, a.best!.rank) || a.best!.at.localeCompare(b.best!.at));
}

/** "Wins first, then…": the line on the tournament page, from the game. */
export const rulesLine = (t: Pick<Tournament, "tries" | "prize" | "ageRule">) =>
  `Free entry; signed-in members${t.prize ? "; prize tournaments 18+" : t.ageRule === "practice" ? "; practice tournament, teens welcome, no prizes" : "; 18+"}. Best of ${t.tries} ${t.tries === 1 ? "try" : "tries"} counts. Nana sits out tournaments.`;
