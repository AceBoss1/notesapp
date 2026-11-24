// Notes Arcade tournaments end to end on the Firestore emulator (lib/arcade/tournaments-server.ts; owner, 21 Nov 2026: "start tournaments").
// A tiny fake game stands in for the real ones, so these tests check the server's rules without depending on each game's replay.
// Run: npm run test:tournaments-server → "TOURNAMENTS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { TournamentGame } from "../../lib/arcade/tournament-games";
import {
  TournamentError, activeSponsor, adminAction, adminList, adminResults, countListView, countSponsor, countView, createTournament, finishRun, getTournament,
  leaderboard, listTournaments, sponsorReport, startRun, tellWinners, updateTournament, winnersPlan,
} from "../../lib/arcade/tournaments-server";
import { shareTournament, sitemapTournaments } from "../../lib/arcade/tournament-share-server";
import { officialSender } from "../../lib/official-messages-server";
import { conversationId } from "../../lib/messages-rules";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();

// The fake game: a recording is "seed|won|moves|ms|finished|check". The check ties it to the seed and the numbers, so editing any of
// them (a tampered recording) fails the replay, as a real game's replay fails a made-up move list.
const check = (seed: number, won: number, moves: number, ms: number) => (seed + won * 7 + moves * 13 + ms) % 997;
const FAKE: TournamentGame = {
  slug: "fake", name: "Fake", levels: ["easy", "hard"], rankedBy: "Wins first, then the fewest moves", maxRecording: 200,
  replay(seed, _level, recording) {
    const p = String(recording).split("|").map(Number);
    if (p.length !== 6 || p.some((n) => !Number.isFinite(n))) return { ok: false, error: "That recording can't be read." };
    const [s, won, moves, ms, finished, c] = p;
    if (s !== seed || c !== check(s, won, moves, ms)) return { ok: false, error: "That recording doesn't match the deal." };
    return { ok: true, finished: finished === 1, rank: [won, -moves], summary: `${won ? "Won" : "Lost"} in ${moves} moves`, score: won ? 1000 - moves : 0, ms };
  },
};
const o = (now: Date) => ({ now, games: (slug: string) => (slug === "fake" ? FAKE : undefined), gameList: [FAKE] });
const rec = (seed: number, won: number, moves: number, ms = 60_000, finished = 1) => `${seed}|${won}|${moves}|${ms}|${finished}|${check(seed, won, moves, ms)}`;
const me = (uid: string, emailVerified = true) => ({ uid, emailVerified });
const rejects = (p: Promise<unknown>, status: number, re: RegExp) =>
  assert.rejects(p, (e: unknown) => e instanceof TournamentError && e.status === status && re.test(e.message) ? true : (console.error(e), false));
const at = (iso: string) => new Date(iso);
const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

