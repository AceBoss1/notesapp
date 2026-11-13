import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { moniepointWebhookReady, processMoniepoint } from "@/lib/hotel-pos-server";

// Moniepoint card machines → us (the Hotel kit's card-machine link; lib/hotel-pos-server.ts). Moniepoint dashboard → webhooks:
// https://<site>/api/hotel/moniepoint, its secret in MONIEPOINT_WEBHOOK_SECRET. 401 for a bad signature; 5xx makes Moniepoint retry.
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "hotel-moniepoint", clientIp(req), 300, 60);
  if (limited) return limited;
  if (!moniepointWebhookReady()) return NextResponse.json({ error: "not set up yet" }, { status: 503 });
  const raw = await req.text();
  try {
    const r = await processMoniepoint(getAdminDb(), { id: req.headers.get("moniepoint-webhook-id"), timestamp: req.headers.get("moniepoint-webhook-timestamp"), signature: req.headers.get("moniepoint-webhook-signature") }, raw);
    return NextResponse.json({ result: r.result }, { status: r.status });
  } catch (err) {
    console.error("[moniepoint] webhook failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
