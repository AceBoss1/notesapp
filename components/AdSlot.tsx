"use client";

import { useEffect, useState } from "react";
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
  rotateMs = 15000,
  className = "",
}: {
  placement: AdPlacement;
  publisher?: { accountTier?: string; adsOptIn?: boolean } | null; // pass on publisher-scoped slots
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
  if (!eligible || !ad) return null;

  return (
    <aside className={`my-8 ${className}`} aria-label="Sponsored">
      <a href={ad.href} target="_blank" rel="sponsored noopener noreferrer" className="card flex flex-col overflow-hidden sm:flex-row">
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
