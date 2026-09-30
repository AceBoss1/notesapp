import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { listBanks } from "@/lib/paystack";

// Rate-limits by IP (reads headers), so it can't be prerendered; the
// bank list barely changes, so cache it in memory for a day instead.
export const dynamic = "force-dynamic";
let cache: { at: number; banks: { name: string; code: string }[] } | null = null;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "banks", clientIp(req), 30, 60);
  if (limited) return limited;
  try {
    if (!cache || Date.now() - cache.at > 86_400_000) {
      const banks = await listBanks();
      cache = { at: Date.now(), banks: banks.map((b) => ({ name: b.name, code: b.code })) };
    }
    return NextResponse.json({ banks: cache.banks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load banks" }, { status: 500 });
  }
}
