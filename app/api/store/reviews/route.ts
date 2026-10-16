import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ReviewError } from "@/lib/reviews";
import { deleteReview, listReviews, replyToReview, submitReview } from "@/lib/reviews-server";

export const dynamic = "force-dynamic";
const uidOf = async (req: NextRequest) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return token ? (await getAuth(getAdminApp()).verifyIdToken(token).catch(() => null))?.uid : undefined;
};
const fail = (err: unknown, fallback: string) => {
  if (err instanceof ReviewError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, fallback);
  return NextResponse.json({ error: f.message }, { status: f.status });
};

// Anyone: GET ?itemId=… (one item's reviews) or ?ownerUid=… (a seller's reviews across items). Signed in: also whether you can review.
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, "reviews-read", clientIp(req), 120, 60);
    if (limited) return limited;
    const sp = req.nextUrl.searchParams;
    return NextResponse.json(await listReviews(getAdminDb(), { itemId: sp.get("itemId") || undefined, ownerUid: sp.get("ownerUid") || undefined }, await uidOf(req)), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load reviews");
  }
}

// Signed in: POST { action: "review", itemId, rating, text } | { action: "delete", id } | { action: "reply", id, text } (the seller).
export async function POST(req: NextRequest) {
  try {
    const uid = await uidOf(req);
    if (!uid) throw new ReviewError("Sign in first.", 401);
    const limited = await rateLimit(req, "reviews-write", uid, 30, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "review": return NextResponse.json(await submitReview(db, uid, String(b.itemId ?? ""), b));
      case "delete": await deleteReview(db, uid, String(b.id ?? "")); return NextResponse.json({ ok: true });
      case "reply": await replyToReview(db, uid, String(b.id ?? ""), b.text); return NextResponse.json({ ok: true });
      default: throw new ReviewError("Unknown action.");
    }
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
