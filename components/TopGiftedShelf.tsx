"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import { giftNaira } from "@/lib/gift-catalogue";

// "Top gifted today" (lib/gifts-server.ts topGiftedToday): creators who reached today's gift target (Admin → Pricing → Gifts), pinned
// at the top of Trending and Explore until midnight in Lagos, most received first. Hidden when nobody has reached it yet.
type Row = { uid: string; username: string; displayName: string; avatar: string; kobo: number; count: number; senders: number; reachedAt: string; liveId?: string };
type Shelf = { day: string; rows: Row[]; target: { kobo: number; basis: "gross" | "net"; minSenders: number } };

export default function TopGiftedShelf({ className = "" }: { className?: string }) {
  const [shelf, setShelf] = useState<Shelf | null>(null);
  useEffect(() => {
    let on = true;
    const off = onAuthStateChanged(auth, async (u) => {
      const headers: Record<string, string> = u ? { Authorization: `Bearer ${await u.getIdToken()}` } : {};
      fetch("/api/gifts/top-today", { headers }).then((r) => (r.ok ? r.json() : null)).then((s) => on && setShelf(s)).catch(() => {});
    });
    return () => { on = false; off(); };
  }, []);
  if (!shelf?.rows.length) return null;
  return (
    <section aria-labelledby="top-gifted" className={`rounded-3xl border border-[#E8B23A]/60 bg-gradient-to-br from-[#FFF6E0] via-paper to-[#FBEDEF] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="top-gifted" className="font-display text-2xl text-ink">🎁 Top gifted today</h2>
        <p className="text-xs text-slate">
          Reached {giftNaira(shelf.target.kobo)}{shelf.target.basis === "net" ? " after commission" : ""} in gifts today from {shelf.target.minSenders}+ people · <Link href="/help/gifts" className="font-semibold text-crimson">How it works</Link>
        </p>
      </div>
      <ol className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {shelf.rows.map((r, i) => (
          <li key={r.uid} className="w-36 shrink-0 sm:w-auto">
            <Link href={r.liveId ? `/u/${r.username}?live=${encodeURIComponent(r.liveId)}` : `/u/${r.username}`} className="flex h-full flex-col items-center rounded-2xl bg-card p-3 text-center ring-1 ring-rule hover:ring-crimson">
              <span className="relative">
                <Avatar src={r.avatar} alt={r.displayName} size={56} />
                <span className="absolute -left-2 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-crimson font-ui text-xs font-bold text-paper">{i + 1}</span>
              </span>
              <span className="mt-2 line-clamp-1 font-ui text-sm font-bold text-ink">{r.displayName}</span>
              <span className="font-mono text-[11px] text-slate">@{r.username}</span>
              <span className="mt-1 font-display text-lg text-crimson">{giftNaira(r.kobo)}</span>
              <span className="text-[11px] text-slate">{r.senders} {r.senders === 1 ? "sender" : "senders"}{r.liveId ? " · live" : ""}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
