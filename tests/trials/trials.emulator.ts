// Free trials against the emulators (lib/trials-server.ts, the expiry in lib/tier-billing.ts). Run: npm run test:trials-server → "ALL OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { TrialError, startTrial } from "../../lib/trials-server";
import { expireOrgTrials } from "../../lib/tier-billing";

initializeApp({ projectId: "demo-notesapp" });
const db = getFirestore();
const ok = { emailVerified: true };
const fails = async (p: Promise<unknown>, re: RegExp) => { await assert.rejects(p, (e: unknown) => e instanceof TrialError && re.test(e.message)); };

(async () => {
  await db.doc("users/ada").set({ uid: "ada", username: "ada", displayName: "Ada", role: "publisher", accountTier: "basic" });
  await db.doc("users/org").set({ uid: "org", username: "bigco", displayName: "Big Co", role: "publisher", accountTier: "basic", accountKind: "organisation", org: { rcNumber: "RC123" } });
  await db.doc("users/org2").set({ uid: "org2", username: "bigco2", displayName: "Big Co again", role: "publisher", accountTier: "basic", accountKind: "organisation", org: { rcNumber: "RC123" } });
  await db.doc("users/reader").set({ uid: "reader", username: "r", displayName: "R", role: "reader", accountTier: "standard" });

  await fails(startTrial(db, "ada", "pro", { emailVerified: false }), /Verify your email/);
  await fails(startTrial(db, "reader", "pro", ok), /publishers/);
  const t = await startTrial(db, "ada", "pro", ok, new Date("2026-10-01T00:00:00Z"));
  assert.equal(t.until, "2026-10-16T00:00:00.000Z", "15 days");
  let u = (await db.doc("users/ada").get()).data()!;
  assert.equal(u.accountTier, "pro"); assert.equal(u.trialTier, "pro"); assert.equal(u.trials.length, 1);
  await fails(startTrial(db, "ada", "business", ok, new Date("2026-10-05T00:00:00Z")), /You're on a free Pro trial/);

  // The trial ends (the daily sweep): back to Free Basic; Business can't be tried without paying first.
  assert.ok((await expireOrgTrials()) >= 1);
  u = (await db.doc("users/ada").get()).data()!;
  assert.equal(u.accountTier, "basic"); assert.equal(u.trialUntil, undefined);
  await fails(startTrial(db, "ada", "business", ok), /paid plan has to come between/);
  await fails(startTrial(db, "ada", "pro", ok), /already had your free Pro trial/);
  // Pays for Pro: may now try Business; when that ends, back to Pro (what they pay for), not Free Basic.
  await db.doc("tierSubscriptions/ada").set({ uid: "ada", tier: "pro", status: "active", currentPeriodEnd: "2099-01-01T00:00:00Z" });
  await db.doc("users/ada").update({ accountTier: "pro", lastPaidAt: new Date().toISOString() });
  await startTrial(db, "ada", "business", ok, new Date(Date.now() - 20 * 86_400_000));
  await expireOrgTrials();
  u = (await db.doc("users/ada").get()).data()!;
  assert.equal(u.accountTier, "pro", "back to the plan they pay for");
  assert.equal(u.trials.length, 2);

  // Organisations: Business once per registration number, across accounts.
  await startTrial(db, "org", "business", ok);
  assert.equal((await db.doc("orgTrials/RC123").get()).exists, true);
  await fails(startTrial(db, "org2", "business", ok), /already been used for this organisation/);
  assert.equal((await startTrial(db, "org2", "pro", ok)).tier, "pro", "Pro is a different plan");
  console.log("ALL OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
