"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

// Keeps an arcade game's <canvas> sized to its box and sharp on any screen.
//
// Games sit inside ArcadeShell, which only renders them once the player's saved progress has loaded, so a game's
// canvas is NOT in the page when the game component first mounts. A plain `useEffect(..., [])` that reads
// `canvasRef.current` on mount finds null, gives up, and the canvas keeps its default 300×150 backing store while the
// game draws as if it were 640×400 (Naija Run showed a magnified corner; Puff-Puff Rush cut off the bottom of the
// maze). This hook uses callback refs, so it starts measuring whenever the elements actually appear, and re-fits on box
// resizes, window resizes and devicePixelRatio changes (browser zoom, or dragging the window to another screen).
//
// `measure` gets the box's content width and the viewport height (CSS px) and returns the canvas's CSS size.
// `size.current` always holds the CSS size and the pixel ratio the backing store was made for.

export type CanvasSize = { w: number; h: number; dpr: number };

export function useCanvasFit(
  measure: (boxWidth: number, viewportHeight: number) => { w: number; h: number },
  { maxDpr = 3, onFit }: { maxDpr?: number; onFit?: (size: CanvasSize) => void } = {},
): {
  wrapRef: (el: HTMLElement | null) => void;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  canvas: MutableRefObject<HTMLCanvasElement | null>;
  size: MutableRefObject<CanvasSize>;
} {
  const [wrapEl, setWrapEl] = useState<HTMLElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const size = useRef<CanvasSize>({ w: 300, h: 150, dpr: 1 });
  const measureRef = useRef(measure);
  const onFitRef = useRef(onFit);
  measureRef.current = measure;
  onFitRef.current = onFit;

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => { canvas.current = el; setCanvasEl(el); }, []);

  useEffect(() => {
    if (!wrapEl || !canvasEl) return;
    let mq: MediaQueryList | null = null;
    const fit = () => {
      // clientWidth rounds, so a 631.6px box reads 632: floor the real width so the canvas never overflows it.
      const boxW = Math.min(wrapEl.clientWidth, Math.floor(wrapEl.getBoundingClientRect().width));
      if (boxW <= 0) return; // hidden or not laid out yet; the ResizeObserver calls again when it is
      const m = measureRef.current(boxW, window.innerHeight);
      const w = Math.max(1, Math.floor(m.w));
      const h = Math.max(1, Math.floor(m.h));
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;
      const bw = Math.round(w * dpr); const bh = Math.round(h * dpr);
      if (canvasEl.width !== bw) canvasEl.width = bw; // assigning clears the canvas, so only when it changes
      if (canvasEl.height !== bh) canvasEl.height = bh;
      size.current = { w, h, dpr };
      onFitRef.current?.(size.current);
      watchDpr();
    };
    // Zoom changes devicePixelRatio, which doesn't always resize the box: listen for the current ratio ending.
    const watchDpr = () => {
      mq?.removeEventListener?.("change", fit);
      mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
      mq?.addEventListener?.("change", fit);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(wrapEl);
    window.addEventListener("resize", fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", fit);
      mq?.removeEventListener?.("change", fit);
    };
  }, [wrapEl, canvasEl, maxDpr]);

  return { wrapRef: setWrapEl, canvasRef, canvas, size };
}
