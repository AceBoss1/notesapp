import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { getLimitTable, saveLimitOverrides } from "@/lib/limits-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: GET → the limit for every plan; POST { limits: { <key>: { <plan>: number } } } → saves them (whole numbers within each range; the
// defaults apply to anything left out). Applies sitewide within about 30 seconds.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req), ["product"]);
    return NextResponse.json({ limits: await getLimitTable(getAdminDb()) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load the limits");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdminRequest(bearer(req), ["product"]);
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ limits: await saveLimitOverrides(getAdminDb(), body.limits, admin) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the limits");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
