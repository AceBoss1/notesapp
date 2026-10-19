"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiscoveryHero from "@/components/DiscoveryHero";
import Shelf from "@/components/Shelf";
import AdSlot from "@/components/AdSlot";
import MarketCard from "@/components/MarketCard";
import ShopDirectory from "@/components/ShopDirectory";
import BoostedStrip from "@/components/BoostedStrip";
import { STORE_CATEGORIES } from "@/lib/store-meta";
import { hashtag } from "@/lib/topics";
import { useInterests } from "@/lib/interests-client";
import { byForYou, byMostViewed, byRecent, shelves, type Shelfable } from "@/lib/discovery";
import type { DirectoryShop, MarketItem } from "@/lib/shop-directory";

// Notes Market (/shop): every #NotesApp store in one place, arranged like Journals (lib/discovery.ts): the shopper's interests
// first, then what most people looked at this week, then what's new; categories and stores below.
type Tab = "all" | "foryou" | "viewed" | "new" | "digital" | "stores";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" }, { id: "foryou", label: "For you" }, { id: "viewed", label: "Most viewed" }, { id: "new", label: "New in" }, { id: "digital", label: "Digital" }, { id: "stores", label: "Stores" },
];
type Shelved = Omit<MarketItem, "viewsWeek"> & Shelfable;
const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

export default function MarketPageClient() {
  const [data, setData] = useState<{ shops: DirectoryShop[]; items: MarketItem[] } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const { interests, signedIn } = useInterests();

  useEffect(() => {
    fetch("/api/public/market").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load the market")))).then(setData).catch((e) => setError(e.message));
    const t0 = new URLSearchParams(window.location.search).get("tab");
    if (t0 && TABS.some((t) => t.id === t0)) setTab(t0 as Tab);
  }, []);

  const q = query.trim().toLowerCase();
  // Weekly visits once any exist (the day buckets started with this release); lifetime visits until then.
  const anyWeekly = (data?.items ?? []).some((i) => i.viewsWeek > 0);
  const shelved = useMemo<Shelved[]>(() => (data?.items ?? [])
    .filter((i) => (!category || i.category === category) && (!q || i.title.toLowerCase().includes(q) || i.sellerName.toLowerCase().includes(q) || i.sellerUsername.includes(q) || i.category.toLowerCase().includes(q)))
    .map((i) => ({ ...i, publishedAt: i.createdAt, ownerUsername: i.sellerUsername, viewsWeek: anyWeekly ? i.viewsWeek : undefined })), [data, category, q, anyWeekly]);
  const reader = useMemo(() => ({ interests: interests ?? [] }), [interests]);
  const s = useMemo(() => shelves(shelved, reader, 8), [shelved, reader]);
  const cards = (list: Shelved[]) => <div className={grid}>{list.map((i) => <MarketCard key={i.id} item={{ ...i, viewsWeek: i.viewsWeek ?? 0 }} />)}</div>;
  const why = (interests ?? []).length > 0
    ? <>Because you chose {(interests ?? []).slice(0, 4).map(hashtag).join(" ")} · <Link href="/interests" className="text-crimson">Change your interests</Link></>
    : null;
  const pick = <p className="text-sm text-slate">{signedIn ? <><Link href="/interests" className="font-semibold text-crimson">Choose your interests</Link> to see things you&apos;re into first.</> : <><Link href="/login?next=/shop" className="font-semibold text-crimson">Sign in</Link> and choose your interests to see things you&apos;re into first.</>}</p>;
  const shopsShown = (data?.shops ?? []).filter((sh) => !q || sh.displayName.toLowerCase().includes(q) || sh.username.includes(q));

  return (
    <div>
      <DiscoveryHero eyebrow="Notes Market" title="Every #NotesApp store in one place" sub="Things you're into first, then what's popular and what's new. Pay safely through #NotesApp."
        query={query} onQuery={setQuery} placeholder="Search products and stores" tabs={TABS} tab={tab} onTab={setTab}>
        <div className="mt-4 flex flex-wrap gap-2">
          {[null, ...STORE_CATEGORIES].map((c) => (
            <button key={c ?? "all"} onClick={() => setCategory(c)} aria-pressed={category === c}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${category === c ? "bg-white text-crimson" : "bg-white/15 text-paper hover:bg-white/25"}`}>{c ?? "All categories"}</button>
          ))}
        </div>
      </DiscoveryHero>
      <BoostedStrip kind="item" title="Boosted from #NotesApp stores" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {error ? <p className="text-sm text-crimson">{error}</p> : !data ? <p className="py-16 text-center text-sm text-slate">Loading the market…</p> : (
          <>
            {tab === "all" && (
              <>
                <Shelf title="For you" why={why} seeAll={s.forYou.length ? { href: "/shop?tab=foryou" } : undefined}>{s.forYou.length ? cards(s.forYou) : pick}</Shelf>
                <AdSlot placement="market" />
                {s.mostViewed.length > 0 && <Shelf title={`Most viewed ${anyWeekly ? "this week" : ""}`.trim()} seeAll={{ href: "/shop?tab=viewed" }}>{cards(s.mostViewed)}</Shelf>}
                {s.mostViewed.length > 0 && <AdSlot placement="market" offset={1} />}
                <Shelf title="New in" seeAll={{ href: "/shop?tab=new" }}>{s.recent.length ? cards(s.recent) : <p className="text-sm text-slate">Nothing here yet{category ? ` in ${category}` : ""}.</p>}</Shelf>
                {shopsShown.length > 0 && <Shelf title="Stores" seeAll={{ href: "/shop?tab=stores", label: "All stores" }}><ShopDirectory shops={shopsShown.slice(0, 6)} /></Shelf>}
              </>
            )}
            {tab === "foryou" && <Shelf title="For you" why={why}>{(interests ?? []).length ? cards(byForYou(shelved, reader)) : pick}</Shelf>}
            {tab === "viewed" && <Shelf title="Most viewed">{cards(byMostViewed(shelved).filter((i) => (i.viewsWeek ?? i.views) > 0))}</Shelf>}
            {tab === "new" && <Shelf title="New in">{cards(byRecent(shelved))}</Shelf>}
            {tab === "digital" && <Shelf title="Digital" why="Downloads, PDFs and view-only courses: yours straight after paying.">{cards(byRecent(shelved.filter((i) => i.kind === "digital")))}</Shelf>}
            {tab === "stores" && <Shelf title="Stores" why="Every #NotesApp store taking orders now."><ShopDirectory shops={shopsShown} /></Shelf>}
            <p className="mt-6 text-sm text-slate">Selling something? <Link href="/store-selling" className="font-semibold text-crimson">Open your store on #NotesApp</Link>.</p>
          </>
        )}
      </div>
    </div>
  );
}
