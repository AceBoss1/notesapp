"use client";

import { useEffect, useRef, useState } from "react";
import { loadAds, weightedOrder, type Ad } from "@/components/AdSlot";
import { AD_FOOTER, fitsSpot, forSpot, spotPicture } from "@/lib/ads";

// An advert spot inside Notes Arcade (owner, 20 Nov 2026: "advert spots in every game, the center of the ludo is a great advert
// spot"). Same adverts, rotation, impressions and clicks as every other spot (Admin → Ads, placement "arcade"; components/AdSlot.tsx).
// With nothing booked, the spot still shows, offering itself: "Your brand here" → the Arcade partnership page.
// Shapes never cross (owner, 21 Nov 2026): the square spots (board, tile, yard) are their own placement, "arcadesq", and show
// only adverts with a square picture (1080 × 1080, lib/ad-config.ts SQUARE_IMAGE); the banner keeps placement "arcade" and the
// wide picture (or the title).
//   board  — a small square in the middle of a board (Ludo's centre, Naija Landlord's middle)
//   tile   — the same square, sitting in a row (beside Naija Landlord's dice)
//   banner — a wide strip under a game's board
//   yard   — a whole Ludo yard (owner, 21 Nov 2026): the picture laid see-through over the yard's colour, under the white seed holder;
//            each of the four yards starts on a different advert (offset)
// pin: the spot's own id (lib/ads.ts forSpot): adverts pinned to it show there and nowhere else; with none, the unpinned rotate.
// The sponsor takeover (docs/ARCADE_TOURNAMENTS.md §2 and §6 "Advert spots"; owner, 21 Nov 2026: "start tournaments"): while a sponsored
// tournament for this game is playing, every spot in the game shows only that sponsor (label SPONSOR and the tournament's name), and the
// booked adverts wait. Its views and clicks are counted on the tournament (/api/arcade/tournaments/[id]/sponsor) for the sponsor's report,
// never as impressions of a booked campaign. One lookup per game per page load, shared by every spot on the page.
type Takeover = { id: string; name: string; sponsor: { name: string; logo: string; link: string; words: string } };
const takeovers = new Map<string, Promise<Takeover | null>>();
function sponsorFor(game: string): Promise<Takeover | null> {
  if (!takeovers.has(game)) {
    takeovers.set(game, fetch(`/api/arcade/tournaments?active=1&game=${encodeURIComponent(game)}`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => (j?.sponsor ?? null) as Takeover | null).catch(() => null));
  }
  return takeovers.get(game)!;
}
function trackSponsor(id: string, event: "impression" | "click") {
  const body = JSON.stringify({ event });
  const url = `/api/arcade/tournaments/${encodeURIComponent(id)}/sponsor`;
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* counting must never break a game */ }
}

