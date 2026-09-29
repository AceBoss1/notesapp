import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import {
  BOOKING_SLOTS,
  SESSION_PRICE_KOBO,
  bookingId,
  initializeTransaction,
  newReference,
  PaymentRecord,
} from "@/lib/paystack";

// Starts a Paystack checkout for a 1:1 session. The price and slot
// list are enforced server-side; the client only picks who/when.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to book a session." }, { status: 401 });
    if (!user.email) {
      return NextResponse.json({ error: "Your account needs an email to pay." }, { status: 400 });
    }

    const { username, date, slot } = await req.json();
    if (typeof username !== "string" || !/^[a-z0-9_-]{2,30}$/.test(username)) {
      return NextResponse.json({ error: "Invalid journal." }, { status: 400 });
    }
    if (!BOOKING_SLOTS.includes(slot)) {
      return NextResponse.json({ error: "Invalid time slot." }, { status: 400 });
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Pick a date." }, { status: 400 });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date <= today) {
      return NextResponse.json({ error: "Pick a future date." }, { status: 400 });
    }

    const db = getAdminDb();
    const taken = await db.doc(`bookings/${bookingId(username, date, slot)}`).get();
    if (taken.exists) {
      return NextResponse.json({ error: "That slot was just taken — pick another." }, { status: 409 });
    }

    const reference = newReference();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const tx = await initializeTransaction({
      email: user.email,
      amountKobo: SESSION_PRICE_KOBO,
      reference,
      callbackUrl: `${origin.replace(/\/$/, "")}/booking/confirm`,
      metadata: { kind: "booking", username, date, slot, uid: user.uid },
    });

    const record: PaymentRecord = {
      reference,
      kind: "booking",
      uid: user.uid,
      email: user.email,
      amountKobo: SESSION_PRICE_KOBO,
      status: "pending",
      booking: { username, date, slot },
      createdAt: new Date().toISOString(),
    };
    await db.doc(`payments/${reference}`).set(record);

    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    console.error("Paystack initialize failed:", err);
    const message = err instanceof Error ? err.message : "Couldn't start payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
