"use client";

import Link from "next/link";
import { useBasket } from "@/lib/cart-client";
import { useSite } from "./SiteContext";

// The basket icon in a shop's header, with how many things are in it (lib/cart-client.ts).
export default function SiteBasketButton({ light = false }: { light?: boolean }) {
  const { uid, base } = useSite();
  const { count } = useBasket(uid);
  return (
    <Link href={`${base}/cart`} aria-label={count ? `Basket, ${count} ${count === 1 ? "item" : "items"}` : "Basket"} className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full ${light ? "text-paper hover:bg-white/10" : "text-ink hover:bg-rule/50"}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson px-1 font-ui text-[10px] font-bold text-paper ring-2 ring-paper">{count}</span>}
    </Link>
  );
}
