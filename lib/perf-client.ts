"use client";

import { BROWSER_SAMPLE, type Timing } from "./ops-metrics";

// Sends one timing to /api/perf for the admin dashboard's speed numbers (lib/ops-metrics.ts). A quarter of page views take part,
// decided once per tab, so the samples stay cheap at any size. Nothing about the visitor is sent: the metric and its milliseconds.
let inSample: boolean | null = null;
export function reportTiming(m: Exclude<Timing, "report">, ms: number) {
  if (typeof window === "undefined" || !Number.isFinite(ms) || ms <= 0) return;
  if (inSample === null) inSample = Math.random() < BROWSER_SAMPLE;
  if (!inSample) return;
  const body = JSON.stringify({ m, v: Math.round(ms) });
  try {
    if (!navigator.sendBeacon?.("/api/perf", new Blob([body], { type: "application/json" }))) void fetch("/api/perf", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch { /* a lost sample doesn't matter */ }
}

// Milliseconds since the page started loading: the clock the feed and search timings use.
export const sinceStart = () => (typeof performance !== "undefined" ? performance.now() : 0);
