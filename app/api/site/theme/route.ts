import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { canHaveSite, isSiteTheme, siteThemeNames, themeAllowed, tierName, SITE_THEMES } from "@/lib/site-themes";
import { effectiveTier } from "@/lib/users";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

// Members with a site (Free Basic and above): POST { theme } sets the look of their own site; each look has its plan (lib/site-themes.ts). Written here (not from the browser)
// so the plan is checked on the server.
export async function POST(req: NextRequest) {
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-theme", user.uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (!isSiteTheme(b.theme)) return NextResponse.json({ error: `Choose ${siteThemeNames()}.` }, { status: 400 });
    const db = getAdminDb();
    const snap = await db.doc(`users/${user.uid}`).get();
    const p = snap.data() as UserProfile | undefined;
    if (!p) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (!canHaveSite(p)) return NextResponse.json({ error: "Your own site comes with Free Basic and above." }, { status: 403 });
    if (!themeAllowed(b.theme, effectiveTier(p))) return NextResponse.json({ error: `The ${SITE_THEMES.find((t) => t.id === b.theme)!.name} look comes with ${tierName(SITE_THEMES.find((t) => t.id === b.theme)!.minTier)} and above.` }, { status: 403 });
    await db.doc(`users/${user.uid}`).update({ siteTheme: b.theme });
    return NextResponse.json({ theme: b.theme });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the theme");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
