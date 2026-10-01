// Browser-side follower/subscriber counts, via the cached /api/public/journal-stats
// endpoint. Both counts come from one request, shared in this tab for 5 minutes.
type Counts = { followers: number; subscribers: number };
const cache = new Map<string, { at: number; p: Promise<Counts> }>();
const TTL_MS = 5 * 60_000;

export function getJournalCounts(username: string): Promise<Counts> {
  const hit = cache.get(username);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = fetch(`/api/public/journal-stats?username=${encodeURIComponent(username)}`).then(async (res) => {
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Couldn't load counts");
    return json as Counts;
  });
  cache.set(username, { at: Date.now(), p });
  p.catch(() => cache.delete(username)); // don't cache failures
  return p;
}
