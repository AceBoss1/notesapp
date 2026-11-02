import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getUserEmail, verifyAdminRequest } from "@/lib/firebase-admin";
import { holdForReview, weeklyLeaders } from "@/lib/referrals-server";
import { monthlyReferralReports, previewReport, reportEmail } from "@/lib/referral-report-server";
import { monthById, reportMonth } from "@/lib/referral-report";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Finance and Growth: this week's top referrers, with an alert on anyone well past their usual week (there is no monthly cap), and
// a hold that keeps a referrer's earnings back for review. GET → { rows }   POST { uid, days }
// The monthly referrals report (lib/referral-report-server.ts), POST { action }:
//   "report_preview" { username, month? "YYYY-MM" } → sends that member's report to your own email (last month by default)
//   "report_send_now" → sends last month's reports that are still due, now (owner and super admins; each member still gets one)
const token = (req: NextRequest) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
async function staff(req: NextRequest) {
  return verifyAdminRequest(token(req), ["finance", "growth"]).then(() => true).catch(() => false);
}
export async function GET(req: NextRequest) {
  if (!(await staff(req))) return NextResponse.json({ error: "Finance and Growth only." }, { status: 403 });
  return NextResponse.json({ rows: await weeklyLeaders(getAdminDb()) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await staff(req))) return NextResponse.json({ error: "Finance and Growth only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const db = getAdminDb();
  if (b.action === "report_preview") {
    const adminUid = await verifyAdminRequest(token(req));
    const month = b.month ? monthById(String(b.month)) : reportMonth();
    if (!month) return NextResponse.json({ error: "Choose a month like 2026-10." }, { status: 400 });
    const username = String(b.username ?? "").trim().toLowerCase().replace(/^@/, "");
    const uid = /^[a-z0-9_-]{2,30}$/.test(username) ? String((await db.doc(`usernames/${username}`).get()).data()?.uid ?? "") : "";
    if (!uid) return NextResponse.json({ error: "No member has that username." }, { status: 404 });
    const { report, active } = await previewReport(db, uid, month);
    if (!report) return NextResponse.json({ error: "That member can't get the report (suspended, or no username)." }, { status: 409 });
    const to = await getUserEmail(adminUid);
    if (!to) return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
    const sent = await sendEmail(reportEmail(to, report, username));
    return sent ? NextResponse.json({ sent, to, active, month: month.label }) : NextResponse.json({ error: "Resend didn't accept it: check RESEND_API_KEY and EMAIL_FROM (Admin → Errors has the reply)." }, { status: 502 });
  }
  if (b.action === "report_send_now") {
    try { await verifyAdminRequest(token(req), "super"); } catch { return NextResponse.json({ error: "Owner and super admins only: it emails members." }, { status: 403 }); }
    return NextResponse.json({ sent: await monthlyReferralReports(db, new Date(), { force: true }), month: reportMonth().label });
  }
  const days = Math.min(90, Math.max(1, Math.round(Number(b.days) || 14)));
  if (typeof b.uid !== "string" || !b.uid) return NextResponse.json({ error: "Choose a member." }, { status: 400 });
  return NextResponse.json({ held: await holdForReview(db, b.uid, days) });
}
