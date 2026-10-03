import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { DigitalFail, createDownloadLink } from "@/lib/digital-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/store/download?ref=<purchase reference> (signed in as the buyer) → { url }.
// The first call marks the sale final: no refunds once a download has started.
export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "digital-download", user.uid, 30, 3600);
    if (limited) return limited;
    const link = await createDownloadLink(user.uid, String(req.nextUrl.searchParams.get("ref") || ""));
    return NextResponse.json(link, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof DigitalFail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't start the download");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
