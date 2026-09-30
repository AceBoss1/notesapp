import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { disableSubscription } from "@/lib/paystack";
import { findPaystackSubscription, TierSubscription, BadgeSubscription } from "@/lib/tier-billing";
import { rateLimit } from "@/lib/rate-limit";

// Stops auto-renewal of the caller's Pro/Business plan. They keep the
// plan until the period they've paid for ends (expiry sweep downgrades).
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "cancel-tier", user.uid, 5, 3600);
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const ref = getAdminDb().doc(`${body.which === "badge" ? "badgeSubscriptions" : "tierSubscriptions"}/${user.uid}`);
    const sub = (await ref.get()).data() as TierSubscription | BadgeSubscription | undefined;
    if (!sub || sub.status !== "active") return NextResponse.json({ error: "You don't have an active plan to cancel." }, { status: 404 });

    const found = await findPaystackSubscription(sub.email, sub.planCode);
    if (!found) {
      return NextResponse.json({ error: "Couldn't find your subscription at Paystack yet — try again in a few minutes, or contact us." }, { status: 404 });
    }
    await disableSubscription(found.code, found.token);
    await ref.update({ status: "cancelled", cancelledAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, accessUntil: sub.currentPeriodEnd });
  } catch (err) {
    console.error("cancel-tier failed:", err);
    { const f = friendlyMessage(err, "Couldn't cancel"); return NextResponse.json({ error: f.message }, { status: f.status }); }
  }
}
