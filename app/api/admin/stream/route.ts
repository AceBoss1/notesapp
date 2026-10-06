import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { cleanOrphans, scanOrphans } from "@/lib/media-cleanup";
import { streamDiagnostics } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: GET → what Cloudflare Stream says to our token (the real error when /status shows Video courses as Down), and
// ?scan=1 adds what a clean-up would remove. POST → run the clean-up.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    const diagnostics = await streamDiagnostics();
    if (req.nextUrl.searchParams.get("scan") !== "1") return NextResponse.json({ diagnostics });
    return NextResponse.json({ diagnostics, orphans: await scanOrphans() });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check video storage");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    return NextResponse.json({ removed: await cleanOrphans() });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't clean up");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
