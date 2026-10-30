import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { canActForSeller } from "@/lib/orders-server";
import { ReferralError, listOffers, ownProducts, setOffer } from "@/lib/referrals-server";
import { rateLimit } from "@/lib/rate-limit";
import { affiliateCodes } from "@/lib/discounts-server";

export const dynamic = "force-dynamic";

// Products open to affiliates.
//   GET                → { offers }: the marketplace (anyone), each with the codes its publisher lets affiliates share
//   GET ?mine=1        → { offers, products }: the signed-in publisher's own, and every product that can carry a share
//   POST { type: "item"|"course", itemId, percent }   a publisher sets (or, with 0, removes) the share on their product
export async function GET(req: NextRequest) {
  const db = getAdminDb();
  if (req.nextUrl.searchParams.get("mine") === "1") {
    const u = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const [offers, products] = await Promise.all([listOffers(db, { ownerUid: u.uid }), ownProducts(db, u.uid)]);
    return NextResponse.json({ offers, products }, { headers: { "Cache-Control": "no-store" } });
  }
  const offers = await listOffers(db);
  const codes = await affiliateCodes(db, offers.map((o) => o.ownerUid));
  const withCodes = offers.map((o) => ({ ...o, codes: (codes[o.ownerUid] ?? []).filter((c) => !c.itemIds.length || c.itemIds.includes(o.itemId)) }));
  return NextResponse.json({ offers: withCodes }, { headers: { "Cache-Control": "public, max-age=60" } });
}

export async function POST(req: NextRequest) {
  try {
    const u = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!u) throw new ReferralError(401, "Sign in first.");
    const limited = await rateLimit(req, "affiliate-offers", u.uid, 60, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const type = b.type === "course" ? "course" : "item";
    const offer = await setOffer(getAdminDb(), u.uid, type, String(b.itemId ?? ""), b.percent, (owner) => owner === u.uid ? Promise.resolve(true) : canActForSeller(u.uid, owner));
    return NextResponse.json({ offer });
  } catch (e) {
    if (e instanceof ReferralError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("affiliate offers", e);
    return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  }
}
