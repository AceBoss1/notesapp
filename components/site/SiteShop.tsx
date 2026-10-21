"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STORE_CATEGORIES, categoryOf, isStoreCategory } from "@/lib/store-meta";
import { getStoreStats, type StoreStat } from "@/lib/store-social";
import { isCrimsonTheme } from "@/lib/site-themes";
import { SHOP_SORTS, isShopSort, shopStyleOf, sortItems, type ShopSort } from "@/lib/site-kits";
import { useSite } from "./SiteContext";
import { useOwnItems } from "./useOwnItems";
import AuroraBand from "./AuroraBand";
import { ProductGrid } from "./Storefront";

// The shop page of a member's site, laid out like an online shop on every look (borrowing from Shopify's collection pages): a featured
// piece (the one they chose, or the most viewed), links across the top (New arrivals, Shop all, their categories, Most popular), a bar
// with the number of products, search, sorting and a big or small grid, and the products (components/site/Storefront.tsx). The
// category, sort and search ride in the address (?cat=…&sort=…&q=…), so "New arrivals" or a category can be linked to.
export default function SiteShop() {
  const { base, theme, uid, kit, displayName } = useSite();
  const items = useOwnItems();
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<ShopSort>("new");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Record<string, StoreStat>>({});
  const [big, setBig] = useState(false); // two to a row on a computer (one on a phone), instead of four (two)
  // Start from the address, and keep it up to date (without a new history entry for every letter typed).
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const c = u.get("cat"), so = u.get("sort");
    if (c && isStoreCategory(c)) setFilter(c);
    if (isShopSort(so)) setSort(so);
    setQ(u.get("q") ?? "");
  }, []);
  useEffect(() => {
    const u = new URLSearchParams();
    if (filter !== "All") u.set("cat", filter);
    if (sort !== "new") u.set("sort", sort);
    if (q.trim()) u.set("q", q.trim());
    const next = `${window.location.pathname}${u.size ? `?${u}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [filter, sort, q]);
  const aurora = isCrimsonTheme(theme); // Aurora and Maroon keep their crimson band
  const style = shopStyleOf(kit);
  useEffect(() => { getStoreStats(uid).then(setStats).catch(() => {}); }, [uid]);

  const list = items ?? [];
  const counts = STORE_CATEGORIES.map((c) => ({ c, n: list.filter((i) => categoryOf(i) === c).length })).filter((x) => x.n > 0);
  const inCategory = filter !== "All" ? list.filter((i) => categoryOf(i) === filter) : list;
  const views = Object.fromEntries(Object.entries(stats).map(([id, st]) => [id, st.views]));
  const shown = sortItems(inCategory, sort, q, views);
  const pick = (cat: string, so: ShopSort) => { setFilter(cat); setSort(so); setQ(""); };
  const buyable = list.filter((i) => i.id && (i.kind === "digital" || (i.stock ?? 0) > 0));
  const browsing = filter === "All" && !q.trim();
  const featured = browsing && buyable.length >= 3 ? buyable.find((i) => i.featured) ?? [...buyable].sort((a, b) => (stats[b.id!]?.views ?? 0) - (stats[a.id!]?.views ?? 0))[0] : null;

  return (
    <div>
      {aurora && <AuroraBand eyebrow="Shop"><h1 className="mt-3 font-display text-4xl sm:text-5xl">Shop</h1></AuroraBand>}
      <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${aurora ? "pb-14 pt-8" : "py-10 sm:py-14"}`}>
        {!aurora && (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="eyebrow">{displayName}</p><h1 className="mt-1 font-display text-4xl text-ink">Shop</h1></div>
          </div>
        )}
        {items === undefined ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Loading">
            {Array.from({ length: 8 }, (_, i) => <span key={i} className={`block animate-pulse rounded-2xl bg-rule/50 ${style.ratio === "portrait" ? "aspect-[4/5]" : "aspect-square"}`} />)}
          </div>
        ) : items.length === 0 ? (
          <p className="card mt-8 p-6 text-sm text-slate">Nothing for sale yet. Check back soon.</p>
        ) : (
          <>
            <nav className="-mx-4 mt-6 flex gap-6 overflow-x-auto px-4 font-ui text-xs font-semibold uppercase tracking-[0.2em] text-ink sm:mx-0 sm:justify-center sm:gap-10 sm:px-0" aria-label="Collections">
              {[
                { label: "New arrivals", on: filter === "All" && sort === "new" && !q, go: () => pick("All", "new") },
                ...counts.slice(0, 3).map((x) => ({ label: x.c, on: filter === x.c, go: () => pick(x.c, sort) })),
                { label: "Most popular", on: filter === "All" && sort === "popular", go: () => pick("All", "popular") },
              ].map((l) => <button key={l.label} type="button" onClick={l.go} className={`shrink-0 border-b-2 pb-1 ${l.on ? "border-crimson" : "border-transparent hover:border-rule"}`}>{l.label}</button>)}
            </nav>
            {featured && (
              <Link href={`${base}/shop/${featured.id}`} className="group mt-6 grid overflow-hidden rounded-3xl bg-crimson-deep text-paper sm:grid-cols-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.image} alt={featured.title} className={`h-56 w-full sm:h-96 ${style.fit === "contain" ? "bg-white object-contain p-6" : "object-cover"}`} />
                <span className="flex flex-col justify-center gap-2 p-6 sm:gap-3 sm:p-10">
                  <span className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70">Featured</span>
                  <span className="font-display text-2xl leading-tight sm:text-4xl">{featured.title}</span>
                  <span className="font-ui text-xl font-bold">{featured.price}</span>
                  <span className="mt-2 inline-block w-fit rounded-full bg-paper px-5 py-2.5 font-ui text-sm font-bold text-crimson-deep transition group-hover:bg-white">Shop now</span>
                </span>
              </Link>
            )}
            <div className="sticky top-0 z-10 -mx-4 mt-8 border-y border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="hidden items-center gap-1 sm:flex" role="group" aria-label="Grid size">
                  <button type="button" aria-pressed={big} onClick={() => setBig(true)} title="Bigger pictures" className={`rounded-lg p-1.5 ${big ? "text-ink" : "text-slate/60 hover:text-ink"}`}><svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="7" height="7" /><rect x="11" y="2" width="7" height="7" /><rect x="2" y="11" width="7" height="7" /><rect x="11" y="11" width="7" height="7" /></svg><span className="sr-only">Bigger pictures</span></button>
                  <button type="button" aria-pressed={!big} onClick={() => setBig(false)} title="More at a time" className={`rounded-lg p-1.5 ${!big ? "text-ink" : "text-slate/60 hover:text-ink"}`}><svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">{[2, 8, 14].flatMap((y) => [2, 8, 14].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" />))}</svg><span className="sr-only">More at a time</span></button>
                </span>
                <p className="order-last w-full text-center font-ui text-xs font-semibold uppercase tracking-[0.2em] text-slate sm:order-none sm:w-auto sm:flex-1">{shown.length} {shown.length === 1 ? "product" : "products"}</p>
                <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search the shop" aria-label="Search the shop" className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-2 text-sm text-ink placeholder:text-slate focus:border-crimson focus:outline-none sm:max-w-[14rem] sm:flex-none" />
                <select value={sort} onChange={(e) => setSort(e.target.value as ShopSort)} aria-label="Sort" className="rounded-full border border-rule bg-card px-3 py-2 text-sm text-ink">
                  {SHOP_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              {counts.length > 3 && ( // with three or fewer, the links above already list every category
                <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Browse by category">
                  {[{ c: "All", n: list.length }, ...counts].map((x) => (
                    <button key={x.c} type="button" aria-pressed={filter === x.c} onClick={() => setFilter(x.c)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${filter === x.c ? "border-crimson bg-crimson text-white" : "border-rule bg-card text-ink hover:border-crimson"}`}>
                      {x.c} <span className="font-mono text-xs opacity-70">{x.n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6">
              {shown.length ? <ProductGrid items={shown} base={base} style={style} big={big} /> : <p className="card p-6 text-sm text-slate">Nothing matches that. <button type="button" className="font-semibold text-crimson" onClick={() => { setQ(""); setFilter("All"); }}>See everything</button></p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
