import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loadActiveAds as loadActive } from "@/lib/ads-server";
import { isPlacement } from "@/lib/ads";
import { adConfig } from "@/lib/ad-config-server";
import { spotOn } from "@/lib/ad-config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "ads", clientIp(req), 120, 60);
  if (limited) return limited;
  const placement = req.nextUrl.searchParams.get("placement");
  if (!isPlacement(placement)) return NextResponse.json({ error: "Unknown placement." }, { status: 400 });
  try {
    const now = Date.now();
    const cfg = await adConfig();
    // A spot switched off in Admin → Ads gets no adverts; rotateSec is how long each advert stays.
    if (!spotOn(cfg, placement)) return NextResponse.json({ ads: [], rotateSec: cfg.adRotateSec }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    const ads = (await loadActive())
      .filter((a) => a.placements?.includes(placement))
      .filter((a) => (!a.startsAt || new Date(a.startsAt).getTime() <= now) && (!a.endsAt || new Date(a.endsAt).getTime() >= now))
      .filter((a) => placement !== "life" || !!a.billboard) // the game shows the billboard picture
      .map(({ id, title, text, image, billboard, href, weight, provider }) => ({ id, title, text, image, href, weight, provider, ...(placement === "life" ? { billboard } : {}) }));
    return NextResponse.json({ ads, rotateSec: cfg.adRotateSec }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (err) {
    const f = friendlyMessage(err);
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
