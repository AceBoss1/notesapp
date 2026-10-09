import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { listConnections } from "@/lib/social-server";
import { socialAuthed, socialFail } from "@/lib/social-api";

export const dynamic = "force-dynamic";

// GET → which networks can be connected, and which are: [{ provider, label, configured, connected, name?, handle?, expiresAt?, needsReconnect? }]
export async function GET(req: NextRequest) {
  try {
    const me = await socialAuthed(req);
    return NextResponse.json({ connections: await listConnections(getAdminDb(), me.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return socialFail(err, "Couldn't load your connected accounts");
  }
}
