import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { GlobalPayError } from "@/lib/global-pay";
import { liveDeps, startCheckout } from "@/lib/global-pay-server";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/host";

// POST { username, tier, currency } → { url }: a month's subscription paid in the reader's currency through Stripe, Flutterwave or
// Paystack (lib/currency.ts). Naira readers of naira creators keep the usual checkout (/api/paystack/initialize).
export async function POST(req: NextRequest) {
  const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  const limited = await rateLimit(req, "global-checkout", user.uid, 10, 600);
  if (limited) return limited;
  try {
    const b = await req.json();
    const r = await startCheckout(getAdminDb(), { uid: user.uid, email: user.email }, { username: String(b.username ?? ""), tier: b.tier, currency: b.currency }, liveDeps(SITE_URL));
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof GlobalPayError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("global checkout failed", e);
    return NextResponse.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
