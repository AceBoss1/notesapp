// The five numbers that start each stage of the speed and infrastructure plan, watched on the admin dashboard (v0.92.0).
// Pure: the lines each number is held against, and how a measured value reads (ok, near, crossed, or not measured yet).
// The server gathers the values (lib/ops-metrics-server.ts); the browser sends timings (lib/perf-client.ts → /api/perf).

// Timings the browser and server record, in milliseconds. page = Largest Contentful Paint; feed = the journal feed from opening
// to its posts on screen; search = the search box from first opening to results ready; report = building the revenue report.
export const TIMINGS = ["page", "feed", "search", "report"] as const;
export type Timing = (typeof TIMINGS)[number];
export const isTiming = (m: unknown): m is Timing => typeof m === "string" && (TIMINGS as readonly string[]).includes(m);
export const MAX_TIMING_MS = 120_000;
export const BROWSER_SAMPLE = 0.25; // a quarter of page views send their timings: enough to see the 95th percentile, cheap at any size

// The nearest-rank percentile of a list (95 → the value 95% of samples are at or under). null for an empty list.
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

export type Status = "ok" | "near" | "crossed" | "unknown";
const RANK: Record<Status, number> = { unknown: 0, ok: 1, near: 2, crossed: 3 };
export const worst = (xs: Status[]): Status => xs.reduce<Status>((a, b) => (RANK[b] > RANK[a] ? b : a), "unknown");
// A value against its line: crossed at or over the line, near from `nearAt` of the way there.
export function against(value: number | null | undefined, line: number, nearAt = 0.7): Status {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  return value >= line ? "crossed" : value >= line * nearAt ? "near" : "ok";
}

// The lines, from "What to watch" in the plan.
export const LINES = {
  stage1Events: 3,            // jobs cut off by the time limit plus partner blocks in 30 days: "any, repeatedly"
  ledgerEntries: 50_000,
  reportMs: 30_000,
  loadP95Ms: 1_000,
  dailyMembers: 10_000,
  readsGrowth: 0.10,          // reads per member up 10% or more on a month ago
  searchP95Ms: 500,
  roomPeople: 20,             // ROOM_LISTENERS_MAX_P2P: phone-to-phone rooms stop growing here
  videoShare: 0.9,            // of the Cloudflare Stream plan's storage minutes
} as const;

export type Part = { label: string; value: string; status: Status; note?: string };
export type Trigger = { key: string; stage: 1 | 2 | 3 | 4; title: string; line: string; status: Status; parts: Part[] };

export const fmtMs = (ms: number | null) => (ms === null ? "not measured yet" : ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)} s` : `${Math.round(ms)} ms`);
export const fmtInt = (n: number) => n.toLocaleString("en-GB");

// Reads per member now against a month ago: the change as a fraction (0.12 = up 12%), or null without both.
export function growth(now: number | null, monthAgo: number | null): number | null {
  if (now === null || monthAgo === null || monthAgo <= 0) return null;
  return now / monthAgo - 1;
}
