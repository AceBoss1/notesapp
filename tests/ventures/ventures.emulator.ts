// NotesApp Ventures (Rewrite the Playbook) against the Firestore emulator: who may pitch (verified email, 18 and over, not suspended), the
// emerging-markets rule and the terms tick box, the checks on each field, rolling applications grouped by quarter, up to 3 pitches a member
// a quarter, withdrawing, the team's decisions (up to 3 picked a quarter), advice the member sees and notes they never see, and pausing.
// Run: npm run test:ventures → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { adminPitches, callSettings, decidePitch, myPitches, sendPitch, setCall, setPicksPerQuarter, withdrawPitch } from "../../lib/ventures-server";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const rejects = (p: Promise<unknown>, re: RegExp, why?: string) => assert.rejects(p, (e: Error) => re.test(e.message), why);

const ok = (over: Record<string, unknown> = {}) => ({
  kind: "product", sector: "fintech", stage: "idea", region: "africa", countries: "Nigeria, Ghana",
  title: "Kolo Circles", oneLiner: "Group savings for market women, without the box.",
  problem: "Market women save in ajo groups run on trust and notebooks; money goes missing and payouts are late.",
  solution: "A shared savings circle with automatic contributions, a payout schedule everyone can see, and SMS for feature phones.",
  whyYou: "I ran an ajo group for six years in Balogun market.", traction: "", teamSize: 2, links: ["https://example.com/demo"],
  emergingMarkets: true, agree: true, ...over,
});
const ME = { uid: "u_ada", emailVerified: true };

