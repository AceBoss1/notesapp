import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { loadLivePricing } from "@/lib/pricing-server";
import { topGiftedToday } from "@/lib/gifts-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { friendlyMessage } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// The "Top gifted today" shelf at the top of Trending and Explore (lib/gifts-server.ts). Anyone may read it; a signed-in viewer also
// sees members in teen mode whom they follow. The list itself is cached for a minute.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "gift-shelf", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    await loadLivePricing();
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = token ? await verifySignedInRequest(token).catch(() => null) : null;
    const shelf = await topGiftedToday(getAdminDb(), user ? { uid: user.uid } : null);
    return NextResponse.json(shelf, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load Top gifted today");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
