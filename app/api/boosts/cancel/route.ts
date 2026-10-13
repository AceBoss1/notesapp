import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { BoostCancelError, cancelBoost } from "@/lib/boost-cancel";

export const dynamic = "force-dynamic";

// POST { reference } — the member cancels their own running boost; half of the undelivered share is refunded, half forfeited.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "boost-cancel", me.uid, 10, 3600);
    if (limited) return limited;
    const { reference } = await req.json().catch(() => ({}));
    if (typeof reference !== "string" || !reference) return NextResponse.json({ error: "Missing boost." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await cancelBoost(getAdminDb(), reference, "member", { uid: me.uid })) });
  } catch (err) {
    if (err instanceof BoostCancelError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't cancel that boost");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
