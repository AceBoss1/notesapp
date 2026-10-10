"use client";

import Link from "next/link";
import { digitalReady, isViewOnly, type StoreItem } from "@/lib/store";
import NotifyWhenBack from "@/components/NotifyWhenBack";
import { fmtSize } from "@/lib/store-files";
import FavoriteButton from "@/components/FavoriteButton";
import { categoryOf } from "@/lib/store-meta";

// How much of the description a storefront card shows before "…  Learn more »".
const BLURB_CHARS = 110;
const blurb = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= BLURB_CHARS) return { text: t, cut: false };
  return { text: t.slice(0, BLURB_CHARS).replace(/\s+\S*$/, "") + "…", cut: true };
};

// One item on a storefront: photo, title and price, a short piece of the description with "Learn more »" to the full
// item page, and the Buy button. `shopBase` is where the item pages live ("/shop", or "/s/<username>/shop" on a preview).
export default function ItemCard({ item, shopBase = "/shop", saved, onToggleSave, favs }: { item: StoreItem; shopBase?: string; saved?: boolean; onToggleSave?: (itemId: string) => void; favs?: number }) {
  const digital = item.kind === "digital";
  const href = item.id ? `${shopBase}/${item.id}` : null;
  const b = item.subtitle ? blurb(item.subtitle) : null;
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image} alt={item.title} className="aspect-[3/4] w-full object-cover" />
  );
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative">
        {href ? <Link href={href} aria-label={item.title}>{image}</Link> : image}
        {item.id && item.sellable && onToggleSave && <FavoriteButton saved={!!saved} onToggle={() => onToggleSave(item.id!)} label={item.title} className="absolute right-3 top-3" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {(item.badge || digital) && (
          <span className="mb-2 inline-block w-fit rounded-full bg-crimson/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wideish text-crimson">
            {digital ? (isViewOnly(item) ? (item.lessonCount && item.lessonCount > 1 ? "Course · view only" : "View only") : "Digital download") : item.badge}
          </span>
        )}
        <h3 className="font-ui text-base font-bold leading-snug text-ink">
          {href ? <Link href={href} className="hover:text-crimson">{item.title}</Link> : item.title}
        </h3>
        <p className="mt-1 font-mono text-sm text-crimson-bright">{item.price}</p>
        <p className="mt-1 text-[11px] text-slate">
          {categoryOf(item)}
          {!digital && item.shipsFrom ? <> · Ships from {item.shipsFrom}</> : null}
          {favs ? <> · ♥ {favs} saved</> : null}
        </p>
        {b && b.text && (
          <p className="mt-2 flex-1 text-sm text-slate">
            {b.text}
            {href && b.cut && <> <Link href={href} className="whitespace-nowrap font-semibold text-crimson hover:underline">Learn more »</Link></>}
          </p>
        )}
        {href && b && !b.cut && <p className="mt-1"><Link href={href} className="text-xs font-semibold text-crimson hover:underline">Learn more »</Link></p>}
        {digital && isViewOnly(item) && digitalReady(item) && <p className="mt-2 font-mono text-[11px] text-slate">{item.lessonCount} lesson{item.lessonCount === 1 ? "" : "s"} · watch or read online, no download</p>}
        {digital && item.fileName && <p className="mt-2 font-mono text-[11px] text-slate">{item.fileName}{item.fileSize ? ` · ${fmtSize(item.fileSize)}` : ""}</p>}
        {digital && !digitalReady(item) && <p className="mt-2 font-mono text-[11px] text-amber-800">{isViewOnly(item) ? "No lessons added yet" : "File not attached yet"} — buyers can&apos;t see this item.</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          {item.sellable && item.id ? (
            digital ? (
              <Link href={href!} className="btn-primary !px-4 !py-2 text-xs">{isViewOnly(item) ? "Buy & view" : "Buy & download"}</Link>
            ) : (item.stock ?? 0) > 0 ? (
              <>
                {(item.stock ?? 0) <= 5 && <span className="mr-auto font-mono text-[11px] text-slate">Only {item.stock} left</span>}
                <Link href={href!} className="btn-primary !px-4 !py-2 text-xs">{item.options?.length ? "Choose options" : "Buy now"}</Link>
              </>
            ) : (
              <><span className="font-mono text-xs text-slate">Sold out</span><NotifyWhenBack itemId={item.id} compact /></>
            )
          ) : (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn-primary !px-4 !py-2 text-xs">{item.cta}</a>
          )}
        </div>
      </div>
    </div>
  );
}
