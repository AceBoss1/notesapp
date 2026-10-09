import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { wgDiagnose, wgPricing, whogohostConfigured } from "@/lib/whogohost";
import { lookupDomain } from "@/lib/domain-lookup";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: scans the Whogohost reseller connection — which settings exist, whether the service accepts our login, and its version, our credit
// balance and the extensions on offer, exactly as it answered. No secrets are included.
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    // ?name=example.com.ng → is it free (registry lookup) and what does Whogohost charge for it, exactly as each answered.
    const name = req.nextUrl.searchParams.get("name");
    if (name) {
      const lookup = await lookupDomain(name);
      const price = whogohostConfigured() && lookup.source !== "input"
        ? await wgPricing("register", lookup.domain).then((data) => ({ ok: true as const, data }), (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }))
        : null;
      return NextResponse.json({ lookup, price });
    }
    return NextResponse.json(await wgDiagnose());
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check the domain service");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