(async () => {
  for (let i = 1; i <= 6; i++) await db.doc(`users/a${i}`).set({ uid: `a${i}`, username: `adult${i}`, displayName: `Adult ${i}` });
  await db.doc("users/teen").set({ uid: "teen", username: "teen1", teen: true });
  await db.doc("users/sus").set({ uid: "sus", username: "sus1", suspended: true });
  await db.doc("users/nouser").set({ uid: "nouser" });

  const created = at("2026-11-21T12:00:00Z");
  const from = "2026-11-29T09:00:00.000Z", until = "2026-11-30T21:00:00.000Z";
  const during = at("2026-11-29T12:00:00Z");
  const draft = {
    game: "fake", name: "The Ariaria Cup", level: "hard", tries: 3, playFrom: from, playUntil: until, prize: true, ageRule: "adults",
    prizes: [{ place: "1st", prize: "A phone" }], sponsor: { name: "Ariaria Ltd", link: "https://ariaria.example", logo: "https://ariaria.example/l.png", words: "Shop local." },
  };

  // Admin creates a prize tournament: a draft, with its own random seed; never public.
  const t = await createTournament(db, draft, "admin1", o(created));
  assert.equal(t.status, "draft"); assert.ok(Number.isInteger(t.seed) && t.seed > 0 && t.seed < 2 ** 31);
  assert.equal(t.id, "the-ariaria-cup-2026-11-29");
  await rejects(createTournament(db, { ...draft, ageRule: "practice" }, "admin1", o(created)), 400, /adults \(18\+\) only/);
  assert.equal((await listTournaments(db, o(created))).length, 0, "drafts aren't listed");
  await rejects(getTournament(db, t.id, undefined, o(created)), 404, /doesn't exist/);
  await rejects(startRun(db, me("a1"), t.id, o(during)), 404, /doesn't exist/);

  // §8.5: a prize tournament won't open until the legal check is ticked.
  await rejects(adminAction(db, t.id, "open", o(created)), 409, /legal check/);
  await updateTournament(db, t.id, { ...draft, legalChecked: true }, o(created));
  const opened = await adminAction(db, t.id, "open", o(created));
  assert.equal(opened.status, "open");
  const list = await listTournaments(db, o(created));
  assert.equal(list.length, 1); assert.equal((list[0] as Record<string, unknown>).seed, undefined, "no seed in the list");
  assert.equal(list[0].phase, "upcoming");
  const page = await getTournament(db, t.id, undefined, o(created));
  assert.equal((page.tournament as Record<string, unknown>).seed, undefined, "no seed on the page");
  assert.equal(page.game.rankedBy, "Wins first, then the fewest moves"); assert.equal(page.mine, null);
  assert.equal((await adminList(db, o(created)))[0].seed, t.seed, "admins see the seed");

  // Who may play.
  await rejects(startRun(db, null, t.id, o(during)), 401, /Sign in/);
  await rejects(startRun(db, me("kid_abc"), t.id, o(during)), 403, /kids' accounts/);
  await rejects(startRun(db, me("teen"), t.id, o(during)), 403, /18 and over/);
  await rejects(startRun(db, me("a1", false), t.id, o(during)), 403, /Verify your email/);
  await rejects(startRun(db, me("sus"), t.id, o(during)), 403, /can't do that/);
  await rejects(startRun(db, me("nouser"), t.id, o(during)), 400, /profile/);
  // The window.
  await rejects(startRun(db, me("a1"), t.id, o(at("2026-11-29T08:59:00Z"))), 409, /starts/);
  await rejects(startRun(db, me("a1"), t.id, o(at("2026-11-30T21:00:00Z"))), 409, /has ended/);

  // a1 plays three tries; the best (a win in 30 moves) is kept, whatever order they come in.
  const s1 = await startRun(db, me("a1"), t.id, o(during));
  assert.equal(s1.seed, t.seed); assert.equal(s1.level, "hard"); assert.equal(s1.try, 1); assert.equal(s1.tries, 3);
  const f1 = await finishRun(db, me("a1"), t.id, s1.runId, rec(t.seed, 0, 50), o(plus(during, 61_000)));
  assert.equal(f1.result.summary, "Lost in 50 moves"); assert.equal(f1.rank, 1); assert.equal(f1.triesLeft, 2);
  await rejects(finishRun(db, me("a1"), t.id, s1.runId, rec(t.seed, 1, 5), o(plus(during, 62_000))), 409, /already in/);
  await rejects(finishRun(db, me("a2"), t.id, s1.runId, rec(t.seed, 1, 5), o(plus(during, 62_000))), 404, /wasn't found/);
  const t2 = plus(during, 120_000);
  const s2 = await startRun(db, me("a1"), t.id, o(t2));
  const f2 = await finishRun(db, me("a1"), t.id, s2.runId, rec(t.seed, 1, 30), o(plus(t2, 61_000)));
  assert.equal(f2.best.summary, "Won in 30 moves");
  const t3 = plus(during, 240_000);
  const s3 = await startRun(db, me("a1"), t.id, o(t3));
  const f3 = await finishRun(db, me("a1"), t.id, s3.runId, rec(t.seed, 1, 40), o(plus(t3, 61_000)));
  assert.equal(f3.result.summary, "Won in 40 moves"); assert.equal(f3.best.summary, "Won in 30 moves", "the best is kept"); assert.equal(f3.triesLeft, 0);
  await rejects(startRun(db, me("a1"), t.id, o(plus(t3, 120_000))), 409, /used all 3 tries/);

  // A tampered recording is refused (and the try still counts), as is a wrong seed, an unfinished game, and one claiming more time than passed.
  const s4 = await startRun(db, me("a2"), t.id, o(during));
  const tampered = rec(t.seed, 0, 50).replace(/^(\d+)\|0\|/, "$1|1|"); // a loss edited into a win
  await rejects(finishRun(db, me("a2"), t.id, s4.runId, tampered, o(plus(during, 61_000))), 400, /doesn't match the deal/);
  assert.equal((await db.doc(`tournaments/${t.id}/runs/${s4.runId}`).get()).data()!.status, "rejected");
  const s5 = await startRun(db, me("a2"), t.id, o(during));
  await rejects(finishRun(db, me("a2"), t.id, s5.runId, rec(t.seed + 1, 1, 10), o(plus(during, 61_000))), 400, /doesn't match the deal/);
  const s6 = await startRun(db, me("a2"), t.id, o(during));
  await rejects(finishRun(db, me("a2"), t.id, s6.runId, rec(t.seed, 1, 10, 600_000), o(plus(during, 61_000))), 400, /longer than it did/);
  await rejects(startRun(db, me("a2"), t.id, o(during)), 409, /used all 3 tries/);
  assert.equal((await leaderboard(db, t.id, "a2")).mine!.best, null, "refused tries leave no best");
  const s7 = await startRun(db, me("a3"), t.id, o(during));
  await rejects(finishRun(db, me("a3"), t.id, s7.runId, rec(t.seed, 1, 10, 60_000, 0), o(plus(during, 61_000))), 400, /isn't finished/);
  const s8 = await startRun(db, me("a3"), t.id, o(during));
  await rejects(finishRun(db, me("a3"), t.id, s8.runId, "x".repeat(201), o(plus(during, 61_000))), 400, /too long/);

  // Starting a new try gives up the open one, and it still counts.
  const a4a = await startRun(db, me("a4"), t.id, o(during));
  const a4b = await startRun(db, me("a4"), t.id, o(plus(during, 1000)));
  assert.equal(a4b.try, 2);
  assert.equal((await db.doc(`tournaments/${t.id}/runs/${a4a.runId}`).get()).data()!.status, "abandoned");
  await rejects(finishRun(db, me("a4"), t.id, a4a.runId, rec(t.seed, 1, 5), o(plus(during, 62_000))), 409, /newer try/);
  const a4 = await finishRun(db, me("a4"), t.id, a4b.runId, rec(t.seed, 1, 20), o(plus(during, 62_000)));
  assert.equal(a4.rank, 1, "a win in 20 beats a win in 30"); assert.equal(a4.triesLeft, 1);

  // A run expires 30 minutes after it starts.
  const a5 = await startRun(db, me("a5"), t.id, o(during));
  await rejects(finishRun(db, me("a5"), t.id, a5.runId, rec(t.seed, 1, 5), o(plus(during, 31 * 60_000))), 400, /ran out of time/);
  assert.equal((await db.doc(`tournaments/${t.id}/runs/${a5.runId}`).get()).data()!.status, "expired");

  // a6 ties a1 (won in 30) later: a1 got there first, so a1 ranks above.
  const a6 = await startRun(db, me("a6"), t.id, o(plus(during, 3_600_000)));
  await finishRun(db, me("a6"), t.id, a6.runId, rec(t.seed, 1, 30), o(plus(during, 3_661_000)));

  // The leaderboard: by rank, ties by who got there first; usernames only; the caller's own row.
  const board = await leaderboard(db, t.id, "a6");
  assert.deepEqual(board.rows.map((r) => [r.rank, r.username, r.summary]), [[1, "adult4", "Won in 20 moves"], [2, "adult1", "Won in 30 moves"], [3, "adult6", "Won in 30 moves"]]);
  assert.equal((board.rows[0] as Record<string, unknown>).uid, undefined, "no uids on the public board");
  assert.deepEqual(board.mine, { tries: 1, best: board.mine!.best, rank: 3, openRun: false });
  const mineA4 = (await getTournament(db, t.id, "a4", o(during))).mine!;
  assert.equal(mineA4.rank, 1); assert.equal(mineA4.tries, 2);

  // The sponsor takes over the game's advert spots while it plays, and only then.
  assert.deepEqual(await activeSponsor(db, "fake", o(during)), { id: t.id, name: "The Ariaria Cup", sponsor: draft.sponsor });
  assert.equal(await activeSponsor(db, "fake", o(created)), null, "not before play");
  assert.equal(await activeSponsor(db, "whot", o(during)), null, "not in another game");
  // Takeover counts: once per visitor per day; a click needs a view first.
  assert.deepEqual(await countSponsor(db, t.id, "click", "v1", "20261129"), { counted: false });
  assert.deepEqual(await countSponsor(db, t.id, "impression", "v1", "20261129"), { counted: true });
  assert.deepEqual(await countSponsor(db, t.id, "impression", "v1", "20261129"), { counted: false });
  assert.deepEqual(await countSponsor(db, t.id, "click", "v1", "20261129"), { counted: true });
  await countSponsor(db, t.id, "impression", "v2", "20261129");

  // Page views (owner, 24 Nov 2026): once per visitor per Lagos day; a draft's page isn't counted. The list page counts per day, and
  // the report adds up only the days the tournament ran (29 and 30 Nov here).
  assert.deepEqual(await countView(db, t.id, "v1", "20261129", o(during)), { counted: true });
  assert.deepEqual(await countView(db, t.id, "v1", "20261129", o(during)), { counted: false }, "same visitor, same day");
  assert.deepEqual(await countView(db, t.id, "v2", "20261129", o(during)), { counted: true });
  assert.deepEqual(await countView(db, t.id, "v1", "20261130", o(during)), { counted: true }, "the next day counts again");
  const hidden = await createTournament(db, { ...draft, name: "Hidden Draft" }, "admin1", o(created));
  assert.deepEqual(await countView(db, hidden.id, "v1", "20261129", o(during)), { counted: false }, "drafts aren't counted");
  await rejects(countView(db, "no-such-cup", "v1", "20261129", o(during)), 404, /doesn't exist/);
  assert.deepEqual(await countListView(db, "v1", "20261129"), { counted: true });
  assert.deepEqual(await countListView(db, "v1", "20261129"), { counted: false });
  await countListView(db, "v2", "20261130");
  await countListView(db, "v3", "20261205"); // after the window: not in this report
  assert.equal((await db.doc(`tournaments/${t.id}`).get()).data()!.sponsorStats.views, 3);

  // Share card, title and sitemap read public tournaments only: never a draft.
  assert.equal(await shareTournament(db, hidden.id), null, "a draft's share card 404s");
  const share = await shareTournament(db, t.id);
  assert.equal(share!.name, "The Ariaria Cup"); assert.equal(share!.sponsor!.name, "Ariaria Ltd"); assert.equal((share as Record<string, unknown>).seed, undefined);
  const inMap = await sitemapTournaments(db);
  assert.ok(inMap.some((x) => x.id === t.id && x.updatedAt)); assert.ok(!inMap.some((x) => x.id === hidden.id), "no drafts in the sitemap");

  // Results: not while playing; after closing, checked; then prizes sent.
  await rejects(adminAction(db, t.id, "results-checked", o(during)), 409, /after play has ended/);
  await rejects(adminAction(db, t.id, "prizes-sent", o(during)), 409, /Check the results first/);
  await rejects(updateTournament(db, t.id, { ...draft, legalChecked: true, level: "easy" }, o(during)), 409, /can't change/);
  await adminAction(db, t.id, "close", o(during));
  await rejects(startRun(db, me("a3"), t.id, o(during)), 409, /has ended/);
  // §5: winners are told only after the results are checked.
  await db.doc("users/team").set({ uid: "team", username: "notesteam", displayName: "#NotesApp" });
  await db.doc("usernames/notesteam").set({ uid: "team" });
  const sender = await officialSender(db, "notesteam");
  assert.deepEqual(sender, { ok: true, uid: "team", username: "notesteam" });
  const noAlerts = { email: async () => {}, push: async () => 0 };
  await rejects(winnersPlan(db, t.id, undefined, { ...o(during), sender }), 409, /Results checked/);
  await rejects(tellWinners(db, t.id, 1, { ...o(during), sender, alerts: noAlerts }), 409, /Results checked/);
  const results = await adminResults(db, t.id);
  assert.deepEqual(results.map((r) => r.username).sort(), ["adult1", "adult4", "adult6"], "only entrants with a checked best");
  assert.equal(results.find((r) => r.username === "adult1")!.runs.length, 3, "every try a member sent");
  assert.equal(results[0].username, "adult4");
  const done = await adminAction(db, t.id, "results-checked", o(during));
  assert.equal(done.status, "results"); assert.ok(done.resultsCheckedAt);
  assert.ok((await adminAction(db, t.id, "prizes-sent", o(during))).prizesSentAt);

  // The sponsor's report.
  const rep = await sponsorReport(db, t.id);
  assert.equal(rep.entrants, 6); assert.equal(rep.tries, 12); assert.equal(rep.finished, 5);
  assert.equal(rep.rejected, 5); assert.equal(rep.abandoned, 1); assert.equal(rep.expired, 1);
  assert.equal(rep.sponsorImpressions, 2); assert.equal(rep.sponsorClicks, 1);
  assert.equal(rep.pageViews, 3); assert.equal(rep.listViews, 2, "list views on the days it ran only");
  assert.deepEqual(rep.winners, []); assert.equal(rep.winnersNotifiedAt, null);

  // Telling the winners (§5; owner, 24 Nov 2026). One prize, so one winner by default. adult4 led, but is suspended now: skipped, and
  // adult1 (next on the board) moves up. adult1 takes messages only from people they follow; #NotesApp's system message still reaches them.
  await db.doc("users/a4").update({ suspended: true });
  await db.doc("users/a1").update({ keepDmFollowers: true });
  const plan = await winnersPlan(db, t.id, undefined, { ...o(after()), sender });
  assert.equal(plan.count, 1); assert.equal(plan.max, 1); assert.deepEqual(plan.sender, { ok: true, username: "notesteam" });
  assert.deepEqual(plan.rows.map((r) => [r.username, r.place, r.action]), [["adult4", null, "skip"], ["adult1", 1, "send"]]);
  assert.match(plan.rows[0].why!, /suspended/);
  assert.equal(plan.rows[1].prize, "A phone");
  assert.match(plan.rows[1].text, /^Congratulations, @adult1! You placed 1st in The Ariaria Cup \(Fake, 29–30 Nov 2026\)/);
  assert.match(plan.rows[1].text, /A phone, from Ariaria Ltd/); assert.match(plan.rows[1].text, /Reply here to confirm your details/);
  await rejects(winnersPlan(db, t.id, 2, { ...o(after()), sender }), 400, /one per prize/);
  const told = await tellWinners(db, t.id, 1, { ...o(after()), sender, alerts: noAlerts });
  assert.deepEqual(told.sent, [{ username: "adult1", place: 1, dm: true }]); assert.deepEqual(told.failed, []);
  assert.deepEqual(told.skipped.map((s) => s.username), ["adult4"]);
  const cid = conversationId("team", "a1");
  const dms = await db.collection(`conversations/${cid}/messages`).get();
  assert.equal(dms.size, 1); assert.equal(dms.docs[0].data().from, "team"); assert.match(dms.docs[0].data().text, /You placed 1st/);
  const bells = await db.collection("notifications").where("recipientUid", "==", "a1").get();
  assert.deepEqual(bells.docs.map((d) => [d.data().type, d.data().linkHref]), [["arcade", `/arcade/tournaments/${t.id}`]], "one bell, to the tournament; no extra 'new message' bell");
  // Idempotent: Send again tells nobody twice.
  await rejects(tellWinners(db, t.id, 1, { ...o(after()), sender, alerts: noAlerts }), 409, /already been told/);
  assert.equal((await db.collection(`conversations/${cid}/messages`).get()).size, 1);
  assert.equal((await winnersPlan(db, t.id, 1, { ...o(after()), sender })).rows[1].action, "told");
  const rep2 = await sponsorReport(db, t.id);
  assert.equal(rep2.winners.length, 1); assert.equal(rep2.winners[0].username, "adult1"); assert.equal(rep2.winners[0].prize, "A phone");
  assert.equal((rep2.winners[0] as Record<string, unknown>).uid, undefined, "usernames only in the report"); assert.ok(rep2.winnersNotifiedAt);
  assert.equal((await getTournament(db, t.id, undefined, o(after()))).tournament.winnersNotifiedAt, rep2.winnersNotifiedAt);
  assert.equal(((await getTournament(db, t.id, undefined, o(after()))).tournament as Record<string, unknown>).winners, undefined, "no winners' uids in public");
  await db.doc("users/a4").update({ suspended: false });

  // A practice tournament: teens play; kids still don't; no prizes allowed.
  const p = await createTournament(db, { ...draft, name: "Teen Practice", prize: false, prizes: [], ageRule: "practice", sponsor: undefined }, "admin1", o(created));
  await adminAction(db, p.id, "open", o(created));
  const ts = await startRun(db, me("teen"), p.id, o(during));
  assert.equal(ts.try, 1);
  await rejects(startRun(db, me("kid_abc"), p.id, o(during)), 403, /kids' accounts/);
  const tf = await finishRun(db, me("teen"), p.id, ts.runId, rec(p.seed, 1, 12), o(plus(during, 61_000)));
  assert.equal(tf.rank, 1);
  await rejects(adminAction(db, p.id, "prizes-sent", o(after())), 409, /practice tournament/);
  assert.equal(await activeSponsor(db, "fake", o(during)), null, "no sponsor, no takeover");

  // "Tell the top players" in a practice tournament: a plain congratulations. A deleted account is skipped; the teen gets the bell only.
  for (const [u, moves] of [["a2", 15], ["a3", 18]] as const) {
    const r = await startRun(db, me(u), p.id, o(during));
    await finishRun(db, me(u), p.id, r.runId, rec(p.seed, 1, moves), o(plus(during, 61_000)));
  }
  await adminAction(db, p.id, "results-checked", o(after()));
  await db.doc("users/a2").delete();
  const pp = await winnersPlan(db, p.id, undefined, { ...o(after()), sender });
  assert.equal(pp.count, 3);
  assert.deepEqual(pp.rows.map((r) => [r.username, r.place, r.action]), [["teen1", 1, "bell"], ["adult2", null, "skip"], ["adult3", 2, "send"]]);
  assert.match(pp.rows[1].why!, /deleted/);
  assert.match(pp.rows[2].text, /^Well played, @adult3! You finished 2nd/); assert.doesNotMatch(pp.rows[2].text, /confirm your details/);
  // Without #NotesApp's messaging account set up, nothing is sent.
  await rejects(tellWinners(db, p.id, 3, { ...o(after()), sender: await officialSender(db, ""), alerts: noAlerts }), 409, /OFFICIAL_MESSAGES_USERNAME/);
  assert.equal((await db.doc(`tournaments/${p.id}`).get()).data()!.winners, undefined);
  // A member who blocked the account isn't messaged; their claim is given back so Send can try again later.
  await db.doc("dmBlocks/a3_team").set({ blocker: "a3", blocked: "team" });
  const pt = await tellWinners(db, p.id, 3, { ...o(after()), sender, alerts: noAlerts });
  assert.deepEqual(pt.sent, [{ username: "teen1", place: 1, dm: false }]);
  assert.equal(pt.failed.length, 1); assert.match(pt.failed[0].error, /blocked/);
  assert.deepEqual(((await db.doc(`tournaments/${p.id}`).get()).data()!.winners as { username: string }[]).map((w) => w.username), ["teen1"]);
  assert.equal((await db.collection(`conversations/${conversationId("team", "teen")}/messages`).get()).size, 0, "no chat with a teen");
  assert.equal((await db.collection("notifications").where("recipientUid", "==", "teen").get()).size, 1, "the teen's bell");
  await db.doc("dmBlocks/a3_team").delete();
  const pt2 = await tellWinners(db, p.id, 3, { ...o(after()), sender, alerts: noAlerts });
  assert.deepEqual(pt2.sent, [{ username: "adult3", place: 2, dm: true }]);
  assert.equal((await db.collection(`conversations/${conversationId("team", "a3")}/messages`).get()).size, 1);

  console.log("TOURNAMENTS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

function after() { return at("2026-12-01T00:00:00Z"); }
