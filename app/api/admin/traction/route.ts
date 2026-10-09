import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { summaryText, tractionCsv } from "@/lib/traction";
import { gatherTraction } from "@/lib/traction-server";
import { complianceSummary } from "@/lib/compliance";

export const dynamic = "force-dynamic";

// Admin-only platform numbers for decks and applications (counts only — no personal data leaves).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const t = await gatherTraction(getAdminDb());
    return NextResponse.json({ traction: t, summary: `${summaryText(t)}\n\n${complianceSummary()}`, csv: tractionCsv(t) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't build the snapshot");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
