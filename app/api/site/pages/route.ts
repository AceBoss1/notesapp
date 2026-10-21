import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { canHaveSite } from "@/lib/site-themes";
import { SITE_PAGE_MAX, isSitePage } from "@/lib/site-settings";
import type { UserProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

// Members with a site (Free Basic and above): POST { page: "about" | "contact", markdown } saves that page of their own site.
// An empty page is removed (the site then has no link to it). Written here so the plan and the length are checked on the server.
export async function POST(req: NextRequest) {
  try {
    const user = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = await rateLimit(req, "site-pages", user.uid, 60, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    if (!isSitePage(b.page)) return NextResponse.json({ error: "Choose the About or Contact page." }, { status: 400 });
    if (typeof b.markdown !== "string") return NextResponse.json({ error: "Write the page first." }, { status: 400 });
    const markdown = b.markdown.replace(/\r\n/g, "\n").trim();
    if (markdown.length > SITE_PAGE_MAX) return NextResponse.json({ error: `Keep the page under ${SITE_PAGE_MAX.toLocaleString("en-NG")} characters (it has ${markdown.length.toLocaleString("en-NG")}).` }, { status: 400 });
    const db = getAdminDb();
    const snap = await db.doc(`users/${user.uid}`).get();
    const p = snap.data() as UserProfile | undefined;
    if (!p) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (!canHaveSite(p)) return NextResponse.json({ error: "Your own site comes with Free Basic and above." }, { status: 403 });
    const updatedAt = new Date().toISOString();
    await db.doc(`users/${user.uid}`).update({ [`sitePages.${b.page}`]: markdown || FieldValue.delete(), "sitePages.updatedAt": updatedAt });
    return NextResponse.json({ page: b.page, markdown, updatedAt });
  } catch (err) {
    const f = friendlyMessage(err, "Couldn't save the page");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
