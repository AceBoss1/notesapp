// Promo campaigns end to end on the Firestore emulator (lib/promos-server.ts, lib/ventures-server.ts, lib/tier-billing.ts's trial job).
// Run: npm run test:promos-server → "PROMOS SERVER OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PromoError, adminPromo, claimPromoPlan, joinPromoTournament, myPromo, promoStatus } from "../../lib/promos-server";
import { VenturesError, decidePitch, sendPitch } from "../../lib/ventures-server";
import { finishTournamentRun, leaderboard, startTournamentRun } from "../../lib/tournament-server";
import { createRun, step, type RunInput } from "../../lib/arcade/run";
import { encodeStep } from "../../lib/arcade/run-replay";
import { DAVIDO_AT_34 } from "../../lib/promos";
initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const now = new Date("2026-11-21T12:00:00Z");
const me = (uid: string) => ({ uid, emailVerified: true });
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => (e instanceof PromoError || e instanceof VenturesError) && re.test(e.message));
const pitch = (title: string, promoCode?: string) => ({
  kind: "business", sector: "fintech", stage: "idea", region: "africa", countries: "Nigeria", title,
  oneLiner: "It helps traders get paid faster.", problem: "x".repeat(60), solution: "y".repeat(60), whyYou: "z".repeat(30), traction: "", teamSize: 2,
  links: [], agree: true, emergingMarkets: true, ...(promoCode ? { promoCode } : {}),
});

