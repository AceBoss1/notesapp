import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { resolveShareCard } from "@/lib/share-targets-server";

export const dynamic = "force-dynamic";

// GET ?kind=&id= → { card }: the card Share to Moments and Share to Journals use (lib/share-targets.ts), built from the item as it is
// now; 404 for anything that isn't public (drafts, members-only posts, revoked certificates, ended coupons). Anyone may ask: a card only
// holds what the item's own public page already shows.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "share-card", clientIp(req), 60, 60);
  if (limited) return limited;
  const q = req.nextUrl.searchParams;
  const card = await resolveShareCard(getAdminDb(), { kind: q.get("kind"), id: q.get("id") ?? "" }).catch(() => null);
  if (!card) return NextResponse.json({ error: "That can't be shared: it may be private, a draft, or no longer there." }, { status: 404 });
  return NextResponse.json({ card }, { headers: { "Cache-Control": "no-store" } });
}
