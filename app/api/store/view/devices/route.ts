import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { DigitalFail } from "@/lib/digital-server";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_REMOVALS, cleanDeviceId, deviceView, loadViewPurchase, removeDevice } from "@/lib/view-access";

export const dynamic = "force-dynamic";

// POST { reference, deviceId, remove } — the buyer frees a device slot (a lost phone, a new laptop). Limited to
// MAX_REMOVALS a month per purchase.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "view-devices", user.uid, 20, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const { p } = await loadViewPurchase(user.uid, String(body.reference || ""));
    const current = String(body.deviceId || "");
    const r = await removeDevice(p.reference, user.uid, cleanDeviceId(body.remove));
    return NextResponse.json({ devices: deviceView(r.devices, current), removalsLeft: r.removalsLeft, maxRemovals: MAX_REMOVALS });
  } catch (err) {
    if (err instanceof DigitalFail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't remove the device");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