(async () => {
  for (let i = 0; i < 40; i++) await db.doc(`users/u${i}`).set({ uid: `u${i}`, username: `member${i}`, displayName: `Member ${i}`, role: "publisher", accountTier: "basic" });
  await db.doc("users/reader").set({ uid: "reader", username: "reader", role: "reader", accountTier: "standard" });
  await db.doc("users/paidpro").set({ uid: "paidpro", username: "paidpro", role: "publisher", accountTier: "pro" });
  await db.doc("tierSubscriptions/paidpro").set({ tier: "pro", status: "active" });
  await db.doc("users/org1").set({ uid: "org1", username: "acme", role: "publisher", accountTier: "basic", accountKind: "organisation", org: { rcNumber: "RC123" } });
  await db.doc("users/org2").set({ uid: "org2", username: "acme2", role: "publisher", accountTier: "basic", accountKind: "organisation", org: { rcNumber: "RC123" } });
  await db.doc("users/teen").set({ uid: "teen", username: "teen", role: "publisher", accountTier: "basic", teen: true });

  // Status before anything: everything left.
  let st = await promoStatus(db, "davido at 34", now);
  assert.deepEqual(st.plans.map((p) => p.left), [34, 34, 1000]);
  assert.equal(st.ventures!.left, 4);
  await rejects(promoStatus(db, "NOPE", now), /isn't one of our offers/);

  // A claim: the plan starts now, rides on the trial fields with the promo marker, and isn't added to the trial history.
  const c0 = await claimPromoPlan(db, me("u0"), "DAVIDO-at-34", "pro", now);
  assert.equal(c0.tier, "pro"); assert.equal(c0.until, "2027-11-21T12:00:00.000Z"); assert.equal(c0.left, 999);
  const u0 = (await db.doc("users/u0").get()).data()!;
  assert.equal(u0.accountTier, "pro"); assert.equal(u0.trialTier, "pro"); assert.equal(u0.trialSource, "promo:davido-at-34"); assert.equal(u0.trials, undefined);
  assert.deepEqual(await myPromo(db, "u0", "davido-at-34"), { plan: { tier: "pro", until: c0.until }, tournament: false });
  // One per account, whichever plan.
  await rejects(claimPromoPlan(db, me("u0"), "DAVIDO-at-34", "enterprise", now), /one per account/);
  // Who can't.
  await rejects(claimPromoPlan(db, { uid: "u1", emailVerified: false }, "DAVIDO-at-34", "pro", now), /Verify your email/);
  await rejects(claimPromoPlan(db, me("reader"), "DAVIDO-at-34", "pro", now), /switch to Free Basic/);
  await rejects(claimPromoPlan(db, me("paidpro"), "DAVIDO-at-34", "pro", now), /already has Pro/);
  await rejects(claimPromoPlan(db, me("u1"), "WRONG", "pro", now), /isn't one of our offers/);
  // One per organisation registration number, across accounts.
  await claimPromoPlan(db, me("org1"), "DAVIDO-at-34", "business", now);
  await rejects(claimPromoPlan(db, me("org2"), "DAVIDO-at-34", "enterprise", now), /one per account/);

  // The last slots: 34 Enterprise, claimed by 35 members at once; exactly 34 get one, and the counter says 34.
  const results = await Promise.allSettled(Array.from({ length: 35 }, (_, i) => claimPromoPlan(db, me(`u${i + 1}`), "DAVIDO-at-34", "enterprise", now)));
  const won = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(won, 34, "exactly 34 Enterprise plans");
  const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.match(String(lost.reason.message), /All 34 Enterprise for 1 month slots have been claimed/);
  st = await promoStatus(db, "DAVIDO-at-34", now);
  assert.deepEqual(st.plans.map((p) => p.left), [0, 33, 999]);
  assert.equal((await db.collection("promoClaims").where("campaignId", "==", "davido-at-34").get()).size, 36);

  // Ventures: a pitch with the code is tagged; picking it uses the campaign's 4 slots (not the quarter's 3), and a 5th pick is refused.
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    const p = await sendPitch(db, me(`u${i}`), pitch(`Idea ${i}`, "davido-at-34"), now);
    ids.push(p.id);
    assert.equal((await db.doc(`ventureApplications/${p.id}`).get()).data()!.campaign, "davido-at-34");
  }
  await rejects(sendPitch(db, me("u9"), pitch("Bad code", "DAVIDO-at-35"), now), /isn't for NotesApp Ventures/);
  const plain = await sendPitch(db, me("u9"), pitch("No code"), now);
  assert.equal((await db.doc(`ventureApplications/${plain.id}`).get()).data()!.campaign, undefined);
  for (let i = 0; i < 4; i++) await decidePitch(db, ids[i], { status: "picked" }, now);
  await rejects(decidePitch(db, ids[4], { status: "picked" }, now), /All 4 DAVIDO-at-34 venture slots are already picked/);
  assert.equal((await promoStatus(db, "DAVIDO-at-34", now)).ventures!.left, 0);
  // The quarter's picks are untouched: a regular pitch can still be picked.
  await decidePitch(db, plain.id, { status: "picked" }, now);
  // With every slot picked, the code no longer opens a pitch…
  await rejects(sendPitch(db, me("u10"), pitch("Late", "DAVIDO-at-34"), now), /venture slots are filled/);
  // …until one is un-picked.
  await decidePitch(db, ids[0], { status: "not-picked" }, now);
  assert.equal((await promoStatus(db, "DAVIDO-at-34", now)).ventures!.left, 1);
  await decidePitch(db, ids[4], { status: "picked" }, now);
  assert.equal((await promoStatus(db, "DAVIDO-at-34", now)).ventures!.left, 0);

  // The tournament: sign up on the day, once; not before or after; adults only.
  const day = new Date("2026-11-21T15:00:00Z");
  assert.deepEqual(await joinPromoTournament(db, me("u5"), "DAVIDO-at-34", day), { entries: 1 });
  assert.deepEqual(await joinPromoTournament(db, me("u5"), "DAVIDO-at-34", day), { entries: 1 }, "twice counts once");
  assert.deepEqual(await joinPromoTournament(db, me("u6"), "DAVIDO-at-34", day), { entries: 2 });
  await rejects(joinPromoTournament(db, me("u7"), "DAVIDO-at-34", new Date("2026-11-22T08:00:00Z")), /only/);
  await rejects(joinPromoTournament(db, me("teen"), "DAVIDO-at-34", day), /18 and over/);
  assert.equal((await myPromo(db, "u5", "DAVIDO-at-34")).tournament, true);

  // Admin sees it all.
  const a = await adminPromo(db, "davido-at-34", now);
  assert.equal(a.claims.length, 36); assert.equal(a.tournament.length, 2); assert.equal(a.pitches.length, 5);
  assert.equal(a.status.tournament!.entries, 2);

  // Tournament play (lib/tournament-server.ts): 10 PM to midnight Lagos, best of 3 tries, the server's own score.
  const T = DAVIDO_AT_34.tournament!;
  const play = (dodgeEvery: number) => { // a run recorded like the browser does; returns the recording and how long it ran
    let s = createRun(T.seed, T.level); const rec: number[] = []; let i = 0;
    while (!s.over && i < 20_000) { const input: RunInput = dodgeEvery && i % dodgeEvery === 0 ? (["left", "right", "jump"] as RunInput[])[(i / dodgeEvery) % 3] : "none"; rec.push(encodeStep(16, input)); s = step(s, 16, input); i++; }
    return { recording: rec.join(","), ms: rec.length * 16 };
  };
  const t0 = new Date("2026-11-21T21:05:00Z");
  await rejects(startTournamentRun(db, me("u20"), "DAVIDO-at-34", new Date("2026-11-21T20:00:00Z")), /starts at/);
  await rejects(startTournamentRun(db, me("u20"), "DAVIDO-at-34", new Date("2026-11-21T23:00:00Z")), /has ended/);
  await rejects(startTournamentRun(db, me("teen"), "DAVIDO-at-34", t0), /18 and over/);
  // u20 wasn't signed up: starting a try signs them up.
  const s1 = await startTournamentRun(db, me("u20"), "DAVIDO-at-34", t0);
  assert.equal(s1.seed, T.seed); assert.equal(s1.try, 1); assert.equal(s1.tries, 3);
  const runA = play(37);
  const f1 = await finishTournamentRun(db, me("u20"), "DAVIDO-at-34", s1.runId, runA.recording, new Date(t0.getTime() + runA.ms + 1000));
  assert.ok(f1.score > 0); assert.equal(f1.best, f1.score); assert.equal(f1.rank, 1); assert.equal(f1.triesLeft, 2);
  await rejects(finishTournamentRun(db, me("u20"), "DAVIDO-at-34", s1.runId, runA.recording, new Date(t0.getTime() + runA.ms + 2000)), /already in/);
  // A run that claims more running time than has passed is refused (and still uses the try).
  const s2 = await startTournamentRun(db, me("u20"), "DAVIDO-at-34", t0);
  await rejects(finishTournamentRun(db, me("u20"), "DAVIDO-at-34", s2.runId, runA.recording, new Date(t0.getTime() + 1000)), /longer than it did/);
  // Someone else's run can't be sent in.
  const s3 = await startTournamentRun(db, me("u20"), "DAVIDO-at-34", t0);
  await rejects(finishTournamentRun(db, me("u21"), "DAVIDO-at-34", s3.runId, runA.recording, new Date(t0.getTime() + runA.ms + 1000)), /wasn't found/);
  // A worse run doesn't lower the best.
  const runB = play(0);
  const f3 = await finishTournamentRun(db, me("u20"), "DAVIDO-at-34", s3.runId, runB.recording, new Date(t0.getTime() + runA.ms + 1000));
  assert.equal(f3.best, f1.score); assert.equal(f3.triesLeft, 0);
  // Three tries, then no more.
  await rejects(startTournamentRun(db, me("u20"), "DAVIDO-at-34", t0), /all 3 tries/);
  // Another player: the leaderboard orders by best score.
  const s4 = await startTournamentRun(db, me("u21"), "DAVIDO-at-34", t0);
  await finishTournamentRun(db, me("u21"), "DAVIDO-at-34", s4.runId, runB.recording, new Date(t0.getTime() + runB.ms + 1000));
  const board = await leaderboard(db, "DAVIDO-at-34", "u21");
  assert.deepEqual(board.rows.map((r) => r.username), ["member20", "member21"]);
  assert.equal(board.mine!.rank, 2); assert.equal(board.mine!.triesUsed, 1);
  assert.equal(board.rows[0].best, f1.score);
  assert.ok(!("uid" in board.rows[0]), "no uids on the public board");
  // Runs sent in after midnight + 15 minutes are refused.
  const s5 = await startTournamentRun(db, me("u22"), "DAVIDO-at-34", new Date("2026-11-21T22:59:00Z"));
  await rejects(finishTournamentRun(db, me("u22"), "DAVIDO-at-34", s5.runId, runB.recording, new Date("2026-11-21T23:16:00Z")), /has ended/);

  console.log("PROMOS SERVER OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
