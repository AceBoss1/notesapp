import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { formatSlot } from "@/lib/booking-time";
import { expireTiers } from "@/lib/tier-billing";

// Run every ~15 minutes by an external scheduler with
//   Authorization: Bearer $CRON_SECRET
// (Vercel Cron on a Pro plan sends that header automatically when
// CRON_SECRET is set; on Hobby use a free pinger such as cron-job.org —
// Vercel Hobby only allows daily crons, too coarse for 1-hour reminders).
// Reads request headers/query, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const pub = (await db.doc(`users/${b.publisherUid}`).get()).data();
    const text = `Reminder: your ${b.minutes}-minute #NotesApp session with @${b.username} ${label} — ${when}.`;
    const results = await Promise.all([
      sendEmail({ to: b.clientEmail, subject: `Reminder: session ${when}`, text }),
      pub?.email ? sendEmail({ to: pub.email, subject: `Reminder: session ${when}`, text }) : Promise.resolve(true),
    ]);
    if (results.every(Boolean)) {
      await doc.ref.update(flag === "reminder1Sent" ? { reminder1Sent: true, reminder24Sent: true } : { reminder24Sent: true });
      sent++;
    }
  }
  // Same scheduler run also downgrades lapsed Pro/Business plans.
  const expired = await expireTiers().catch((e) => (console.error("expireTiers failed", e), 0));
  return NextResponse.json({ checked: snap.size, sent, expiredPlans: expired });
}
