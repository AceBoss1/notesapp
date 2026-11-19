import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { LeadError, submitDeviceReservation } from "@/lib/leads-server";
import { RESERVE_LIMIT } from "@/lib/devices";

export const dynamic = "force-dynamic";

// NotesPhone reservations (devices.<domain>, components/devices/ReserveForm.tsx, lib/devices.ts). Free and binding on no one. Anyone
// can reserve, signed in or not; a signed-in member's reservation is linked to their account and gets a bell too. Saved as a lead of
// category "device-reservation" (Admin → Leads → NotesPhone). POST { name, email, model, colour, city, notify } → { ok, id, again }.
// 6 an hour per address (and per member).
export async function POST(req: NextRequest) {
  const me = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")).catch(() => null);
  const limited = (await rateLimit(req, "devices-reserve", `ip:${clientIp(req)}`, RESERVE_LIMIT.max, RESERVE_LIMIT.windowSec))
    ?? (me ? await rateLimit(req, "devices-reserve", me.uid, RESERVE_LIMIT.max, RESERVE_LIMIT.windowSec) : null);
  if (limited) return limited;
  try {
    const r = await submitDeviceReservation(getAdminDb(), await req.json().catch(() => ({})), { uid: me?.uid ?? null });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof LeadError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[devices-reserve]", err);
    return NextResponse.json({ error: "Couldn't save your reservation just now. Try again." }, { status: 500 });
  }
}
