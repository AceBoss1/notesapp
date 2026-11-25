import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes, randomInt } from "crypto";
import { isKidUid } from "../kids";
import { TOURNAMENT_GAMES, compareRank, rankKey, tournamentGame, type TournamentGame } from "./tournament-games";
import {
  canEnter, listed, openBlocker, phase, publicTournament, validateDraft, type Best, type PublicTournament, type ResultsPost, type Tournament, type Winner,
} from "./tournaments";
import { ARCADE_GAMES } from "./catalogue";
import { ordinal, winnerBell, winnerMessage } from "./tournament-text";
import { resultsPostBody, resultsPostTitle, type PostWinner, type Unnamed } from "./tournament-results";
import { NA_NOTESAPP_PROFILE } from "../journals-directory";
import { NA_UID } from "../social-graph";
import { slugify as noteSlug } from "../firestore-notes";
import { keptOffLists } from "../young";
import { notifyNewPostServer } from "../new-post-notify";
import { notifyMentions } from "../mentions-server";
import { SITE_URL } from "../host";
import { officialSender, sendOfficialMessage, type OfficialSender } from "../official-messages-server";
import type { Alerts } from "../messages-server";

// Notes Arcade tournaments on the server (docs/ARCADE_TOURNAMENTS.md §6, Phase 1; owner, 21 Nov 2026: "start tournaments"). Server only:
// every collection here is closed to browsers (firestore.rules); the pages go through /api/arcade/tournaments.
//   tournaments/{id}                 the tournament (lib/arcade/tournaments.ts Tournament), with its seed and counters
//   tournaments/{id}/entries/{uid}   one entrant: tries used, the open run, the best checked try (+ rankKey to order the board by)
//   tournaments/{id}/runs/{runId}    one try: who, which try, when it started, and what the replay found
// Built like the DAVIDO tournament (lib/tournament-server.ts): the browser records the moves, the server replays them from the seed with
// the game's own code and keeps the result IT works out.

export class TournamentError extends Error { constructor(public status: number, message: string) { super(message); } }

/** A run is refused this long after it started (§3 "runs expire, say 30 minutes"). */
export const RUN_EXPIRES_MS = 30 * 60_000;
/** Slack for the network when comparing the game time a recording claims with the real time since the try started. */
export const CLOCK_GRACE_MS = 5_000;
const BOARD_SIZE = 50;

type Me = { uid: string; emailVerified: boolean } | null;
/** Tests pass their own game registry so they don't depend on each game's replay; the site uses lib/arcade/tournament-games.ts. */
export type Opts = { now?: Date; games?: (slug: string) => TournamentGame | undefined };
const gameOf = (t: Tournament, o: Opts) => {
  const g = (o.games ?? tournamentGame)(t.game);
  if (!g) throw new TournamentError(500, "That game can't be checked right now.");
  return g;
};
const ID = /^[a-z0-9-]{3,64}$/;
const RUN_ID = /^[0-9a-f]{20}$/;

const asTournament = (id: string, d: FirebaseFirestore.DocumentData): Tournament => ({ ...(d as Tournament), id, prizes: d.prizes ?? [] });
async function load(db: Firestore, id: unknown): Promise<Tournament> {
  if (typeof id !== "string" || !ID.test(id)) throw new TournamentError(404, "That tournament doesn't exist.");
  const s = await db.doc(`tournaments/${id}`).get();
  if (!s.exists) throw new TournamentError(404, "That tournament doesn't exist.");
  return asTournament(id, s.data()!);
}

// ---- Public ----

/** Every listed tournament (public fields only), newest play window first. */
export async function listTournaments(db: Firestore, o: Opts = {}): Promise<PublicTournament[]> {
  const now = o.now ?? new Date();
  const s = await db.collection("tournaments").where("status", "in", ["open", "closed", "results"]).get();
  return s.docs.map((d) => asTournament(d.id, d.data())).filter((t) => listed(t, now))
    .sort((a, b) => b.playFrom.localeCompare(a.playFrom)).map((t) => publicTournament(t, now));
}

/** The sponsor whose tournament for this game is playing now: their logo and link take over the game's advert spots (§6). */
export async function activeSponsor(db: Firestore, game: unknown, o: Opts = {}) {
  const now = o.now ?? new Date();
  if (typeof game !== "string") return null;
  const s = await db.collection("tournaments").where("status", "==", "open").get();
  const t = s.docs.map((d) => asTournament(d.id, d.data())).find((x) => x.game === game && x.sponsor && phase(x, now) === "playing");
  return t ? { id: t.id, name: t.name, sponsor: t.sponsor! } : null;
}

export type BoardRow = { rank: number; username: string; name: string; summary: string; score: number; at: string };
type EntryDoc = { uid: string; username: string; name: string; tries: number; best?: Best; rankKey?: string; openRun?: string };

