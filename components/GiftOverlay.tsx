"use client";

import { useEffect, useRef, useState } from "react";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";
import { MOTIF_EFFECTS, giftNaira, isGrand, playMs, type GiftEffect, type GiftMotif } from "@/lib/gift-catalogue";
import { GIFT_PLAY_EVENT, giftSoundOn, type GiftPlay } from "@/lib/gift-play";

// Plays animated gifts full screen over the page (lib/gift-play.ts). Each gift plays with its own mix of rays, stars, fireworks,
// confetti and sound (MOTIF_EFFECTS in lib/gift-catalogue.ts); grand gifts are bigger and stay longer. It never blocks taps. One at a
// time; others queue. Sound only if the viewer switched gift sounds on (made in the browser; no audio files). Reduced motion: the card
// alone, without the moving effects.
const COLOURS = ["#E8B23A", "#A6093D", "#1F7A4D", "#2B3A8C", "#C8562B", "#F5B7C6"];

type Tone = { f: number; at: number; len: number; type: OscillatorType; gain: number };
function play(tones: Tone[], noise?: { at: number; len: number }[]) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (const t of tones) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = t.type; o.frequency.value = t.f;
      const s = ctx.currentTime + t.at;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(t.gain, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + t.len);
      o.connect(g).connect(ctx.destination); o.start(s); o.stop(s + t.len + 0.05);
    }
    for (const n of noise ?? []) { // a firework's crackle: a short burst of noise
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * n.len), ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 0.12;
      src.buffer = buf; src.connect(g).connect(ctx.destination); src.start(ctx.currentTime + n.at);
    }
    setTimeout(() => ctx.close().catch(() => {}), 4000);
  } catch { /* no audio: silent */ }
}
// The drum talks (two pitches), everything else chimes; grand gifts get a fanfare, and fireworks crackle.
function sound(id: GiftMotif, grand: boolean, fireworks: boolean) {
  const tones: Tone[] = id === "drum"
    ? [0, 0.18, 0.36, 0.62, 0.8].map((at, i) => ({ f: i % 2 ? 110 : 160, at, len: 0.25, type: "sine" as const, gain: 0.35 }))
    : (grand ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 987.77]).map((f, i) => ({ f, at: i * 0.12, len: 0.6, type: "triangle" as const, gain: 0.18 }));
  play(tones, fireworks ? [0.7, 1.4, 2.1].map((at) => ({ at, len: 0.35 })) : undefined);
}

