import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { deliveredByAd } from "@/lib/ads-server";
import type { AdCampaign } from "@/lib/ad-packages";

export const dynamic = "force-dynamic";

// The signed-in advertiser's campaigns with delivery stats (views / clicks).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const snap = await getAdminDb().collection("adCampaigns").where("uid", "==", me.uid).get();
    const campaigns = snap.docs.map((d) => d.data() as AdCampaign).filter((c) => c.status !== "awaiting_payment").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const live = campaigns.filter((c) => c.status === "live" || c.status === "completed").map((c) => c.id);
    const stats = live.length ? await deliveredByAd(live) : {};
    return NextResponse.json({ campaigns: campaigns.map((c) => ({ ...c, stats: stats[c.id] ?? { impressions: 0, clicks: 0 } })) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load your campaigns");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
