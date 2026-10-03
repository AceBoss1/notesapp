import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, getUserEmail, verifySignedInRequest } from "@/lib/firebase-admin";
import { refundTransaction, slotLockId } from "@/lib/paystack";
import { refundFraction } from "@/lib/cancellation";
import { sendEmail } from "@/lib/email";
import { formatNaira, formatSlot } from "@/lib/booking-time";
import { rateLimit } from "@/lib/rate-limit";
import type { LedgerEntry, PaymentRecord } from "@/lib/payments";

// Cancel a confirmed, future session — by the client who booked it or
// the publisher who owns it. Refund follows lib/cancellation.ts.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "cancel", user.uid, 10, 3600);
    if (limited) return limited;

    const { reference } = await req.json();
    if (typeof reference !== "string") return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const db = getAdminDb();
    const bRef = db.doc(`bookings/${reference}`);
    const snap = await bRef.get();
    const b = snap.data();
    if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const by: "client" | "publisher" | null =
      b.clientUid === user.uid ? "client" : b.publisherUid === user.uid ? "publisher" : null;
    if (!by) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const startsAt = new Date(b.startsAt).getTime();
    if (startsAt <= Date.now()) return NextResponse.json({ error: "This session has already started." }, { status: 409 });

    // Claim the booking so a double-click can't refund twice.
    const claimed = await db.runTransaction(async (t) => {
      const cur = (await t.get(bRef)).data();
      if (cur?.status !== "confirmed") return false;
      t.update(bRef, { status: "cancelling" });
      return true;
    });
    if (!claimed) return NextResponse.json({ error: "This booking can't be cancelled." }, { status: 409 });

    const [ledgerSnap, paySnap] = await Promise.all([db.doc(`ledger/${reference}`).get(), db.doc(`payments/${reference}`).get()]);
    const ledger = ledgerSnap.data() as LedgerEntry | undefined;
    const payment = paySnap.data() as PaymentRecord | undefined;
    if (!ledger || !payment || (ledger.status !== "held" && ledger.status !== "disputed")) {
      await bRef.update({ status: "confirmed" });
      return NextResponse.json({ error: "Payout already processed — contact support to cancel." }, { status: 409 });
    }

    const hoursBefore = (startsAt - Date.now()) / 3_600_000;
    const fraction = refundFraction(hoursBefore, by);
    const refundKobo = Math.floor(b.amountKobo * fraction);

    try {
      if (refundKobo > 0) await refundTransaction(reference, refundKobo === b.amountKobo ? undefined : refundKobo);
    } catch (err) {
      await bRef.update({ status: "confirmed" });
      throw err;
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(bRef, { status: `cancelled_by_${by}`, refundKobo, cancelledAt: now });
    batch.delete(db.doc(`slotLocks/${slotLockId(b.username, b.date, b.slot)}`));
    if (refundKobo === b.amountKobo) {
      batch.update(db.doc(`ledger/${reference}`), { status: "refunded" });
      batch.update(db.doc(`payments/${reference}`), { status: "refunded" });
    } else {
      // Retained portion goes to the publisher (minus commission) — releasable now.
      const retained = b.amountKobo - refundKobo;
      const commissionKobo = Math.round(retained * payment.commissionRate);
      batch.update(db.doc(`ledger/${reference}`), {
        grossKobo: retained,
        commissionKobo,
        netKobo: retained - commissionKobo,
        releaseAfter: now,
      });
    }
    await batch.commit();

    const when = `${b.date} at ${formatSlot(b.slot)} (WAT)`;
    const line = refundKobo > 0 ? `A refund of ${formatNaira(refundKobo)} has been issued (allow a few business days).` : "Under the cancellation policy no refund applies.";
    const pubEmail = await getUserEmail(b.publisherUid);
    await Promise.all([
      sendEmail({ to: b.clientEmail, bell: { uid: b.clientUid, type: "booking", linkHref: "/bookings" }, subject: `Session cancelled — ${when}`, text: `The session on ${when} was cancelled by the ${by}.\n${line}\nReference: ${reference}` }),
      pubEmail ? sendEmail({ to: pubEmail, bell: { uid: b.publisherUid, type: "booking", linkHref: "/bookings" }, subject: `Session cancelled — ${when}`, text: `The session on ${when} was cancelled by the ${by}.\nReference: ${reference}` }) : Promise.resolve(true),
    ]).catch(() => {});

    return NextResponse.json({ ok: true, refundKobo, cancelledBy: by });
  } catch (err) {
    console.error("Cancel failed:", err);
    { const f = friendlyMessage(err, "Couldn't cancel"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
