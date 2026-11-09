import { getAdminDb } from "./firebase-admin";
import { ttlCacheBy } from "./ttl-cache";

// Server-only. The pageViews day buckets (pageViews/{kind}_{id}_{day}: kind, id, day, count) of the last `days` days, read once and shared
// for 10 minutes by everything that ranks by recent visits: Trending, discovery shelves, Notes Market, the weekly digest and trending
// replays. Each of those used to read the whole window on its own (Query insights, 9 Nov 2026: 150 reads of ~207 buckets a day, about
// 31,000 document reads, most of the project's daily reads). Up to 10 minutes stale, which ranking doesn't notice.
export type ViewBucket = { kind: string; id: string; day: string; count: number };
const TTL = 10 * 60_000;

const load = ttlCacheBy(TTL, async (days: number): Promise<ViewBucket[]> => {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const snap = await getAdminDb().collection("pageViews").where("day", ">=", since).get();
  return snap.docs.map((d) => {
    const b = d.data();
    return { kind: String(b.kind ?? ""), id: String(b.id ?? ""), day: String(b.day ?? ""), count: Number(b.count) || 0 };
  });
}, 31);

// The buckets of the last `days` days (1 to 30). Callers filter by kind themselves.
export const viewBuckets = (days = 7): Promise<ViewBucket[]> => load(Math.min(30, Math.max(1, Math.round(days) || 7)));

// Visits by id for one kind over the last `days` days.
export async function viewsByKind(kind: string, days = 7): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const b of await viewBuckets(days)) if (b.kind === kind) out.set(b.id, (out.get(b.id) ?? 0) + b.count);
  return out;
}
