import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { fail, who } from "@/lib/partner-network-api";
import { applyPartner, joinPartner, leavePartner, mine, sendLead, tierTerms, withdrawApplication } from "@/lib/partner-network-server";

export const dynamic = "force-dynamic";

// The NotesApp Partner Network (lib/partner-network.ts).
// GET → { terms, signedIn, mine: { applications, partners, memberships } | null }
// POST { action: "apply", track, orgName, website, countries, reach, about, plan, services?, agree: true } → { application }
//      { action: "withdraw", id }
//      { action: "lead", partnerId, service, budget, message }     ask a solutions partner for help (Find an expert)
//      { action: "join", partnerId, ref }                          ask to be verified by an association, join a chapter, or a workplace (code)
//      { action: "leave", partnerId }
export async function GET(req: NextRequest) {
  try {
    const me = await who(req);
    const limited = await rateLimit(req, "partners-read", me?.uid ?? clientIp(req), 120, 600);
    if (limited) return limited;
    const db = getAdminDb();
    const [terms, my] = await Promise.all([tierTerms(db), me ? mine(db, me.uid) : Promise.resolve(null)]);
    return NextResponse.json({ terms, signedIn: !!me, mine: my }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err, "Couldn't load the Partner Network");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await who(req);
    if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "partners-write", me.uid, 30, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (body.action === "apply") return NextResponse.json({ application: await applyPartner(db, me, body) });
    if (body.action === "withdraw") { await withdrawApplication(db, me.uid, body.id); return NextResponse.json({ ok: true }); }
    if (body.action === "lead") { await sendLead(db, me, body.partnerId, body); return NextResponse.json({ ok: true }); }
    if (body.action === "join") return NextResponse.json({ status: await joinPartner(db, me, body.partnerId, body) });
    if (body.action === "leave") { await leavePartner(db, me.uid, body.partnerId); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err, "Couldn't do that");
  }
}
