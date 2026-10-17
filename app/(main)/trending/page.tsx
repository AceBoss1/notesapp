"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import AdSlot from "@/components/AdSlot";
import BadgeToast from "@/components/BadgeToast";
import RankedList from "@/components/RankedList";
import { NameBadgeIcons } from "@/components/PersonName";
import { hashtag } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";

// Trending (/trending): the most visited journals, store items and publishers, with the same tabs as profiles (Notes · Store ·
// Courses) plus Publishers. Journals can be narrowed to a topic, the reader's interests first.
type Post = { id: string; slug: string; title: string; author: string; authorUsername?: string; views: number; date: string; topics?: string[]; featured_image?: string };
type Publisher = { username: string; displayName: string; avatar: string; views: number; posts: number };
type Item = { id: string; title: string; price: string; image: string; digital: boolean; seller: string; sellerUsername: string; sellerIsOrg: boolean; views: number; favs: number; rating?: number; reviews?: number };
type Data = { basis: string; posts: Post[]; publishers: Publisher[]; items: Item[] };
type Tab = "notes" | "store" | "courses" | "publishers";
const TABS: { id: Tab; label: string }[] = [{ id: "notes", label: "Notes" }, { id: "store", label: "Store" }, { id: "courses", label: "Courses" }, { id: "publishers", label: "Publishers" }];

export default function TrendingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("notes");
  const [topic, setTopic] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const { interests } = useInterests();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((x) => x.id === t)) setTab(t as Tab);
  }, []);
  useEffect(() => {
    setData(null);
    fetch(`/api/trending?days=${days}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load trending"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [days]);

  // Topic chips: the reader's interests that have trending journals (★), then the other topics there, most common first.
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    (data?.posts ?? []).forEach((p) => (p.topics ?? []).forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    const mine = (interests ?? []).filter((t) => c.has(t));
    const rest = Array.from(c.entries()).filter(([t]) => !mine.includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 8);
    return { mine, rest };
  }, [data, interests]);
  const posts = (data?.posts ?? []).filter((p) => !topic || (p.topics ?? []).includes(topic)).slice(0, topic ? 40 : 10);
  const chip = (on: boolean) => `flex-shrink-0 rounded-full px-4 py-2 text-[15px] sm:px-4 sm:py-1.5 sm:text-xs ${on ? "bg-ink text-paper" : "bg-card text-ink hover:ring-1 hover:ring-rule"}`;
  const pill = (on: boolean) => `flex-shrink-0 rounded-full px-6 py-3 font-ui text-base sm:px-5 sm:py-2 sm:text-sm ${on ? "bg-crimson-deep font-semibold text-paper" : "bg-card text-ink hover:ring-1 hover:ring-rule"}`;

  return (
    <>
      {/* Moda redesign: the hero with the period, then pill tabs, topic chips and the numbered list. */}
      <section className="bg-gradient-to-br from-crimson-deep via-crimson to-crimson-bright text-paper">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-paper/80">Trending</p>
          <h1 className="mt-3 font-display text-[2.6rem] leading-[1.1] sm:text-5xl">Most visited on #NotesApp</h1>
          <p className="mt-4 max-w-2xl text-[17px] text-paper/90 sm:text-base">{days === 1 ? "Today" : "This week"}, across journals, stores and courses. Refreshed every few minutes.</p>
          <label className="relative mt-6 inline-flex">
            <span className="sr-only">Period</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="appearance-none rounded-full bg-card py-3 pl-16 pr-20 font-ui text-base font-semibold text-ink outline-none sm:py-2.5 sm:pl-10 sm:pr-12 sm:text-sm">
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <span aria-hidden className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-ink sm:right-5">▾</span>
          </label>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div role="tablist" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={pill(tab === t.id)}>{t.label}</button>)}
        </div>
        <div className="mt-4"><AdSlot placement="trending" /></div>
        {error && <p className="mt-8 text-sm text-crimson">{error}</p>}
        {!data && !error && <p className="mt-8 text-sm text-slate">Loading…</p>}

        {data && tab === "notes" && (
          <>
            {(chips.mine.length > 0 || chips.rest.length > 0) && (
              <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <button onClick={() => setTopic(null)} className={chip(!topic)}>All topics</button>
                {chips.mine.map((t) => <button key={t} onClick={() => setTopic(t)} className={chip(topic === t)}>★ {hashtag(t)}</button>)}
                {chips.rest.map((t) => <button key={t} onClick={() => setTopic(t)} className={chip(topic === t)}>{hashtag(t)}</button>)}
              </div>
            )}
            {posts.length === 0 ? <p className="py-6 text-sm text-slate">No visits recorded yet{topic ? ` on ${hashtag(topic)}` : ""}.</p> : (
              <RankedList rows={posts.map((p) => ({ key: p.id, href: `/journals/${p.slug}`, title: p.title, sub: <>{p.author}{p.topics?.[0] ? ` · ${hashtag(p.topics[0])}` : ""}</>, count: p.views }))} />
            )}
          </>
        )}

        {data && tab === "store" && (
          <>
            <p className="mb-3 text-xs text-slate">Ranked by what buyers look at and save (a save counts five looks). Items nobody has opened yet follow, newest first. <Link href="/shop" className="font-semibold text-crimson">Browse Notes Market</Link></p>
            {(data.items ?? []).length === 0 ? <p className="py-6 text-sm text-slate">No store items have been looked at yet.</p> : (
              <RankedList rows={data.items.map((it) => ({ key: it.id, href: `/shop/${it.id}`, title: it.title, count: it.views, sub: <>{it.seller}{it.digital ? " · digital" : ""} · {it.price}{it.favs ? ` · ♥ ${it.favs.toLocaleString("en-GB")}` : ""}{it.reviews ? ` · ★ ${it.rating}` : ""}</> }))} />
            )}
          </>
        )}

        {data && tab === "courses" && (
          <div className="card p-6 text-sm text-slate">
            <p className="font-display text-xl text-ink">Courses are coming</p>
            <p className="mt-1">The most followed courses will show here once <Link href="/academy" className="font-semibold text-crimson">Notes Academy</Link> opens.</p>
          </div>
        )}

        {data && tab === "publishers" && (
          <ol className="divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
            {data.publishers.length === 0 && <li className="px-4 py-6 text-sm text-slate">No visits recorded yet.</li>}
            {data.publishers.map((p, i) => (
              <li key={p.username}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper">
                  <span className="w-7 text-center font-display text-2xl text-crimson-bright">{i + 1}</span>
                  <Avatar src={p.avatar} alt={p.displayName} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center font-ui text-sm font-bold text-ink"><span className="truncate">{p.displayName}</span><NameBadgeIcons username={p.username} size={14} /></span>
                    <span className="block font-mono text-xs text-slate">@{p.username} · {p.posts} posts</span>
                  </span>
                  <span className="font-mono text-xs text-slate">{p.views.toLocaleString("en-GB")} views</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        {data && <p className="mt-4 text-xs text-slate">Views in the {data.basis}.</p>}
        <BadgeToast />
      </section>
    </>
  );
}
