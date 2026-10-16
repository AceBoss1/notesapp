import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { buildDigest, digestStatus, sendDigest, setDigestOn, weekPool } from "@/lib/digest-server";
import { renderDigestHtml } from "@/lib/digest";

export const dynamic = "force-dynamic";

// Admin → Weekly digest (app/(main)/admin/digest). Owner and super admins only: it emails every member.
// GET → the status (on or off, this week's run, what's set up). POST { action }:
//   "preview"   → { html } this week's digest as you would get it
//   "send_test" → sends it to your own email (works while the digest is off)
//   "turn_on" / "turn_off" → the switch (stored in digestConfig/main); WEEKLY_DIGEST=on in Vercel keeps it on regardless
async function admin(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "super");
}

export async function GET(req: NextRequest) {
  try { await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  return NextResponse.json(await digestStatus(getAdminDb()), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = await admin(req); } catch { return NextResponse.json({ error: "Owner and super admins only." }, { status: 403 }); }
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  const db = getAdminDb();
  if (action === "turn_on" || action === "turn_off") {
    const status = await digestStatus(db);
    if (action === "turn_on" && !status.linkSecret) return NextResponse.json({ error: "Set EMAIL_LINK_SECRET (or CRON_SECRET) in Vercel first: the unsubscribe links are signed with it." }, { status: 409 });
    if (action === "turn_on" && !status.emailReady) return NextResponse.json({ error: "Email isn't set up (RESEND_API_KEY), so nothing would be sent." }, { status: 409 });
    await setDigestOn(db, action === "turn_on", uid);
    return NextResponse.json(await digestStatus(db));
  }
  const pool = await weekPool(db);
  const d = await buildDigest(db, uid, pool);
  if (!d) return NextResponse.json({ error: pool.length ? "Nothing to send you this week (only your own posts, or your profile isn't set up)." : "No journals were published in the last 7 days, so there's nothing to show." }, { status: 404 });
  if (action === "preview") return NextResponse.json({ html: renderDigestHtml(d), stories: d.stories.length });
  if (action === "send_test") {
    const to = await getUserEmail(uid);
    if (!to) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    const sent = await sendDigest(to, uid, d);
    return sent ? NextResponse.json({ sent, to }) : NextResponse.json({ error: "Resend didn't accept it: check RESEND_API_KEY and EMAIL_FROM (Admin → Errors has the reply)." }, { status: 502 });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
