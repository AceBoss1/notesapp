"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";

export type Boost = { id: string; href: string; kind: "post" | "item"; title: string; author: string; image: string };

// Beacon with optional sign-in token so a publisher's own views of their
// boost aren't counted.
export async function beacon(boostId: string, type: "impression" | "click") {
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

// An impression only counts after the boosted card has been ≥50% visible for 1 s.
export function useBoostImpression<T extends HTMLElement>(boostId: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer = setTimeout(() => {
            beacon(boostId, "impression");
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
  }, [boostId]);
  return ref;
}

function BoostCard({ b }: { b: Boost }) {
  const ref = useBoostImpression<HTMLAnchorElement>(b.id);
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
// that publisher's own store page. Shows a set at a time (3 on computers and tablets, 1 on phones, from Admin → Ads) and
// moves to the next set every 45 seconds unless changed there; it waits while the pointer is over it or it's off screen,
// and the dots jump to a set. A card counts as seen only after 1 s at half visible (useBoostImpression), never by rotating.
type Show = { wide: number; phone: number; rotateSec: number };
export default function BoostedStrip({ limit = 12, kind, owner, title }: { limit?: number; kind?: "post" | "item"; owner?: string; title?: string }) {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [show, setShow] = useState<Show>({ wide: 3, phone: 1, rotateSec: 45 });
  const [phone, setPhone] = useState(false);
  const [set, setSet] = useState(0);
  const [held, setHeld] = useState(false); // pointer over it
  const [onScreen, setOnScreen] = useState(false);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const q = new URLSearchParams({ limit: String(limit), ...(kind ? { kind } : {}), ...(owner ? { owner } : {}) });
    fetch(`/api/boosts/active?${q}`)
      .then((r) => r.json())
      .then((d) => { setBoosts(d.boosts || []); if (d.show) setShow(d.show); })
      .catch(() => {});
  }, [limit, kind, owner]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [boosts.length]);
  const per = Math.max(1, phone ? show.phone : show.wide);
  const sets = Math.max(1, Math.ceil(boosts.length / per));
  const at = set % sets;
  useEffect(() => {
    if (sets < 2 || held || !onScreen) return;
    const t = setTimeout(() => setSet((n) => (n + 1) % sets), show.rotateSec * 1000);
    return () => clearTimeout(t);
  }, [sets, held, onScreen, show.rotateSec, at]);
  if (boosts.length === 0) return null;
  const visible = boosts.slice(at * per, at * per + per);
  const cols = per === 1 ? "grid-cols-1" : per === 2 ? "grid-cols-1 sm:grid-cols-2" : per === 4 ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";
  return (
    <section ref={box} className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
      <p className="eyebrow">{title ?? (kind === "item" ? "Boosted items" : kind === "post" ? "Boosted posts" : "Boosted")}</p>
      <div key={at} className={`mt-4 grid gap-5 ${cols} animate-[fadeIn_.5s_ease]`}>
        {visible.map((b) => (
          <BoostCard key={b.id} b={b} />
        ))}
      </div>
      {sets > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Boosted sets">
          {Array.from({ length: sets }, (_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === at} aria-label={`Set ${n + 1} of ${sets}`} onClick={() => setSet(n)}
              className={`h-1.5 rounded-full transition-all ${n === at ? "w-5 bg-crimson" : "w-1.5 bg-rule hover:bg-slate"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
