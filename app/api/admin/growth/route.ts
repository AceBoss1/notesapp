import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { storedGrowth } from "@/lib/growth-server";

export const dynamic = "force-dynamic";

// Admin → Growth (docs/GROWTH.md): where members come from and whether they stay. Counts and percentages only, plus creators'
// usernames (never a teen's or a child's, and never the members they brought). Counted at most once an hour (lib/stat-cache.ts);
// ?fresh=1 is the page's "Count again now".
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["marketing", "growth", "finance"]);
    const { data, asOf } = await storedGrowth(getAdminDb(), req.nextUrl.searchParams.get("fresh") === "1");
    return NextResponse.json({ report: data, asOf }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't count the growth numbers");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
