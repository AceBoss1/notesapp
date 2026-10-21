import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SiteError, applyKit } from "@/lib/site-server";

export const dynamic = "force-dynamic";

// POST { kit } → { site, theme, sections }: starts the member's site from a kit (lib/site-kits.ts): look, colours, sections and starter words
// where they haven't written anything. Each kit needs a plan (Personal: Free Basic; shops and services: Pro; schools and churches: Business).
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-kit", me.uid, 20, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await applyKit(getAdminDb(), me.uid, b.kit));
  } catch (err) {
    if (err instanceof SiteError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't apply the kit");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
