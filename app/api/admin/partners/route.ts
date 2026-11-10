import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { PartnerError, adminPartners, decideApplication, setTierTerms, updatePartner } from "@/lib/partner-network-server";

export const dynamic = "force-dynamic";
// Sales & partnerships (growth) and the executive office review applications and manage partners; marketing helps with chapters and media.
// Only a super admin changes the tier terms (Admin → Limits → Partner Network).
const NEED = ["growth", "executive", "marketing"] as const;

// Admin → Partners. GET → { applications, partners, terms }.
// POST { action: "decide", id, status?, tier?, feedback? (the applicant sees it), notes? (team only) }
//      { action: "partner", id, tier?, status?, listed?, notes?, declineTier? }
//      { action: "terms", terms: { registered|certified|premier: { percent, months } } } (super admin)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), NEED);
    return NextResponse.json(await adminPartners(getAdminDb()), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({}));
    const by = await verifyAdminRequest(token, body.action === "terms" ? "super" : NEED);
    const db = getAdminDb();
    if (body.action === "decide") return NextResponse.json(await decideApplication(db, body.id, body));
    if (body.action === "partner") { await updatePartner(db, body.id, body); return NextResponse.json({ ok: true }); }
    if (body.action === "terms") return NextResponse.json({ terms: await setTierTerms(db, body.terms, by) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}
function fail(err: unknown) {
  if (err instanceof PartnerError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't update partners");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
