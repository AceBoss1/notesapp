import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ttlCache } from "@/lib/ttl-cache";

// One read of the active boosts serves everyone for a minute.
const activeBoosts = ttlCache(60_000, async () => {
  const snap = await getAdminDb().collection("boosts").where("status", "==", "active").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, any>);
});

export const dynamic = "force-dynamic";

// Boosts that can be shown right now: paid, inside their window, not
// out of impressions, and under today's delivery cap. The least-
// delivered (relative to what was bought) go first so campaigns get
// fair rotation.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "boosts-active", clientIp(req), 60, 60);
  if (limited) return limited;
  try {
    const limit = Math.min(6, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 3));
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const boosts = (await activeBoosts())
      .filter(
        (b) =>
          new Date(b.endsAt).getTime() > now &&
          b.impressionsDelivered < b.impressionsPurchased &&
          (b.daily?.[today] || 0) < b.maxPerDay
      )
      .sort((a, b) => a.impressionsDelivered / a.impressionsPurchased - b.impressionsDelivered / b.impressionsPurchased)
      .slice(0, limit)
      .map((b) => ({ id: b.id, slug: b.slug, title: b.title, author: b.author, image: b.image }));
    return NextResponse.json({ boosts }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (err) {
    console.error("boosts active failed:", err);
    return NextResponse.json({ boosts: [] });
  }
}
