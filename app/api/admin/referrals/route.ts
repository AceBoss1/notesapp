import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { holdForReview, weeklyLeaders } from "@/lib/referrals-server";

export const dynamic = "force-dynamic";

// Finance and Growth: this week's top referrers, with an alert on anyone well past their usual week (there is no monthly cap), and
// a hold that keeps a referrer's earnings back for review. GET → { rows }   POST { uid, days }
async function staff(req: NextRequest) {
  return verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), ["finance", "growth"]).then(() => true).catch(() => false);
}
export async function GET(req: NextRequest) {
  if (!(await staff(req))) return NextResponse.json({ error: "Finance and Growth only." }, { status: 403 });
  return NextResponse.json({ rows: await weeklyLeaders(getAdminDb()) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!(await staff(req))) return NextResponse.json({ error: "Finance and Growth only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const days = Math.min(90, Math.max(1, Math.round(Number(b.days) || 14)));
  if (typeof b.uid !== "string" || !b.uid) return NextResponse.json({ error: "Choose a member." }, { status: 400 });
  return NextResponse.json({ held: await holdForReview(getAdminDb(), b.uid, days) });
}
