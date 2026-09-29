import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { fulfillPayment } from "@/lib/payments";

// Called by /booking/confirm after Paystack redirects the buyer back.
export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to view this payment." }, { status: 401 });

    const reference = req.nextUrl.searchParams.get("reference");
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const owner = await getAdminDb().doc(`payments/${reference}`).get();
    if (!owner.exists || owner.data()?.uid !== user.uid) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const payment = await fulfillPayment(reference);
    return NextResponse.json({
      status: payment.status,
      kind: payment.kind,
      booking: payment.booking,
      subscription: payment.subscription,
    });
  } catch (err) {
    console.error("Paystack verify failed:", err);
    const message = err instanceof Error ? err.message : "Couldn't verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
