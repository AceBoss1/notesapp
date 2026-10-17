import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { canChooseSiteTheme } from "@/lib/site-themes";
import { cleanSiteSections } from "@/lib/site-settings";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

// Business and Enterprise members: POST { sections: { journals, shop, courses } } chooses what their own site shows (at least one).
// Written here (not from the browser) so the plan is checked on the server.
export async function POST(req: NextRequest) {
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-sections", user.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    const sections = cleanSiteSections(b.sections);
    if (!sections) return NextResponse.json({ error: "Choose at least one of Journals, Shop and Courses." }, { status: 400 });
    const db = getAdminDb();
    const snap = await db.doc(`users/${user.uid}`).get();
    const p = snap.data() as UserProfile | undefined;
    if (!p) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (!canChooseSiteTheme(p)) return NextResponse.json({ error: "Choosing what your site shows is on the Business and Enterprise plans." }, { status: 403 });
    await db.doc(`users/${user.uid}`).update({ siteSections: sections });
    return NextResponse.json({ sections });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save what your site shows");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
