"use client";

import { useEffect, useState } from "react";

// This week's visits per journal, profile, store item or course (GET /api/public/weekly-views), shared in this tab for 5 minutes.
const cache = new Map<string, { at: number; p: Promise<Record<string, number>> }>();
export function useWeeklyViews(kind: "note" | "profile" | "item" | "course"): Record<string, number> {
  const [v, setV] = useState<Record<string, number>>({});
  useEffect(() => {
    let hit = cache.get(kind);
    if (!hit || Date.now() - hit.at > 5 * 60_000) {
      hit = { at: Date.now(), p: fetch(`/api/public/weekly-views?kind=${kind}`).then((r) => (r.ok ? r.json() : { views: {} })).then((j) => j.views ?? {}).catch(() => ({})) };
      cache.set(kind, hit);
    }
    let alive = true;
    hit.p.then((x) => { if (alive) setV(x); });
    return () => { alive = false; };
  }, [kind]);
  return v;
}
