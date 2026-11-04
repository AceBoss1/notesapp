"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// The /anya hero: the three Anya pictures, one at a time, dissolving into the next every few seconds. It pauses while the pointer or
// keyboard focus is on it, the dots pick one, and with "reduce motion" switched on it stays on the one chosen and never moves by itself.
export type AnyaSlide = { src: string; name: string; alt: string };

const EVERY_MS = 5500;

export default function AnyaHeroCarousel({ slides }: { slides: AnyaSlide[] }) {
  const [shown, setShown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (paused || still || slides.length < 2) return;
    const t = setTimeout(() => setShown((i) => (i + 1) % slides.length), EVERY_MS);
    return () => clearTimeout(t);
  }, [shown, paused, still, slides.length]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Anya smart glasses"
    >
      <div className="relative aspect-[1672/941] w-full overflow-hidden rounded-3xl border border-paper/10 shadow-2xl">
        {slides.map((s, i) => (
          <Image
            key={s.src}
            src={s.src}
            alt={s.alt}
            fill
            priority={i === 0}
            sizes="(min-width: 1152px) 1104px, 100vw"
            aria-hidden={i !== shown}
            className={`object-cover transition-opacity duration-[1400ms] ease-in-out ${i === shown ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setShown(i)}
            aria-label={`Show Anya ${s.name}`}
            aria-current={i === shown}
            className={`rounded-full px-3 py-1 font-ui text-xs font-semibold transition-colors ${i === shown ? "bg-paper text-ink" : "bg-paper/10 text-paper/70 hover:bg-paper/20"}`}
          >
            Anya {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
