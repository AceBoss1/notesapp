import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes, randomInt } from "crypto";
import { isKidUid } from "../kids";
import { TOURNAMENT_GAMES, compareRank, rankKey, tournamentGame, type TournamentGame } from "./tournament-games";
import {
  canEnter, listed, openBlocker, phase, publicTournament, validateDraft, type Best, type PublicTournament, type Tournament,
} from "./tournaments";

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
    if (!t.prize) throw new TournamentError(409, "That's a practice tournament: there are no prizes to send.");
    if (!t.resultsCheckedAt) throw new TournamentError(409, "Check the results first; nothing is handed over before that (§5).");
    await ref.update({ prizesSentAt: at, updatedAt: at });
  } else {
    throw new TournamentError(400, "Unknown action.");
  }
  return load(db, t.id);
}

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

/** The sponsor's report (§2 "The numbers"): entrants, tries, finished games, and their takeover's impressions and clicks. */
export async function sponsorReport(db: Firestore, id: unknown) {
  const t = await load(db, id);
  const runs = db.collection(`tournaments/${t.id}/runs`);
  const byStatus = async (s: string) => (await runs.where("status", "==", s).count().get()).data().count;
  const [done, rejected, abandoned, expired, open] = await Promise.all(["done", "rejected", "abandoned", "expired", "open"].map(byStatus));
  return {
    id: t.id, name: t.name, game: t.game, sponsor: t.sponsor ?? null, playFrom: t.playFrom, playUntil: t.playUntil,
    entrants: t.entrants ?? 0, tries: t.runs ?? 0, finished: done, rejected, abandoned, expired, open,
    sponsorImpressions: t.sponsorStats?.impressions ?? 0, sponsorClicks: t.sponsorStats?.clicks ?? 0,
    // TODO(page views): the tournament page isn't counted yet; add a view counter when the sitemap/analytics work lands.
    pageViews: null as number | null,
  };
}
