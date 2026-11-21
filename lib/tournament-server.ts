import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";
import { isKidUid } from "./kids";
import { replayRun } from "./arcade/run-replay";
import { RUN_GRACE_MS, campaignByCode, campaignById, tournamentPlaying, type Campaign } from "./promos";
import { PromoError } from "./promos-server";

// The DAVIDO-at-34 Arcade tournament, played (owner, 21 Nov 2026: "tournament must run today, maybe 10pm; we will announce as people play").
// "Same deal" (docs/ARCADE_TOURNAMENTS.md): every entrant runs the same Naija Run street (the campaign's seed) at the same speed, up to
// `tries` times, and the best score counts. The browser records each run step by step; the server replays the recording with the game's own
// code and keeps the score IT works out, so a made-up score can't pass. Free entry; signed-in adults only.
//   promoTournament/{campaignId}_{uid}  the entry: tries used, the open run, the best score (also the sign-up from lib/promos-server.ts)
//   promoRuns/{runId}                   one try: who, when it started, and the result once it's in
// Server only (firestore.rules).

type Me = { uid: string; emailVerified: boolean };
const tourOf = (code: unknown): Campaign & { tournament: NonNullable<Campaign["tournament"]> } => {
  const c = campaignByCode(code) ?? campaignById(code);
  if (!c || !c.tournament) throw new PromoError(404, "That tournament doesn't exist.");
  return c as Campaign & { tournament: NonNullable<Campaign["tournament"]> };
};
const lagosTime = (iso: string) => new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

// Start a try: checks the window, the member and the tries left, and hands out the seed and a run id. Signs the member up if they weren't.
export async function startTournamentRun(db: Firestore, me: Me, code: unknown, now = new Date()) {
  const c = tourOf(code);
  const t = c.tournament;
  if (now.getTime() < Date.parse(t.playFrom)) throw new PromoError(409, `The ${t.name} starts at ${lagosTime(t.playFrom)} (Lagos time). Practise on Naija Run until then.`);
  if (!tournamentPlaying(c, now)) throw new PromoError(409, `The ${t.name} has ended. Watch #NotesApp for the winners.`);
  if (!me.emailVerified) throw new PromoError(403, "Verify your email first (check your inbox), then play.");
  if (isKidUid(me.uid)) throw new PromoError(403, "Prize tournaments are for members aged 18 and over.");
  const entryRef = db.doc(`promoTournament/${c.id}_${me.uid}`);
  const counterRef = db.doc(`promos/${c.id}`);
  const runId = randomBytes(10).toString("hex");
  const at = now.toISOString();
  const tries = await db.runTransaction(async (tx) => {
    const [user, entry] = await Promise.all([tx.get(db.doc(`users/${me.uid}`)), tx.get(entryRef)]);
    const u = user.data();
    if (!u || !u.username) throw new PromoError(400, "Finish setting up your profile first.");
    if (u.suspended === true) throw new PromoError(403, "Your account can't do that right now.");
    if (u.teen === true) throw new PromoError(403, "Prize tournaments are for members aged 18 and over.");
    const e = entry.data();
    const used = Number(e?.tries ?? 0);
    if (used >= t.tries) throw new PromoError(409, `You've used all ${t.tries} tries. Your best score stands: watch the leaderboard.`);
    if (!e) {
      tx.set(entryRef, { campaignId: c.id, uid: me.uid, username: String(u.username), name: String(u.displayName ?? u.username), at });
      tx.set(counterRef, { campaignId: c.id, tournamentEntries: FieldValue.increment(1), updatedAt: at }, { merge: true });
    }
    tx.set(entryRef, { tries: used + 1, openRun: runId, lastStartAt: at }, { merge: true });
    tx.set(db.doc(`promoRuns/${runId}`), { campaignId: c.id, uid: me.uid, startedAt: at, status: "open", try: used + 1 });
    return used + 1;
  });
  return { runId, seed: t.seed, level: t.level, try: tries, tries: t.tries };
}

