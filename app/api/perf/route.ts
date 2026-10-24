import { NextRequest, NextResponse } from "next/server";
import { isTiming } from "@/lib/ops-metrics";
import { recordTiming } from "@/lib/ops-metrics-server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Timings from browsers (lib/perf-client.ts): POST { m: "page" | "feed" | "search", v: milliseconds }, sent with sendBeacon by a
// quarter of page views. Kept as anonymous samples for the 95th percentile on the admin dashboard; nothing about the visitor.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "perf", clientIp(req), 60, 600);
  if (limited) return new NextResponse(null, { status: 204 });
  const b = (await req.json().catch(() => null)) as { m?: unknown; v?: unknown } | null;
  if (!b || !isTiming(b.m) || b.m === "report" || typeof b.v !== "number") return new NextResponse(null, { status: 204 });
  await recordTiming(b.m, b.v);
  return new NextResponse(null, { status: 204 });
}
