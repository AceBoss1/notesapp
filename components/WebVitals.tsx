"use client";

import { useReportWebVitals } from "next/web-vitals";
import { reportTiming } from "@/lib/perf-client";

// Largest Contentful Paint of each page, for the admin dashboard's "page load (95th percentile)" (lib/ops-metrics.ts).
export default function WebVitals() {
  useReportWebVitals((m) => { if (m.name === "LCP") reportTiming("page", m.value); });
  return null;
}