// Send a try in: replay it, check it took no less time than it says, and keep the best score.
export async function finishTournamentRun(db: Firestore, me: Me, code: unknown, runId: unknown, recording: unknown, now = new Date()) {
  const c = tourOf(code);
  const t = c.tournament;
  if (typeof runId !== "string" || !/^[0-9a-f]{20}$/.test(runId)) throw new PromoError(404, "That run wasn't found.");
  if (now.getTime() > Date.parse(t.playUntil) + RUN_GRACE_MS) throw new PromoError(409, `The ${t.name} has ended.`);
  const runRef = db.doc(`promoRuns/${runId}`);
  const entryRef = db.doc(`promoTournament/${c.id}_${me.uid}`);
  const run = (await runRef.get()).data();
  if (!run || run.uid !== me.uid || run.campaignId !== c.id) throw new PromoError(404, "That run wasn't found.");
  if (run.status !== "open") throw new PromoError(409, "That run is already in.");
  const r = replayRun(t.seed, t.level, recording);
  const reject = async (why: string) => { await runRef.update({ status: "rejected", reason: why, finishedAt: now.toISOString() }); throw new PromoError(400, why); };
  if (!r.ok) return reject(r.error);
  // The recording can't claim more running time than has passed since the try started (a little slack for the network).
  const wall = now.getTime() - Date.parse(String(run.startedAt));
  if (r.ms > wall + 5_000) return reject("That run says it took longer than it did.");
  if (r.ms > 2 * 3_600_000) return reject("That run is too long.");
  const result = { score: r.score, metres: r.metres, coins: r.coins, ms: r.ms };
  const best = await db.runTransaction(async (tx) => {
    const [fresh, entry] = await Promise.all([tx.get(runRef), tx.get(entryRef)]);
    if (fresh.data()?.status !== "open") throw new PromoError(409, "That run is already in.");
    const e = entry.data() ?? {};
    const isBest = r.score > Number(e.best ?? -1);
    tx.update(runRef, { status: "done", ...result, finishedAt: now.toISOString() });
    tx.set(entryRef, { ...(e.openRun === runId ? { openRun: FieldValue.delete() } : {}), ...(isBest ? { best: r.score, bestMetres: r.metres, bestCoins: r.coins, bestAt: now.toISOString() } : {}) }, { merge: true });
    return isBest ? r.score : Number(e.best ?? 0);
  });
  const board = await leaderboard(db, c.id, me.uid);
  return { ...result, best, rank: board.mine?.rank ?? null, triesLeft: Math.max(0, t.tries - Number(((await entryRef.get()).data() ?? {}).tries ?? 0)) };
}

export type BoardRow = { rank: number; username: string; name: string; best: number; metres: number; at: string };
// The leaderboard, live: best score first, the earlier best breaking a tie. Public (names and scores only).
export async function leaderboard(db: Firestore, code: unknown, uid?: string, limit = 50) {
  const c = tourOf(code);
  const s = await db.collection("promoTournament").where("campaignId", "==", c.id).get();
  const rows = s.docs.map((d) => d.data()).filter((e) => typeof e.best === "number")
    .sort((a, b) => b.best - a.best || String(a.bestAt).localeCompare(String(b.bestAt)))
    .map((e, i): BoardRow & { uid: string } => ({ rank: i + 1, uid: String(e.uid), username: String(e.username), name: String(e.name ?? e.username), best: e.best, metres: Number(e.bestMetres ?? 0), at: String(e.bestAt) }));
  const mineEntry = uid ? s.docs.find((d) => d.data().uid === uid)?.data() : undefined;
  const mineRow = uid ? rows.find((r) => r.uid === uid) : undefined;
  const strip = ({ uid: _u, ...rest }: BoardRow & { uid: string }) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    name: c.tournament.name, playFrom: c.tournament.playFrom, playUntil: c.tournament.playUntil, tries: c.tournament.tries,
    playing: tournamentPlaying(c, new Date()), entrants: s.size, played: rows.length,
    rows: rows.slice(0, limit).map(strip),
    mine: uid ? { rank: mineRow?.rank ?? null, best: mineRow?.best ?? null, triesUsed: Number(mineEntry?.tries ?? 0), signedUp: !!mineEntry } : null,
  };
}
