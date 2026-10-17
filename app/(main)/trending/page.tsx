"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import AdSlot from "@/components/AdSlot";
import BadgeToast from "@/components/BadgeToast";
import PageHero from "@/components/PageHero";

type Post = { id: string; slug: string; title: string; author: string; authorUsername?: string; views: number; date: string };
type Publisher = { username: string; displayName: string; avatar: string; views: number; posts: number };
type Item = { id: string; title: string; price: string; image: string; digital: boolean; seller: string; sellerUsername: string; sellerIsOrg: boolean; views: number; favs: number; rating: number; reviews: number };
type Data = { basis: string; posts: Post[]; publishers: Publisher[]; items: Item[] };

export default function TrendingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"publishers" | "posts" | "items">("publishers");

  useEffect(() => {
    fetch("/api/trending")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load trending"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`rounded-full px-5 py-2 font-ui text-sm font-semibold ${tab === t ? "bg-crimson text-paper" : "border border-rule text-ink hover:border-crimson"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHero eyebrow="Trending" title={<>Most visited on #NotesApp</>}>
        <p>Ranked by visits{data ? ` (${data.basis})` : ""}. Refreshed every few minutes.</p>
      </PageHero>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mt-6 flex gap-2">{tabBtn("publishers", "Top publishers")}{tabBtn("posts", "Top posts")}{tabBtn("items", "Top store items")}</div>
      <AdSlot placement="trending" />

      {error && <p className="mt-8 text-sm text-crimson">{error}</p>}
      {!data && !error && <p className="mt-8 text-sm text-slate">Loading…</p>}

      {data && tab === "publishers" && (
        <ol className="mt-6 divide-y divide-rule">
          {data.publishers.length === 0 && <li className="py-6 text-sm text-slate">No visits recorded yet.</li>}
          {data.publishers.map((p, i) => (
            <li key={p.username}>
              <Link href={`/u/${p.username}`} className="flex items-center gap-4 py-4">
                <span className="w-6 font-mono text-sm text-crimson-bright">{i + 1}</span>
                <Avatar src={p.avatar} alt={p.displayName} size={44} />
                <span className="flex-1">
                  <span className="flex items-center font-ui text-sm font-bold text-ink">{p.displayName}<NameBadgeIcons username={p.username} size={14} /></span>
                  <span className="block font-mono text-xs text-slate">@{p.username} · {p.posts} posts</span>
                </span>
                <span className="font-mono text-xs text-slate">👁 {p.views.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {data && tab === "posts" && (
        <ol className="mt-6 divide-y divide-rule">
          {data.posts.length === 0 && <li className="py-6 text-sm text-slate">No visits recorded yet.</li>}
          {data.posts.map((p, i) => (
            <li key={p.id}>
              <Link href={`/journals/${p.slug}`} className="flex items-center gap-4 py-4">
                <span className="w-6 font-mono text-sm text-crimson-bright">{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-ui text-sm font-bold text-ink">{p.title}</span>
                  <span className="block font-mono text-xs text-slate">{p.author}</span>
                </span>
                <span className="font-mono text-xs text-slate">👁 {p.views.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {data && tab === "items" && (
        <>
          <p className="mt-4 text-xs text-slate">Ranked by what buyers look at and save (a save counts five looks), all time. Items nobody has opened yet follow, newest first.</p>
          <ol className="mt-2 divide-y divide-rule">
            {(data.items ?? []).length === 0 && <li className="py-6 text-sm text-slate">No store items have been looked at yet.</li>}
            {(data.items ?? []).map((it, i) => (
              <li key={it.id}>
                <Link href={`/shop/${it.id}`} className="flex items-center gap-4 py-4">
                  <span className="w-6 font-mono text-sm text-crimson-bright">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.image} alt="" className="h-14 w-12 rounded-lg border border-rule object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-ui text-sm font-bold text-ink">{it.title}</span>
                    <span className="block truncate font-mono text-xs text-slate">{it.seller}{it.digital ? " · digital" : ""} · {it.price}{it.reviews > 0 ? ` · ★ ${it.rating.toFixed(1)} (${it.reviews})` : ""}</span>
                  </span>
                  <span className="text-right font-mono text-xs text-slate">{it.views + it.favs > 0 ? <>👁 {it.views.toLocaleString()}<br />♥ {it.favs.toLocaleString()}</> : <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-crimson">New</span>}</span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
      <BadgeToast />
    </section>
    </>
  );
}
