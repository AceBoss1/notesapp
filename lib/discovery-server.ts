import { ttlCache } from "./ttl-cache";
import { viewBuckets } from "./page-view-buckets";

// Server-only. Visits in the last 7 days per journal, profile, store item or course, from the day buckets (pageViews/{kind}_{id}_{day},
// written by /api/views, lib/store-stats-server.ts and lib/courses-server.ts). One read of a week's buckets every 5 minutes, shared by every page.
export type WeeklyViews = { note: Record<string, number>; profile: Record<string, number>; item: Record<string, number>; course: Record<string, number> };
const load = ttlCache(5 * 60_000, async (): Promise<WeeklyViews> => {
  const out: WeeklyViews = { note: {}, profile: {}, item: {}, course: {} };
  for (const b of await viewBuckets(7)) {
    const m = out[b.kind as keyof WeeklyViews];
    if (m) m[b.id] = (m[b.id] ?? 0) + b.count;
  }
  return out;
});
export const weeklyViews = () => load().catch((): WeeklyViews => ({ note: {}, profile: {}, item: {}, course: {} }));
