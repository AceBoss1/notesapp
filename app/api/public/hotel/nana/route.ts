import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "@/lib/api-errors";
import { getAdminDb } from "@/lib/firebase-admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ensurePricing } from "@/lib/pricing-server";
import { HotelError } from "@/lib/hotel-server";
import { hotelChat, liveNanaDeps } from "@/lib/hotel-nana-server";

// Ordering and booking by chatting with Nana on a hotel's website (Hotel Grand; lib/hotel-nana-server.ts). No sign-in needed.
// POST { h, chatId?, message, name? } → { chatId, reply, orderId }
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const l = await rateLimit(req, "hotel-nana", clientIp(req), 40, 3600);
    if (l) return NextResponse.json({ error: "That's a lot of messages. Wait a little, or call the front desk." }, { status: 429 });
    const b = await req.json().catch(() => ({}));
    await ensurePricing();
    return NextResponse.json(await hotelChat(getAdminDb(), String(b.h ?? ""), b, "site", liveNanaDeps()));
  } catch (err) {
    if (err instanceof HotelError) return NextResponse.json({ error: err.message }, { status: err.status });
    const f = friendlyMessage(err, "Nana couldn't answer");
    return NextResponse.json({ error: f.message }, { status: f.status });
  }
}