export default function ArcadeAdSpot({ variant, game, offset = 0, pin }: { variant: "board" | "tile" | "banner" | "yard"; game: string; offset?: number; pin?: string }) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [i, setI] = useState(0);
  const [stay, setStay] = useState(30_000);
  const box = useRef<HTMLElement>(null);
  const shape = variant === "banner" ? "wide" : "square";
  const placement = shape === "square" ? "arcadesq" : "arcade";

  const [takeover, setTakeover] = useState<Takeover | null>(null);

  useEffect(() => {
    let live = true;
    // A sponsored tournament for this game, playing now, takes every spot first; only without one do the booked adverts load.
    sponsorFor(game).then((t) => {
      if (!live) return;
      if (t) { setTakeover(t); return; }
      return loadAds(placement).then((l) => {
        if (!live) return;
        setAds(weightedOrder(forSpot(l.ads.filter((a) => a.provider === "notesapp" && fitsSpot(a, shape)), pin)));
        setStay(l.rotateSec * 1000);
      });
    });
    return () => { live = false; };
  }, [placement, shape, pin, game]);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % ads.length), stay);
    return () => clearInterval(t);
  }, [ads, stay]);

  const ad = ads.length ? ads[(i + offset) % ads.length] : null;
  const pic = ad ? spotPicture(ad, shape) : undefined;

  function track(event: "impression" | "click", adId: string) {
    const body = JSON.stringify({ adId, event, placement, game });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/ads/track", new Blob([body], { type: "application/json" }));
      else fetch("/api/ads/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch { /* counting must never break a game */ }
  }

  // One impression per advert per tab, once half of the spot is on screen (as AdSlot does).
  useEffect(() => {
    const el = box.current;
    if (!el || !ad || typeof IntersectionObserver === "undefined") return;
    const key = `adimp:${placement}:${variant}${offset}:${ad.id}`;
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

  // The takeover's own count, once per tab, for the sponsor's report (never as a booked advert's impression).
  useEffect(() => {
    const el = box.current;
    if (!el || !takeover || typeof IntersectionObserver === "undefined") return;
    const key = `spimp:${takeover.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* no storage */ }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
        trackSponsor(takeover.id, "impression");
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [takeover]);

  // What the spot shows: the sponsor during a takeover, else the booked advert, else the spot offering itself.
  const s = takeover?.sponsor;
  const label = takeover ? `SPONSOR · ${takeover.name.toUpperCase()}` : "";
  const shown = s
    ? { href: s.link, img: s.logo || undefined, title: s.name, text: s.words, onClick: () => trackSponsor(takeover!.id, "click") }
    : ad ? { href: ad.href, img: pic, title: ad.title, text: ad.text, onClick: () => track("click", ad.id) } : null;
  const out = shown ? { target: "_blank", rel: "sponsored noopener noreferrer", onClick: shown.onClick } : {};

  if (variant === "yard") {
    return (
      <aside ref={box} className={`arc-ad-yard${shown ? "" : " is-open"}${s ? " is-sponsor" : ""}`} aria-label={s ? `${label}: ${s.name}` : ad ? `Sponsored by Notes Ads: ${ad.title}` : "Advertise here with Notes Ads"}>
        <a href={shown ? shown.href : "/arcade/partners"} {...out}>
          {shown?.img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown.img} alt={s ? s.name : ""} />
            : <span className="arc-ad-yard-text">{shown ? shown.title : "YOUR BRAND HERE"}</span>}
          <small>{s ? "SPONSOR" : "SPONSORED"}</small>
        </a>
        <style jsx global>{`
          .arc-ad-yard { position:absolute; inset:6%; z-index:0; overflow:hidden; border-radius:9%; } /* a band of the yard's own colour stays round it */
          .arc-ad-yard a { position:absolute; inset:0; display:block; color:#fff; text-decoration:none; }
          .arc-ad-yard img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.95; } /* strong, not a faint wash (owner, 21 Nov 2026) */
          .arc-ad-yard.is-sponsor img { object-fit:contain; background:#fff; } /* a sponsor's logo whole, not cropped */
          .arc-ad-yard-text { position:absolute; left:0; right:0; bottom:3%; text-align:center; font:800 clamp(5px,1vw,10px) ui-monospace,monospace; letter-spacing:.12em; opacity:.55; }
          .arc-ad-yard small { position:absolute; top:.6%; right:5%; font:700 clamp(4px,.7vw,7px) ui-monospace,monospace; letter-spacing:.1em; opacity:.7; }
          .arc-ad-yard a:focus-visible { outline:2px solid #fff; outline-offset:-4px; }
        `}</style>
      </aside>
    );
  }

  return (
    <aside ref={box} className={`arc-ad arc-ad-${variant}${variant === "banner" ? "" : " arc-ad-sq"}${shown ? "" : " is-open"}${s ? " is-sponsor" : ""}`} aria-label={s ? `${label}: ${s.name}` : ad ? "Sponsored by Notes Ads" : "Advertise here with Notes Ads"}>
      {/* The Notes Ads badge (owner, 21 Nov 2026), on every Arcade advert spot, booked or still open; a takeover carries the sponsor's own. */}
      {variant === "banner" && (s
        ? <em className="arc-ad-badge" aria-hidden="true"><i>🏆</i> {label}</em>
        : <em className="arc-ad-badge" aria-hidden="true"><i>na</i> NOTES ADS · SPONSORED</em>)}
      {shown ? (
        <a href={shown.href} {...out}>
          {shown.img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown.img} alt={shown.title} />
            : <span className="arc-ad-title">{shown.title}</span>}
          {variant === "banner" && <span className="arc-ad-copy"><strong>{shown.title}</strong>{shown.text && <span>{shown.text}</span>}</span>}
          {variant !== "banner" ? <small>{s ? "SPONSOR" : "SPONSORED"}</small> : s ? <small>SPONSOR ↗</small> : ad && ad.provider !== "notesapp" && <small>{AD_FOOTER[ad.provider]}</small>}
        </a>
      ) : (
        <a href="/arcade/partners">
          <span className="arc-ad-title">{variant !== "banner" ? <>Your brand<br />here</> : "Your brand here"}</span>
          {variant === "banner" && <span className="arc-ad-copy"><span>Put your brand in front of players in every Notes Arcade game.</span></span>}
          <small>{variant !== "banner" ? "SPONSORED" : "PARTNER WITH NOTES ARCADE ↗"}</small>
        </a>
      )}
      <style jsx global>{`
        .arc-ad.is-sponsor img { object-fit:contain; background:#fff; }
        .arc-ad-banner.is-sponsor a { border-color:#cfe3b0; background:#fbfdf6; }
        .arc-ad a { display:flex; align-items:center; gap:12px; color:inherit; text-decoration:none; }
        .arc-ad small { color:#8a938b; font:700 8px ui-monospace,monospace; letter-spacing:.12em; }
        .arc-ad-title { font:600 13px/1.15 Georgia,serif; color:#17251f; }
        .arc-ad-board { position:absolute; inset:18%; z-index:2; display:grid; }
        .arc-ad-tile { position:relative; flex:none; width:clamp(52px,8vw,84px); aspect-ratio:1; display:grid; }
        .arc-ad-sq a { flex-direction:column; justify-content:center; gap:3px; width:100%; height:100%; padding:6%; border-radius:12%; background:#fffef8; box-shadow:0 4px 14px #17251f33; text-align:center; overflow:hidden; }
        .arc-ad-sq img { flex:1; width:100%; min-height:0; object-fit:cover; aspect-ratio:1; border-radius:8%; }
        .arc-ad-sq .arc-ad-title { font-size:clamp(7px,1.3vw,13px); }.arc-ad-tile .arc-ad-title { font-size:clamp(7px,1vw,11px); }
        .arc-ad-sq small { font-size:clamp(5px,.7vw,8px); }
        .arc-ad-sq:has(img) a { padding:4%; }
        .arc-ad-banner { position:relative; margin-top:20px; }
        .arc-ad-badge { position:absolute; top:-9px; left:14px; z-index:1; display:inline-flex; align-items:center; gap:6px; padding:3px 9px 3px 4px; border-radius:999px; background:#2f6a12; color:#f1f8e6; font:700 8.5px ui-monospace,monospace; font-style:normal; letter-spacing:.1em; box-shadow:0 2px 6px #17251f22; }
        .arc-ad-badge i { display:inline-grid; place-items:center; width:16px; height:12px; border-radius:4px; background:#f1f8e6; color:#2f6a12; font:800 8px Arial,sans-serif; font-style:normal; letter-spacing:-.04em; }
        .arc-ad-banner a { padding-top:16px !important; }
        .arc-ad-banner a { padding:10px 12px; border:1px solid #e3e6df; border-radius:12px; background:#fff; }
        .arc-ad-banner img { width:min(42%,240px); aspect-ratio:1.91/1; object-fit:cover; border-radius:8px; flex:none; }
        .arc-ad-banner .arc-ad-copy { display:flex; flex:1; flex-direction:column; gap:2px; min-width:0; color:#657169; font-size:12px; line-height:1.5; }
        .arc-ad-banner .arc-ad-copy strong { color:#17251f; font-size:13px; }
        .arc-ad-banner small { margin-left:auto; flex:none; }
        .arc-ad-banner.is-open a { border-style:dashed; background:#fbfcf8; }
        .arc-ad-banner.is-open .arc-ad-title { flex:none; font-size:16px; }
        .arc-ad a:hover .arc-ad-title { color:#5f9a22; }
        .arc-ad a:focus-visible { outline:2px solid #83b83c; outline-offset:3px; }
        @media(max-width:560px) { .arc-ad-banner a { flex-direction:column; align-items:flex-start; gap:6px; } .arc-ad-banner img { width:100%; } .arc-ad-banner .arc-ad-copy { width:100%; flex:none; } .arc-ad-banner small { margin-left:0; } }
      `}</style>
    </aside>
  );
}
