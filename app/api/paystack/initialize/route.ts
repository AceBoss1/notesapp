import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { slotLockId, initializeTransaction, newReference } from "@/lib/paystack";
import { PaymentRecord } from "@/lib/payments";
import { loadPublisher } from "@/lib/publishers";
import { weekdayOf } from "@/lib/booking-time";
import { LEGAL_VERSION } from "@/lib/legal";
import { rateLimit } from "@/lib/rate-limit";

// Starts a Paystack checkout for a 1:1 session or a monthly journal
// subscription. Price, slots and plan all come from the publisher's
// server-side settings — the client only says who/what/when.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Your account needs an email to pay." }, { status: 400 });

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Verify your email first — use the banner at the top of the page to resend the link." },
        { status: 403 }
      );
    }

    const limited = rateLimit(req, "pay-init", user.uid, 10, 600);
    if (limited) return limited;
    const payer = (await getAdminDb().doc(`users/${user.uid}`).get()).data();
    if (payer?.consent?.version !== LEGAL_VERSION) {
      return NextResponse.json(
        { error: "Please accept the Terms of Service and Privacy Policy first.", code: "consent_required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { kind, username } = body;
    if (typeof username !== "string" || !/^[a-z0-9_-]{2,30}$/.test(username)) {
      return NextResponse.json({ error: "Invalid journal." }, { status: 400 });
    }
    const pub = await loadPublisher(username);
    if (pub.uid === user.uid) return NextResponse.json({ error: "You can't pay yourself." }, { status: 400 });
    if (!pub.hasPayoutAccount) {
      return NextResponse.json({ error: "This publisher hasn't set up payouts yet." }, { status: 409 });
    }

    const db = getAdminDb();
    const reference = newReference();
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
    let record: PaymentRecord;
    let plan: string | undefined;

    if (kind === "booking") {
      const { date, slot } = body;
      const s = pub.settings?.session;
      if (!s?.enabled) return NextResponse.json({ error: "Booking isn't open for this journal." }, { status: 409 });
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: "Pick a date." }, { status: 400 });
      }
      if (date <= new Date().toISOString().slice(0, 10)) {
        return NextResponse.json({ error: "Pick a future date." }, { status: 400 });
      }
      if (!(s.availability[String(weekdayOf(date))] || []).includes(slot)) {
        return NextResponse.json({ error: "That time isn't available." }, { status: 400 });
      }
      if ((await db.doc(`slotLocks/${slotLockId(username, date, slot)}`).get()).exists) {
        return NextResponse.json({ error: "That slot was just taken — pick another." }, { status: 409 });
      }
      record = {
        reference, kind: "booking", uid: user.uid, email: user.email, amountKobo: s.priceKobo,
        status: "pending", publisherUid: pub.uid, publisherUsername: username,
        commissionRate: pub.commissionRate,
        booking: { username, date, slot, minutes: s.minutes },
        createdAt: new Date().toISOString(),
      };
    } else if (kind === "subscription") {
      const sub = pub.settings?.subscription;
      if (!sub?.enabled || !sub.planCode) {
        return NextResponse.json({ error: "Subscriptions aren't open for this journal." }, { status: 409 });
      }
      plan = sub.planCode;
      record = {
        reference, kind: "subscription", uid: user.uid, email: user.email, amountKobo: sub.priceKobo,
        status: "pending", publisherUid: pub.uid, publisherUsername: username,
        commissionRate: pub.commissionRate,
        subscription: { username, planCode: sub.planCode },
        createdAt: new Date().toISOString(),
      };
    } else {
      return NextResponse.json({ error: "Unknown payment type." }, { status: 400 });
    }

    const tx = await initializeTransaction({
      plan,
      email: user.email,
      amountKobo: record.amountKobo,
      reference,
      callbackUrl: `${origin}/booking/confirm`,
      metadata: { kind, username, uid: user.uid },
    });
    await db.doc(`payments/${reference}`).set(record);
    return NextResponse.json({ authorizationUrl: tx.authorization_url, reference });
  } catch (err) {
    console.error("Paystack initialize failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't start payment" }, { status: 500 });
  }
}
