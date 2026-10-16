import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { buildDigest, digestOn, sendDigest, weekPool } from "@/lib/digest-server";
import { renderDigestHtml } from "@/lib/digest";

export const dynamic = "force-dynamic";

// Admins: POST { action: "preview" } → { html } (this week's digest as you would get it) | { action: "send_test" } → sends it to
// your own email, even while WEEKLY_DIGEST is off. Use it before turning the digest on.
export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")); }
  catch { return NextResponse.json({ error: "Admins only." }, { status: 403 }); }
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  const db = getAdminDb();
  const pool = await weekPool(db);
  const d = await buildDigest(db, uid, pool);
  if (!d) return NextResponse.json({ error: pool.length ? "Nothing to send you this week (only your own posts, or your profile isn't set up)." : "No journals were published in the last 7 days." }, { status: 404 });
  if (action === "preview") return NextResponse.json({ html: renderDigestHtml(d), stories: d.stories.length, live: digestOn() });
  if (action === "send_test") {
    const to = await getUserEmail(uid);
    if (!to) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    return NextResponse.json({ sent: await sendDigest(to, uid, d), to });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
