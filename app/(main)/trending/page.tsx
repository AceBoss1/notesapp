"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import AdSlot from "@/components/AdSlot";
import BadgeToast from "@/components/BadgeToast";
import DiscoveryHero from "@/components/DiscoveryHero";
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
  const { interests } = useInterests();

  useEffect(() => {
    fetch("/api/trending")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load trending"))))
      .then(setData)
      .catch((e) => setError(e.message));
    const t = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((x) => x.id === t)) setTab(t as Tab);
  }, []);

  // Topic chips: the reader's interests that have trending journals (★), then the other topics there, most common first.
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    (data?.posts ?? []).forEach((p) => (p.topics ?? []).forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    const mine = (interests ?? []).filter((t) => c.has(t));
    const rest = Array.from(c.entries()).filter(([t]) => !mine.includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 8);
    return { mine, rest };
  }, [data, interests]);
  const posts = (data?.posts ?? []).filter((p) => !topic || (p.topics ?? []).includes(topic)).slice(0, topic ? 40 : 10);
  const chip = (on: boolean) => `flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-ink text-paper" : "bg-card text-slate ring-1 ring-rule hover:text-ink"}`;

  return (
    <>
      <DiscoveryHero eyebrow="Trending" title="Most visited on #NotesApp" sub={<>Across journals, stores and courses{data ? ` (${data.basis})` : ""}. Refreshed every few minutes.</>} tabs={TABS} tab={tab} onTab={setTab} />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <AdSlot placement="trending" />
        {error && <p className="mt-8 text-sm text-crimson">{error}</p>}
        {!data && !error && <p className="mt-8 text-sm text-slate">Loading…</p>}

        {data && tab === "notes" && (
          <>
            {(chips.mine.length > 0 || chips.rest.length > 0) && (
              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <button onClick={() => setTopic(null)} className={chip(!topic)}>All topics</button>
                {chips.mine.map((t) => <button key={t} onClick={() => setTopic(t)} className={chip(topic === t)}>★ {hashtag(t)}</button>)}
                {chips.rest.map((t) => <button key={t} onClick={() => setTopic(t)} className={chip(topic === t)}>{hashtag(t)}</button>)}
              </div>
            )}
            {posts.length === 0 ? <p className="py-6 text-sm text-slate">No visits recorded yet{topic ? ` on ${hashtag(topic)}` : ""}.</p> : (
              <RankedList rows={posts.map((p) => ({ key: p.id, href: `/journals/${p.slug}`, title: p.title, sub: <>{p.author}{p.topics?.[0] ? ` · ${hashtag(p.topics[0])}` : ""}</>, count: p.views, image: p.featured_image || undefined }))} />
            )}
          </>
        )}

        {data && tab === "store" && (
          <>
            <p className="mb-3 text-xs text-slate">Ranked by what buyers look at and save (a save counts five looks). Items nobody has opened yet follow, newest first. <Link href="/shop" className="font-semibold text-crimson">Browse Notes Market</Link></p>
            {(data.items ?? []).length === 0 ? <p className="py-6 text-sm text-slate">No store items have been looked at yet.</p> : (
              <RankedList rows={data.items.map((it) => ({ key: it.id, href: `/shop/${it.id}`, title: it.title, image: it.image, count: it.views, sub: <>{it.seller}{it.digital ? " · digital" : ""} · {it.price}{it.favs ? ` · ♥ ${it.favs.toLocaleString("en-GB")}` : ""}{it.reviews ? ` · ★ ${it.rating}` : ""}</> }))} />
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
          <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-card">
            {data.publishers.length === 0 && <li className="px-4 py-6 text-sm text-slate">No visits recorded yet.</li>}
            {data.publishers.map((p, i) => (
              <li key={p.username}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper">
                  <span className="w-7 text-center font-display text-2xl text-crimson">{i + 1}</span>
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
        <BadgeToast />
      </section>
    </>
  );
}
