"use client";

import ItemCard from "@/components/StoreItemCard";
import { useSite } from "./SiteContext";
import { useOwnItems } from "./useOwnItems";

export default function SiteShop() {
  const { base } = useSite();
  const items = useOwnItems();
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="eyebrow">Shop</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Shop</h1>
      {items === undefined ? (
        <p className="mt-8 text-sm text-slate">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate">Nothing for sale yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => <ItemCard key={i.id} item={i} shopBase={`${base}/shop`} />)}
        </div>
      )}
    </div>
  );
}
