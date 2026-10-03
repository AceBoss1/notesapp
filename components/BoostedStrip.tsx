"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

type Boost = { id: string; href: string; kind: "post" | "item"; title: string; author: string; image: string };

// Beacon with optional sign-in token so a publisher's own views of their
// boost aren't counted.
async function beacon(boostId: string, type: "impression" | "click") {
  try {
    const token = await auth.currentUser?.getIdToken();
    fetch("/api/boosts/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ boostId, type }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function BoostCard({ b }: { b: Boost }) {
  const ref = useRef<HTMLAnchorElement>(null);
  // An impression only counts after the card has been ≥50% visible for 1 s.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = setTimeout(() => {
            beacon(b.id, "impression");
            io.disconnect();
          }, 1000);
        } else if (timer) clearTimeout(timer);
      },
      { threshold: [0.5] }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [b.id]);

  return (
    <Link ref={ref} href={b.href} onClick={() => beacon(b.id, "click")} className="card flex flex-col overflow-hidden hover:shadow-md">
      {b.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.image} alt="" className="h-36 w-full object-cover" loading="lazy" />
      )}
      <div className="p-4">
        <span className="font-mono text-[10px] uppercase tracking-eyebrow text-crimson-bright">{b.kind === "item" ? "Boosted item" : "Boosted post"}</span>
        <p className="mt-1 font-ui text-sm font-bold text-ink">{b.title}</p>
        <p className="mt-1 font-mono text-xs text-slate">{b.author}</p>
      </div>
    </Link>
  );
}

// kind: only posts or only store items (default: both). owner: only one publisher's boosts, used on
// that publisher's own store page.
export default function BoostedStrip({ limit = 3, kind, owner, title }: { limit?: number; kind?: "post" | "item"; owner?: string; title?: string }) {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  useEffect(() => {
    const q = new URLSearchParams({ limit: String(limit), ...(kind ? { kind } : {}), ...(owner ? { owner } : {}) });
    fetch(`/api/boosts/active?${q}`)
      .then((r) => r.json())
      .then((d) => setBoosts(d.boosts || []))
      .catch(() => {});
  }, [limit, kind, owner]);
  if (boosts.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <p className="eyebrow">{title ?? (kind === "item" ? "Boosted items" : kind === "post" ? "Boosted posts" : "Boosted")}</p>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {boosts.map((b) => (
          <BoostCard key={b.id} b={b} />
        ))}
      </div>
    </section>
  );
}
