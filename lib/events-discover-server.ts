import type { Firestore } from "firebase-admin/firestore";
import { listedEvents } from "./events-server";
import { storedSnapshot } from "./stat-cache";
import { REGIONS, citiesFor, countUpcoming, featured, placeKey, whereLine, type Counts, type DiscoverEvent, type Region } from "./event-kit";
import type { EventDoc } from "./events";
import type { UserProfile } from "./users";

// Discover events (docs/EVENTS_DISCOVER.md): the cards, counts by category and city, and calendars to follow, built from the listed
// events (lib/events-server.ts listedEvents) at most every DISCOVER_MAX_AGE_MS and kept in statCache, so opening /events costs one read.

export const DISCOVER_MAX_AGE_MS = 10 * 60_000;
export type DiscoverCard = DiscoverEvent & {
  endsAt: string; cover?: string; theme?: string; pattern?: string; where: string; priceFromKobo?: number; approval?: boolean;
  hostName: string; hostUsername: string; cid?: string; communityName?: string;
};
export type CalendarCard = { key: string; name: string; href: string; avatar: string; bio: string; username?: string; cid?: string; upcoming: number; followers: number };
type Snapshot = { cards: DiscoverCard[]; counts: Counts; calendars: CalendarCard[] };

async function build(db: Firestore, now: Date): Promise<Snapshot> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [list, rs] = await Promise.all([listedEvents(db, now), db.collection("eventRsvps").where("at", ">=", since).limit(10_000).get()]);
  const week = new Map<string, number>();
  rs.docs.forEach((d) => { const x = d.data(); if (x.status === "going") week.set(String(x.eventId), (week.get(String(x.eventId)) ?? 0) + 1); });
  const cards: DiscoverCard[] = list.map((e) => {
    const len = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();
    const w = { format: e.format ?? (e.place && e.liveUrl ? "hybrid" : e.liveUrl ? "online" : "in_person"), place: e.place, city: e.city, state: e.state, online: e.online ?? (e.liveUrl ? "link" : ""), link: e.liveUrl } as const;
    const { region, city } = placeKey(w);
    return {
      id: e.id, title: e.title, startsAt: String(e.nextStartAt), endsAt: new Date(new Date(String(e.nextStartAt)).getTime() + len).toISOString(),
      category: e.category, going: Number(e.going ?? 0), goingWeek: week.get(e.id) ?? 0, pinned: (e as EventDoc & { pinned?: boolean }).pinned === true,
      visibility: e.visibility, region, city, where: whereLine(w),
      ...(e.cover ? { cover: e.cover } : {}), ...(e.theme ? { theme: e.theme, pattern: e.pattern ?? "none" } : {}),
      ...(typeof e.priceFromKobo === "number" ? { priceFromKobo: e.priceFromKobo } : {}), ...(e.approval ? { approval: true } : {}),
      hostName: e.cid ? e.communityName ?? e.hostName : e.hostName, hostUsername: e.hostUsername, ...(e.cid ? { cid: e.cid, communityName: e.communityName ?? "" } : {}),
    };
  });
  // Calendars to follow: the hosts (people, organisations, communities) with the most people going to their upcoming events.
  const by = new Map<string, { key: string; username?: string; cid?: string; name: string; upcoming: number; going: number }>();
  for (const c of cards) {
    const key = c.cid ? `c:${c.cid}` : `u:${c.hostUsername}`;
    const x = by.get(key) ?? { key, ...(c.cid ? { cid: c.cid } : { username: c.hostUsername }), name: c.cid ? c.communityName ?? "" : c.hostName, upcoming: 0, going: 0 };
    x.upcoming++; x.going += c.going; by.set(key, x);
  }
  const top = [...by.values()].sort((a, b) => b.going - a.going || b.upcoming - a.upcoming).slice(0, 12);
  const calendars: CalendarCard[] = await Promise.all(top.map(async (t) => {
    if (t.cid) {
      const c = (await db.doc(`communities/${t.cid}`).get()).data() ?? {};
      return { key: t.key, cid: t.cid, name: String(c.name ?? t.name), href: `/community/${t.cid}`, avatar: String(c.avatar ?? ""), bio: String(c.tagline || c.about || "").slice(0, 140), upcoming: t.upcoming, followers: Number(c.memberCount ?? 0) };
    }
    const u = await db.collection("users").where("username", "==", t.username).limit(1).get();
    const p = (u.docs[0]?.data() ?? {}) as UserProfile;
    const followers = await db.collection("follows").where("username", "==", t.username).count().get().then((r) => r.data().count).catch(() => 0);
    return { key: t.key, username: t.username, name: p.displayName ?? t.name, href: `/events/calendar/${t.username}`, avatar: p.avatar ?? "", bio: String(p.bio ?? "").slice(0, 140), upcoming: t.upcoming, followers };
  }));
  return { cards, counts: countUpcoming(cards, now.toISOString()), calendars };
}

const snapshot = (db: Firestore, fresh = false) => storedSnapshot(db, "eventsDiscover", DISCOVER_MAX_AGE_MS, () => build(db, new Date()), { fresh }).then((s) => s.data);

// The Discover page: featured events for a city, category counts, calendars, and the cities of each region.
export async function discover(db: Firestore, city: string, now = new Date()) {
  const s = await snapshot(db);
  const nowIso = now.toISOString();
  const pick = featured(s.cards, city, nowIso);
  // A city with nothing on yet: show what's on everywhere, soonest first, so the page is never empty.
  const feat = pick.length ? pick : featured(s.cards, "", nowIso);
  return {
    city, cityHasEvents: pick.length > 0, featured: feat, categories: s.counts.categories, calendars: s.calendars.slice(0, 6),
    regions: REGIONS.map((r) => ({ id: r.id, label: r.label, cities: citiesFor(r.id, s.counts.cities) })),
  };
}
// A list: by category, city or region (or all), soonest first.
export async function discoverList(db: Firestore, f: { category?: string; city?: string; region?: string }, now = new Date()): Promise<DiscoverCard[]> {
  const s = await snapshot(db);
  const nowIso = now.toISOString();
  return s.cards
    .filter((c) => c.startsAt >= nowIso || c.endsAt >= nowIso)
    .filter((c) => !f.category || c.category === f.category)
    .filter((c) => !f.city || c.city.toLowerCase() === f.city.toLowerCase())
    .filter((c) => !f.region || c.region === (f.region as Region))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 120);
}
