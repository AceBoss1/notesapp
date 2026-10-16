// A small store shared by every server instance: Upstash Redis over its REST API (no SDK), when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set. Without them, or if Redis doesn't answer within a moment, each instance keeps its own copy in
// memory, which is how everything worked before (fine for one instance, not a hard cap across many).
// Used by lib/rate-limit.ts (counters) and for caches that should be shared (link previews).
import { setting } from "./config";

const url = () => (setting("UPSTASH_REDIS_REST_URL") ?? "").replace(/\/$/, "");
const token = () => setting("UPSTASH_REDIS_REST_TOKEN") ?? "";
export const sharedStoreConfigured = () => !!(url() && token());
const TIMEOUT_MS = 800;

// Runs Redis commands in one round trip; null when Redis isn't configured or failed (callers fall back to memory).
export async function redis(commands: (string | number)[][]): Promise<unknown[] | null> {
  if (!sharedStoreConfigured()) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url()}/pipeline`, {
      method: "POST", signal: ctl.signal, cache: "no-store",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map((c) => c.map(String))),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.some((r) => r.error) ? null : out.map((r) => r.result);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- a JSON cache with an expiry ----
const memory = new Map<string, { until: number; value: unknown }>();
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const r = await redis([["GET", `cache:${key}`]]);
  if (r) return typeof r[0] === "string" ? (JSON.parse(r[0]) as T) : undefined;
  const hit = memory.get(key);
  if (!hit || hit.until < Date.now()) { memory.delete(key); return undefined; }
  return hit.value as T;
}
export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = await redis([["SET", `cache:${key}`, JSON.stringify(value), "EX", Math.max(1, Math.round(ttlSec))]]);
  if (r) return;
  memory.set(key, { until: Date.now() + ttlSec * 1000, value });
  if (memory.size > 2000) { const now = Date.now(); memory.forEach((v, k) => { if (v.until < now) memory.delete(k); }); if (memory.size > 2000) memory.clear(); }
}
