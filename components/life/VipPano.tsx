"use client";

import { useEffect, useRef } from "react";

// The real VIP bar at the Candellux, as a 360° strip players can look around: the lounge and the guest corner joined by golden
// mirror pillars into one panorama (public/images/life/partners/candellux-vip-360.webp, 1926 × 520; half a pillar at each end, so
// copies side by side join up). It pans slowly by itself; a drag or swipe takes over, and it wraps round both ways.
const SRC = "/images/life/partners/candellux-vip-360.webp", W = 1926, H = 520;

export default function VipPano() {
  const box = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current, st = strip.current;
    if (!el || !st) return;
    let x = 0, last = 0, raf = 0, drag: { at: number; x: number } | null = null, idleUntil = 0;
    // Each copy gets a whole-pixel width so the copies meet without a hairline.
    const width = () => { const w = Math.round((el.clientHeight * W) / H); for (const im of Array.from(st.children) as HTMLElement[]) im.style.width = `${w}px`; return w; };
    const draw = () => { const w = width(); x = ((x % w) + w) % w; st.style.transform = `translate3d(${-Math.round(x)}px,0,0)`; };
    const tick = (t: number) => {
      const dt = last ? Math.min(64, t - last) : 0; last = t;
      if (!drag && t > idleUntil && !matchMedia("(prefers-reduced-motion: reduce)").matches) x += dt * 0.025;
      draw(); raf = requestAnimationFrame(tick);
    };
    const down = (e: PointerEvent) => { drag = { at: e.clientX, x }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (drag) x = drag.x - (e.clientX - drag.at); };
    const up = () => { drag = null; idleUntil = performance.now() + 4000; };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
  }, []);
  return (
    <div ref={box} className="relative h-40 cursor-grab touch-pan-y select-none overflow-hidden rounded-2xl bg-[#18100b] active:cursor-grabbing sm:h-48" role="img" aria-label="The VIP bar at the Candellux Imperial, a 360° view">
      <div ref={strip} className="flex h-full w-max will-change-transform">
        {[0, 1, 2].map((i) => <img key={i} src={SRC} alt="" draggable={false} className="block h-full max-w-none shrink-0 object-cover" />)}
      </div>
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white">↔ 360° · drag to look around</span>
    </div>
  );
}
