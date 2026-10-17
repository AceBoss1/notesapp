import { getAdminDb } from "./firebase-admin";
import { ttlCache } from "./ttl-cache";

// Server-only. Visits in the last 7 days per journal, profile, store item or course, from the day buckets (pageViews/{kind}_{id}_{day},
// written by /api/views, lib/store-stats-server.ts and lib/courses-server.ts). One read of a week's buckets every 5 minutes, shared by every page.
export type WeeklyViews = { note: Record<string, number>; profile: Record<string, number>; item: Record<string, number>; course: Record<string, number> };
const load = ttlCache(5 * 60_000, async (): Promise<WeeklyViews> => {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const snap = await getAdminDb().collection("pageViews").where("day", ">=", since).get();
  const out: WeeklyViews = { note: {}, profile: {}, item: {}, course: {} };
  snap.docs.forEach((d) => {
    const b = d.data();
    const m = out[b.kind as keyof WeeklyViews];
    if (m) m[String(b.id)] = (m[String(b.id)] ?? 0) + (Number(b.count) || 0);
  });
  return out;
});
export const weeklyViews = () => load().catch((): WeeklyViews => ({ note: {}, profile: {}, item: {}, course: {} }));
