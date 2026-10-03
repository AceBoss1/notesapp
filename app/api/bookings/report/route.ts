import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { cleanText } from "@/lib/orders";
import { PAYOUT_HOLD_HOURS } from "@/lib/cancellation";
import { formatSlot, sessionEnd } from "@/lib/booking-time";
import { rateLimit } from "@/lib/rate-limit";
import type { LedgerEntry } from "@/lib/payments";

export const dynamic = "force-dynamic";

// The client reports a problem with a session that has ended (no-show, wrong session…),
// within PAYOUT_HOLD_HOURS of its end. That freezes the publisher's payout ("disputed") so
// the automatic release skips it; an admin then decides on /admin/payments (release or refund).
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "report-booking", user.uid, 10, 3600);
    if (limited) return limited;

    const body = await req.json();
    const reference = String(body.reference || "");
    const reason = cleanText(body.reason, 500);
    if (reason.length < 10) return NextResponse.json({ error: "Tell us what went wrong (a sentence or two)." }, { status: 400 });

    const db = getAdminDb();
    const bRef = db.doc(`bookings/${reference}`);
    const b = (await bRef.get()).data();
    if (!b || b.clientUid !== user.uid) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const ended = sessionEnd(b.date, b.slot, b.minutes).getTime();
    if (b.status !== "confirmed" || ended > Date.now()) return NextResponse.json({ error: "You can report a problem once the session has ended." }, { status: 409 });
    if (Date.now() > ended + PAYOUT_HOLD_HOURS * 3_600_000) {
      return NextResponse.json({ error: `The ${PAYOUT_HOLD_HOURS}-hour window to report a problem has passed. Contact support if it's urgent.` }, { status: 409 });
    }

    const ledgerRef = db.doc(`ledger/${reference}`);
    const frozen = await db.runTransaction(async (t) => {
      const l = (await t.get(ledgerRef)).data() as LedgerEntry | undefined;
      if (!l || l.status !== "held") return false;
      t.update(ledgerRef, { status: "disputed" });
      t.update(bRef, { reportedProblem: { reason, at: new Date().toISOString() } });
      return true;
    });
    if (!frozen) return NextResponse.json({ error: "This session's payout has already been processed or is under review." }, { status: 409 });

    const when = `${b.date} at ${formatSlot(b.slot)} (WAT)`;
    const pubEmail = await getUserEmail(b.publisherUid);
    const support = process.env.SUPPORT_EMAIL || "hello@notesapp.name.ng";
    await Promise.all([
      sendEmail({ to: support, subject: `Session problem reported — ${reference}`, text: `A client reported a problem with the session on ${when} (@${b.username}):\n"${reason}"\n\nThe payout is frozen; resolve it on /admin/payments (release or refund).\nReference: ${reference}` }),
      sendEmail({ to: b.clientEmail, bell: { uid: user.uid, type: "booking", linkHref: "/bookings" }, subject: "We got your report", text: `Thanks — we've paused the publisher's payout for the session on ${when} and will review what you reported. We'll email you with the outcome.\nReference: ${reference}\n\n#NotesApp` }),
      pubEmail ? sendEmail({ to: pubEmail, bell: { uid: b.publisherUid, type: "booking", linkHref: "/bookings" }, subject: "Session payout paused for review", text: `The client reported a problem with the session on ${when}, so your payout is paused while we review it. We'll be in touch.\nReference: ${reference}\n\n#NotesApp` }) : Promise.resolve(true),
    ]).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Report failed:", err);
    const f = friendlyMessage(err, "Couldn't send your report");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
