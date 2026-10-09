import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifyAdminAccess } from "@/lib/firebase-admin";
import { AccessChangeError, accessLog, changeAccess, listStaff } from "@/lib/admin-access-server";
import { DEPARTMENTS } from "@/lib/admin-access";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// Super admins: GET → who has staff access (with roles and departments), what you may do, and the recent changes.
// POST { email, role: "super" | "admin" | "none", depts? } → appoints, edits or removes someone. Only the owner can touch super admins.
export async function GET(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    if (me.access.role !== "super") throw new AccessChangeError(403, "Only a super admin can see this.");
    const db = getAdminDb();
    const [people, log] = await Promise.all([listStaff(db), accessLog(db)]);
    return NextResponse.json({ me: { uid: me.uid, owner: me.owner }, people, log, departments: DEPARTMENTS }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AccessChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't load team access");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await verifyAdminAccess(bearer(req));
    const limited = rateLimit(req, "admin-access", me.uid, 30, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await changeAccess(getAdminDb(), me, body));
  } catch (err) {
    if (err instanceof AccessChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't change access");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
