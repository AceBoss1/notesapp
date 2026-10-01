import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isPlacement, AD_PLACEMENTS } from "@/lib/ads";
import { lagosDay, loadActiveAds } from "@/lib/ads-server";

export const dynamic = "force-dynamic";

// Counts an ad impression or click into DAILY aggregates (adStats per ad; and
// adPublisherStats per publisher for publisher-scoped placements — the base for
// ad-share). Impressions are sent once per ad per tab-session, when the banner
// is actually on screen. Counts can still be inflated by bots — filter before
// paying anyone from them.
export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawler|spider|headless|preview/i.test(ua)) return NextResponse.json({ ok: true, counted: false });
  const limited = rateLimit(req, "ad-track", clientIp(req), 90, 60);
  if (limited) return limited;
  try {
    const { adId, event, placement, publisherUid } = await req.json().catch(() => ({}));
    if ((event !== "impression" && event !== "click") || !isPlacement(placement) || typeof adId !== "string") {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }
    // Only count real, active ads (stops junk stat documents).
    if (!(await loadActiveAds()).some((a) => a.id === adId && a.placements?.includes(placement))) return NextResponse.json({ ok: true, counted: false });

    const db = getAdminDb();
    const day = lagosDay();
    const field = event === "impression" ? "impressions" : "clicks";
    const inc = FieldValue.increment(1);
    const writes = [
      db.doc(`adStats/${adId}_${day}`).set({ adId, day, [field]: inc, byPlacement: { [placement]: { [field]: inc } } }, { merge: true }),
    ];
    if (AD_PLACEMENTS[placement].scope === "publisher" && typeof publisherUid === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(publisherUid)) {
      writes.push(db.doc(`adPublisherStats/${publisherUid}_${day}`).set({ publisherUid, day, [field]: inc }, { merge: true }));
    }
    await Promise.all(writes);
    return NextResponse.json({ ok: true, counted: true });
  } catch {
    return NextResponse.json({ ok: true, counted: false }); // never break a page for analytics
  }
}
