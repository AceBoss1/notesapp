import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { canDownload, canSeeCustomers, canSeeVisitDetail, rangesFor } from "@/lib/analytics";
import { AnalyticsError, accountsFor, gatherReport } from "@/lib/analytics-server";

export const dynamic = "force-dynamic";

// GET ?days=7|30|90&as=<account uid> → { report, tier, ranges, can: { customers, download, visits }, accounts }
// The signed-in member's analytics, or an organisation's whose store they run. The days are limited by the account's plan (lib/analytics.ts).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "analytics", me.uid, 60, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const q = req.nextUrl.searchParams;
    const accounts = await accountsFor(db, me.uid);
    const as = q.get("as") || me.uid;
    if (!accounts.some((a) => a.uid === as)) throw new AnalyticsError(403, "You can't see this account's analytics.");
    // A range the plan doesn't include falls back to 7 days (gatherReport), so a link never shows more than the plan allows.
    const { report, tier } = await gatherReport(db, me.uid, as, Number(q.get("days") || 7));
    return NextResponse.json({
      report, tier, ranges: rangesFor(tier), accounts,
      can: { customers: canSeeCustomers(tier), download: canDownload(tier), visits: canSeeVisitDetail(tier) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AnalyticsError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load your analytics");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
