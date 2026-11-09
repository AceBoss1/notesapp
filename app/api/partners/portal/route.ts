import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { decideMember, portal, requestTier, setLeadStatus, updateListing } from "@/lib/partner-network-server";
import { fail, who } from "@/lib/partner-network-api";

export const dynamic = "force-dynamic";

// The partner portal (/partners/portal): the partners a member runs.
// GET → { partners: PortalPartner[], terms }
// POST { action: "listing", id, blurb?, website?, countries?, services?, training?, recommended?, newCode? }
//      { action: "tier", id }                                  ask to become Certified
//      { action: "lead", leadId, status }                      new · contacted · won · lost
//      { action: "member", id, memberUid, decision }           verify · decline · remove (associations and chapters)
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "partners-portal", me.uid, 120, 600);
    if (limited) return limited;
    return NextResponse.json(await portal(getAdminDb(), me.uid), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load your portal");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "partners-portal-write", me.uid, 120, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "listing") await updateListing(db, me.uid, b.id, b);
    else if (b.action === "tier") await requestTier(db, me.uid, b.id);
    else if (b.action === "lead") await setLeadStatus(db, me.uid, b.leadId, b.status);
    else if (b.action === "member") await decideMember(db, me.uid, b.id, b.memberUid, b.decision);
    else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Couldn't save that");
  }
}
