import { NextRequest, NextResponse } from "next/server";

// Sliding-window limiter, in memory. On serverless each warm instance
// has its own counters, so this blunts abuse and accidental loops but
// is NOT a hard global cap — swap the Map for Upstash/Redis if abuse
// ever needs a real ceiling (same function signature).
const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

// Returns a 429 response when over the limit, otherwise null.
export function rateLimit(req: NextRequest, bucket: string, key: string, max: number, windowSec: number): NextResponse | null {
  const now = Date.now();
  const id = `${bucket}:${key}`;
  const recent = (hits.get(id) || []).filter((t) => now - t < windowSec * 1000);
  if (recent.length >= max) {
    hits.set(id, recent);
    const retry = Math.ceil((windowSec * 1000 - (now - recent[0])) / 1000);
    return NextResponse.json(
      { error: `Too many requests — try again in ${retry}s.` },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) {
    // opportunistic cleanup so the map can't grow without bound
    hits.forEach((v, k) => {
      if (!v.some((t) => now - t < windowSec * 1000)) hits.delete(k);
    });
  }
  return null;
}
