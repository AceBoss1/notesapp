import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ttlCache } from "@/lib/ttl-cache";
import { AdCreative, isPlacement } from "@/lib/ads";

export const dynamic = "force-dynamic";

// One read of the active creatives serves every visitor for 5 minutes.
const loadActive = ttlCache(5 * 60_000, async () => {
  const snap = await getAdminDb().collection("adCreatives").where("active", "==", true).get();
  return snap.docs.map((d) => ({ provider: "notesapp", ...d.data(), id: d.id }) as AdCreative);
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "ads", clientIp(req), 120, 60);
  if (limited) return limited;
  const placement = req.nextUrl.searchParams.get("placement");
  if (!isPlacement(placement)) return NextResponse.json({ error: "Unknown placement." }, { status: 400 });
  try {
    const now = Date.now();
    const ads = (await loadActive())
      .filter((a) => a.placements?.includes(placement))
      .filter((a) => (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() >= now))
      .map(({ id, title, text, image, href, weight, provider }) => ({ id, title, text, image, href, weight, provider }));
    return NextResponse.json({ ads }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    const f = friendlyMessage(err);
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
