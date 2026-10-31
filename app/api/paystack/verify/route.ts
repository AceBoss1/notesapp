import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { fulfillPayment } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

// Called by /booking/confirm after Paystack redirects the buyer back.
// Reads request headers/query, so it must never be prerendered at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in to view this payment." }, { status: 401 });
    const limited = await rateLimit(req, "pay-verify", user.uid, 30, 600);
    if (limited) return limited;

    const reference = req.nextUrl.searchParams.get("reference");
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const owner = await getAdminDb().doc(`payments/${reference}`).get();
    if (!owner.exists || owner.data()?.uid !== user.uid) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    const payment = await fulfillPayment(reference);
    // A basket shows as a store order; any item that sold out before the payment landed is named (it's refunded).
    const soldOut = payment.kind === "store_cart"
      ? (await Promise.all((payment.cart?.orders ?? []).map((r) => getAdminDb().doc(`payments/${r}`).get()))).filter((d) => d.data()?.status === "paid_slot_conflict").map((d) => String(d.data()?.store?.itemTitle ?? ""))
      : [];
    return NextResponse.json({
      status: payment.status,
      kind: payment.kind === "store_cart" ? "store" : payment.kind,
      ...(soldOut.length ? { soldOut } : {}),
      booking: payment.booking,
      subscription: payment.subscription,
      boost: payment.boost,
      tier: payment.tier && { tier: payment.tier.tier, interval: payment.tier.interval },
      gift: payment.gift && { username: payment.gift.username, noteSlug: payment.gift.noteSlug },
      amountKobo: payment.amountKobo,
      ...(payment.payWith === "wallet" ? { payWith: "wallet" } : {}),
      ...(payment.topup ? { topup: payment.topup } : {}),
      ...(payment.nanaPack ? { nanaPack: payment.nanaPack } : {}),
      ...(payment.giving ? { giving: { cid: payment.giving.cid, communityName: payment.giving.communityName, fund: payment.giving.fund, giftKobo: payment.giving.giftKobo } } : {}),
      ...(payment.ticket ? { ticket: { eventId: payment.ticket.eventId, eventTitle: payment.ticket.eventTitle, quantity: payment.ticket.quantity, typeName: payment.ticket.typeName } } : {}),
      ...(payment.certificate ? { certificate: { courseTitle: payment.certificate.courseTitle, issuedId: payment.certificate.issuedId ?? null } } : {}),
    });
  } catch (err) {
    console.error("Paystack verify failed:", err);
    const f = friendlyMessage(err, "Couldn't verify payment");
    return NextResponse.json({ error: f.status === 503 ? "We're at capacity for a moment — your payment is safe and will be confirmed automatically. Refresh in a little while." : f.message }, { status: f.status });
  }
}
