import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { GlobalPayError } from "@/lib/global-pay";
import { quote } from "@/lib/global-pay-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET ?username=&currency= → what each of the creator's tiers costs in that currency (lib/global-pay-server.ts quote). Public.
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "global-quote", clientIp(req), 120, 600);
  if (limited) return limited;
  const username = req.nextUrl.searchParams.get("username") ?? "";
  const currency = req.nextUrl.searchParams.get("currency") ?? "";
  try {
    return NextResponse.json(await quote(getAdminDb(), username, currency));
  } catch (e) {
    if (e instanceof GlobalPayError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("global quote failed", e);
    return NextResponse.json({ error: "Couldn't load the prices." }, { status: 500 });
  }
}