/** The live board: top 50 by the game's rank, and the caller's own place even when lower down. Names are usernames, as on the DAVIDO board. */
export async function leaderboard(db: Firestore, id: string, uid?: string) {
  const col = db.collection(`tournaments/${id}/entries`);
  // Firestore can't order by an array, so the best's rank is also kept as one sortable string (rankKey). A few extra rows let ties
  // at the cut be ordered by who got there first.
  const s = await col.orderBy("rankKey", "desc").limit(BOARD_SIZE + 10).get();
  const top = s.docs.map((d) => d.data() as EntryDoc).filter((e) => e.best)
    .sort((a, b) => compareRank(b.best!.rank, a.best!.rank) || a.best!.at.localeCompare(b.best!.at)).slice(0, BOARD_SIZE);
  const rows = top.map((e, i): BoardRow & { uid: string } => ({ rank: i + 1, uid: e.uid, username: e.username, name: e.name || e.username, summary: e.best!.summary, score: e.best!.score, at: e.best!.at }));
  let mine: { tries: number; best: Best | null; rank: number | null; openRun: boolean } | null = null;
  if (uid) {
    const e = (await col.doc(uid).get()).data() as EntryDoc | undefined;
    let rank = rows.find((r) => r.uid === uid)?.rank ?? null;
    if (rank === null && e?.rankKey) rank = (await col.where("rankKey", ">", e.rankKey).count().get()).data().count + 1;
    mine = { tries: Number(e?.tries ?? 0), best: e?.best ?? null, rank, openRun: !!e?.openRun };
  }
  return { rows: rows.map(({ uid: _u, ...r }) => r), mine }; // eslint-disable-line @typescript-eslint/no-unused-vars
}

/** The tournament page: details (no seed), the board, and the caller's own entry. */
export async function getTournament(db: Firestore, id: unknown, uid?: string, o: Opts = {}) {
  const now = o.now ?? new Date();
  const t = await load(db, id);
  if (!listed(t, now)) throw new TournamentError(404, "That tournament doesn't exist.");
  const board = await leaderboard(db, t.id, uid);
  const g = (o.games ?? tournamentGame)(t.game);
  return { tournament: publicTournament(t, now), game: g ? { slug: g.slug, name: g.name, rankedBy: g.rankedBy } : { slug: t.game, name: t.game, rankedBy: "" }, ...board };
}

// ---- Playing ----

/** Start a try: one transaction checks the member, the window and the tries left, abandons any open run (it still counts), and hands out
 *  the seed and a one-time run id. The first try is the entry. */
export async function startRun(db: Firestore, me: Me, id: unknown, o: Opts = {}) {
  const now = o.now ?? new Date();
  if (!me) throw new TournamentError(401, "Sign in to enter. Tournaments are for signed-in #NotesApp members (entry is free).");
  const tRef = db.doc(`tournaments/${typeof id === "string" && ID.test(id) ? id : "-"}`);
  const entryRef = tRef.collection("entries").doc(me.uid);
  const runId = randomBytes(10).toString("hex");
  const at = now.toISOString();
  return db.runTransaction(async (tx) => {
    const [ts, user, entry] = await Promise.all([tx.get(tRef), tx.get(db.doc(`users/${me.uid}`)), tx.get(entryRef)]);
    if (!ts.exists) throw new TournamentError(404, "That tournament doesn't exist.");
    const t = asTournament(ts.id, ts.data()!);
    const u = user.data();
    const ok = canEnter(t, {
      signedIn: true, emailVerified: me.emailVerified, kid: isKidUid(me.uid), teen: u?.teen === true, suspended: u?.suspended === true, username: String(u?.username ?? ""),
    }, now);
    if (!ok.ok) throw new TournamentError(ok.status, ok.message);
    const e = entry.data() as EntryDoc | undefined;
    const used = Number(e?.tries ?? 0);
    if (used >= t.tries) throw new TournamentError(409, `You've used all ${t.tries} ${t.tries === 1 ? "try" : "tries"}. Your best stands: watch the leaderboard.`);
    // One open run at a time: starting again gives up the open one, and it still counts as a try (so nobody restarts until a good deal).
    if (e?.openRun) {
      const old = await tx.get(tRef.collection("runs").doc(e.openRun));
      if (old.data()?.status === "open") tx.update(old.ref, { status: "abandoned", finishedAt: at });
    }
    if (!e) {
      tx.set(entryRef, { uid: me.uid, username: String(u!.username), name: String(u!.displayName ?? u!.username), tries: 0, firstAt: at });
      tx.set(tRef, { entrants: FieldValue.increment(1) }, { merge: true });
    }
    tx.set(entryRef, { tries: used + 1, openRun: runId, lastStartAt: at }, { merge: true });
    tx.set(tRef.collection("runs").doc(runId), { uid: me.uid, try: used + 1, startedAt: at, status: "open" });
    tx.set(tRef, { runs: FieldValue.increment(1) }, { merge: true });
    return { runId, seed: t.seed, level: t.level, game: t.game, try: used + 1, tries: t.tries };
  });
}

