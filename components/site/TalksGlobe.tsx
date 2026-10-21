"use client";

import { useEffect, useRef, useState } from "react";
import { landDots } from "@/lib/globe-land";
import type { Talk } from "@/lib/site-kits";

// The Talks section's globe: the land as dots, a dot in the site's colour for every talk that has a place, turning slowly. Drag to turn it,
// tap a dot to see what was said there. Drawn on a canvas (thousands of dots stay smooth on a phone); it stops turning when it's off screen,
// and doesn't turn at all for visitors who ask for less motion. The list beside it carries the same talks for screen readers.
const RAD = Math.PI / 180;
type Pin = { lat: number; lng: number; talks: Talk[] };

function pinsOf(talks: Talk[]): Pin[] {
  const by = new Map<string, Pin>();
  for (const t of talks) {
    if (t.lat === null || t.lng === null) continue;
    const k = `${t.lat},${t.lng}`;
    const p = by.get(k) ?? { lat: t.lat, lng: t.lng, talks: [] };
    p.talks.push(t);
    by.set(k, p);
  }
  return [...by.values()];
}

export default function TalksGlobe({ talks }: { talks: Talk[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pins = useRef<Pin[]>(pinsOf(talks));
  // Start over the talks (their average longitude), tilted a little towards the north.
  const view = useRef({ lng: pins.current.length ? pins.current.reduce((s, p) => s + p.lng, 0) / pins.current.length : 3, lat: 12 });
  const [picked, setPicked] = useState<Pin | null>(null);

  useEffect(() => {
    pins.current = pinsOf(talks);
  }, [talks]);

  useEffect(() => {
    const el = canvas.current, box = wrap.current;
    if (!el || !box) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dots = landDots();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, visible = true, dragging = false, frame = 0;
    let colours = { land: "rgb(92 83 78)", pin: "rgb(122 3 40)", edge: "rgb(231 218 211)" };
    // The colours follow the site's colour set and the Scholar look's dark mode: read from elements styled with them.
    const readColours = () => {
      const get = (sel: string) => getComputedStyle(box.querySelector(sel) as Element).color;
      colours = { land: get("[data-c=land]"), pin: get("[data-c=pin]"), edge: get("[data-c=edge]") };
    };
    readColours();

    const project = (lat: number, lng: number, size: number) => {
      const r = size / 2 - 6, phi = lat * RAD, lam = (lng - view.current.lng) * RAD, phi0 = view.current.lat * RAD;
      const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
      const x = r * Math.cos(phi) * Math.sin(lam);
      const y = r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam));
      return { x: size / 2 + x, y: size / 2 - y, front: cosc > 0, depth: cosc };
    };

    const draw = () => {
      const size = box.clientWidth, dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(size * dpr)) { el.width = Math.round(size * dpr); el.height = Math.round(size * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (++frame % 30 === 0) readColours();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
      ctx.strokeStyle = colours.edge; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = colours.land;
      const dot = Math.max(1, size / 260);
      for (const [lat, lng] of dots) {
        const p = project(lat, lng, size);
        if (!p.front) continue;
        ctx.globalAlpha = 0.25 + 0.45 * p.depth;
        ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
      }
      ctx.globalAlpha = 1;
      const pulse = still ? 0 : (Math.sin(frame / 12) + 1) / 2;
      for (const pin of pins.current) {
        const p = project(pin.lat, pin.lng, size);
        if (!p.front) continue;
        ctx.fillStyle = colours.pin;
        ctx.globalAlpha = 0.25 * (1 - pulse);
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 + 7 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
      }
    };
    const tick = () => {
      if (!dragging && !still) view.current.lng = ((view.current.lng + 0.12 + 180) % 360) - 180;
      draw();
      if (visible && !still) raf = requestAnimationFrame(tick);
    };
    tick();

    const seen = new IntersectionObserver(([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was && !still) raf = requestAnimationFrame(tick);
    });
    seen.observe(box);
    const resize = new ResizeObserver(() => draw());
    resize.observe(box);

    // Drag to turn; a tap (no real movement) picks the nearest talk dot.
    let start: { x: number; y: number; lng: number; lat: number } | null = null, moved = false;
    const down = (e: PointerEvent) => { start = { x: e.clientX, y: e.clientY, lng: view.current.lng, lat: view.current.lat }; moved = false; dragging = true; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      const k = 180 / box.clientWidth;
      view.current.lng = start.lng - dx * k;
      view.current.lat = Math.max(-60, Math.min(60, start.lat + dy * k));
      if (still) draw();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (start && !moved) {
        const r = el.getBoundingClientRect(), size = box.clientWidth;
        const x = e.clientX - r.left, y = e.clientY - r.top;
        let best: Pin | null = null, bestD = 18;
        for (const pin of pins.current) {
          const p = project(pin.lat, pin.lng, size);
          const d = Math.hypot(p.x - x, p.y - y);
          if (p.front && d < bestD) { best = pin; bestD = d; }
        }
        setPicked(best);
      }
      start = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf); seen.disconnect(); resize.disconnect();
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrap} className="relative mx-auto aspect-square w-full max-w-sm">
      <span data-c="land" className="hidden text-slate" /><span data-c="pin" className="hidden text-crimson" /><span data-c="edge" className="hidden text-rule" />
      <canvas ref={canvas} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" aria-hidden />
      {picked && (
        <div className="card absolute inset-x-4 bottom-2 p-3 text-xs" role="status">
          <button type="button" onClick={() => setPicked(null)} aria-label="Close" className="float-right text-slate">✕</button>
          <p className="font-ui font-bold text-ink">{picked.talks[0].place}</p>
          <ul className="mt-1 space-y-0.5 text-slate">
            {picked.talks.map((t, n) => <li key={n}>{t.title}{t.event ? `, ${t.event}` : ""}{t.year ? ` (${t.year})` : ""}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
