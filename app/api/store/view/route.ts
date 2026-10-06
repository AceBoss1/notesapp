import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { verifySignedInRequest } from "@/lib/firebase-admin";
import { DigitalFail } from "@/lib/digital-server";
import { rateLimit } from "@/lib/rate-limit";
import { checkDevice, cleanDeviceId, deviceView, loadViewPurchase, markOpened, publicLesson } from "@/lib/view-access";

export const dynamic = "force-dynamic";

// POST { reference, deviceId, label } (signed in as the buyer) → the lessons and this purchase's device count.
// Opens the purchase on this device: registers it if there's room (2 devices per purchase, unlimited sessions on
// them); a third device is refused with 403 { code: "device_limit", attempt } and the attempt is counted.
export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = await verifySignedInRequest(idToken).catch(() => null);
    if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const limited = rateLimit(req, "view-open", user.uid, 60, 3600);
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const deviceId = cleanDeviceId(body.deviceId);
    const { p, lessons } = await loadViewPurchase(user.uid, String(body.reference || ""));
    const r = await checkDevice(p.reference, user.uid, p.itemId, deviceId, String(body.label || ""), true);
    const devices = deviceView(r.devices, deviceId);
    if (!r.ok) {
      return NextResponse.json({
        code: "device_limit", attempt: r.attempt, used: r.used, max: r.max, devices,
        error: `Blocked attempt #${r.attempt}: this purchase is already registered on ${r.max} devices (${r.used} of ${r.max} used). Remove one of them below, or open it on a device you already use.`,
      }, { status: 403 });
    }
    await markOpened(p.reference, !!p.firstDownloadAt);
    return NextResponse.json({ itemId: p.itemId, title: p.itemTitle, email: p.buyerEmail, lessons: lessons.map(publicLesson), used: r.used, max: r.max, isNew: r.isNew, devices }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof DigitalFail) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Couldn't open this");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
