import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { presenceFor } from "@/lib/follows-server";

export const dynamic = "force-dynamic";

// POST { uids: [...] } → { statuses: { uid: { online, lastSeen } }, viewerOff }
// Only people who follow you and whom you follow back, and who (like you) have online visibility on, are included.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "presence", me.uid, 30, 60);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const uids = Array.isArray(body.uids) ? body.uids.filter((u: unknown): u is string => typeof u === "string" && u.length > 0 && u.length < 128) : [];
    return NextResponse.json(await presenceFor(getAdminDb(), me.uid, uids));
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
