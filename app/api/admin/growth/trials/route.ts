import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { trialStatsFor } from "@/lib/trial-earnings-server";

export const dynamic = "force-dynamic";

// Admin → Growth → Trials (lib/trial-earnings.ts): trials that ended in the last ?days= days, what members were told, who paid after, the
// commission given up in trials and the plan payments that followed. Counts and sums only.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["marketing", "growth", "finance"]);
    const days = [7, 30, 90].includes(Number(req.nextUrl.searchParams.get("days"))) ? Number(req.nextUrl.searchParams.get("days")) : 30;
    return NextResponse.json({ stats: await trialStatsFor(getAdminDb(), days) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't count the trials");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