/** Send a try in: the server replays the recording from the seed and keeps the best by the game's rank. */
export async function finishRun(db: Firestore, me: Me, id: unknown, runId: unknown, recording: unknown, o: Opts = {}) {
  const now = o.now ?? new Date();
  if (!me) throw new TournamentError(401, "Sign in first.");
  const t = await load(db, id);
  if (typeof runId !== "string" || !RUN_ID.test(runId)) throw new TournamentError(404, "That try wasn't found.");
  const tRef = db.doc(`tournaments/${t.id}`);
  const runRef = tRef.collection("runs").doc(runId);
  const entryRef = tRef.collection("entries").doc(me.uid);
  const run = (await runRef.get()).data();
  if (!run || run.uid !== me.uid) throw new TournamentError(404, "That try wasn't found.");
  if (run.status === "abandoned") throw new TournamentError(409, "You started a newer try, so this one was given up (it still counts).");
  if (run.status !== "open") throw new TournamentError(409, "That try is already in.");
  if (t.status === "results" || t.status === "draft") throw new TournamentError(409, `The ${t.name} has ended.`);
  const reject = async (status: string, why: string): Promise<never> => {
    await runRef.update({ status, reason: why, finishedAt: now.toISOString() });
    throw new TournamentError(400, why);
  };
  const wall = now.getTime() - Date.parse(String(run.startedAt));
  if (wall > RUN_EXPIRES_MS) return reject("expired", `That try ran out of time (${RUN_EXPIRES_MS / 60_000} minutes). It still counts as a try.`);
  const game = gameOf(t, o);
  const length = typeof recording === "string" ? recording.length : JSON.stringify(recording ?? "").length;
  if (length > game.maxRecording) return reject("rejected", "That try's recording is too long.");
  let r: ReturnType<TournamentGame["replay"]>;
  try { r = game.replay(t.seed, t.level, recording); } catch { r = { ok: false, error: "That try couldn't be checked." }; }
  if (!r.ok) return reject("rejected", r.error);
  if (!r.finished) return reject("rejected", "That game isn't finished. Only a finished game counts.");
  // A recording can't claim more game time than real time passed since the try started.
  if (r.ms !== undefined && r.ms > wall + CLOCK_GRACE_MS) return reject("rejected", "That try says it took longer than it did.");
  const best: Best = { rank: r.rank, rankKey: rankKey(r.rank), summary: r.summary, score: r.score, at: now.toISOString() };
  const kept = await db.runTransaction(async (tx) => {
    const [fresh, entry] = await Promise.all([tx.get(runRef), tx.get(entryRef)]);
    if (fresh.data()?.status !== "open") throw new TournamentError(409, "That try is already in.");
    const e = (entry.data() ?? {}) as EntryDoc;
    const isBest = !e.best || compareRank(r.rank, e.best.rank) > 0;
    tx.update(runRef, { status: "done", length, result: { rank: r.rank, summary: r.summary, score: r.score, ...(r.ms !== undefined ? { ms: r.ms } : {}) }, finishedAt: now.toISOString() });
    tx.set(entryRef, { ...(e.openRun === runId ? { openRun: FieldValue.delete() } : {}), ...(isBest ? { best: { ...best, runId }, rankKey: best.rankKey } : {}) }, { merge: true });
    tx.set(tRef, { finished: FieldValue.increment(1) }, { merge: true });
    return { best: isBest ? best : e.best!, tries: Number(e.tries ?? 0) };
  });
  const board = await leaderboard(db, t.id, me.uid);
  return {
    result: { summary: r.summary, score: r.score, rank: r.rank },
    best: { summary: kept.best.summary, score: kept.best.score },
    rank: board.mine?.rank ?? null,
    triesLeft: Math.max(0, t.tries - kept.tries),
  };
}

// ---- Sponsor takeover counts ----

/** A sponsor takeover seen or clicked (components/games/ArcadeAdSpot.tsx). Counted on the tournament, not as a booked advert's impression,
 *  and once per visitor per Lagos day (the same dedupe as /api/ads/track: adSeen). */
export async function countSponsor(db: Firestore, id: unknown, event: unknown, visitor: string, day: string) {
  if (event !== "impression" && event !== "click") throw new TournamentError(400, "Invalid event.");
  const t = await load(db, id);
  if (!t.sponsor) return { counted: false };
  const key = (e: string) => `${visitor}_tour-${t.id}_${e}_${day}`;
  if (event === "click" && !(await db.doc(`adSeen/${key("impression")}`).get()).exists) return { counted: false };
  try {
    await db.doc(`adSeen/${key(event)}`).create({ at: new Date().toISOString(), expireAt: new Date(Date.now() + 2 * 86_400_000) });
  } catch {
    return { counted: false };
  }
  await db.doc(`tournaments/${t.id}`).set({ sponsorStats: { [event === "impression" ? "impressions" : "clicks"]: FieldValue.increment(1) } }, { merge: true });
  return { counted: true };
}

// ---- Page views (owner, 24 Nov 2026: "page-view counts in the sponsor's report") ----
// The same idea as adverts and the takeover above: once per visitor per Lagos day, where a visitor is the route's salted hash of IP and
// browser (never the IP itself), and the dedupe marks live in adSeen, which expires on its own (expireAt TTL).
//   tournaments/{id}.sponsorStats.views     the tournament's own page
//   tournamentStats/list-YYYYMMDD           the tournaments list page, per Lagos day, so a report can count the days its tournament ran

const seenOnce = async (db: Firestore, key: string) => {
  try {
    await db.doc(`adSeen/${key}`).create({ at: new Date().toISOString(), expireAt: new Date(Date.now() + 2 * 86_400_000) });
    return true;
  } catch {
    return false; // already counted today for this visitor
  }
};

/** A view of /arcade/tournaments/[id]. Drafts and unlisted tournaments aren't counted (nobody can see them). */
export async function countView(db: Firestore, id: unknown, visitor: string, day: string, o: Opts = {}) {
  const t = await load(db, id);
  if (!listed(t, o.now ?? new Date())) return { counted: false };
  if (!(await seenOnce(db, `${visitor}_tour-${t.id}_view_${day}`))) return { counted: false };
  await db.doc(`tournaments/${t.id}`).set({ sponsorStats: { views: FieldValue.increment(1) } }, { merge: true });
  return { counted: true };
}

/** A view of /arcade/tournaments, the list. */
export async function countListView(db: Firestore, visitor: string, day: string) {
  if (!/^\d{8}$/.test(day)) throw new TournamentError(400, "Invalid day.");
  if (!(await seenOnce(db, `${visitor}_tourlist_view_${day}`))) return { counted: false };
  await db.doc(`tournamentStats/list-${day}`).set({ day, views: FieldValue.increment(1) }, { merge: true });
  return { counted: true };
}

