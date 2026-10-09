import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { lagosDay } from "@/lib/ads-server";

export const dynamic = "force-dynamic";

// Per-ad impressions/clicks for the last N days (default 30).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["growth", "finance"]);
    const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
    const cutoff = lagosDay(new Date(Date.now() - days * 86_400_000));
    const snap = await getAdminDb().collection("adStats").where("day", ">=", cutoff).get();
    const byAd: Record<string, { impressions: number; clicks: number }> = {};
    for (const d of snap.docs) {
      const x = d.data();
      const t = (byAd[x.adId] ||= { impressions: 0, clicks: 0 });
      t.impressions += Number(x.impressions) || 0;
      t.clicks += Number(x.clicks) || 0;
    }

    // Ad-share review: per publisher totals + flags for anything that looks off.
    const ps = await getAdminDb().collection("adPublisherStats").where("day", ">=", cutoff).get();
    const byPub: Record<string, { impressions: number; clicks: number; days: number }> = {};
    for (const d of ps.docs) {
      const x = d.data();
      const t = (byPub[x.publisherUid] ||= { impressions: 0, clicks: 0, days: 0 });
      t.impressions += Number(x.impressions) || 0;
      t.clicks += Number(x.clicks) || 0;
      t.days += 1;
    }
    const top = Object.entries(byPub).sort(([, a], [, b]) => b.impressions - a.impressions).slice(0, 50);
    const publishers = await Promise.all(
      top.map(async ([uid, t]) => {
        const u = (await getAdminDb().doc(`users/${uid}`).get()).data();
        const ctr = t.impressions ? t.clicks / t.impressions : 0;
        const flags: string[] = [];
        if (t.clicks > t.impressions) flags.push("more clicks than views");
        else if (t.impressions >= 50 && ctr > 0.15) flags.push("click rate above 15%");
        if (t.days === 1 && t.impressions >= 500) flags.push("one-day spike");
        return { uid, username: u?.username || uid, accountTier: u?.accountTier || "", adsOptIn: u?.adsOptIn === true, ...t, flags };
      })
    );
    return NextResponse.json({ days, byAd, publishers });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load ad stats");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
