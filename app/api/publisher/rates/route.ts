import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { loadLivePricing } from "@/lib/pricing-server";
import { myRates } from "@/lib/my-rates";
import type { AccountTier } from "@/lib/users";

export const dynamic = "force-dynamic";

// The signed-in member's own commission (their plan, or the rates agreed with their Enterprise account), from the prices saved in
// Admin → Pricing. Shown where a publisher sets prices and sees earnings (components/MyCommission.tsx).
export async function GET(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const who = await verifySignedInRequest(idToken).catch(() => null);
  if (!who) return NextResponse.json({ error: "Sign in to see your rates." }, { status: 401 });
  await loadLivePricing();
  const u = (await getAdminDb().doc(`users/${who.uid}`).get()).data();
  return NextResponse.json(myRates((u?.accountTier as AccountTier) || "standard", u?.customRates), { headers: { "Cache-Control": "private, no-store" } });
}
