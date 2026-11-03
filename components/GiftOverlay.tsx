"use client";

import { useEffect, useRef, useState } from "react";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";
import { GRAND_FROM_KOBO, giftNaira } from "@/lib/gift-catalogue";
import { GIFT_PLAY_EVENT, giftSoundOn, type GiftPlay } from "@/lib/gift-play";

// Plays animated gifts over the page (lib/gift-play.ts): the drawing grows in, moves, and fades with who sent it. Gifts from
// GRAND_FROM_KOBO up get the full screen, rays and confetti, and stay longer. It never blocks taps. One at a time; others queue.
// Sound only if the viewer switched gift sounds on (a short chime made in the browser; no audio files).
const COLOURS = ["#E8B23A", "#A6093D", "#1F7A4D", "#2B3A8C", "#C8562B"];

function chime(grand: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    (grand ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77]).forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* no audio: silent */ }
}

export default function GiftOverlay() {
  const [now, setNow] = useState<GiftPlay | null>(null);
  const queue = useRef<GiftPlay[]>([]);
  const seen = useRef(new Set<string>());
  const playing = useRef(false); // kept outside state so the queue is never touched inside a state updater (React may run those twice)
  const next = () => { const g = queue.current.shift() ?? null; playing.current = !!g; setNow(g); };

  useEffect(() => {
    const on = (e: Event) => {
      const g = (e as CustomEvent<GiftPlay>).detail;
      if (!g?.giftId) return;
      if (g.key) { if (seen.current.has(g.key)) return; seen.current.add(g.key); }
      queue.current.push(g);
      if (!playing.current) next();
    };
    window.addEventListener(GIFT_PLAY_EVENT, on);
    return () => window.removeEventListener(GIFT_PLAY_EVENT, on);
  }, []);

  useEffect(() => {
    if (!now) return;
    const grand = now.priceKobo >= GRAND_FROM_KOBO;
    if (giftSoundOn()) chime(grand);
    const t = setTimeout(next, grand ? 5200 : 3200);
    return () => clearTimeout(t);
  }, [now]);

  if (!now) return null;
  const grand = now.priceKobo >= GRAND_FROM_KOBO;
  return (
    <div className={`gift-ov pointer-events-none fixed inset-0 z-[70] flex items-center justify-center ${grand ? "gift-ov-grand" : ""}`} role="status" aria-live="polite" data-gift={now.giftId}>
      <GiftArtStyles />
      <style>{OV_CSS}</style>
      {grand && <div className="gift-ov-rays" aria-hidden />}
      {grand && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 28 }, (_, i) => (
            <span key={i} className="gift-ov-bit" style={{ left: `${(i * 37) % 100}%`, background: COLOURS[i % COLOURS.length], animationDelay: `${(i % 7) * 0.18}s`, transform: `rotate(${i * 23}deg)` }} />
          ))}
        </div>
      )}
      <div className="gift-ov-card flex flex-col items-center rounded-3xl bg-paper/95 px-8 py-6 text-center shadow-2xl ring-1 ring-rule">
        <GiftArt id={now.giftId} size={grand ? 220 : 150} motion="once" title={now.name} />
        <p className="mt-2 font-display text-2xl text-ink">{now.name}</p>
        <p className="mt-1 font-ui text-sm text-slate">
          {now.senderName ? <><strong className="text-ink">{now.senderName}</strong> sent </> : "Someone sent "}
          {giftNaira(now.priceKobo)}{now.toName ? ` to ${now.toName}` : ""}
        </p>
      </div>
    </div>
  );
}

const OV_CSS = `
.gift-ov{background:radial-gradient(circle at 50% 50%,rgba(42,26,18,.28),rgba(42,26,18,0) 60%)}
.gift-ov-grand{background:radial-gradient(circle at 50% 50%,rgba(78,1,25,.55),rgba(42,26,18,.25) 70%)}
.gift-ov-card{animation:gift-in .5s cubic-bezier(.2,1.4,.4,1) both, gift-out .5s ease-in 2.7s forwards}
.gift-ov-grand .gift-ov-card{animation:gift-in .7s cubic-bezier(.2,1.4,.4,1) both, gift-out .6s ease-in 4.6s forwards}
.gift-ov-rays{position:absolute;width:160vmax;height:160vmax;background:repeating-conic-gradient(rgba(232,178,58,.28) 0 6deg,transparent 6deg 18deg);animation:gift-rays 6s linear both;border-radius:50%}
.gift-ov-bit{position:absolute;top:-4%;width:10px;height:16px;border-radius:2px;animation:gift-fall 3.6s ease-in both}
@keyframes gift-in{from{transform:scale(.3) translateY(30%);opacity:0}to{transform:none;opacity:1}}
@keyframes gift-out{to{transform:scale(.9) translateY(-10%);opacity:0}}
@keyframes gift-rays{from{transform:rotate(0) scale(.6);opacity:0}15%{opacity:1}85%{opacity:1}to{transform:rotate(60deg) scale(1);opacity:0}}
@keyframes gift-fall{from{transform:translateY(0) rotate(0)}to{transform:translateY(115vh) rotate(540deg)}}
@media (prefers-reduced-motion:reduce){.gift-ov-card,.gift-ov-rays,.gift-ov-bit{animation:gift-out .4s ease-in 2.6s forwards!important}.gift-ov-bit,.gift-ov-rays{display:none}}
`;
