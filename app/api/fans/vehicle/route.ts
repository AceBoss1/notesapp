import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifySignedInRequest } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { setVehicle } from "@/lib/fans-server";

export const dynamic = "force-dynamic";

// POST { place: 1|2|3, vehicle } → the vehicle a top fan arrives in at that place in a creator's lives (lib/fans.ts entranceChoices).
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifySignedInRequest(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
    const limited = await rateLimit(req, "fan-vehicle", uid, 30, 3600);
    if (limited) return limited;
    const b = await req.json().catch(() => ({}));
    await setVehicle(getAdminDb(), uid, b.place, b.vehicle);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 401;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save that." }, { status });
  }
}
