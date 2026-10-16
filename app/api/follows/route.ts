import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { FollowError, listFollows } from "@/lib/follows-server";

export const dynamic = "force-dynamic";

// GET /api/follows?username=ify&list=followers|following&after=<cursor>
// Someone's followers or the accounts they follow, 30 at a time. You must be signed in; the lists are shown only when both you and they have lists switched on (your own always).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in to see followers and following." }, { status: 401 });
    const limited = await rateLimit(req, "follow-lists", me.uid, 60, 60);
    if (limited) return limited;
    const url = new URL(req.url);
    const kind = url.searchParams.get("list") === "following" ? "following" : "followers";
    const after = url.searchParams.get("after");
    if (after && !/^[A-Za-z0-9_.-]{1,120}$/.test(after)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    return NextResponse.json(await listFollows(getAdminDb(), me.uid, kind, url.searchParams.get("username") ?? "", after));
  } catch (err) {
    if (err instanceof FollowError) return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load that list");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
