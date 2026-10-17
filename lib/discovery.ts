// How #NotesApp arranges things to read, buy and learn: the same three shelves on Journals, the marketplace, courses, every
// profile and Trending. Pure and client-safe.
//   For you      matches the reader's interests (topics, lib/topics.ts); people they follow first among those
//   Recent       the newest
//   Most viewed  the most visits this week (lifetime visits until weekly counts exist)
// On the "All" view each thing shows on one shelf only (For you, then Most viewed, then Recent), so a reader never scrolls
// past the same card three times; a shelf's own tab lists everything in that order.
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

// The three shelves for the "All" view, each `size` long at most, nothing repeated.
export function shelves<T extends Shelfable>(list: T[], r: Reader, size = 6): Shelves<T> {
  const used = new Set<string>();
  const take = (ordered: T[]) => { const out: T[] = []; for (const s of ordered) { if (out.length >= size) break; if (!used.has(s.id)) { used.add(s.id); out.push(s); } } return out; };
  const forYou = take(byForYou(list, r));
  const mostViewed = take(byMostViewed(list).filter((s) => heat(s) > 0));
  const recent = take(byRecent(list));
  return { forYou, mostViewed, recent };
}
