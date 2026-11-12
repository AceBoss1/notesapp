import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { processWhatsapp, verifyChallenge, whatsappConfigured } from "@/lib/hotel-pos-server";
import { liveNanaDeps } from "@/lib/hotel-nana-server";

// WhatsApp Cloud API → us (the Hotel kit's WhatsApp ordering add-on; lib/hotel-pos-server.ts). Meta app → WhatsApp → Configuration:
// callback https://<site>/api/hotel/whatsapp, verify token WHATSAPP_VERIFY_TOKEN; signed with WHATSAPP_APP_SECRET.
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (!whatsappConfigured()) return new NextResponse("not set up yet", { status: 503 });
  return verifyChallenge(sp.get("hub.mode"), sp.get("hub.verify_token")) ? new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 }) : new NextResponse("forbidden", { status: 403 });
}
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "hotel-whatsapp", clientIp(req), 600, 60);
  if (limited) return limited;
  if (!whatsappConfigured()) return new NextResponse("not set up yet", { status: 503 });
  const raw = await req.text();
  try {
    await ensurePricing();
    const r = await processWhatsapp(getAdminDb(), raw, req.headers.get("x-hub-signature-256"), { nana: liveNanaDeps() });
    return NextResponse.json({ handled: r.handled }, { status: r.status });
  } catch (err) {
    console.error("[whatsapp] webhook failed", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
