import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { loadRevenue } from "@/lib/revenue-server";

export const dynamic = "force-dynamic";

// Admin-only revenue report (finance). The raw data is read and cached in lib/revenue-server.ts.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["finance"]);
    const days = [7, 30, 90, 365, 0].includes(Number(req.nextUrl.searchParams.get("days"))) ? Number(req.nextUrl.searchParams.get("days")) : 30;
    return NextResponse.json(await loadRevenue(getAdminDb(), days));
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load revenue");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