const lagosDayOf = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).replace(/-/g, "");
/** Every Lagos day a window touches (YYYYMMDD). A window is 31 days at most (validateDraft), so this stays small. */
export function lagosDaysBetween(fromIso: string, untilIso: string): string[] {
  const days: string[] = [];
  const end = lagosDayOf(Date.parse(untilIso) - 1);
  for (let ms = Date.parse(fromIso); days.length < 40; ms += 86_400_000) {
    const d = lagosDayOf(ms);
    if (!days.includes(d)) days.push(d);
    if (d >= end) break;
  }
  return days;
}

/** Views of the list page on the days the tournament ran. */
async function listViewsDuring(db: Firestore, t: Tournament) {
  const days = lagosDaysBetween(t.playFrom, t.playUntil);
  const snaps = await db.getAll(...days.map((d) => db.doc(`tournamentStats/list-${d}`)));
  return snaps.reduce((n, s) => n + Number(s.data()?.views ?? 0), 0);
}

// ---- Admin ----

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tournament";

/** Every tournament, drafts and seeds included (Admin only). */
export async function adminList(db: Firestore, o: Opts = {}) {
  const now = o.now ?? new Date();
  const s = await db.collection("tournaments").get();
  return s.docs.map((d) => asTournament(d.id, d.data())).sort((a, b) => b.playFrom.localeCompare(a.playFrom)).map((t) => ({ ...t, phase: phase(t, now) }));
}

/** A new draft. The seed is made here (random 31-bit) and never changes. */
export async function createTournament(db: Firestore, input: unknown, adminUid: string, o: Opts & { gameList?: TournamentGame[] } = {}) {
  const now = o.now ?? new Date();
  const v = validateDraft(input, o.gameList ?? TOURNAMENT_GAMES);
  if (!v.ok) throw new TournamentError(400, v.error);
  const base = slugify(`${v.value.name}-${v.value.playFrom.slice(0, 10)}`);
  let id = base;
  for (let i = 2; (await db.doc(`tournaments/${id}`).get()).exists; i++) id = `${base}-${i}`;
  const at = now.toISOString();
  const t: Omit<Tournament, "id"> = {
    ...v.value, format: "same-deal", seed: randomInt(1, 2 ** 31 - 1), status: "draft", createdAt: at, updatedAt: at, createdBy: adminUid,
    entrants: 0, runs: 0, finished: 0,
  };
  await db.doc(`tournaments/${id}`).create(t);
  return { id, ...t } as Tournament;
}

/** Edit a tournament. Once anyone has played, the game and level are fixed (everyone must have played the same deal). */
export async function updateTournament(db: Firestore, id: unknown, input: unknown, o: Opts & { gameList?: TournamentGame[] } = {}) {
  const now = o.now ?? new Date();
  const t = await load(db, id);
  const v = validateDraft(input, o.gameList ?? TOURNAMENT_GAMES);
  if (!v.ok) throw new TournamentError(400, v.error);
  if ((t.runs ?? 0) > 0 && (v.value.game !== t.game || v.value.level !== t.level)) throw new TournamentError(409, "Members have already played: the game and level can't change now.");
  if ((t.runs ?? 0) > 0 && v.value.tries < t.tries) throw new TournamentError(409, "Members have already played: tries can go up, not down.");
  if (t.status === "open" && v.value.prize && !v.value.legalChecked) throw new TournamentError(409, "Close it first: an open prize tournament must keep its legal check.");
  // A field left out of the draft is removed (sponsor, entryFrom) so Admin can clear them.
  const del = { sponsor: v.value.sponsor ?? FieldValue.delete(), entryFrom: v.value.entryFrom ?? FieldValue.delete() };
  await db.doc(`tournaments/${t.id}`).set({ ...v.value, ...del, updatedAt: now.toISOString() }, { merge: true });
  return load(db, t.id);
}

export type AdminAction = "open" | "close" | "results-checked" | "prizes-sent";
export async function adminAction(db: Firestore, id: unknown, action: unknown, o: Opts = {}) {
  const now = o.now ?? new Date();
  const t = await load(db, id);
  const at = now.toISOString();
  const ref = db.doc(`tournaments/${t.id}`);
  if (action === "open") {
    const why = openBlocker(t, now);
    if (why) throw new TournamentError(409, why);
    await ref.update({ status: "open", updatedAt: at });
  } else if (action === "close") {
    if (t.status !== "open") throw new TournamentError(409, "Only an open tournament can be closed.");
    await ref.update({ status: "closed", closedAt: at, updatedAt: at });
  } else if (action === "results-checked") {
    // §5: after the window closes, the top results are checked (replays re-run, odd patterns looked at by a person) before anything is handed over.
    if (t.status === "draft") throw new TournamentError(409, "That tournament never opened.");
    if (phase(t, now) !== "ended") throw new TournamentError(409, "Check results after play has ended (or close it first).");
    await ref.update({ status: "results", resultsCheckedAt: at, updatedAt: at });
  } else if (action === "prizes-sent") {
    const why = await prizesSentBlocker(db, t);
    if (why) throw new TournamentError(409, why);
    await ref.update({ prizesSentAt: at, updatedAt: at });
  } else {
    throw new TournamentError(400, "Unknown action.");
  }
  return load(db, t.id);
}

