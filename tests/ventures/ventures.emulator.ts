// NotesApp Ventures (Rewrite the Playbook) against the Firestore emulator: who may pitch (verified email, 18 and over, not suspended), the
// emerging-markets rule and the terms tick box, the checks on each field, the round (open, closed, a closing day), up to 3 pitches a
// round, withdrawing, the team's decisions and notes (never shown to the member), and opening a new round.
// Run: npm run test:ventures → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { adminPitches, decidePitch, myPitches, roundSettings, sendPitch, setRound, withdrawPitch } from "../../lib/ventures-server";

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

  // A pitch; the same name twice in a round is refused; up to 3 a round.
  assert.deepEqual(await roundSettings(db), { round: "Round 1", open: true });
  const p1 = await sendPitch(db, ME, ok());
  assert.equal(p1.status, "received");
  await rejects(sendPitch(db, ME, ok({ title: "kolo circles" })), /already pitched/);
  await sendPitch(db, ME, ok({ title: "Second" }));
  const p3 = await sendPitch(db, ME, ok({ title: "Third" }));
  await rejects(sendPitch(db, ME, ok({ title: "Fourth" })), /up to 3/);
  // Withdrawing frees a place.
  await withdrawPitch(db, "u_ada", p3.id);
  await rejects(withdrawPitch(db, "u_other", p1.id), /not found/);
  await sendPitch(db, ME, ok({ title: "Fourth" }));
  assert.equal((await myPitches(db, "u_ada")).length, 4);

  // The team: notes stay private, status changes tell the member, a withdrawn pitch can't be moved.
  await decidePitch(db, p1.id, { status: "shortlisted", notes: "Strong founder-market fit", perksSent: true });
  const mine = (await myPitches(db, "u_ada")).find((a) => a.id === p1.id)!;
  assert.equal(mine.status, "shortlisted");
  assert.equal("notes" in mine, false, "notes never reach the member");
  const all = await adminPitches(db);
  const a1 = all.applications.find((a) => a.id === p1.id)!;
  assert.deepEqual([a1.notes, !!a1.perksSentAt], ["Strong founder-market fit", true]);
  await rejects(decidePitch(db, p3.id, { status: "picked" }), /withdrew/);
  await rejects(decidePitch(db, p1.id, { status: "withdrawn" }), /Choose a status/);
  await rejects(withdrawPitch(db, "u_ada", (await myPitches(db, "u_ada")).find((a) => a.status === "received")!.id).then(async () => {
    await decidePitch(db, p1.id, { status: "picked" });
    await withdrawPitch(db, "u_ada", p1.id);
  }), /can't be withdrawn/);

  // Rounds: closed, a closing day passed, then a new round.
  await setRound(db, { round: "Round 1", open: false }, "admin");
  await rejects(sendPitch(db, ME, ok({ title: "Closed" })), /is closed/);
  await setRound(db, { round: "Round 1", open: true, closesOn: "2026-11-01" }, "admin");
  await rejects(sendPitch(db, ME, ok({ title: "Late" }), new Date("2026-11-06T10:00:00Z")), /is closed/);
  await setRound(db, { round: "Round 2", open: true }, "admin");
  const r2 = await sendPitch(db, ME, ok({ title: "Kolo Circles" }));
  assert.equal(r2.round, "Round 2", "a new round has its own limit and names");

  console.log("ALL OK");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
