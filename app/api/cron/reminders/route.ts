import { sweepPaidLives } from "@/lib/live-tickets-server";
import { sweepPpm } from "@/lib/ppm-server";
import { remindExpiringCoupons } from "@/lib/discounts-server";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { formatSlot } from "@/lib/booking-time";
import { expireTiers } from "@/lib/tier-billing";
import { releaseDueOrders, releaseExpiredReservations } from "@/lib/orders-server";
import { autoReleasePayouts } from "@/lib/payouts";
import { reconcilePaylonyPayouts } from "@/lib/paylony-payouts";
import { sweepExpiredMoments, sweepMomentCopies, sweepStaleAudio } from "@/lib/moments-server";
import { sweepProcessingVideos } from "@/lib/media-server";
import { mediaDeps } from "@/lib/media-api";
import { runBackfill } from "@/lib/media-mark-backfill";
import { sweepMessageUploads } from "@/lib/messages-server";
import { sweepMessageRequests } from "@/lib/message-edits";
import { deleteObject, privateFilesConfigured } from "@/lib/private-files";
import { sendReportsDigest, liftExpiredSuspensions } from "@/lib/reports-server";
import { momentDeps } from "@/lib/moments-api";
import { sendMorningSummaries, sendWorkReminders } from "@/lib/team-server";
import { sendGrantReminders } from "@/lib/grants-server";
import { sendDueReminders } from "@/lib/dues-server";
import { sendWeeklyDigests } from "@/lib/digest-server";
import { continueAnnouncements } from "@/lib/announcements-server";
import { announceReleases } from "@/lib/discord";
import { setting } from "@/lib/config";
import { syncOrcidSites } from "@/lib/publications-server";
import { sendEventReminders } from "@/lib/events-server";
import { sendInterviewReminders } from "@/lib/interviews-server";
import { sendRatesReminder, sendRenewReminders } from "@/lib/global-pay-server";
import { fridayNudges, sweepTimers } from "@/lib/time-server";
import { sendInvoiceReminders } from "@/lib/invoices-server";
import { sendKidReports } from "@/lib/kids-server";
import { birthdayBells } from "@/lib/young-server";
import { cycleBells } from "@/lib/cycle-server";
import { trackJob } from "@/lib/ops-metrics-server";
import { settleEndedPromotions } from "@/lib/promo-settle-server";
import { monthlyBooksReports } from "@/lib/books-report-server";
import { sweepHolds } from "@/lib/hotel-server";
import { monthlyReferralReports } from "@/lib/referral-report-server";
import { sweepRecordings, transcribeReplays } from "@/lib/live-recording-server";
import { runDue as nanaJobsDue } from "@/lib/nana-jobs-server";
import { liveDeps as nanaJobsDeps } from "@/lib/nana-jobs-api";

// Run every ~15 minutes by an external scheduler with
//   Authorization: Bearer $CRON_SECRET
// (Vercel Cron on a Pro plan sends that header automatically when
// CRON_SECRET is set; on Hobby use a free pinger such as cron-job.org —
// Vercel Hobby only allows daily crons, too coarse for 1-hour reminders).
// Reads request headers/query, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // many jobs, and a batch of the one-off NotesApp mark re-marking (about 20 seconds) while it runs

export async function GET(req: NextRequest) {
  const secret = setting("CRON_SECRET");
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Counted when it starts and when it finishes (opsDaily): a start with no finish is a run the time limit cut off, the
  // admin dashboard's Stage 1 number (lib/ops-metrics.ts).
  return trackJob(getAdminDb(), () => run());
}

