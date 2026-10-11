"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ItemCard from "@/components/StoreItemCard";
import { STORE_CATEGORIES, categoryOf } from "@/lib/store-meta";
import { getStoreStats, type StoreStat } from "@/lib/store-social";
import { useSite } from "./SiteContext";
import { useOwnItems } from "./useOwnItems";
import AuroraBand from "./AuroraBand";

export default function SiteShop() {
  const { base, theme, uid } = useSite();
  const items = useOwnItems();
  const [filter, setFilter] = useState("All");
  const [stats, setStats] = useState<Record<string, StoreStat>>({});
  const aurora = theme === "aurora";
  useEffect(() => { if (aurora) getStoreStats(uid).then(setStats); }, [aurora, uid]);

  const list = items ?? [];
  const counts = STORE_CATEGORIES.map((c) => ({ c, n: list.filter((i) => categoryOf(i) === c).length })).filter((x) => x.n > 0);
  const shown = aurora && filter !== "All" ? list.filter((i) => categoryOf(i) === filter) : list;
  const buyable = list.filter((i) => i.id && (i.kind === "digital" || (i.stock ?? 0) > 0));
  const featured = aurora && filter === "All" && buyable.length >= 2 ? [...buyable].sort((a, b) => (stats[b.id!]?.views ?? 0) - (stats[a.id!]?.views ?? 0))[0] : null;

  return (
    <div>
      {aurora && <AuroraBand eyebrow="Shop"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Shop</h1></AuroraBand>}
      <div className={`mx-auto max-w-5xl px-4 sm:px-6 ${aurora ? "pb-14 pt-8" : "py-14"}`}>
        {!aurora && <><p className="eyebrow">Shop</p><h1 className="mt-2 font-display text-4xl text-ink">Shop</h1></>}
        {items === undefined ? (
          <p className="mt-8 text-sm text-slate">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate">Nothing for sale yet.</p>
        ) : (
          <>
            {aurora && counts.length > 1 && (
              <div className="flex flex-wrap gap-2" aria-label="Browse by category">
                {[{ c: "All", n: list.length }, ...counts].map((x) => (
                  <button key={x.c} type="button" aria-pressed={filter === x.c} onClick={() => setFilter(x.c)} className={`rounded-full border px-4 py-1.5 text-sm ${filter === x.c ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink hover:border-crimson"}`}>
                    {x.c} <span className="font-mono text-xs opacity-70">{x.n}</span>
                  </button>
                ))}
              </div>
            )}
            {featured && (
              <Link href={`${base}/shop/${featured.id}`} className="card mt-6 grid overflow-hidden sm:grid-cols-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.image} alt={featured.title} className="h-64 w-full object-cover" />
                <span className="flex flex-col justify-center gap-2 bg-crimson-deep p-8 text-paper">
                  <span className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">Featured</span>
                  <span className="font-display text-3xl">{featured.title}</span>
                  <span className="font-mono text-lg">{featured.price}</span>
                </span>
              </Link>
            )}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((i) => <ItemCard key={i.id} item={i} shopBase={`${base}/shop`} favs={aurora && i.id ? stats[i.id]?.favs : undefined} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
