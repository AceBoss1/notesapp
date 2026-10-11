"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import AdSlot from "@/components/AdSlot";
import BadgeToast from "@/components/BadgeToast";
import PageHero from "@/components/PageHero";

type Post = { id: string; slug: string; title: string; author: string; authorUsername?: string; views: number; date: string };
type Publisher = { username: string; displayName: string; avatar: string; views: number; posts: number };
type Data = { basis: string; posts: Post[]; publishers: Publisher[] };

export default function TrendingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"publishers" | "posts">("publishers");

  useEffect(() => {
    fetch("/api/trending")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load trending"))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`rounded-full px-5 py-2 font-ui text-sm font-semibold ${tab === t ? "bg-crimson text-paper" : "bg-paper/10 text-ink"}`}
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
      <div className="mt-6 flex gap-2">{tabBtn("publishers", "Top publishers")}{tabBtn("posts", "Top posts")}</div>
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
                  <span className="block font-ui text-sm font-bold text-ink">{p.displayName}</span>
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
      <BadgeToast />
    </section>
    </>
  );
}
