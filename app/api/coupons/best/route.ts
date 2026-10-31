import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { NOTESAPP_OWNER, isNotesAppTarget, isPublisherTarget } from "@/lib/discounts";
import { bestCoupon } from "@/lib/discounts-server";
import { tierPrice } from "@/lib/tier-billing";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Nana's pick at a checkout (components/DiscountCodeField.tsx applies it): the coupon that takes the most off this purchase,
// from the buyer's saved coupons and the ones on show. The checkout checks it again when they pay.
// POST { target, seller? (username, for a publisher's product), itemId?, itemIds?, subtotalKobo, extraKobo?, tier?, interval? }
export async function POST(req: NextRequest) {
  const u = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  if (!u) return NextResponse.json({ best: null });
  const limited = await rateLimit(req, "coupon-best", u.uid, 60, 600);
  if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const target = String(b.target ?? "");
  const db = getAdminDb();
  let owner = "";
  if (isNotesAppTarget(target)) owner = NOTESAPP_OWNER;
  else if (isPublisherTarget(target)) {
    const seller = String(b.seller ?? "").toLowerCase();
    if (/^[a-z0-9_-]{2,30}$/.test(seller)) owner = String((await db.doc(`usernames/${seller}`).get()).data()?.uid ?? "");
  }
  if (!owner) return NextResponse.json({ best: null });
  // A plan is priced here, from its tier and interval; everything else from what the checkout shows (checked again at payment).
  const tier = b.tier === "business" ? "business" : "pro";
  const subtotalKobo = target === "plan" ? (tierPrice(tier, b.interval === "annually" ? "annually" : "monthly") ?? 0) : Math.max(0, Math.round(Number(b.subtotalKobo) || 0));
  const best = await bestCoupon(db, u.uid, owner, {
    target, subtotalKobo, extraKobo: Math.max(0, Math.round(Number(b.extraKobo) || 0)),
    ...(target === "plan" ? { itemId: tier } : typeof b.itemId === "string" ? { itemId: b.itemId } : {}),
    ...(Array.isArray(b.itemIds) ? { itemIds: b.itemIds.map(String) } : {}),
  } as Parameters<typeof bestCoupon>[3]);
  return NextResponse.json({ best }, { headers: { "Cache-Control": "no-store" } });
}
