"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";
import { giftNaira, isGiftMotif, type GiftMotif } from "@/lib/gift-catalogue";

// The sitewide announcement of a grand gift (lib/gifts-server.ts announceGrandGift, giftBursts/latest): a banner on every open page,
// signed in or not, with a link to the live (or the receiver's page) to witness it. Shows gifts from the last two minutes only, each
// once per tab, and not to someone already on that page. It goes by itself after 15 seconds; the ✕ closes it sooner.
type Burst = { reference: string; giftId: GiftMotif; name: string; priceKobo: number; senderName: string; toName: string; href: string; live: boolean; at: string };
const FRESH_MS = 120_000;
const SHOW_MS = 15_000;
const SEEN_KEY = "na-gift-burst-seen";
const seenRef = () => { try { return sessionStorage.getItem(SEEN_KEY) ?? ""; } catch { return ""; } };
const markSeen = (r: string) => { try { sessionStorage.setItem(SEEN_KEY, r); } catch { /* private window */ } };
// Only a path on this site (the server writes it; this is belt and braces).
const safeHref = (h: unknown) => (typeof h === "string" && h.startsWith("/") && !h.startsWith("//") ? h : null);

export default function GiftBurstBanner() {
  const [b, setB] = useState<Burst | null>(null);
  const path = usePathname();
  useEffect(() => onSnapshot(doc(db, "giftBursts", "latest"), (s) => {
    const d = s.data() as Burst | undefined;
    if (!d || !isGiftMotif(d.giftId) || !safeHref(d.href)) return;
    if (!(Date.now() - Date.parse(d.at) < FRESH_MS) || seenRef() === d.reference) return;
    markSeen(d.reference);
    setB(d);
  }, () => {}), []);
  useEffect(() => {
    if (!b) return;
    const t = setTimeout(() => setB(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [b]);
  if (!b) return null;
  const href = safeHref(b.href)!;
  if (path && href.split("?")[0] === path && !b.live) return null;
  return (
    <div className="fixed inset-x-0 top-2 z-[66] flex justify-center px-3" role="status" aria-live="polite">
      <GiftArtStyles />
      <div className="gift-burst flex w-full max-w-lg items-center gap-3 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-2xl ring-1 ring-[#E8B23A]/60">
        <GiftArt id={b.giftId} size={48} motion="loop" />
        <p className="min-w-0 flex-1 font-ui text-[13px] leading-snug">
          <strong>{b.senderName || "Someone"}</strong> sent a <strong className="text-[#E8B23A]">{b.name}</strong> ({giftNaira(b.priceKobo)}) to <strong>{b.toName}</strong>{b.live ? "'s live" : ""}.
        </p>
        <Link href={href} onClick={() => setB(null)} className="shrink-0 rounded-full bg-[#E8B23A] px-3 py-1.5 font-ui text-xs font-bold text-ink hover:bg-white">{b.live ? "Join to witness" : "See it"}</Link>
        <button type="button" onClick={() => setB(null)} aria-label="Close" className="shrink-0 rounded-full px-1.5 text-white/70 hover:text-white">✕</button>
      </div>
      <style>{`.gift-burst{animation:gift-burst-in .45s cubic-bezier(.2,1.4,.4,1) both}@keyframes gift-burst-in{from{transform:translateY(-120%);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.gift-burst{animation:none}}`}</style>
    </div>
  );
}
