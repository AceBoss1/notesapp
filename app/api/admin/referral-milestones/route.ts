import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { MILESTONES } from "@/lib/referral-milestones";
import { MilestoneError, liveMilestones, resetMemberMilestones, resetMilestoneSettings, saveMilestoneSettings } from "@/lib/referral-milestones-server";

export const dynamic = "force-dynamic";

// Admin → Limits → Referral milestones (super admins). GET → { milestones, defaults }.
// POST { action: "save", milestones: { first|squad|crowd|viral: { need, bonusNaira } } } · { action: "reset" } (back to the defaults)
//      { action: "member", username } (clears that member's claims so they can claim again)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "super");
    return NextResponse.json({ milestones: await liveMilestones(getAdminDb()), defaults: MILESTONES }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const by = await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "super");
    const b = await req.json().catch(() => ({}));
    const db = getAdminDb();
    if (b.action === "save") return NextResponse.json({ milestones: await saveMilestoneSettings(db, b.milestones, by) });
    if (b.action === "reset") return NextResponse.json({ milestones: await resetMilestoneSettings(db, by) });
    if (b.action === "member") return NextResponse.json(await resetMemberMilestones(db, b.username, by));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) { return fail(e); }
}
function fail(e: unknown) {
  if (e instanceof MilestoneError) return NextResponse.json({ error: e.message }, { status: e.status });
  const f = friendlyMessage(e, "Couldn't update referral milestones");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
