// What a free trial kept you, on the server (lib/trial-earnings-server.ts) against the Firestore emulator: the running total, the result
// kept at the end, the one nudge and Admin's figures. The rates are the defaults in lib/tiers.ts (no saved pricing in the emulator).
// Run: npm run test:gtm-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as S from "../../lib/trial-earnings-server";
import { myRates } from "../../lib/my-rates";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const DAY = 86_400_000;
const basic = myRates("basic").session, pro = myRates("pro").session;
const ledger = (id: string, uid: string, kind: string, gross: number, rate: number, at: number, extra: Record<string, unknown> = {}) =>
  db.doc(`ledger/${id}`).set({ reference: id, kind, publisherUid: uid, grossKobo: gross, commissionKobo: Math.round(gross * rate), netKobo: gross - Math.round(gross * rate), status: "held", createdAt: new Date(at).toISOString(), ...extra });

(async () => {
  const NOW = Date.now(), start = NOW - 9 * DAY, until = start + 15 * DAY;
  const trial = { tier: "pro", startedAt: new Date(start).toISOString(), until: new Date(until).toISOString() };
  await db.doc("users/ada").set({ uid: "ada", username: "ada", displayName: "Ada", role: "publisher", accountTier: "pro", trialTier: "pro", trialUntil: trial.until, trials: [trial] });
  await db.doc("users/bo").set({ uid: "bo", username: "bo", displayName: "Bo", role: "publisher", accountTier: "basic" });
  await ledger("a1", "ada", "booking", 10_000_000, pro, start + DAY);
  await ledger("a2", "ada", "gift", 2_000_000, pro, start + 2 * DAY);
  await ledger("a3", "ada", "booking", 5_000_000, pro, start + 3 * DAY, { status: "refunded" });
  await ledger("a4", "ada", "booking", 4_000_000, basic, start - 5 * DAY); // before the trial
  await ledger("b1", "bo", "booking", 9_000_000, basic, start + DAY); // someone else's

  // While the trial runs: the total so far, only Ada's, only in the trial, refunds left out.
  const v = await S.trialView(db, "ada", new Date(NOW));
  assert.equal(v.state, "running");
  if (v.state !== "running") throw new Error();
  assert.equal(v.day, 9);
  assert.equal(v.days, 15);
  assert.equal(v.back, "basic");
  assert.equal(v.comparison.count, 2);
  assert.equal(v.comparison.grossKobo, 12_000_000);
  assert.equal(v.comparison.extraKobo, Math.round(12_000_000 * (basic - pro)));
  assert.equal((await S.trialView(db, "bo")).state, "none");

  // At the end: the result is kept, and the email says what it kept.
  const u = (await db.doc("users/ada").get()).data()!;
  const r = await S.recordTrialEnd(db, "ada", u, null, new Date(until + 60_000));
  assert.ok(r);
  assert.equal(r!.monthlyKobo, 500_000);
  assert.equal(r!.outcome.verdict, "paid", `₦120,000 at ${basic} vs ${pro} keeps more than 15 days of Pro cost`);
  const stored = (await db.doc(`trialResults/ada_${trial.startedAt.slice(0, 10)}`).get()).data()!;
  assert.equal(stored.uid, "ada");
  assert.equal(stored.comparison.extraKobo, r!.comparison.extraKobo);
  assert.match(S.resultEmailText(r!), /Pro kept you ₦[\d,]+ more, and costs ₦5,000 a month\./);
  await db.doc("users/ada").update({ accountTier: "basic", trialTier: null, trialUntil: null });
  const ended = await S.trialView(db, "ada", new Date(until + DAY));
  assert.equal(ended.state, "ended");
  assert.equal(await S.recordTrialEnd(db, "bo", { trialTier: "enterprise", trialUntil: trial.until }, null), null, "only Pro and Business trials");

  // A "not yet" trial, then a busy month: one nudge, then none for 60 days.
  const cStart = NOW - 60 * DAY, cUntil = cStart + 15 * DAY;
  const ct = { tier: "pro", startedAt: new Date(cStart).toISOString(), until: new Date(cUntil).toISOString() };
  await db.doc("users/cy").set({ uid: "cy", username: "cy", displayName: "Cy", role: "publisher", accountTier: "pro", trialTier: "pro", trialUntil: ct.until, trials: [ct] });
  await ledger("c1", "cy", "booking", 500_000, pro, cStart + DAY); // ₦5,000 in the trial
  const cr = await S.recordTrialEnd(db, "cy", (await db.doc("users/cy").get()).data()!, null, new Date(cUntil + 1000));
  assert.equal(cr!.outcome.verdict, "not_yet");
  assert.match(S.resultEmailText(cr!), /Free Basic suits you for now: Pro pays for itself once you earn about ₦[\d,]+ a month/);
  await db.doc("users/cy").update({ accountTier: "basic", trialTier: null, trialUntil: null });
  assert.deepEqual(await S.nudgesDue(db, NOW), [], "a quiet month: no message");
  await ledger("c2", "cy", "booking", 10_000_000, basic, NOW - 5 * DAY); // ₦100,000 last month, at Free Basic's rate
  const due = await S.nudgesDue(db, NOW);
  assert.deepEqual(due.map((d) => d.uid), ["cy"]);
  assert.equal(due[0].extraKobo, Math.round(10_000_000 * (basic - pro)));
  await S.markNudged(db, due[0].id, new Date(NOW).toISOString());
  assert.deepEqual(await S.nudgesDue(db, NOW + DAY), [], "not again within 60 days");
  await db.doc("users/cy").update({ accountTier: "pro" });
  assert.deepEqual(await S.nudgesDue(db, NOW + 61 * DAY), [], "never while on a plan");

  // Admin's figures: Ada paid after her trial, Cy after the nudge.
  await db.doc("users/ada").update({ lastPaidAt: new Date(until + 2 * DAY).toISOString() });
  await db.doc("users/cy").update({ lastPaidAt: new Date(NOW + 3600_000).toISOString() });
  const st = await S.trialStatsFor(db, 90, until + 3 * DAY);
  assert.equal(st.ended, 2);
  assert.equal(st.paidAfter, 2);
  assert.equal(st.paidAfterToldPaid, 1);
  assert.equal(st.paidAfterToldNotYet, 1);
  assert.equal(st.nudged, 1);
  assert.equal(st.paidAfterNudge, 1);
  assert.equal(st.planMonthlyKobo, 1_000_000);
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
