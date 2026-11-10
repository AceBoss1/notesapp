import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isCurrency } from "@/lib/currency";
import { ratesFresh, readerPrice } from "@/lib/global-pay";
import { getRates } from "@/lib/global-pay-server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ttlCache } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";

// GET ?minor=&from=&to= → { payMinor } (or { payMinor: null } without fresh rates): what a buyer paying in `to` pays for an amount in
// the seller's `from`, as checkout will charge it (lib/global-sales.ts: our rate plus the margin, rounded up). Shown under prices as
// "about … in your currency"; the checkout page shows the exact amount before paying.
const rates = ttlCache(5 * 60_000, () => getRates(getAdminDb()));
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "global-price", clientIp(req), 300, 600);
  if (limited) return limited;
  const q = req.nextUrl.searchParams;
  const minor = Number(q.get("minor")), from = q.get("from") ?? "", to = q.get("to") ?? "";
  if (!isCurrency(from) || !isCurrency(to) || !Number.isInteger(minor) || minor <= 0 || minor > 1e12) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (from === to) return NextResponse.json({ payMinor: minor });
  const r = await rates().catch(() => null);
  if (!ratesFresh(r)) return NextResponse.json({ payMinor: null });
  return NextResponse.json({ payMinor: readerPrice(minor, from, to, r!) }, { headers: { "Cache-Control": "public, max-age=300" } });
}