// "Mark prizes sent" waits until the winners have been told (owner, 24 Nov 2026: "making 'Mark prizes sent' wait until winners have
// been told"; §5: winners are told in Messages and confirm their details, and nothing is handed over before that). The rule: winners
// have been told (winnersNotifiedAt), and every prize place has been told, unless the board ran out of players who can take it (fewer
// eligible finishers than prizes: then every place that CAN be told has been). A place whose message failed was given back by
// tellWinners, so it counts as not told. A tournament without prizes has nothing to send.
/** Why "Mark prizes sent" can't be pressed yet, or null. Admin shows the same words beside the greyed-out button. */
export async function prizesSentBlocker(db: Firestore, t: Tournament): Promise<string | null> {
  if (!t.prize) return t.ageRule === "practice" ? "That's a practice tournament: there are no prizes to send." : "That tournament has no prizes to send.";
  if (!t.resultsCheckedAt) return "Check the results first; nothing is handed over before that (§5).";
  const told = t.winners ?? [];
  if (!t.winnersNotifiedAt || !told.length) return "Tell winners first: prizes are sent only after each winner has been told and asked to confirm their details (§5).";
  const toldPlaces = new Set(told.map((w) => w.place));
  if (t.prizes.every((_, i) => toldPlaces.has(i + 1))) return null;
  // Some prize places aren't told: is anyone eligible waiting for one? (The same selection "Tell winners" uses.)
  const waiting = (await pickPlaces(db, t, t.prizes.length))
    .filter((p) => p.place !== null && !told.some((w) => w.uid === p.e.uid) && !toldPlaces.has(p.place));
  if (!waiting.length) return null;
  const places = waiting.map((p) => ordinal(p.place!));
  return `Tell winners first: ${places.length === 1 ? `${places[0]} place hasn't` : `${places.slice(0, -1).join(", ")} and ${places[places.length - 1]} places haven't`} been told yet. Prizes are sent only after each winner has been told (§5).`;
}

/** The same, by tournament id (Admin's details panel). */
export const prizesBlockerOf = async (db: Firestore, id: unknown) => prizesSentBlocker(db, await load(db, id));

/** Check results: the top entrants with every try they sent, so a person can look for odd patterns (§5). Re-runs each best replay too. */
export async function adminResults(db: Firestore, id: unknown, limit = 20) {
  const t = await load(db, id);
  const tRef = db.doc(`tournaments/${t.id}`);
  const s = await tRef.collection("entries").orderBy("rankKey", "desc").limit(limit).get();
  const entries = s.docs.map((d) => d.data() as EntryDoc & { best: Best & { runId?: string } });
  const runs = await tRef.collection("runs").where("uid", "in", entries.length ? entries.map((e) => e.uid).slice(0, 30) : ["-"]).get();
  return entries.map((e, i) => ({
    place: i + 1, uid: e.uid, username: e.username, name: e.name, tries: e.tries, best: e.best,
    runs: runs.docs.filter((r) => r.data().uid === e.uid).map((r) => ({ id: r.id, ...(r.data() as { try: number; status: string; startedAt: string; finishedAt?: string; reason?: string; length?: number; result?: { summary: string; score: number } }) }))
      .sort((a, b) => a.try - b.try),
  }));
}

/** The sponsor's report (§2 "The numbers"): entrants, tries, finished games, page views, their takeover's impressions and clicks, and
 *  the winners told. */
export async function sponsorReport(db: Firestore, id: unknown) {
  const t = await load(db, id);
  const runs = db.collection(`tournaments/${t.id}/runs`);
  const byStatus = async (s: string) => (await runs.where("status", "==", s).count().get()).data().count;
  const [done, rejected, abandoned, expired, open] = await Promise.all(["done", "rejected", "abandoned", "expired", "open"].map(byStatus));
  return {
    id: t.id, name: t.name, game: t.game, sponsor: t.sponsor ?? null, playFrom: t.playFrom, playUntil: t.playUntil,
    entrants: t.entrants ?? 0, tries: t.runs ?? 0, finished: done, rejected, abandoned, expired, open,
    sponsorImpressions: t.sponsorStats?.impressions ?? 0, sponsorClicks: t.sponsorStats?.clicks ?? 0,
    // Once per visitor per day (countView above): the tournament's page, and the list page on the days it ran.
    pageViews: t.sponsorStats?.views ?? 0, listViews: await listViewsDuring(db, t),
    // Who was told they placed, and when (tellWinners below). Usernames only, as on the public board.
    winnersNotifiedAt: t.winnersNotifiedAt ?? null,
    winners: (t.winners ?? []).map(({ uid: _u, ...w }) => w).sort((a, b) => a.place - b.place), // eslint-disable-line @typescript-eslint/no-unused-vars
    // The results post on #NotesApp's journal naming the winners and the sponsor (§2 "The winners"; publishResultsPost below).
    resultsPost: t.resultsPost ? { url: t.resultsPost.url, slug: t.resultsPost.slug, publishedAt: t.resultsPost.publishedAt } : null,
  };
}

