import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { listBanks } from "@/lib/paystack";

export const revalidate = 86400; // bank list barely changes

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "banks", clientIp(req), 30, 60);
  if (limited) return limited;
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks: banks.map((b) => ({ name: b.name, code: b.code })) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load banks" }, { status: 500 });
  }
}
