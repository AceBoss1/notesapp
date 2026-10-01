"use client";

import { useEffect, useRef, useState } from "react";
import { AD_FOOTER, AdPlacement, AdProvider, publisherShowsAds } from "@/lib/ads";

type Ad = { id: string; title: string; text?: string; image?: string; href: string; weight: number; provider: AdProvider };

// One shared fetch per placement per tab.
const cache = new Map<string, Promise<Ad[]>>();
function loadAds(placement: string): Promise<Ad[]> {
  let p = cache.get(placement);
  if (!p) {
    p = fetch(`/api/ads?placement=${placement}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((j) => (j.ads as Ad[]) || [])
      .catch(() => []);
    cache.set(placement, p);
  }
  return p;
}

function weightedOrder(ads: Ad[]): Ad[] {
  // Weighted shuffle: heavier ads tend to come first in the rotation.
  return [...ads].sort((a, b) => Math.random() ** (1 / a.weight) - Math.random() ** (1 / b.weight)).reverse();
}

// A rotating banner. Renders nothing when there's no active creative (or when
// a paid publisher hasn't opted in), so empty boxes never show. Third-party
// providers (google/meta/admob) are not rendered yet — see lib/ads.ts.
export default function AdSlot({
  placement,
  publisher,
  publisherUid,
  rotateMs = 15000,
  className = "",
}: {
  placement: AdPlacement;
  publisher?: { accountTier?: string; adsOptIn?: boolean } | null; // pass on publisher-scoped slots
  publisherUid?: string; // whose page it is (for ad-share attribution)
  rotateMs?: number;
  className?: string;
}) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const eligible = publisher === undefined ? true : publisherShowsAds(publisher);

  useEffect(() => {
    if (!eligible) return;
    let live = true;
    loadAds(placement).then((list) => live && setAds(weightedOrder(list.filter((a) => a.provider === "notesapp"))));
    return () => {
      live = false;
    };
  }, [placement, eligible]);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % ads.length), rotateMs);
    return () => clearInterval(t);
  }, [ads, rotateMs]);

  const ad = ads[i % Math.max(ads.length, 1)];
  const box = useRef<HTMLElement>(null);

  function track(event: "impression" | "click", adId: string) {
    const body = JSON.stringify({ adId, event, placement, publisherUid });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/ads/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch {
      /* analytics must never break the page */
    }
  }

  // One impression per ad per tab-session, once at least half the banner is on screen.
  useEffect(() => {
    const el = box.current;
    if (!el || !ad || typeof IntersectionObserver === "undefined") return;
    const key = `adimp:${placement}:${ad.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* no storage: count once per mount below */
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          try {
            sessionStorage.setItem(key, "1");
          } catch {}
          track("impression", ad.id);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id, placement]);

  if (!eligible || !ad) return null;

  return (
    <aside ref={box} className={`my-8 ${className}`} aria-label="Sponsored">
      <a href={ad.href} onClick={() => track("click", ad.id)} target="_blank" rel="sponsored noopener noreferrer" className="card flex flex-col overflow-hidden sm:flex-row">
        {ad.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image} alt="" className="h-40 w-full object-cover sm:h-auto sm:w-64" />
        )}
        <div className="flex flex-1 flex-col justify-center p-5">
          <p className="font-ui text-base font-bold text-ink">{ad.title}</p>
          {ad.text && <p className="mt-1 text-sm text-slate">{ad.text}</p>}
        </div>
      </a>
      <p className="mt-1 text-right font-mono text-[10px] uppercase tracking-eyebrow text-slate">{AD_FOOTER[ad.provider]}</p>
    </aside>
  );
}
