import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SiteError, readSite, saveSite } from "@/lib/site-server";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// GET → { site }: the signed-in member's site content, colour set and kit (lib/site-kits.ts).
export async function GET(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    return NextResponse.json({ site: await readSite(getAdminDb(), me.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't load your site");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

// POST { blocks?, order?, palette?, bookBelowPosts? } → { site }: saves the sections' content, their order, the colour set and background, and
// the booking card under posts (lib/site-server.ts checks the plan).
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req)).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-content", me.uid, 120, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json({ site: await saveSite(getAdminDb(), me.uid, { blocks: b.blocks, order: b.order, palette: b.palette, bookBelowPosts: b.bookBelowPosts, cover: b.cover }) });
  } catch (err) {
    if (err instanceof SiteError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't save your site");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
