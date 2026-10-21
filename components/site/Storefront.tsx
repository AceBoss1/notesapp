"use client";

import Link from "next/link";
import { isViewOnly, type StoreItem } from "@/lib/store";
import { categoryOf } from "@/lib/store-meta";
import type { ShopStyle } from "@/lib/site-kits";

// A shop's product tiles on a member's site, the way online shops show them: the picture first (tall for clothes and beauty, whole
// on white for gadgets and parts, by kit: lib/site-kits.ts shopStyleOf), then the name and the price, and a badge for what's
// selling out. Two to a row on phones, four on a wide screen. A second photo shows when the pointer rests on a tile.
export function ProductTile({ item, href, style }: { item: StoreItem; href: string; style: ShopStyle }) {
  const digital = item.kind === "digital";
  const stock = item.stock ?? 0;
  const sold = !digital && stock <= 0;
  const badge = sold ? "Sold out" : digital ? (isViewOnly(item) ? "View online" : "Download") : stock <= 5 ? `Only ${stock} left` : item.badge;
  const second = item.images?.find((u) => u && u !== item.image);
  const ratio = style.ratio === "portrait" ? "aspect-[4/5]" : "aspect-square";
  const fit = style.fit === "contain" ? "object-contain p-3" : "object-cover";
  return (
    <Link href={href} className="group block min-w-0" aria-label={`${item.title}, ${item.price}`}>
      <span className={`relative block overflow-hidden rounded-2xl ${style.fit === "contain" ? "bg-white ring-1 ring-rule" : "bg-rule/40"} ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" loading="lazy" className={`absolute inset-0 h-full w-full ${fit} transition duration-500 group-hover:scale-[1.03] ${second ? "group-hover:opacity-0" : ""} ${sold ? "opacity-60" : ""}`} />
        {second && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={second} alt="" loading="lazy" className={`absolute inset-0 h-full w-full ${fit} opacity-0 transition duration-500 group-hover:opacity-100`} />
        )}
        {badge && (
          <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 font-ui text-[10px] font-bold uppercase tracking-wide shadow-sm ${sold ? "bg-ink text-paper" : "bg-card text-ink"}`}>{badge}</span>
        )}
        {!sold && item.options?.length ? <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-semibold text-ink shadow-sm">{item.options.map((o) => `${o.choices.length} ${o.name.toLowerCase()}${o.choices.length === 1 ? "" : "s"}`).join(" · ")}</span> : null}
      </span>
      <span className="mt-2.5 block px-0.5">
        <span className="block text-[11px] uppercase tracking-wide text-slate">{item.subcategory || categoryOf(item)}</span>
        <span className="mt-0.5 line-clamp-2 block font-ui text-sm font-semibold leading-snug text-ink group-hover:text-crimson">{item.title}</span>
        <span className="mt-1 block font-ui text-base font-bold text-ink">{item.price}</span>
      </span>
    </Link>
  );
}

// `big`: bigger pictures (one to a row on phones, two on a computer) instead of more at a time (two, three or four).
export function ProductGrid({ items, base, style, big = false }: { items: StoreItem[]; base: string; style: ShopStyle; big?: boolean }) {
  return (
    <div className={`grid gap-x-3 gap-y-7 sm:gap-x-5 ${big ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
      {items.map((i) => <ProductTile key={i.id} item={i} href={`${base}/shop/${i.id}`} style={style} />)}
    </div>
  );
}
