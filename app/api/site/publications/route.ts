import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { SiteError } from "@/lib/site-server";
import { previewImport, setOrcid } from "@/lib/publications-server";

export const dynamic = "force-dynamic";

// POST { action: "preview", source: "bibtex" | "doi" | "orcid", text? | doi? | orcid? } → { items }: publications to add (lib/publications-import.ts);
//      the page merges them into the section and the member saves.
// POST { action: "orcid", orcid | null, sync } → { orcid }: link (or unlink) an ORCID iD; with sync, new works are added daily.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-publications", me.uid, 60, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (b.action === "preview") return NextResponse.json({ items: await previewImport(b) });
    if (b.action === "orcid") return NextResponse.json({ orcid: await setOrcid(getAdminDb(), me.uid, b) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof SiteError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't import that");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
