// The monthly referrals and affiliate report (lib/referral-report.ts, lib/referral-report-server.ts) on the Firestore emulator:
// no activity means no email and no marker; activity means one email with the month's totals and no buyer named; a re-run sends
// nothing more; a member who turned it off is skipped. The mail sender, email lookup and bell are stubs.
// Run: npm run test:referral-report-server → "REFERRAL REPORT OK".
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
process.env.EMAIL_LINK_SECRET = "test-secret";
import { monthlyReferralReports, previewReport, setReportWanted, validReportToken, reportToken } from "../../lib/referral-report-server";
import { inSendWindow, monthById, reportMonth } from "../../lib/referral-report";
import type { Earning } from "../../lib/referrals";
// Its own project on the emulator, so other suites running against the same emulator don't add to this month.
initializeApp({ projectId: "demo-referral-report" });
const db = getFirestore();

type Mail = { to: string; subject: string; text: string; html?: string; headers?: Record<string, string> };
const mails: Mail[] = [];
const bells: { uid?: string | null; message: string }[] = [];
const deps = {
  send: async (m: Mail) => { mails.push(m); return true; },
  emailOf: async (uid: string) => `${uid}@example.ng`,
  bell: async (b: { uid?: string | null; message: string }) => { bells.push(b); },
};

async function member(uid: string, username: string, displayName: string) {
  await db.doc(`usernames/${username}`).set({ uid });
  await db.doc(`users/${uid}`).set({ uid, username, displayName, createdAt: "2025-01-01T00:00:00Z" });
}
const earning = (id: string, e: Partial<Earning>): Earning => ({
  id, uid: "u_amaka", source: "course", paymentReference: id, buyerUid: "u_buyer", title: "Excel in a weekend", baseKobo: 20_000_00, percent: 20,
  kobo: 4_000_00, status: "held", releaseAfter: "2025-03-20T10:00:00.000Z", createdAt: "2025-03-13T10:00:00.000Z", ...e,
});

