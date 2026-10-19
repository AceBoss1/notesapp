"use client";

import { useEffect, useRef, useState } from "react";
import { AD_FOOTER, AdPlacement, AdProvider, publisherShowsAds } from "@/lib/ads";

export type Ad = { id: string; title: string; text?: string; image?: string; billboard?: string; href: string; weight: number; provider: AdProvider };
type Loaded = { ads: Ad[]; rotateSec: number };

// One shared fetch per placement per tab. rotateSec comes from Admin → Ads (30 seconds unless changed).
const cache = new Map<string, Promise<Loaded>>();
export function loadAds(placement: string): Promise<Loaded> {
  let p = cache.get(placement);
  if (!p) {
    p = fetch(`/api/ads?placement=${placement}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((j) => ({ ads: (j.ads as Ad[]) || [], rotateSec: Number(j.rotateSec) || 30 }))
      .catch(() => ({ ads: [], rotateSec: 30 }));
    cache.set(placement, p);
  }
  return p;
}

export function weightedOrder(ads: Ad[]): Ad[] {
  // Weighted shuffle: heavier ads tend to come first in the rotation.
  return [...ads].sort((a, b) => Math.random() ** (1 / a.weight) - Math.random() ** (1 / b.weight)).reverse();
}

// A rotating banner in one fixed 1.91 : 1 frame (the 1200 × 628 picture of /advertise/specifications), picture on top on a
// phone and to the left on a computer. Renders nothing when there's no active creative (or when a paid publisher hasn't
// opted in), so empty boxes never show. It moves on only while at least half of it is on screen. Third-party providers
// (google/meta/admob) are not rendered yet — see lib/ads.ts.
export default function AdSlot({
  placement,
  publisher,
  publisherUid,
  rotateMs,
  offset = 0,
  stacked = false,
  className = "",
}: {
  placement: AdPlacement;
  publisher?: { accountTier?: string; adsOptIn?: boolean } | null; // pass on publisher-scoped slots
  publisherUid?: string; // whose page it is (for ad-share attribution)
  rotateMs?: number; // overrides the Admin → Ads setting
  stacked?: boolean; // picture above the words at every width (a narrow side column)
  offset?: number; // a second slot of the same spot on a page starts on a different advert
  className?: string;
}) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [stay, setStay] = useState(30_000);
  const [i, setI] = useState(offset);
  const [seen, setSeen] = useState(false); // at least half on screen
  const eligible = publisher === undefined ? true : publisherShowsAds(publisher);

  useEffect(() => {
    if (!eligible) return;
    let live = true;
    loadAds(placement).then((l) => {
      if (!live) return;
      setAds(weightedOrder(l.ads.filter((a) => a.provider === "notesapp")));
      setStay(rotateMs ?? l.rotateSec * 1000);
    });
    return () => {
      live = false;
    };
  }, [placement, eligible, rotateMs]);

  const ad = ads[i % Math.max(ads.length, 1)];
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ad?.id]);

  useEffect(() => {
    if (ads.length < 2 || !seen) return;
    const t = setInterval(() => setI((n) => (n + 1) % ads.length), stay);
    return () => clearInterval(t);
  }, [ads, stay, seen]);

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
      <a href={ad.href} onClick={() => track("click", ad.id)} target="_blank" rel="sponsored noopener noreferrer" className={`card flex flex-col overflow-hidden ${stacked ? "" : "sm:flex-row"}`}>
        <div className={`relative aspect-[1.91/1] w-full shrink-0 overflow-hidden bg-paper ${stacked ? "" : "sm:w-72 sm:self-center"}`}>
          {ad.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className={`flex min-w-0 flex-1 flex-col justify-center p-4 ${stacked ? "" : "sm:p-5"}`}>
          <p className="font-ui text-base font-bold text-ink">{ad.title}</p>
          {ad.text && <p className="mt-1 text-sm text-slate">{ad.text}</p>}
          <span className="mt-3 inline-flex w-max rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-bold text-paper">Learn more</span>
        </div>
      </a>
      <p className="mt-1 flex justify-between gap-3 font-mono text-[10px] uppercase tracking-eyebrow text-slate"><span>{AD_FOOTER[ad.provider]}</span>{ads.length > 1 && <span>{(i % ads.length) + 1} of {ads.length}</span>}</p>
    </aside>
  );
}
