import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isPlacement, AD_PLACEMENTS } from "@/lib/ads";
import { lagosDay, loadActiveAds } from "@/lib/ads-server";

export const dynamic = "force-dynamic";

// Counts an ad impression or click into DAILY aggregates (adStats per ad; and
// adPublisherStats per publisher for publisher-scoped placements — the base for
// ad-share). Anti-fraud, so the numbers can be trusted before anyone is paid:
//   * UNIQUE per visitor: one impression and one click per (visitor, ad, day),
//     where a visitor is a salted hash of IP + user-agent (adSeen/{hash}; set a
//     Firestore TTL on adSeen.expireAt). Refreshing or scripting repeats adds 0.
//   * A click only counts if the same visitor already has an impression today.
//   * Bots/previews are skipped by user-agent; the endpoint is rate-limited.
//   * /admin/ads flags publishers with abnormal click rates for review.
// Still not bulletproof against a determined attacker rotating IPs — that is why
// ad-share payouts must be held and reviewed (see README), not automatic.
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
    const visitor = createHash("sha256").update(`${clientIp(req)}|${ua}|${process.env.AD_HASH_SALT || "notesapp"}`).digest("hex").slice(0, 24);
    const impKey = `${visitor}_${adId}_impression_${day}`;
    if (event === "click") {
      // No impression from this visitor today → not a real click.
      if (!(await db.doc(`adSeen/${impKey}`).get()).exists) return NextResponse.json({ ok: true, counted: false });
    }
    try {
      await db.doc(`adSeen/${event === "impression" ? impKey : `${visitor}_${adId}_click_${day}`}`).create({ at: new Date().toISOString(), expireAt: new Date(Date.now() + 2 * 86_400_000) });
    } catch {
      return NextResponse.json({ ok: true, counted: false }); // already counted today for this visitor
    }
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
