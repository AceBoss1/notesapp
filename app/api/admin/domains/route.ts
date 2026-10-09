import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { wgDiagnose } from "@/lib/whogohost";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: scans the Whogohost reseller connection — which settings exist, whether the service accepts our login, and its version, our credit
// balance and the extensions on offer, exactly as it answered. No secrets are included.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    return NextResponse.json(await wgDiagnose());
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check the domain service");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