// ---- Telling the winners (§5; owner, 24 Nov 2026: "telling winners in Messages") ----
// §5: "After the window closes: the top results are checked ... then winners are told in Messages and asked to confirm their details.
// Nothing is handed over before that check." So this works only once "Results checked" is ticked. Each winner gets a direct message from
// #NotesApp's own account (lib/official-messages-server.ts) and a bell linking to the tournament; who was told is kept on the tournament
// (winners, winnersNotifiedAt), so pressing Send again never tells anyone twice.
//
// Who counts, re-checked now rather than trusted from entry: a deleted or suspended account is skipped (and the next player moves up, as
// a disqualified entry would), and in a prize tournament so is anyone under 18 (entry already refuses them; this is the belt to that
// brace). A tournament without prizes ("Tell the top players") sends a plain congratulations. Teens, who may play practice tournaments,
// get only the bell: they take messages only from people they follow (docs/YOUNG_MEMBERS.md), and a congratulations doesn't need a chat.

export type WinnerRow = {
  place: number | null; uid: string; username: string; summary: string; prize: string;
  action: "send" | "bell" | "told" | "skip"; why?: string; text: string;
};
type WinnerOpts = Opts & { sender?: OfficialSender; alerts?: Alerts };
const MAX_TOP_PLAYERS = 10; // a tournament without prizes: congratulate up to the top ten
const gameName = (t: Tournament, o: Opts) => (o.games ?? tournamentGame)(t.game)?.name ?? ARCADE_GAMES.find((g) => g.slug === t.game)?.name ?? t.game;
export const tournamentUrl = (id: string) => `${SITE_URL}/arcade/tournaments/${id}`;

// Who places, in board order: the one selection "Tell winners" and the results post share, so the post names exactly who was (or would
// be) told. Deleted and suspended accounts, and in a prize tournament anyone under 18, are skipped with the reason, and the next player
// moves up. Stops once `n` players have a place.
type Pick = { e: EntryDoc & { best: Best }; u: FirebaseFirestore.DocumentData | undefined; username: string; place: number | null; why?: string; young: boolean };
async function pickPlaces(db: Firestore, t: Tournament, n: number): Promise<Pick[]> {
  const s = await db.collection(`tournaments/${t.id}/entries`).orderBy("rankKey", "desc").limit(n + 40).get();
  const entries = s.docs.map((d) => d.data() as EntryDoc).filter((e): e is EntryDoc & { best: Best } => !!e.best)
    .sort((a, b) => compareRank(b.best.rank, a.best.rank) || a.best.at.localeCompare(b.best.at));
  const users = entries.length ? await db.getAll(...entries.map((e) => db.doc(`users/${e.uid}`))) : [];
  const out: Pick[] = [];
  let place = 0;
  for (const [i, e] of entries.entries()) {
    if (place >= n) break;
    const u = users[i]?.data();
    const username = String(u?.username ?? e.username);
    const young = isKidUid(e.uid) || u?.teen === true;
    const skip = (why: string) => out.push({ e, u, username, place: null, why, young });
    if (!u) { skip("Account deleted: skipped, the next player moves up."); continue; }
    if (u.suspended === true) { skip("Account suspended: skipped, the next player moves up."); continue; }
    if (t.prize && young) { skip("Under 18: prize tournaments are for adults (§8.2). Skipped, the next player moves up."); continue; }
    out.push({ e, u, username, place: ++place, young });
  }
  return out;
}

/** How many "Tell winners" tells by default, and the results post names when nobody has been told yet: one per prize, or the top three
 *  of a tournament without prizes. */
const defaultWinnerCount = (t: Tournament) => (t.prize ? t.prizes.length : Math.min(3, MAX_TOP_PLAYERS));

/** What "Tell winners" would do for the top `count`: each row's place, prize, message and whether it will be sent, skipped or was sent. */
export async function winnersPlan(db: Firestore, id: unknown, count?: unknown, o: WinnerOpts = {}) {
  const t = await load(db, id);
  if (t.status !== "results" || !t.resultsCheckedAt) throw new TournamentError(409, "Tick \"Results checked\" first: winners are told only after the top results are checked (§5).");
  const max = t.prize ? t.prizes.length : MAX_TOP_PLAYERS;
  const n = count === undefined || count === null || count === "" ? defaultWinnerCount(t) : Number(count);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new TournamentError(400, t.prize ? `Tell 1 to ${max} winners (one per prize).` : `Tell 1 to ${max} top players.`);
  const told = t.winners ?? [];
  const name = gameName(t, o);
  const url = tournamentUrl(t.id);
  const rows = (await pickPlaces(db, t, n)).map((p): WinnerRow => {
    const base = { uid: p.e.uid, username: p.username, summary: p.e.best.summary, prize: "", text: "" };
    if (p.place === null) return { ...base, place: null, action: "skip", why: p.why };
    const place = p.place;
    const already = told.find((w) => w.uid === p.e.uid);
    if (already) return { ...base, place: already.place, prize: already.prize, action: "told", why: `Told ${already.at.slice(0, 16).replace("T", " ")} UTC.` };
    const clash = told.find((w) => w.place === place);
    if (clash) return { ...base, place, action: "skip", why: `@${clash.username} was already told they placed ${place}. Check the results by hand.` };
    const prize = t.prize ? t.prizes[place - 1] : undefined;
    return {
      ...base, place, prize: prize?.prize ?? "", action: p.young ? "bell" : "send",
      ...(p.young ? { why: "A teen: bell only (teens take messages only from people they follow)." } : {}),
      text: winnerMessage(t, name, { username: p.username, place, ...(prize ? { prize } : {}) }, url),
    };
  });
  const sender = o.sender ?? (await officialSender(db));
  return {
    id: t.id, name: t.name, prize: t.prize, count: n, max, rows, told: [...told].sort((a, b) => a.place - b.place), winnersNotifiedAt: t.winnersNotifiedAt ?? null,
    sender: sender.ok ? { ok: true as const, username: sender.username } : { ok: false as const, error: sender.error },
  };
}

