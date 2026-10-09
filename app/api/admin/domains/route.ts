import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifyAdminRequest } from "@/lib/firebase-admin";
import { whogohostConfigured, wgVersion, wgCredits, wgTlds, WhogohostError } from "@/lib/whogohost";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Admin: checks the Whogohost reseller connection. Returns whether the two settings exist, and — when they do — the service version, the
// reseller credit balance and the extensions on offer, exactly as the service answered (no secrets are included).
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(bearer(req));
    if (!whogohostConfigured()) return NextResponse.json({ configured: false });
    const [version, credits, tlds] = await Promise.allSettled([wgVersion(), wgCredits(), wgTlds()]);
    const show = (r: PromiseSettledResult<unknown>) =>
      r.status === "fulfilled" ? { ok: true, data: r.value } : { ok: false, error: r.reason instanceof WhogohostError ? r.reason.message : "Failed" };
    return NextResponse.json({ configured: true, version: show(version), credits: show(credits), tlds: show(tlds) });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't check the domain service");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
