import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminRequest } from "@/lib/firebase-admin";
import { friendlyMessage } from "@/lib/api-errors";
import { VenturesError, adminPitches, decidePitch, setCall, setPicksPerQuarter } from "@/lib/ventures-server";

export const dynamic = "force-dynamic";
// The executive office and growth read pitches and decide (up to 3 picked a quarter); only a super admin pauses or reopens the call.
const NEED = ["executive", "growth"] as const;

// Admin → Ventures. GET → { applications, call, quarter, pickedThisQuarter, picksPerQuarter }.
// POST { action: "decide", id, status?, advice? (shown to the member), notes? (team only), perksSent? } · { action: "call", open } (super admin)
//      { action: "picks", picksPerQuarter } (super admin; Admin → Limits → NotesApp Ventures: picks a quarter, sitewide)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), NEED);
    return NextResponse.json(await adminPitches(getAdminDb()), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = await req.json().catch(() => ({}));
    const by = await verifyAdminRequest(token, body.action === "call" || body.action === "picks" ? "super" : NEED);
    const db = getAdminDb();
    if (body.action === "decide") { await decidePitch(db, body.id, body); return NextResponse.json({ ok: true }); }
    if (body.action === "call") return NextResponse.json({ call: await setCall(db, body, by) });
    if (body.action === "picks") return NextResponse.json({ call: await setPicksPerQuarter(db, body.picksPerQuarter, by) });
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}
function fail(err: unknown) {
  if (err instanceof VenturesError) return NextResponse.json({ error: err.message }, { status: err.status });
  const f = friendlyMessage(err, "Couldn't update Ventures");
  return NextResponse.json({ error: f.message }, { status: f.status });
}