/** Tell the top `count`: claims each winner on the tournament first (in a transaction, so two admins pressing Send can't both tell
 *  someone), then sends the message and the bell. A message that fails gives the claim back, so Send can try that winner again. */
export async function tellWinners(db: Firestore, id: unknown, count: unknown, o: WinnerOpts = {}) {
  const now = o.now ?? new Date();
  const sender = o.sender ?? (await officialSender(db));
  const plan = await winnersPlan(db, id, count, { ...o, sender });
  const due = plan.rows.filter((r) => r.action === "send" || r.action === "bell");
  if (!due.length) throw new TournamentError(409, plan.rows.some((r) => r.action === "told") ? "Everyone in that list has already been told." : "There's no one to tell.");
  if (due.some((r) => r.action === "send") && !sender.ok) throw new TournamentError(409, sender.error);
  const tRef = db.doc(`tournaments/${plan.id}`);
  const sent: { username: string; place: number; dm: boolean }[] = [];
  const failed: { username: string; place: number; error: string }[] = [];
  for (const r of due) {
    const dm = r.action === "send";
    const w: Winner = { uid: r.uid, username: r.username, place: r.place!, prize: r.prize, at: now.toISOString(), dm };
    const claimed = await db.runTransaction(async (tx) => {
      const cur = ((await tx.get(tRef)).data()?.winners ?? []) as Winner[];
      if (cur.some((x) => x.uid === w.uid || x.place === w.place)) return false;
      tx.update(tRef, { winners: [...cur, w], winnersNotifiedAt: w.at, updatedAt: w.at });
      return true;
    });
    if (!claimed) continue;
    if (dm) {
      try {
        await sendOfficialMessage(db, r.uid, r.text, { sender, now, ...(o.alerts ? { alerts: o.alerts } : {}) });
      } catch (e) {
        await db.runTransaction(async (tx) => {
          const cur = ((await tx.get(tRef)).data()?.winners ?? []) as Winner[];
          tx.update(tRef, { winners: cur.filter((x) => x.uid !== w.uid) });
        });
        failed.push({ username: r.username, place: w.place, error: e instanceof Error ? e.message : "Couldn't send." });
        continue;
      }
    }
    // The bell, written as lib/email.ts notifyBell writes it (server-only collection; firestore.rules lets members read and mark their own).
    await db.collection("notifications").add({
      recipientUid: r.uid, type: "arcade", message: winnerBell({ name: plan.name, prize: plan.prize }, w.place, dm), read: false, createdAt: now.toISOString(), linkHref: `/arcade/tournaments/${plan.id}`,
    }).catch((e) => console.error("[tournaments] winner bell failed", e instanceof Error ? e.message : e));
    sent.push({ username: r.username, place: w.place, dm });
  }
  return { sent, failed, skipped: plan.rows.filter((r) => r.action === "skip").map((r) => ({ username: r.username, why: r.why ?? "" })), tournament: await load(db, plan.id) };
}

// ---- The results post (§2 "The winners"; owner, 24 Nov 2026: "the results post on #NotesApp's account naming the winners and the sponsor") ----
// Once results are checked, Admin gets a draft (lib/arcade/tournament-results.ts), edits it, and publishes it on @na-notesapp's journal.
// The post is written exactly as NoteForm writes an admin's post under the "NotesApp" author toggle (a published `notes` document with
// author "NotesApp", authorUsername "na-notesapp" and no authorUid, since the channel has no account of its own), so it shows on
// /u/na-notesapp, in feeds, Explore, search and the sitemap like any other #NotesApp post, with comments and likes open. Followers get
// the usual "new post" bell (lib/new-post-notify.ts), and winners @mentioned in it get a mention bell (lib/mentions-server.ts, which keeps
// the young-member rules). The tournament keeps resultsPost, so it's never posted twice.
//
// The winners named are the same list "Tell winners" tells: the winners told (winners[]) once anyone has been told, otherwise the checked
// board with the same skips (pickPlaces). Teens and members who keep their profile private aren't named (docs/YOUNG_MEMBERS.md).

/** @na-notesapp's byline role, as NoteForm's author toggle writes it. */
const NA_ROLE = "Official Channel";
/** The tournament's share card (app/(arcade)/arcade/tournaments/[id]/opengraph-image.tsx): the post's cover image. A path on our own
 *  site, so next/image and feeds load it without a remote-image allowance, and link previews resolve it against the site address. */
export const shareCardPath = (id: string) => `/arcade/tournaments/${id}/opengraph-image`;

const unnamedOf = (uid: string, u: FirebaseFirestore.DocumentData | undefined): { unnamed?: Unnamed } =>
  !u || u.suspended === true ? { unnamed: "gone" } : isKidUid(uid) || u.teen === true ? { unnamed: "teen" } : keptOffLists(u) ? { unnamed: "private" } : {};