async function main() {
  await db.doc("users/u_ada").set({ username: "ada", displayName: "Ada" });
  await db.doc("users/u_teen").set({ username: "tobi", teen: true });
  await db.doc("users/u_gone").set({ username: "gone", suspended: true });

  // Who may pitch.
  await rejects(sendPitch(db, { uid: "u_ada", emailVerified: false }, ok()), /Verify your email/);
  await rejects(sendPitch(db, { uid: "u_teen", emailVerified: true }, ok()), /18 and over/);
  await rejects(sendPitch(db, { uid: "kid_x", emailVerified: true }, ok()), /18 and over/);
  await rejects(sendPitch(db, { uid: "u_gone", emailVerified: true }, ok()), /can't do that/);

  // The emerging-markets rule, the terms, and the fields.
  await rejects(sendPitch(db, ME, ok({ emergingMarkets: false })), /emerging markets/);
  await rejects(sendPitch(db, ME, ok({ agree: false })), /Tick the box/);
  await rejects(sendPitch(db, ME, ok({ region: "north-america" })), /emerging market/);
  await rejects(sendPitch(db, ME, ok({ problem: "too short" })), /at least 40/);
  await rejects(sendPitch(db, ME, ok({ links: ["http://plain.example"] })), /https/);
  await rejects(sendPitch(db, ME, ok({ teamSize: 0 })), /Team size/);

  // Rolling, grouped by quarter. A pitch; the same name twice in a quarter is refused; up to 3 a member a quarter.
  const NOV = new Date("2026-11-06T10:00:00Z"), JAN = new Date("2027-01-10T10:00:00Z");
  assert.deepEqual(await callSettings(db), { open: true, picksPerQuarter: 3 });
  const p1 = await sendPitch(db, ME, ok(), NOV);
  assert.deepEqual([p1.status, p1.quarter], ["received", "Q4 2026"]);
  await rejects(sendPitch(db, ME, ok({ title: "kolo circles" }), NOV), /already pitched/);
  await sendPitch(db, ME, ok({ title: "Second" }), NOV);
  const p3 = await sendPitch(db, ME, ok({ title: "Third" }), NOV);
  await rejects(sendPitch(db, ME, ok({ title: "Fourth" }), NOV), /up to 3 pitches a quarter/);
  // Withdrawing frees a place; someone else can't withdraw yours.
  await withdrawPitch(db, "u_ada", p3.id);
  await rejects(withdrawPitch(db, "u_other", p1.id), /not found/);
  const p4 = await sendPitch(db, ME, ok({ title: "Fourth" }), NOV);
  assert.equal((await myPitches(db, "u_ada")).length, 4);

  // The team: advice reaches the member, notes never do; the member is told; a withdrawn pitch can't be moved.
  await decidePitch(db, p1.id, { status: "shortlisted", notes: "Strong founder-market fit", advice: "Show us 20 market women who'd join.", perksSent: true }, NOV);
  const mine = (await myPitches(db, "u_ada")).find((a) => a.id === p1.id)!;
  assert.deepEqual([mine.status, mine.advice], ["shortlisted", "Show us 20 market women who'd join."]);
  assert.equal("notes" in mine, false, "notes never reach the member");
  const all = await adminPitches(db, NOV);
  const a1 = all.applications.find((a) => a.id === p1.id)!;
  assert.deepEqual([a1.notes, !!a1.perksSentAt, all.quarter, all.call.picksPerQuarter], ["Strong founder-market fit", true, "Q4 2026", 3]);
  await rejects(decidePitch(db, p3.id, { status: "picked" }, NOV), /withdrew/);
  await rejects(decidePitch(db, p1.id, { status: "withdrawn" }, NOV), /Choose a status/);

  // Up to 3 picked a quarter: other members' pitches fill the quarter, the 4th pick is refused, next quarter it's fine.
  for (const n of [1, 2, 3]) {
    await db.doc(`users/u_m${n}`).set({ username: `m${n}` });
    const x = await sendPitch(db, { uid: `u_m${n}`, emailVerified: true }, ok({ title: `Idea ${n}` }), NOV);
    await decidePitch(db, x.id, { status: "picked" }, NOV);
  }
  assert.equal((await adminPitches(db, NOV)).pickedThisQuarter, 3);
  await rejects(decidePitch(db, p1.id, { status: "picked" }, NOV), /3 pitches are already picked in Q4 2026/);
  // A super admin raises the quota (Admin → Limits): the 4th pick goes through, and the 5th is refused at the new limit.
  await rejects(setPicksPerQuarter(db, 0, "admin"), /1 to 50/);
  await rejects(setPicksPerQuarter(db, 2.5, "admin"), /1 to 50/);
  await setPicksPerQuarter(db, 4, "admin");
  assert.equal((await callSettings(db)).picksPerQuarter, 4);
  await decidePitch(db, p1.id, { status: "picked" }, NOV);
  await db.doc("users/u_m9").set({ username: "m9" });
  const x9 = await sendPitch(db, { uid: "u_m9", emailVerified: true }, ok({ title: "Idea 9" }), NOV);
  await rejects(decidePitch(db, x9.id, { status: "picked" }, NOV), /4 pitches are already picked in Q4 2026/);
  // Back to 3 and un-pick p1, so the next-quarter check below starts clean.
  await setPicksPerQuarter(db, 3, "admin");
  await decidePitch(db, p1.id, { status: "shortlisted" }, NOV);
  await decidePitch(db, p4.id, { status: "not-picked", advice: "Try again with a pilot." }, NOV);
  assert.equal((await myPitches(db, "u_ada")).find((a) => a.id === p4.id)!.status, "not-picked");
  await decidePitch(db, p1.id, { status: "picked" }, JAN);
  assert.equal((await adminPitches(db, JAN)).pickedThisQuarter, 1, "a new quarter has its own 3 picks");
  await rejects(withdrawPitch(db, "u_ada", p1.id), /can't be withdrawn/);

  // A new quarter has its own pitch limit and names; the team can pause the call.
  const q1 = await sendPitch(db, ME, ok({ title: "Kolo Circles" }), JAN);
  assert.equal(q1.quarter, "Q1 2027");
  await rejects(setCall(db, {}, "admin"), /Open or pause/);
  await setCall(db, { open: false }, "admin");
  await rejects(sendPitch(db, ME, ok({ title: "Paused" }), JAN), /paused/);
  await setCall(db, { open: true }, "admin");

  console.log("ALL OK");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
