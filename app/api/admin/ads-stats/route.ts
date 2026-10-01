import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { lagosDay } from "@/lib/ads-server";

export const dynamic = "force-dynamic";

// Per-ad impressions/clicks for the last N days (default 30).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
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
    return NextResponse.json({ days, byAd });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load ad stats");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
