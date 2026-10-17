import Link from "next/link";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import type { MarketItem } from "@/lib/shop-directory";

// An item on a Notes Market shelf: picture, title, price, and who sells it (picture, name, badges).
export default function MarketCard({ item }: { item: MarketItem }) {
  return (
    <div className="card group flex flex-col overflow-hidden">
      <Link href={item.href} aria-label={item.title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link href={item.href} className="line-clamp-2 font-ui text-sm font-bold leading-snug text-ink hover:text-crimson">{item.title}</Link>
        <p className="mt-1 font-mono text-sm text-crimson-bright">{item.price}</p>
        <Link href={`/u/${item.sellerUsername}/store`} className="mt-auto flex min-w-0 items-center gap-1.5 pt-2 text-xs text-slate hover:text-ink">
          <Avatar src={item.sellerAvatar} alt="" size={18} square={item.sellerIsOrg} />
          <span className="truncate">{item.sellerName}</span>
          <NameBadgeIcons username={item.sellerUsername} size={12} />
        </Link>
        <p className="mt-1 text-[11px] text-slate">{item.kind === "digital" ? "Digital" : item.category}{item.favs ? ` · ♥ ${item.favs}` : ""}</p>
      </div>
    </div>
  );
}
