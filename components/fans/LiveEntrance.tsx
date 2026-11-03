"use client";

import { useEffect, useRef, useState } from "react";
import { VEHICLE_LABEL, type Entrance, type Vehicle } from "@/lib/fans";

// A top fan arriving in (or leaving) a live (lib/fans.ts): the vehicle crosses the screen and a banner names them with their badge.
// Played from the room doc's `entrance` field on every screen in the room; only ones from the last 20 seconds, each once. Never blocks
// taps. Reduced motion: the banner alone.
function Art({ v }: { v: Vehicle }) {
  const W = "#F4ECE0", R = "#A6093D", G = "#E8B23A", I = "#2A1A12", B = "#2B3A8C";
  switch (v) {
    case "jet": return <svg viewBox="0 0 240 90" aria-hidden><path d="M10 50 L170 42 Q215 40 232 48 Q215 56 170 56 L10 58 Z" fill={W} stroke={G} strokeWidth="2" /><path d="M80 46 L120 6 L140 6 L118 46 Z" fill={R} /><path d="M84 56 L118 84 L134 84 L116 56 Z" fill={R} /><path d="M14 48 L4 22 L22 22 L36 46Z" fill={R} /><g fill={I}><circle cx="150" cy="49" r="3" /><circle cx="160" cy="49" r="3" /><circle cx="140" cy="49" r="3" /><circle cx="130" cy="49" r="3" /></g></svg>;
    case "yacht": return <svg viewBox="0 0 240 110" aria-hidden><path d="M20 70 H220 L196 96 H44 Z" fill={W} stroke={G} strokeWidth="2" /><path d="M60 70 V46 H170 L190 70 Z" fill="#fff" stroke={G} strokeWidth="2" /><path d="M86 46 V30 H150 L162 46 Z" fill={W} stroke={G} strokeWidth="2" /><g fill={B}>{[72, 96, 120, 144, 168].map((x) => <rect key={x} x={x} y="52" width="14" height="8" rx="2" />)}</g><path d="M0 100 Q30 92 60 100 T120 100 T180 100 T240 100" stroke="#9CC3EA" strokeWidth="5" fill="none" /><path d="M108 30 V12 L130 22 Z" fill={R} /></svg>;
    case "suv": return <svg viewBox="0 0 240 100" aria-hidden><path d="M20 62 Q22 40 50 38 L80 18 H160 L190 38 Q222 40 222 62 V74 H20 Z" fill={R} /><path d="M86 24 H120 V40 H66 Z M126 24 H156 L178 40 H126 Z" fill="#CFE3F6" /><circle cx="64" cy="76" r="15" fill={I} /><circle cx="64" cy="76" r="6" fill="#bbb" /><circle cx="180" cy="76" r="15" fill={I} /><circle cx="180" cy="76" r="6" fill="#bbb" /><rect x="210" y="52" width="10" height="6" rx="2" fill={G} /></svg>;
    case "sports": return <svg viewBox="0 0 240 90" aria-hidden><path d="M10 64 Q14 50 40 46 L92 30 Q130 22 160 34 L210 46 Q232 50 232 62 V68 H10 Z" fill={G} /><path d="M98 34 Q128 26 152 36 L136 44 H90 Z" fill="#2A1A12" opacity=".85" /><circle cx="60" cy="68" r="13" fill={I} /><circle cx="60" cy="68" r="5" fill="#bbb" /><circle cx="186" cy="68" r="13" fill={I} /><circle cx="186" cy="68" r="5" fill="#bbb" /><path d="M14 56 H40" stroke={R} strokeWidth="4" /></svg>;
    case "ebike": return <svg viewBox="0 0 200 110" aria-hidden><circle cx="44" cy="80" r="22" fill="none" stroke={I} strokeWidth="6" /><circle cx="156" cy="80" r="22" fill="none" stroke={I} strokeWidth="6" /><path d="M44 80 L84 50 H130 L156 80 M84 50 L100 80 H130 L130 50" stroke={R} strokeWidth="6" fill="none" strokeLinejoin="round" /><rect x="96" y="56" width="26" height="14" rx="3" fill={G} /><path d="M130 50 L140 30 H156" stroke={I} strokeWidth="5" fill="none" /><path d="M76 44 H96" stroke={I} strokeWidth="6" /></svg>;
    default: return <svg viewBox="0 0 200 110" aria-hidden><circle cx="44" cy="80" r="22" fill="none" stroke={I} strokeWidth="5" /><circle cx="156" cy="80" r="22" fill="none" stroke={I} strokeWidth="5" /><path d="M44 80 L84 50 H130 L156 80 M84 50 L100 80 L130 50" stroke="#1F7A4D" strokeWidth="5" fill="none" strokeLinejoin="round" /><path d="M130 50 L138 32 H152 M76 44 H94" stroke={I} strokeWidth="5" fill="none" /></svg>;
  }
}

export default function LiveEntrance({ entrance }: { entrance?: Entrance | null }) {
  const [now, setNow] = useState<Entrance | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (!entrance) return;
    const key = `${entrance.uid}_${entrance.at}_${entrance.way}`;
    if (seen.current.has(key) || Date.now() - Date.parse(entrance.at) > 20_000) return;
    seen.current.add(key);
    setNow(entrance);
    const t = setTimeout(() => setNow(null), 5_500);
    return () => clearTimeout(t);
  }, [entrance]);
  if (!now) return null;
  const v = VEHICLE_LABEL[now.vehicle];
  return (
    <div className="pointer-events-none fixed inset-0 z-[72] overflow-hidden" role="status" aria-live="polite">
      <style>{`
.le-ride{position:absolute;top:22%;width:min(70vw,360px);animation:le-${now.way} 4.6s cubic-bezier(.3,.7,.4,1) both}
@keyframes le-in{0%{transform:translateX(-110vw)}55%{transform:translateX(calc(50vw - 50%))}70%{transform:translateX(calc(50vw - 50%))}100%{transform:translateX(calc(50vw - 50%));opacity:0}}
@keyframes le-out{0%{transform:translateX(calc(50vw - 50%))}30%{transform:translateX(calc(50vw - 50%))}100%{transform:translateX(120vw)}}
.le-card{animation:le-card 5.4s ease both}
@keyframes le-card{0%{transform:translateY(30px);opacity:0}12%,85%{transform:none;opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.le-ride{display:none}}
`}</style>
      <div className="le-ride"><Art v={now.vehicle} /></div>
      <div className="le-card absolute inset-x-0 top-[48%] mx-auto flex w-[min(92%,560px)] items-center gap-3 rounded-2xl bg-paper/95 px-4 py-3 text-ink shadow-2xl ring-1 ring-rule">
        <span className="text-3xl" aria-hidden>{v.emoji}</span>
        <span className="min-w-0">
          <b>{now.name}</b> {now.way === "in" ? v.arrive : v.leave}
          <span className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full border border-[#EBC867] bg-[#FFF4D6] px-2 py-0.5 font-ui text-[11px] font-bold text-[#8A5A00]">{now.badge}</span>
            <span className="rounded-full border border-rule bg-card px-2 py-0.5 font-ui text-[11px] font-bold">{now.tier === "vvip" ? "🏆 VVIP" : now.tier === "vip" ? "🛡 Army" : "🌄 Starter"}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
