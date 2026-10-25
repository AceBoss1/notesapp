import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { formatSlot } from "@/lib/booking-time";
import { expireTiers } from "@/lib/tier-billing";
import { releaseDueOrders, releaseExpiredReservations } from "@/lib/orders-server";
import { autoReleasePayouts } from "@/lib/payouts";
import { reconcilePaylonyPayouts } from "@/lib/paylony-payouts";
import { sweepExpiredMoments, sweepStaleAudio } from "@/lib/moments-server";
import { sweepMessageUploads } from "@/lib/messages-server";
import { sweepMessageRequests } from "@/lib/message-edits";
import { deleteObject, privateFilesConfigured } from "@/lib/private-files";
import { sendReportsDigest, liftExpiredSuspensions } from "@/lib/reports-server";
import { momentDeps } from "@/lib/moments-api";
import { sendMorningSummaries, sendWorkReminders } from "@/lib/team-server";
import { sendGrantReminders } from "@/lib/grants-server";
import { sendDueReminders } from "@/lib/dues-server";
import { sendWeeklyDigests } from "@/lib/digest-server";
import { announceReleases } from "@/lib/discord";
import { setting } from "@/lib/config";
import { syncOrcidSites } from "@/lib/publications-server";
import { sendEventReminders } from "@/lib/events-server";
import { fridayNudges, sweepTimers } from "@/lib/time-server";
import { sendInvoiceReminders } from "@/lib/invoices-server";
import { sendKidReports } from "@/lib/kids-server";
import { birthdayBells } from "@/lib/young-server";
import { trackJob } from "@/lib/ops-metrics-server";

// Run every ~15 minutes by an external scheduler with
//   Authorization: Bearer $CRON_SECRET
// (Vercel Cron on a Pro plan sends that header automatically when
// CRON_SECRET is set; on Hobby use a free pinger such as cron-job.org —
// Vercel Hobby only allows daily crons, too coarse for 1-hour reminders).
// Reads request headers/query, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

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
  const expired = await job("expireTiers", expireTiers);
  const released = await job("releaseDueOrders", releaseDueOrders);
  const unreserved = await job("releaseExpiredReservations", releaseExpiredReservations);
  // ...and pays publishers for sessions that ended PAYOUT_HOLD_HOURS ago with no problem reported.
  const paidOut = await job("autoReleasePayouts", () => autoReleasePayouts());
  // Moments past their 24, 48 or 72 hours are deleted with their files (reads already refuse them).
  await job("sweepExpiredMoments", async () => (await sweepExpiredMoments(db, momentDeps)) + (await sweepStaleAudio(db, momentDeps)));
  // One email a day to the team about open reports (nothing when there are none).
  await job("sweepMessageRequests", () => sweepMessageRequests(db));
  await job("sweepMessageUploads", () => (privateFilesConfigured() ? sweepMessageUploads(db, deleteObject) : Promise.resolve(0)));
  await job("liftExpiredSuspensions", () => liftExpiredSuspensions(db));
  await job("reportsDigest", async () => ((await sendReportsDigest(db)) ? 1 : 0));
  // From 07:00 Lagos time, once a day: the team's morning summary (their day, decisions, blockers, queues, milestones, meetings).
  await job("teamMorningSummary", () => sendMorningSummaries(db));
  // Grants and free-period plans: 30, 14, 7, 3, 1 and 0 days before they end, to finance and the owner.
  await job("grantReminders", () => sendGrantReminders(db));
  // Expenses due (bills and renewals entered by finance): 14, 7, 3, 1 and 0 days ahead, and once when overdue.
  await job("dueReminders", () => sendDueReminders(db));
  // Work board deadlines: to each item's owner 3 days and 1 day before, on the day, and once when overdue.
  await job("workReminders", () => sendWorkReminders(db));
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
  // Sundays from 5 PM Lagos, in batches across runs, once WEEKLY_DIGEST=on (lib/digest-server.ts).
  await job("weeklyDigest", () => sendWeeklyDigests(db));
  // Events: reminders 24 hours and 1 hour before each start to everyone going or interested (lib/events-server.ts).
  await job("eventReminders", () => sendEventReminders(db));
  // Researchers who linked ORCID with sync on: their new works are added to their site's Publications (lib/publications-server.ts).
  await job("syncOrcidSites", () => syncOrcidSites(db));
  await job("discordChangelog", () => announceReleases(db).then((v) => v.length)); // new releases to the Discord #announcements channel
  await job("reconcilePaylonyPayouts", () => reconcilePaylonyPayouts().then((r) => r.paid + r.failed));
  // Heartbeat read by /status ("Scheduled jobs"); server-only collection, no client rules.
  await db.collection("cronRuns").doc("reminders").set({ at: new Date().toISOString(), ok: failed.length === 0, failed }).catch((e) => console.error("cron heartbeat failed", e));
  return NextResponse.json({ checked: snap.size, sent, expiredPlans: expired, releasedOrders: released, unreservedCheckouts: unreserved, payoutsStarted: paidOut });
}
