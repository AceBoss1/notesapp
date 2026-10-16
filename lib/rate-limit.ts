import { NextRequest, NextResponse } from "next/server";
import { redis } from "./shared-store";

// Rate limits. With Upstash Redis configured (lib/shared-store.ts) the count is shared by every server instance, so a limit is a
// real limit; without it, or if Redis doesn't answer, each instance counts on its own (a sliding window in memory), which blunts
// abuse and accidental loops but isn't a hard cap across instances.
const hits = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

const tooMany = (retry: number) =>
  NextResponse.json({ error: `Too many requests — try again in ${retry}s.` }, { status: 429, headers: { "Retry-After": String(retry) } });

// Returns a 429 response when over the limit, otherwise null.
export async function rateLimit(_req: NextRequest, bucket: string, key: string, max: number, windowSec: number): Promise<NextResponse | null> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  // Shared: a fixed window per bucket and key ("rl:comments:<uid>:<window number>"), counted with INCR, gone when the window ends.
  const slot = Math.floor(now / windowMs);
  const shared = await redis([["INCR", `rl:${bucket}:${key}:${slot}`], ["EXPIRE", `rl:${bucket}:${key}:${slot}`, windowSec + 1]]);
  if (shared) return Number(shared[0]) > max ? tooMany(Math.max(1, Math.ceil(((slot + 1) * windowMs - now) / 1000))) : null;

  const id = `${bucket}:${key}`;
  const recent = (hits.get(id) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(id, recent);
    return tooMany(Math.ceil((windowMs - (now - recent[0])) / 1000));
  }
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) {
    // opportunistic cleanup so the map can't grow without bound
    hits.forEach((v, k) => {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    });
  }
  return null;
}
