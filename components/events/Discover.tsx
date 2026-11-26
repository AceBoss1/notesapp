"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EVENT_CATEGORIES, KNOWN_CITIES, categoryOf, cleanTheme, coverStyle, shortCount } from "@/lib/event-kit";
import { formatNaira } from "@/lib/booking-time";
import type { CalendarCard, DiscoverCard } from "@/lib/events-discover-server";
import { useMember } from "@/lib/member-client";
import FollowCalendar from "./FollowCalendar";
import { EventList } from "./Events";

// /events: Discover events (docs/EVENTS_DISCOVER.md; the owner's screenshot as the idea). Featured events for a city, categories with
// counts, calendars to follow and events by place; ?category=, ?city= or ?region= shows that list. The figures come from
// /api/events?discover=1 (lib/events-discover-server.ts), rebuilt at most every 10 minutes.
type Discover = {
  city: string; cityHasEvents: boolean; featured: DiscoverCard[]; categories: Record<string, number>; calendars: CalendarCard[];
  regions: { id: string; label: string; cities: { city: string; count: number; icon: string }[] }[];
};
const CITY_KEY = "na-events-city";
const when = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-GB", { timeZone: "Africa/Lagos", ...o });
  const day = f({ year: "numeric", month: "2-digit", day: "2-digit" }), today = now.toLocaleString("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
  const tmr = new Date(now.getTime() + 86_400_000).toLocaleString("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
  const time = f({ hour: "2-digit", minute: "2-digit", hour12: false });
  return day === today ? `Today, ${time}` : day === tmr ? `Tomorrow, ${time}` : `${f({ weekday: "short", day: "numeric", month: "short" })}, ${time}`;
};
const price = (c: DiscoverCard) => (c.approval ? "Free · approval needed" : c.priceFromKobo ? `From ${formatNaira(c.priceFromKobo)}` : "Free");

export function Poster({ c, size = 64 }: { c: Pick<DiscoverCard, "cover" | "theme" | "pattern" | "title" | "hostUsername">; size?: number }) {
  const t = cleanTheme({ theme: c.theme, pattern: c.pattern }, c.hostUsername);
  return (
    <span className="flex shrink-0 items-end overflow-hidden rounded-xl p-1.5 font-display text-[11px] font-semibold leading-tight"
      style={{ width: size, height: size, ...(c.cover ? { background: `url(${c.cover}) center/cover` } : coverStyle(t)) }} aria-hidden>
      {!c.cover && <span className="line-clamp-2">{c.title}</span>}
    </span>
  );
}
export function EventRow({ c }: { c: DiscoverCard }) {
  return (
    <Link href={`/events/${c.id}`} className="group flex min-w-0 items-center gap-3">
      <Poster c={c} />
      <span className="min-w-0">
        <span className="block text-xs text-slate">{when(c.startsAt)}</span>
        <span className="block truncate font-ui text-sm font-bold text-ink group-hover:text-crimson">{c.title}</span>
        <span className="block truncate text-xs text-slate">{[c.where || c.city, price(c)].filter(Boolean).join(" · ")}</span>
      </span>
    </Link>
  );
}

function List({ f }: { f: { category?: string; city?: string; region?: string } }) {
  const [list, setList] = useState<DiscoverCard[] | null>(null);
  const q = new URLSearchParams({ list: "1", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  useEffect(() => { setList(null); fetch(`/api/events?${q}`).then((r) => r.json()).then((j) => setList(j.events ?? [])).catch(() => setList([])); }, [q]);
  const cat = categoryOf(f.category);
  const title = cat ? `${cat.icon} ${cat.label}` : f.city ? `Events in ${f.city}` : f.region === "online" ? "Online events" : "Events";
  return (
    <section>
      <Link href="/events" className="text-sm text-crimson">← Discover</Link>
      <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
      {list === null ? <p className="mt-4 text-sm text-slate">Loading…</p> : !list.length ? <p className="card mt-4 p-6 text-sm text-slate">Nothing coming up here yet.</p> : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">{list.map((c) => <li key={c.id}><EventRow c={c} /></li>)}</ul>
      )}
    </section>
  );
}

export default function Discover() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useMember();
  const filter = { category: params.get("category") ?? undefined, city: params.get("city") ?? undefined, region: params.get("region") ?? undefined };
  const [city, setCity] = useState("Lagos");
  const [d, setD] = useState<Discover | null>(null);
  const [region, setRegion] = useState("nigeria");
  const [mine, setMine] = useState(false);
  useEffect(() => { try { const c = localStorage.getItem(CITY_KEY); if (c) setCity(c); } catch { /* private mode */ } }, []);
  useEffect(() => { setD(null); fetch(`/api/events?discover=1&city=${encodeURIComponent(city)}`).then((r) => r.json()).then(setD).catch(() => {}); }, [city]);
  const cities = useMemo(() => [...new Set([...KNOWN_CITIES.map((c) => c.city), ...(d?.regions.flatMap((r) => r.cities.map((c) => c.city)) ?? [])])], [d]);
  if (filter.category || filter.city || filter.region) return <List f={filter} />;
  const pickCity = (c: string) => { setCity(c); try { localStorage.setItem(CITY_KEY, c); } catch { /* fine */ } };
  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Discover events</h1>
          <p className="mt-2 max-w-xl text-slate">Find what&apos;s on near you, browse by category, or follow the calendars of communities, organisations and creators you like.</p>
        </div>
        <div className="flex gap-2">
          {user && <button onClick={() => setMine((x) => !x)} aria-pressed={mine} className="btn-ghost !px-4 !py-2 text-xs">{mine ? "Discover" : "My events"}</button>}
          <Link href={user ? "/events/new" : "/login?next=/events/new"} className="btn-primary !px-4 !py-2 text-xs">＋ Create</Link>
        </div>
      </header>

      {mine ? <section><h2 className="font-ui text-lg font-bold">Events you&apos;re going to</h2><EventList query="mine=1" empty="Tap Register or Interested on an event and it shows here." /></section> : <>
        <section className="border-t border-rule pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-ui text-lg font-bold text-ink">Featured events</h2>
              <label className="text-slate"><span className="sr-only">City</span>
                <select value={city} onChange={(e) => pickCity(e.target.value)} className="mt-1 rounded-lg border-0 bg-transparent p-0 font-ui text-base text-slate focus:ring-0">{cities.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
            </div>
            <Link href={`/events?city=${encodeURIComponent(city)}`} className="btn-ghost !px-3 !py-1.5 text-xs">View all →</Link>
          </div>
          {!d ? <p className="mt-4 text-sm text-slate">Loading…</p> : <>
            {!d.cityHasEvents && <p className="mt-3 text-sm text-slate">Nothing in {city} yet. Here&apos;s what&apos;s coming up elsewhere.</p>}
            {!d.featured.length ? <p className="card mt-4 p-6 text-sm text-slate">No public events coming up yet. Be the first: tap ＋ Create.</p> : (
              <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{d.featured.map((c) => <li key={c.id} className="min-w-0"><EventRow c={c} /></li>)}</ul>
            )}
          </>}
        </section>

        <section className="border-t border-rule pt-6">
          <h2 className="font-ui text-lg font-bold text-ink">Browse by category</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {EVENT_CATEGORIES.map((c) => (
              <li key={c.id}><Link href={`/events?category=${c.id}`} className="card flex items-center gap-3 p-3 hover:border-crimson/50">
                <span className="w-7 text-center text-xl" aria-hidden>{c.icon}</span>
                <span className="min-w-0"><span className="block truncate font-ui text-sm font-bold text-ink">{c.label}</span><span className="text-xs text-slate">{shortCount(d?.categories[c.id] ?? 0)} event{(d?.categories[c.id] ?? 0) === 1 ? "" : "s"}</span></span>
              </Link></li>
            ))}
          </ul>
        </section>

        {!!d?.calendars.length && (
          <section className="border-t border-rule pt-6">
            <h2 className="font-ui text-lg font-bold text-ink">Calendars to follow</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.calendars.map((c) => (
                <li key={c.key} className="card flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.avatar || "/images/headshots/default-avatar.png"} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    {c.username ? <FollowCalendar username={c.username} /> : <Link href={c.href} className="btn-ghost !px-3 !py-1 text-xs">Visit</Link>}
                  </div>
                  <Link href={c.href} className="font-ui text-sm font-bold text-ink hover:text-crimson">{c.name}</Link>
                  <p className="line-clamp-2 text-xs text-slate">{c.bio || `${c.upcoming} upcoming event${c.upcoming === 1 ? "" : "s"}`}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-rule pt-6">
          <h2 className="font-ui text-lg font-bold text-ink">Explore local events</h2>
          <div className="mt-3 flex flex-wrap gap-1" role="tablist">
            {(d?.regions ?? []).map((r) => <button key={r.id} role="tab" aria-selected={region === r.id} onClick={() => (r.id === "online" ? router.push("/events?region=online") : setRegion(r.id))} className={`rounded-lg px-3 py-1 text-xs ${region === r.id ? "bg-field font-bold text-ink" : "text-slate"}`}>{r.label}</button>)}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(d?.regions.find((r) => r.id === region)?.cities ?? []).map((c) => (
              <li key={c.city}><Link href={`/events?city=${encodeURIComponent(c.city)}`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-crimson text-lg" aria-hidden>{c.icon}</span>
                <span><span className="block font-ui text-sm font-bold text-ink">{c.city}</span><span className="text-xs text-slate">{c.count} event{c.count === 1 ? "" : "s"}</span></span>
              </Link></li>
            ))}
          </ul>
        </section>
      </>}
    </div>
  );
}