/** The winners the post names, in place order (see above). */
async function postWinners(db: Firestore, t: Tournament): Promise<{ winners: PostWinner[]; from: "told" | "board" }> {
  const told = [...(t.winners ?? [])].sort((a, b) => a.place - b.place);
  if (told.length) {
    const [users, entries] = await Promise.all([
      db.getAll(...told.map((w) => db.doc(`users/${w.uid}`))),
      db.getAll(...told.map((w) => db.doc(`tournaments/${t.id}/entries/${w.uid}`))),
    ]);
    return {
      from: "told",
      winners: told.map((w, i) => {
        const u = users[i].data();
        return {
          place: w.place, username: String(u?.username ?? w.username), summary: String((entries[i].data() as EntryDoc | undefined)?.best?.summary ?? "result checked"),
          ...(w.prize ? { prize: w.prize } : {}), ...unnamedOf(w.uid, u),
        };
      }),
    };
  }
  const picks = (await pickPlaces(db, t, defaultWinnerCount(t))).filter((p) => p.place !== null);
  return {
    from: "board",
    winners: picks.map((p) => {
      const prize = t.prize ? t.prizes[p.place! - 1] : undefined;
      return { place: p.place!, username: p.username, summary: p.e.best.summary, ...(prize ? { prize: prize.prize } : {}), ...unnamedOf(p.e.uid, p.u) };
    }),
  };
}

const needsChecked = (t: Tournament) => {
  if (t.status !== "results" || !t.resultsCheckedAt) throw new TournamentError(409, "Tick \"Results checked\" first: the results post names the winners, so it comes after the top results are checked (§5).");
};

/** The draft Admin edits: title, Markdown body, the winners it names (and whether they're the ones told or the board's top), the cover. */
export async function resultsPostDraft(db: Firestore, id: unknown, o: Opts = {}) {
  const t = await load(db, id);
  needsChecked(t);
  const { winners, from } = await postWinners(db, t);
  const body = resultsPostBody(t, gameName(t, o), winners, {
    tournament: tournamentUrl(t.id), list: `${SITE_URL}/arcade/tournaments`, partners: `${SITE_URL}/arcade/partners`,
  });
  return { id: t.id, title: resultsPostTitle(t), body, winners, from, cover: shareCardPath(t.id), resultsPost: t.resultsPost ?? null };
}

const cleanTitle = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200) : "");
const cleanBody = (v: unknown) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, 100_000) : "");

/** Publish the post as #NotesApp (@na-notesapp). `title` and `body` are Admin's edits; left out, the draft is used as it is. Once only. */
export async function publishResultsPost(db: Firestore, id: unknown, input: { title?: unknown; body?: unknown }, adminUid: string, o: Opts = {}) {
  const now = o.now ?? new Date();
  const t = await load(db, id);
  needsChecked(t);
  if (t.resultsPost) throw new TournamentError(409, `The results post is already up: ${t.resultsPost.url}`);
  const draft = input.title === undefined || input.body === undefined ? await resultsPostDraft(db, t.id, o) : null;
  const title = input.title === undefined ? draft!.title : cleanTitle(input.title);
  const body = input.body === undefined ? draft!.body : cleanBody(input.body);
  if (title.length < 3) throw new TournamentError(400, "Give the post a title (3 to 200 characters).");
  if (body.length < 20) throw new TournamentError(400, "The post is nearly empty. Write the results first.");
  // A slug nobody else uses (NoteForm checks the same before saving).
  const base = noteSlug(title).slice(0, 80).replace(/-+$/, "") || `winners-${t.id}`;
  let slug = base;
  for (let i = 2; !(await db.collection("notes").where("slug", "==", slug).limit(1).get()).empty; i++) slug = i > 20 ? `${base}-${randomBytes(3).toString("hex")}` : `${base}-${i}`;
  const at = now.toISOString();
  const noteRef = db.collection("notes").doc();
  const note = {
    viewCount: 0, likeCount: 0, shareCount: 0,
    slug, title, date: at, topics: ["gaming"], categories: ["Gaming"], tags: ["notes-arcade", "tournaments"],
    featured_image: shareCardPath(t.id), content: body,
    author: NA_NOTESAPP_PROFILE.displayName, author_role: NA_ROLE, author_avatar: NA_NOTESAPP_PROFILE.avatar, authorUsername: NA_NOTESAPP_PROFILE.username,
    status: "published", premium: false, offerSwahili: false,
    // Where it came from, like a replay's post (from: "replay"), so it can be traced back to its tournament.
    from: "arcade-results", tournamentId: t.id,
  };
  const resultsPost: ResultsPost = { noteId: noteRef.id, slug, url: `${SITE_URL}/journals/${slug}`, publishedAt: at, by: adminUid };
  const tRef = db.doc(`tournaments/${t.id}`);
  // The claim and the post in one transaction: two admins pressing Publish together get one post, not two.
  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(tRef)).data();
    if (cur?.resultsPost) throw new TournamentError(409, `The results post is already up: ${cur.resultsPost.url}`);
    tx.create(noteRef, note);
    tx.update(tRef, { resultsPost, updatedAt: at });
  });
  // The bells a #NotesApp post gets when Admin publishes it from the editor (createNote → /api/notify/new-post and /api/notify/mentions).
  // They never undo the post: a failure is logged.
  await notifyNewPostServer(db, noteRef.id, now).catch((e) => console.error("[tournaments] results post new-post bells failed", e instanceof Error ? e.message : e));
  await notifyMentions(db, {
    kind: "journal", sourceId: noteRef.id, text: body, markdown: true,
    author: { uid: NA_UID, name: NA_NOTESAPP_PROFILE.displayName, username: NA_NOTESAPP_PROFILE.username, avatar: NA_NOTESAPP_PROFILE.avatar },
    where: `in “${title}”`, linkHref: `/journals/${slug}`,
  }, now).catch((e) => console.error("[tournaments] results post mention bells failed", e instanceof Error ? e.message : e));
  return { resultsPost, tournament: await load(db, t.id) };
}