async function run() {
  const db = getAdminDb();
  const now = Date.now();
  const soon = new Date(now + 25 * 3_600_000).toISOString();
  // Range on one field only — no composite index needed; status/flags filtered below.
  const snap = await db.collection("bookings")
    .where("startsAt", ">=", new Date(now).toISOString())
    .where("startsAt", "<=", soon)
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const b = doc.data();
    if (b.status !== "confirmed") continue;
    const hoursLeft = (new Date(b.startsAt).getTime() - now) / 3_600_000;
    const flag = hoursLeft <= 1 ? "reminder1Sent" : hoursLeft <= 24 ? "reminder24Sent" : null;
    if (!flag || b[flag]) continue;
    // A 1-hour reminder also covers the 24-hour one for late bookings.
    const label = flag === "reminder1Sent" ? "starts in about 1 hour" : "is tomorrow";
    const when = `${b.date} at ${formatSlot(b.slot)} (WAT)`;
    const pubEmail = await getUserEmail(b.publisherUid);
    const text = `Reminder: your ${b.minutes}-minute #NotesApp session with @${b.username} ${label} — ${when}.`;
    const results = await Promise.all([
      sendEmail({ to: b.clientEmail, bell: { uid: b.clientUid, type: "booking", linkHref: "/bookings" }, subject: `Reminder: session ${when}`, text }),
      pubEmail ? sendEmail({ to: pubEmail, bell: { uid: b.publisherUid, type: "booking", linkHref: "/bookings" }, subject: `Reminder: session ${when}`, text }) : Promise.resolve(true),
    ]);
    if (results.every(Boolean)) {
      await doc.ref.update(flag === "reminder1Sent" ? { reminder1Sent: true, reminder24Sent: true } : { reminder24Sent: true });
      sent++;
    }
  }
  // Same scheduler run also downgrades lapsed Pro/Business plans, releases store
  // orders whose 7 "delivered" days passed without a buyer reply, and gives back
  // stock reserved by checkouts that were never paid. Each job is isolated so one
  // failure can't stop the others, and is recorded for /status.
  const failed: string[] = [];
  const job = (name: string, fn: () => Promise<number>) =>
    fn().catch((e) => (console.error(`${name} failed`, e), failed.push(name), 0));
  // This route runs every 15 minutes. Jobs that send at most one message a day per item read their whole list each run, so they run
  // once an hour instead (the first run in each hour): a reminder can be up to an hour later, never twice (Query insights, 9 Nov 2026:
  // the work board alone was ~7,800 reads a day).
  const firstRunThisHour = new Date().getUTCMinutes() < 15;
  const hourly = (name: string, fn: () => Promise<number>) => (firstRunThisHour ? job(name, fn) : Promise.resolve(0));
  const expired = await job("expireTiers", expireTiers);
  const released = await job("releaseDueOrders", releaseDueOrders);
  const unreserved = await job("releaseExpiredReservations", releaseExpiredReservations);
  await job("hotelHolds", () => sweepHolds(db)); // Hotel kit: unpaid bookings and orders past their hold are released (lib/hotel-server.ts)
  // ...and pays publishers for sessions that ended PAYOUT_HOLD_HOURS ago with no problem reported.
  const paidOut = await job("autoReleasePayouts", () => autoReleasePayouts());
  // Ended boosts and adverts: the undelivered share refunded pro rata, the way the member paid, as the help and Terms promise
  // (lib/promo-settle-server.ts). Each is settled once.
  await job("settlePromotions", () => settleEndedPromotions(db));
  // Moments past their 24, 48 or 72 hours are deleted with their files (reads already refuse them).
  await job("mediaVideos", async () => sweepProcessingVideos(db, mediaDeps())); // Media videos Stream has finished (or rejected), pictures still being marked
  // The one-off re-marking of what was posted before the NotesApp mark (Admin → Limits): a batch per tick while an admin has it running.
  await job("markBackfill", async () => { const r = await runBackfill(db, mediaDeps(), { budgetMs: 20_000 }); return r.status === "running" ? 1 : 0; });
  await job("sweepExpiredMoments", async () => (await sweepExpiredMoments(db, momentDeps)) + (await sweepStaleAudio(db, momentDeps)) + (await sweepMomentCopies(db, momentDeps)));
  // One email a day to the team about open reports (nothing when there are none).
  await job("sweepMessageRequests", () => sweepMessageRequests(db));
  // Live recordings: past their keep days (Admin → Limits → Live recording) and not published, deleted; a recording the recorder never
  // finished is finished from what arrived; queued replay transcripts, a few at a time (lib/live-recording-server.ts).
  await job("recordings", async () => { const r = await sweepRecordings(db); return r.deleted + r.finished; });
  await job("replayTranscripts", () => transcribeReplays(db));
  await job("sweepMessageUploads", () => (privateFilesConfigured() ? sweepMessageUploads(db, deleteObject) : Promise.resolve(0)));
  await job("liftExpiredSuspensions", () => liftExpiredSuspensions(db));
  await job("reportsDigest", async () => ((await sendReportsDigest(db)) ? 1 : 0));
  // From 07:00 Lagos time, once a day: the team's morning summary (their day, decisions, blockers, queues, milestones, meetings).
  await job("teamMorningSummary", () => sendMorningSummaries(db));
  // Grants and free-period plans: 30, 14, 7, 3, 1 and 0 days before they end, to finance and the owner.
  await hourly("grantReminders", () => sendGrantReminders(db));
  // Expenses due (bills and renewals entered by finance): 14, 7, 3, 1 and 0 days ahead, and once when overdue.
  await job("dueReminders", () => sendDueReminders(db));
  // Work board deadlines: to each item's owner 3 days and 1 day before, on the day, and once when overdue.
  await hourly("workReminders", () => sendWorkReminders(db));
  // Team time: timers whose "still working?" went unanswered (or that ran to midnight) stop, the check-in bell goes out once per
  // check, and on Fridays from 4 PM Lagos, one reminder to submit the week's timesheet (lib/time-server.ts).
  await job("timeTimers", async () => { const r = await sweepTimers(db); return r.stopped + r.asked; });
  await job("timeFridayNudge", () => fridayNudges(db));
  // Client invoices: one reminder to the client 3 days after the due date (lib/invoices-server.ts).
  await job("invoiceReminders", () => sendInvoiceReminders(db));
  // Kids mode: Sundays from 5 PM Lagos, each parent gets their child's week on Naija Exam Prep, once (lib/kids-server.ts).
  await job("kidReports", () => sendKidReports(db));
  // Teen mode: on an 18th birthday, one bell to the "You're 18 now" screen (lib/young-server.ts).
  await job("birthday18", () => birthdayBells(db));
  // My Cycle: the optional check-in reminder (from 7 PM Lagos) and "may be late" note, as bells that never say what they're about.
  await job("cycleBells", () => cycleBells(db));
  // Sundays from 5 PM Lagos, in batches across runs, once WEEKLY_DIGEST=on (lib/digest-server.ts).
  await job("weeklyDigest", () => sendWeeklyDigests(db));
  // Admin → Announcements: one more batch of an announcement left half-sent (the admin closed the page), until it's done.
  await job("announcements", () => continueAnnouncements(db));
  // Events: reminders 24 hours and 1 hour before each start to everyone going or interested (lib/events-server.ts).
  await job("eventReminders", () => sendEventReminders(db));
  await job("interviewReminders", () => sendInterviewReminders(db)); // job interviews: a day and an hour before (lib/interviews-server.ts)
  await job("globalRenewals", () => sendRenewReminders(db)); // subscriptions paid in another currency: a bell 3 days before the month ends
  await job("ratesReminder", async () => ((await sendRatesReminder(db)) ? 1 : 0)); // Finance: exchange rates 36 hours old (and 48, when paying in other currencies pauses)
  // Paid lives (lib/live-tickets-server.ts): reminders to ticket holders a day and an hour before; a live the host never opened is
  // cancelled after Admin's no-show minutes and everyone refunded to NotesApp Credit.
  await job("paidLives", () => sweepPaidLives(db));
  // Pay-per-minute sessions (lib/ppm-server.ts): a call whose phones went quiet, or whose held minutes ran out and weren't topped up,
  // is ended and charged on the server's meter; a session whose call never started is ended and the hold given back.
  await job("ppmSessions", () => sweepPpm(db));
  await job("couponReminders", () => remindExpiringCoupons(db)); // saved coupons ending within 3 days: one bell a day each
  // The 1st of each month from 08:00 Lagos, in batches: last month's referrals report to members who had activity (lib/referral-report-server.ts).
  await job("referralReports", () => monthlyReferralReports(db));
  // The 1st of each month from 08:00 Lagos, in batches: last month's Business books summary to sellers whose books had entries (lib/books-report-server.ts).
  await job("booksReports", () => monthlyBooksReports(db));
  // Researchers who linked ORCID with sync on: their new works are added to their site's Publications (lib/publications-server.ts).
  await job("syncOrcidSites", () => syncOrcidSites(db));
  // Nana Jobs: members' daily shortlists at the hour each chose, a few per run within a time limit (lib/nana-jobs-server.ts). The shared
  // pool they read is collected once a day by /api/cron/nana-jobs.
  await job("nanaJobs", () => nanaJobsDue(db, nanaJobsDeps(), { max: 3, budgetMs: 60_000 }));
  await job("discordChangelog", () => announceReleases(db).then((v) => v.length)); // new releases to the Discord #announcements channel
  await job("reconcilePaylonyPayouts", () => reconcilePaylonyPayouts().then((r) => r.paid + r.failed));
  // Heartbeat read by /status ("Scheduled jobs"); server-only collection, no client rules.
  await db.collection("cronRuns").doc("reminders").set({ at: new Date().toISOString(), ok: failed.length === 0, failed }).catch((e) => console.error("cron heartbeat failed", e));
  return NextResponse.json({ checked: snap.size, sent, expiredPlans: expired, releasedOrders: released, unreservedCheckouts: unreserved, payoutsStarted: paidOut });
}