(async () => {
  // ---- the schedule: the 1st from 08:00 Lagos (07:00 UTC), about the month before, for three days ----
  const sendAt = new Date("2025-04-01T07:00:00Z");
  const m = reportMonth(sendAt);
  assert.equal(m.id, "2025-03"); assert.equal(m.label, "March 2025");
  assert.equal(m.start, "2025-02-28T23:00:00.000Z", "March starts at midnight Lagos time"); assert.equal(m.end, "2025-03-31T23:00:00.000Z");
  assert.ok(inSendWindow(m, sendAt)); assert.ok(!inSendWindow(m, new Date("2025-04-01T06:59:00Z")), "not before 8 AM Lagos");
  assert.ok(!inSendWindow(m, new Date("2025-04-04T07:00:00Z")), "the window closes after three days");
  assert.equal(reportMonth(new Date("2025-01-01T08:00:00Z")).id, "2024-12", "January reports on December");
  assert.equal(monthById("2025-13"), null);
  assert.equal(await monthlyReferralReports(db, new Date("2025-04-01T06:00:00Z"), deps), 0, "nothing before the window");

  // ---- members ----
  await member("u_amaka", "amaka", "Amaka Obi"); // active: a friend, a paid conversion, a course sale, a refund, a withdrawal
  await member("u_tolu", "tolu", "Tolu Ade"); // active but opted out
  await member("u_quiet", "quiet", "Quiet Member"); // earnings in another month only
  await member("u_adaeze", "adaeze", "Adaeze Buyer"); // the friend who joined and bought
  await member("u_buyer", "chukwuemeka", "Chukwuemeka Buyer");
  // Amaka's month: Adaeze joined with her link and paid for Pro; a course sold through her affiliate link; one refunded; she took cash.
  await db.doc("referrals/u_adaeze").set({ uid: "u_adaeze", referredBy: "u_amaka", referredByUsername: "amaka", referredAt: "2025-03-05T09:00:00.000Z", paidSince: "2025-03-10T09:00:00.000Z" });
  await db.doc("referralEarnings/plan_P1").set(earning("plan_P1", { source: "plan", buyerUid: "u_adaeze", title: "Pro plan", baseKobo: 5_000_00, kobo: 1_000_00, createdAt: "2025-03-10T09:00:00.000Z", releaseAfter: "2025-03-17T09:00:00.000Z" }));
  await db.doc("referralEarnings/prod_C1").set(earning("prod_C1", { buyerUid: "u_buyer" }));
  await db.doc("referralEarnings/prod_C2").set(earning("prod_C2", { status: "reversed", createdAt: "2025-03-14T10:00:00.000Z", releaseAfter: "2025-03-21T10:00:00.000Z" }));
  await db.doc("referralEarnings/prod_OLD").set(earning("prod_OLD", { status: "withdrawn", kobo: 3_000_00, createdAt: "2025-01-10T10:00:00.000Z", releaseAfter: "2025-01-17T10:00:00.000Z", withdrawalId: "rw_1" }));
  await db.doc("referralWithdrawals/rw_1").set({ id: "rw_1", uid: "u_amaka", method: "cash", kobo: 3_000_00, bonusKobo: 0, earnings: ["prod_OLD"], at: "2025-03-25T12:00:00.000Z" });
  // Tolu sold something too, but turned the report off.
  await db.doc("referralEarnings/prod_T1").set(earning("prod_T1", { uid: "u_tolu", createdAt: "2025-03-02T10:00:00.000Z" }));
  await setReportWanted(db, "u_tolu", false);
  // Quiet earned in February only (and its hold ended in February): nothing in March.
  await db.doc("referralEarnings/prod_Q1").set(earning("prod_Q1", { uid: "u_quiet", createdAt: "2025-02-10T10:00:00.000Z", releaseAfter: "2025-02-17T10:00:00.000Z" }));

  // ---- the run ----
  const n = await monthlyReferralReports(db, sendAt, deps);
  assert.equal(n, 1, "one email: Amaka's");
  assert.deepEqual(mails.map((x) => x.to), ["u_amaka@example.ng"]);

  // no activity: no email, no marker
  assert.equal((await db.doc("referralReports/u_quiet_2025-03").get()).exists, false, "no activity, no marker");
  // opted out: skipped, no marker
  assert.equal((await db.doc("referralReports/u_tolu_2025-03").get()).exists, false, "opted out, skipped");
  assert.ok(!mails.some((x) => x.to.startsWith("u_tolu")));

  // activity: the right totals
  const mail = mails[0];
  assert.equal(mail.subject, "Your referrals report for March 2025: ₦5,000 earned");
  assert.match(mail.text, /^Dear Amaka Obi,\n\nHere's your referrals and affiliate report for March 2025\./);
  assert.ok(mail.text.includes("- Friends who joined: 1"));
  assert.ok(mail.text.includes("- Paid conversions: 1"));
  assert.ok(mail.text.includes("- Affiliate sales: 1"), "the refunded sale isn't counted");
  assert.ok(mail.text.includes("- Earned this month: ₦5,000"), "₦1,000 on the plan + ₦4,000 on the course; the refund isn't");
  assert.ok(mail.text.includes("- Cleared the hold this month: ₦5,000"));
  assert.ok(mail.text.includes("- Taken out this month: ₦3,000"));
  assert.ok(mail.text.includes("- Available: ₦5,000") && mail.text.includes("- Pending: ₦0") && mail.text.includes("- Withdrawn: ₦3,000"), "all-time balances");
  assert.ok(mail.text.includes("Course sale: Excel in a weekend · ₦20,000 · you earn ₦4,000 · Available"));
  assert.ok(mail.text.includes("Course sale: Excel in a weekend · ₦20,000 · you earn ₦4,000 · Refunded"));
  assert.ok(mail.text.includes("A friend joined with your link or code · Paying"));
  assert.ok(mail.text.includes("Plan payment: Pro plan · ₦5,000 · you earn ₦1,000 · Available"));
  assert.ok(mail.text.includes("/r/amaka") && mail.text.includes("Your code: AMAKA") && mail.text.includes("/profile/referrals"));
  assert.ok(mail.text.includes("Tip: "));
  assert.match(mail.text, /Turn off the monthly referrals report: https:\/\/.+\/api\/referrals\/report\/unsubscribe\?u=u_amaka&t=/);
  assert.ok(mail.headers?.["List-Unsubscribe"]?.includes("/api/referrals/report/unsubscribe"));
  assert.ok(mail.html && mail.html.includes("Dear Amaka Obi, here&rsquo;s your referrals and affiliate report for March 2025.") && mail.html.includes("See your referrals") && mail.html.includes("₦5,000"));
  // buyers masked: neither the friend nor the buyer is named anywhere
  for (const who of ["adaeze", "Adaeze", "chukwuemeka", "Chukwuemeka", "u_buyer", "u_adaeze"]) {
    assert.ok(!mail.text.includes(who) && !mail.html.includes(who), `${who} isn't in the email`);
  }
  // the bell and the marker
  assert.deepEqual(bells.map((b) => [b.uid, b.message]), [["u_amaka", "Your referrals in March 2025: 1 sign-up, 1 paying, 1 affiliate sale, ₦5,000 earned."]]);
  const marker = (await db.doc("referralReports/u_amaka_2025-03").get()).data();
  assert.equal(marker?.status, "sent"); assert.equal(marker?.earnedKobo, 5_000_00);
  assert.equal((await db.doc("referralReportRuns/2025-03").get()).data()?.done, true);

  // re-run: no second email (the run is done; and even with the run reopened, the marker holds)
  assert.equal(await monthlyReferralReports(db, new Date("2025-04-01T07:15:00Z"), deps), 0);
  await db.doc("referralReportRuns/2025-03").delete();
  assert.equal(await monthlyReferralReports(db, new Date("2025-04-01T07:30:00Z"), deps), 0);
  assert.equal(mails.length, 1, "still one email");

  // turning it back on before the window closes: Tolu gets theirs on the next run
  await setReportWanted(db, "u_tolu", true);
  await db.doc("referralReportRuns/2025-03").delete();
  assert.equal(await monthlyReferralReports(db, new Date("2025-04-01T07:45:00Z"), deps), 1);
  assert.equal(mails[1].to, "u_tolu@example.ng");

  // the admin preview: any member, even without activity (then `active` is false)
  const p = await previewReport(db, "u_quiet", m, sendAt);
  assert.equal(p.active, false); assert.equal(p.report?.totals.earnedKobo, 0);
  assert.equal((await previewReport(db, "u_amaka", m, sendAt)).active, true);

  // the turn-off link is signed per member
  assert.ok(validReportToken("u_amaka", reportToken("u_amaka"))); assert.ok(!validReportToken("u_tolu", reportToken("u_amaka")));

  console.log("REFERRAL REPORT OK");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
