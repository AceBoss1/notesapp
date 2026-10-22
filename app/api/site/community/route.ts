import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SiteError, linkCommunity } from "@/lib/site-server";

export const dynamic = "force-dynamic";

// POST { cid, page? } → { site }: links a community the member runs to their site (cid "" unlinks it), and whether it shows as a page
// inside their site (page); lib/site-server.ts linkCommunity.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-community", me.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ site: await linkCommunity(getAdminDb(), me.uid, b.cid, new Date(), b.page) });
  } catch (err) {
    if (err instanceof SiteError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't link the community");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
