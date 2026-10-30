import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { DiscountError } from "@/lib/discounts";
import { couponCard, myCoupons, removeCoupon, saveCoupon, shopCoupons } from "@/lib/discounts-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Coupons (docs/REFERRALS.md, step 3).
//   GET ?seller=<username>[&item=<id>]   the coupons a publisher shows in their shop (anyone)
//   GET ?seller=<username>&code=<CODE>   one coupon for its card, if it's open (anyone)
//   GET ?mine=1                          the signed-in member's saved coupons
//   POST { action: "save", seller, code } | { action: "remove", id }
const me = (req: NextRequest) => verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
const fail = (e: unknown) => {
  if (e instanceof DiscountError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("coupons", e);
  return NextResponse.json({ error: "Couldn't do that. Try again." }, { status: 500 });
};

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    if (q.get("mine") === "1") {
      const u = await me(req);
      if (!u) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      return NextResponse.json({ coupons: await myCoupons(db, u.uid) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (q.get("code")) {
      const coupon = await couponCard(db, q.get("seller"), q.get("code"));
      return coupon ? NextResponse.json({ coupon }, { headers: { "Cache-Control": "public, max-age=60" } }) : NextResponse.json({ error: "This coupon has ended or isn't available." }, { status: 404 });
    }
    const item = q.get("item") ?? undefined;
    return NextResponse.json({ coupons: await shopCoupons(db, q.get("seller"), item && /^[A-Za-z0-9_-]{1,64}$/.test(item) ? item : undefined) },
      { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const u = await me(req);
    if (!u) return NextResponse.json({ error: "Sign in to save coupons." }, { status: 401 });
    const limited = await rateLimit(req, "coupons", u.uid, 30, 600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "save") return NextResponse.json({ coupon: await saveCoupon(db, u.uid, b.seller, b.code) });
    if (b.action === "remove" && typeof b.id === "string") { await removeCoupon(db, u.uid, b.id); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}
