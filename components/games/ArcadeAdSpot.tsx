"use client";

import { useEffect, useRef, useState } from "react";
import { loadAds, weightedOrder, type Ad } from "@/components/AdSlot";
import { AD_FOOTER } from "@/lib/ads";

// An advert spot inside Notes Arcade (owner, 20 Nov 2026: "advert spots in every game, the center of the ludo is a great advert
// spot"). Same adverts, rotation, impressions and clicks as every other spot (Admin → Ads, placement "arcade"; components/AdSlot.tsx).
// With nothing booked, the spot still shows, offering itself: "Your brand here" → the Arcade partnership page.
//   board  — a small square in the middle of a board (Ludo's centre, Naija Landlord's middle)
//   tile   — the same square, sitting in a row (beside Naija Landlord's dice)
//   banner — a wide strip under a game's board
export default function ArcadeAdSpot({ variant, game }: { variant: "board" | "tile" | "banner"; game: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const [stay, setStay] = useState(30_000);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    let live = true;
    loadAds("arcade").then((l) => {
      if (!live) return;
      setAds(weightedOrder(l.ads.filter((a) => a.provider === "notesapp")));
      setStay(l.rotateSec * 1000);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % ads.length), stay);
    return () => clearInterval(t);
  }, [ads, stay]);

  const ad = ads.length ? ads[i % ads.length] : null;

  function track(event: "impression" | "click", adId: string) {
    const body = JSON.stringify({ adId, event, placement: "arcade", game });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/ads/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* counting must never break a game */ }
  }

  // One impression per advert per tab, once half of the spot is on screen (as AdSlot does).
  useEffect(() => {
    const el = box.current;
    if (!el || !ad || typeof IntersectionObserver === "undefined") return;
    const key = `adimp:arcade:${variant}:${ad.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* no storage */ }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
        track("impression", ad.id);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id, variant]);

  return (
    <aside ref={box} className={`arc-ad arc-ad-${variant}${variant === "banner" ? "" : " arc-ad-sq"}${ad ? "" : " is-open"}`} aria-label={ad ? "Sponsored" : "Advertise here"}>
      {ad ? (
        <a href={ad.href} target="_blank" rel="sponsored noopener noreferrer" onClick={() => track("click", ad.id)}>
          {ad.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={ad.image} alt={ad.title} />
            : <span className="arc-ad-title">{ad.title}</span>}
          {variant === "banner" && <span className="arc-ad-copy"><strong>{ad.title}</strong>{ad.text && <span>{ad.text}</span>}</span>}
          <small>{variant !== "banner" ? "AD" : AD_FOOTER[ad.provider]}</small>
        </a>
      ) : (
        <a href="/arcade/partners">
          <span className="arc-ad-title">{variant !== "banner" ? <>Your brand<br />here</> : "Your brand here"}</span>
          {variant === "banner" && <span className="arc-ad-copy"><span>Put your brand in front of players in every Notes Arcade game.</span></span>}
          <small>{variant !== "banner" ? "ADVERTISE" : "PARTNER WITH NOTES ARCADE ↗"}</small>
        </a>
      )}
      <style jsx global>{`
        .arc-ad a { display:flex; align-items:center; gap:12px; color:inherit; text-decoration:none; }
        .arc-ad small { color:#8a938b; font:700 8px ui-monospace,monospace; letter-spacing:.12em; }
        .arc-ad-title { font:600 13px/1.15 Georgia,serif; color:#17251f; }
        .arc-ad-board { position:absolute; inset:18%; z-index:2; display:grid; }
        .arc-ad-tile { position:relative; flex:none; width:clamp(52px,8vw,84px); aspect-ratio:1; display:grid; }
        .arc-ad-sq a { flex-direction:column; justify-content:center; gap:3px; width:100%; height:100%; padding:6%; border-radius:12%; background:#fffef8; box-shadow:0 4px 14px #17251f33; text-align:center; overflow:hidden; }
        .arc-ad-sq img { width:100%; height:100%; object-fit:contain; border-radius:8%; }
        .arc-ad-sq .arc-ad-title { font-size:clamp(7px,1.3vw,13px); }.arc-ad-tile .arc-ad-title { font-size:clamp(7px,1vw,11px); }
        .arc-ad-sq small { font-size:clamp(5px,.7vw,8px); }
        .arc-ad-sq:has(img) a { padding:4%; }
        .arc-ad-banner { margin-top:14px; }
        .arc-ad-banner a { padding:10px 12px; border:1px solid #e3e6df; border-radius:12px; background:#fff; }
        .arc-ad-banner img { width:min(42%,240px); aspect-ratio:1.91/1; object-fit:cover; border-radius:8px; flex:none; }
        .arc-ad-banner .arc-ad-copy { display:flex; flex:1; flex-direction:column; gap:2px; min-width:0; color:#657169; font-size:12px; line-height:1.5; }
        .arc-ad-banner .arc-ad-copy strong { color:#17251f; font-size:13px; }
        .arc-ad-banner small { margin-left:auto; flex:none; }
        .arc-ad-banner.is-open a { border-style:dashed; background:#fbfcf8; }
        .arc-ad-banner.is-open .arc-ad-title { flex:none; font-size:16px; }
        .arc-ad a:hover .arc-ad-title { color:#5f9a22; }
        .arc-ad a:focus-visible { outline:2px solid #83b83c; outline-offset:3px; }
        @media(max-width:560px) { .arc-ad-banner a { flex-wrap:wrap; } .arc-ad-banner small { margin-left:0; } }
      `}</style>
    </aside>
  );
}
