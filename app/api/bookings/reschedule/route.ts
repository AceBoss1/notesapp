import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getUserEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { formatSlot } from "@/lib/booking-time";
import { BookingFail, rescheduleBooking } from "@/lib/bookings-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The client moves their own confirmed session to another open slot (rules in
// lib/cancellation.ts, logic in lib/bookings-server.ts), then both sides are told.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "reschedule", user.uid, 20, 3600);
    if (limited) return limited;

    const { reference, date, slot } = await req.json();
    if (typeof reference !== "string" || typeof date !== "string" || typeof slot !== "string") throw new BookingFail("Missing details.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(slot)) throw new BookingFail("Pick a valid date and time.");

    const result = await rescheduleBooking(user.uid, reference, date, slot);

    const newWhen = `${date} at ${formatSlot(slot)} (WAT)`;
    const pubEmail = await getUserEmail(result.publisherUid);
    await Promise.all([
      sendEmail({
        to: result.clientEmail,
        bell: { uid: user.uid, type: "booking", linkHref: "/bookings" },
        subject: `Session rescheduled — ${newWhen}`,
        text: `Your ${result.minutes}-minute session with @${result.username} moved from ${result.was} to ${newWhen}. You can reschedule ${result.left} more time${result.left === 1 ? "" : "s"}; cancellations still follow the refund policy.\nReference: ${reference}\n\n#NotesApp`,
      }),
      pubEmail
        ? sendEmail({
            to: pubEmail,
            bell: { uid: result.publisherUid, type: "booking", linkHref: "/bookings" },
            subject: `Session rescheduled — ${newWhen}`,
            text: `The client moved your ${result.minutes}-minute session from ${result.was} to ${newWhen}. Your earnings are unchanged.\nReference: ${reference}\n\n#NotesApp`,
          })
        : Promise.resolve(true),
    ]).catch(() => {});
    return NextResponse.json({ ok: true, date, slot, left: result.left });
  } catch (err) {
    if (err instanceof BookingFail) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Reschedule failed:", err);
    const f = friendlyMessage(err, "Couldn't reschedule");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
