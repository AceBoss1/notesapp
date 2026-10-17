// How #NotesApp arranges things to read, buy and learn: the same three shelves on Journals, the marketplace, courses, every
// profile and Trending. Pure and client-safe.
//   For you      matches the reader's interests (topics, lib/topics.ts); people they follow first among those
//   Recent       the newest
//   Most viewed  the most visits this week (lifetime visits until weekly counts exist)
// On the "All" view, Most viewed is always the true ranking (it may repeat a For you card, because a ranking that skips the
// top items would be wrong); Recent leaves out what For you already showed, and falls back to the newest overall when that
// leaves nothing. A shelf's own tab lists everything in its order.
export type Shelfable = { id: string; topics: string[]; publishedAt: string; views: number; viewsWeek?: number; ownerUsername?: string };
export type Reader = { interests: string[]; follows?: Set<string>; self?: string };
export type Shelves<T> = { forYou: T[]; mostViewed: T[]; recent: T[] };

const time = (s: Shelfable) => Date.parse(s.publishedAt) || 0;
const heat = (s: Shelfable) => s.viewsWeek ?? s.views;

export const byRecent = <T extends Shelfable>(list: T[]) => [...list].sort((a, b) => time(b) - time(a));
export const byMostViewed = <T extends Shelfable>(list: T[]) => [...list].sort((a, b) => heat(b) - heat(a) || time(b) - time(a));
// Interests first; within them people the reader follows, then a mix of new and popular.
export function byForYou<T extends Shelfable>(list: T[], r: Reader): T[] {
  const want = new Set(r.interests);
  const now = Date.now();
  const score = (s: T) =>
    s.topics.filter((t) => want.has(t)).length * 100 +
    (s.ownerUsername && r.follows?.has(s.ownerUsername) ? 60 : 0) +
    Math.log1p(heat(s)) * 8 -
    Math.min(60, (now - time(s)) / 86_400_000) * 1.5; // a day older costs a little, up to two months
  return list.filter((s) => s.topics.some((t) => want.has(t)) && s.ownerUsername !== r.self).sort((a, b) => score(b) - score(a));
}

// The three shelves for the "All" view, each `size` long at most.
export function shelves<T extends Shelfable>(list: T[], r: Reader, size = 6): Shelves<T> {
  const forYou = byForYou(list, r).slice(0, size);
  const mostViewed = byMostViewed(list).filter((s) => heat(s) > 0).slice(0, size);
  const shown = new Set(forYou.map((s) => s.id));
  const newest = byRecent(list);
  const fresh = newest.filter((s) => !shown.has(s.id));
  return { forYou, mostViewed, recent: (fresh.length ? fresh : newest).slice(0, size) };
}