function Effects({ fx, big }: { fx: GiftEffect[]; big: boolean }) {
  const n = big ? 1.6 : 1;
  return (
    <div aria-hidden className="gift-fx absolute inset-0 overflow-hidden">
      {fx.includes("rays") && <div className="gift-ov-rays" />}
      {fx.includes("stars") && Array.from({ length: Math.round(14 * n) }, (_, i) => (
        <span key={`s${i}`} className="gift-ov-star" style={{ left: `${(i * 53) % 100}%`, top: `${(i * 31 + 7) % 92}%`, animationDelay: `${(i % 6) * 0.22}s`, color: COLOURS[i % 2 ? 0 : 5] }}>✦</span>
      ))}
      {fx.includes("fireworks") && Array.from({ length: big ? 5 : 3 }, (_, b) => (
        <span key={`f${b}`} className="gift-ov-burst" style={{ left: `${[22, 76, 48, 12, 88][b]}%`, top: `${[24, 30, 14, 52, 58][b]}%`, animationDelay: `${0.6 + b * 0.55}s` }}>
          {Array.from({ length: 14 }, (_, i) => <b key={i} style={{ transform: `rotate(${i * (360 / 14)}deg)` }}><i style={{ background: COLOURS[(b + i) % COLOURS.length], animationDelay: `${0.6 + b * 0.55}s` }} /></b>)}
        </span>
      ))}
      {fx.includes("confetti") && Array.from({ length: Math.round(30 * n) }, (_, i) => (
        <span key={`c${i}`} className="gift-ov-bit" style={{ left: `${(i * 37 + (i % 3) * 11) % 100}%`, background: COLOURS[i % COLOURS.length], animationDelay: `${-((i * 0.53) % 2.4).toFixed(2)}s`, animationDuration: `${3 + (i % 5) * 0.35}s`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  );
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
    const fx = MOTIF_EFFECTS[now.giftId] ?? [];
    const unit = Math.round(now.priceKobo / Math.max(1, now.quantity ?? 1)); // a send of N plays as one gift of that kind
    if (fx.includes("sound") && giftSoundOn()) sound(now.giftId, isGrand(unit), fx.includes("fireworks"));
    const t = setTimeout(next, playMs(unit));
    return () => clearTimeout(t);
  }, [now]);

  if (!now) return null;
  const unit = Math.round(now.priceKobo / Math.max(1, now.quantity ?? 1));
  const grand = isGrand(unit);
  const ms = playMs(unit);
  return (
    <div className={`gift-ov pointer-events-none fixed inset-0 z-[70] flex items-center justify-center ${grand ? "gift-ov-grand" : ""}`} style={{ ["--gift-ms" as string]: `${ms}ms` }} role="status" aria-live="polite" data-gift={now.giftId}>
      <GiftArtStyles />
      <style>{OV_CSS}</style>
      <Effects fx={MOTIF_EFFECTS[now.giftId] ?? []} big={grand} />
      <div className="gift-ov-card relative flex flex-col items-center rounded-3xl bg-paper/95 px-8 py-6 text-center shadow-2xl ring-1 ring-rule">
        <GiftArt id={now.giftId} size={grand ? 240 : 170} motion="once" title={now.name} />
        <p className="mt-2 font-display text-2xl text-ink">{now.name}{(now.quantity ?? 1) > 1 && <span className="ml-2 inline-block rounded-full bg-crimson px-2.5 py-0.5 font-ui text-lg font-bold text-paper" data-gift-qty={now.quantity}>×{now.quantity}</span>}</p>
        <p className="mt-1 font-ui text-sm text-slate">
          {now.senderName ? <><strong className="text-ink">{now.senderName}</strong> sent </> : "Someone sent "}
          {giftNaira(now.priceKobo)}{now.toName ? ` to ${now.toName}` : ""}
        </p>
      </div>
    </div>
  );
}

const OV_CSS = `
.gift-ov{background:radial-gradient(circle at 50% 50%,rgba(42,26,18,.45),rgba(42,26,18,.12) 75%)}
.gift-ov-grand{background:radial-gradient(circle at 50% 50%,rgba(78,1,25,.62),rgba(42,26,18,.3) 75%)}
.gift-ov-card{animation:gift-in .55s cubic-bezier(.2,1.4,.4,1) both, gift-out .55s ease-in calc(var(--gift-ms) - 600ms) forwards}
.gift-fx{animation:gift-out .5s ease-in calc(var(--gift-ms) - 550ms) forwards}
.gift-ov-rays{position:absolute;left:50%;top:50%;width:170vmax;height:170vmax;margin:-85vmax 0 0 -85vmax;background:repeating-conic-gradient(rgba(232,178,58,.3) 0 6deg,transparent 6deg 18deg);animation:gift-rays var(--gift-ms) linear both;border-radius:50%}
.gift-ov-star{position:absolute;font-size:22px;line-height:1;animation:gift-tw 1.3s ease-in-out infinite both;text-shadow:0 0 8px rgba(255,236,170,.9)}
.gift-ov-grand .gift-ov-star{font-size:30px}
.gift-ov-burst{position:absolute;width:0;height:0}
.gift-ov-burst b{position:absolute;left:0;top:0;width:0;height:0}
.gift-ov-burst i{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;opacity:0;animation:gift-boom 1.3s ease-out both}
.gift-ov-burst i::after{content:"";position:absolute;inset:0;border-radius:50%;background:inherit;filter:blur(2px)}
.gift-ov-bit{position:absolute;top:-4%;width:10px;height:16px;border-radius:2px;animation:gift-fall 3.4s ease-in both}
@keyframes gift-in{from{transform:scale(.3) translateY(30%);opacity:0}to{transform:none;opacity:1}}
@keyframes gift-out{to{transform:scale(.92) translateY(-8%);opacity:0}}
@keyframes gift-rays{from{transform:rotate(0) scale(.6);opacity:0}12%{opacity:1}88%{opacity:1}to{transform:rotate(70deg) scale(1);opacity:0}}
@keyframes gift-tw{0%,100%{transform:scale(.3) rotate(0);opacity:.15}50%{transform:scale(1.15) rotate(30deg);opacity:1}}
@keyframes gift-boom{0%{opacity:1;transform:translateY(0) scale(1.2)}70%{opacity:1}100%{opacity:0;transform:translateY(-110px) scale(.6)}}
@keyframes gift-fall{from{transform:translateY(0) rotate(0)}to{transform:translateY(115vh) rotate(540deg)}}
@media (prefers-reduced-motion:reduce){.gift-fx{display:none}.gift-ov-card{animation:gift-out .4s ease-in calc(var(--gift-ms) - 500ms) forwards!important}}
`;
