"use client";

import { useEffect, useRef, useState } from "react";
import type { Look } from "./scene";

// The turning 3D view of a merch item (docs/MERCH_3D.md). Drag to turn, pinch or scroll to look closer, Front and Back buttons. It turns
// slowly by itself until touched, unless the device asks for reduced motion (then the arrows turn it). If 3D can't run here, `fallback`
// (a flat picture) is shown instead. three is loaded only when this mounts, so the store page stays light.
export type Side = "front" | "back";

export default function Merch3D({ look, height = 320, fallback, label, controls = true, side, onSide }: {
  look: Look; height?: number; fallback: React.ReactNode; label: string; controls?: boolean; side?: Side; onSide?: (s: Side) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [still] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const api = useRef<{ setLook: (l: Look) => void; turnTo: (a: number) => void; nudge: (a: number) => void; angle: () => number } | null>(null);
  const lookKey = JSON.stringify(look);
  const latest = useRef(look);

  useEffect(() => {
    let dead = false, raf = 0;
    let stage: Awaited<ReturnType<typeof start>> | null = null;
    async function start() {
      const m = await import("./scene");
      const el = cv.current!, holder = box.current!;
      const s = m.makeStage(el);
      const { renderer, scene, camera, THREE } = s;
      let product: import("three").Group | null = null, built = 0;
      let rotY = 0, rotX = 0.06, dist = 5.2, target: number | null = null, touched = 0;
      const size = () => { const w = holder.clientWidth, h = holder.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      size();
      const ro = new ResizeObserver(size); ro.observe(holder);
      async function setLook(l: Look) {
        const n = ++built;
        const g = await m.buildProduct(l);
        if (dead || n !== built) { m.disposeAll(g); return; }
        if (product) { s.holder.remove(product); m.disposeAll(product); }
        product = g; s.holder.add(g); setReady(true);
      }
      // Pointer: one finger turns, two fingers (or the wheel) zoom.
      const pts = new Map<number, { x: number; y: number }>();
      let pinch = 0;
      const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); touched = performance.now(); target = null; };
      const move = (e: PointerEvent) => {
        const p = pts.get(e.pointerId); if (!p) return;
        if (pts.size === 1) { rotY += (e.clientX - p.x) * 0.012; rotX = Math.max(-0.5, Math.min(0.6, rotX + (e.clientY - p.y) * 0.006)); }
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) dist = Math.max(3, Math.min(8, dist * (pinch / d)));
          pinch = d;
        }
        touched = performance.now();
      };
      const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
      const wheel = (e: WheelEvent) => { e.preventDefault(); dist = Math.max(3, Math.min(8, dist * (1 + Math.sign(e.deltaY) * 0.08))); touched = performance.now(); };
      el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", wheel, { passive: false });
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (target !== null) {
          const diff = target - rotY; rotY += diff * Math.min(1, dt * 6);
          if (Math.abs(diff) < 0.002) { rotY = target; target = null; }
        } else if (!still && controls !== false && pts.size === 0 && now - touched > 4000) rotY += dt * 0.45;
        else if (!still && controls === false) rotY += dt * 0.45;
        s.holder.rotation.set(rotX, rotY, 0);
        camera.position.set(0, 0.15, dist); camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // The nearest angle that shows the asked-for side, so Front and Back never spin the long way round.
      const nearest = (a: number) => rotY + ((((a - rotY) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      api.current = {
        setLook, angle: () => rotY,
        turnTo: (a) => { target = nearest(a); touched = performance.now(); },
        nudge: (a) => { target = (target ?? rotY) + a; touched = performance.now(); },
      };
      setLook(latest.current);
      return { renderer, ro, el, THREE, down, move, up, wheel, dispose: () => { if (product) m.disposeAll(product); renderer.dispose(); } };
    }
    start().then((x) => { stage = x; if (dead) cleanup(); }).catch(() => setFailed(true));
    function cleanup() {
      cancelAnimationFrame(raf);
      if (!stage) return;
      stage.ro.disconnect();
      stage.el.removeEventListener("pointerdown", stage.down); stage.el.removeEventListener("pointermove", stage.move);
      stage.el.removeEventListener("pointerup", stage.up); stage.el.removeEventListener("pointercancel", stage.up); stage.el.removeEventListener("wheel", stage.wheel);
      stage.dispose();
    }
    return () => { dead = true; cleanup(); api.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new colour, logo, place or name rebuilds the product (the stage stays). Before the stage is ready, the latest choice waits in
  // `latest` and is built as soon as it is, so nothing chosen while it loads is lost.
  latest.current = look;
  useEffect(() => { api.current?.setLook(look); }, [lookKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (side) api.current?.turnTo(side === "back" ? Math.PI : 0); }, [side]);

  if (failed) return <>{fallback}</>;
  const pill = "rounded-full px-3 py-1 text-xs font-bold";
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-3xl" style={{ height, background: "radial-gradient(ellipse at 50% 85%, #e9dcd4 0, #f7f1ec 45%, #fff 80%)" }}>
      <canvas ref={cv} role="img" aria-label={label} className="block h-full w-full touch-none" style={{ cursor: "grab" }} />
      {!ready && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
      {controls && ready && (
        <>
          {!still && <span className={`${pill} absolute left-3 top-3 bg-ink/60 text-white`}>↻ Drag to turn · pinch to zoom</span>}
          {onSide && (
            <div className="absolute right-3 top-3 flex flex-col gap-1.5">
              {(["front", "back"] as const).map((x) => (
                <button key={x} type="button" aria-pressed={side === x} onClick={() => { api.current?.turnTo(x === "back" ? Math.PI : 0); onSide(x); }} className={`${pill} border ${side === x ? "border-rule bg-white text-ink" : "border-transparent bg-ink/5 text-slate"}`}>{x === "front" ? "Front" : "Back"}</button>
              ))}
            </div>
          )}
          {still && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
              <button type="button" onClick={() => api.current?.nudge(-Math.PI / 4)} className={`${pill} border border-rule bg-white text-ink`} aria-label="Turn left">◀ Turn</button>
              <button type="button" onClick={() => api.current?.nudge(Math.PI / 4)} className={`${pill} border border-rule bg-white text-ink`} aria-label="Turn right">Turn ▶</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
