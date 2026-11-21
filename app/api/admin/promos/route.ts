import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { PromoError, adminPromo } from "@/lib/promos-server";

export const dynamic = "force-dynamic";
// The executive office, growth and finance follow promo campaigns (who claimed which free plan, tournament sign-ups, campaign pitches).
const NEED = ["executive", "growth", "finance"] as const;

// GET ?id=davido-at-34 → { status, claims, tournament, pitches }
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), NEED);
    return NextResponse.json(await adminPromo(getAdminDb(), req.nextUrl.searchParams.get("id") ?? "davido-at-34"), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof PromoError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load the campaign");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
