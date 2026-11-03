import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { CareersError } from "@/lib/careers";
import { apply } from "@/lib/careers-server";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const bearer = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

// POST { roleId, coverNote, links?, phone?, city?, consent: true, futureRoles? } with the applicant's NotesApp sign-in.
export async function POST(req: NextRequest) {
  try {
    const me = await verifySignedInRequest(bearer(req));
    if (!me.emailVerified) throw new CareersError("Verify your email first, then apply.", 403);
    const limited = await rateLimit(req, "careers-apply", me.uid, 10, 86400);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    return NextResponse.json(await apply(getAdminDb(), me, b.roleId, b));
  } catch (err) {
    if (err instanceof CareersError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't send your application");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
