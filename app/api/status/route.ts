import { NextRequest, NextResponse } from "next/server";
import { checkServices, ServiceStatus } from "@/lib/status";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Public health summary. Results are cached for 60 s so a busy status
// page can't hammer Firestore / Paystack / R2.
let cache: { at: number; services: ServiceStatus[] } | null = null;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "status", clientIp(req), 30, 60);
  if (limited) return limited;
  if (!cache || Date.now() - cache.at > 60_000) {
    cache = { at: Date.now(), services: await checkServices() };
  }
  const active = cache.services.filter((s) => s.state !== "not_configured");
  const overall = active.some((s) => s.state === "down") ? "outage" : active.some((s) => s.state === "degraded") ? "degraded" : "operational";
  return NextResponse.json({ overall, checkedAt: new Date(cache.at).toISOString(), services: cache.services });
}
