"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Nana's smart suggestions, easy to adopt (owner, 1 Nov 2026: "smart suggestions should be easy to adopt by swiping in the suggestion …
// swipe out to remove"). One suggestion as a chip:
//   swipe right (in) or tap   → adopt it: the chip slides, turns crimson and flashes "✓ Added"
//   swipe left (out) or ✕     → remove it from the list (the list offers Undo for a few seconds, useDismissed below)
//   keyboard                  → Enter adopts, Delete or Backspace removes; focus shows a crimson ring
// Pointer events only (touch, pen and a mouse drag), no library. A vertical move is left to the page, so the list still scrolls on a
// phone. With prefers-reduced-motion the chip doesn't slide or animate: the same actions happen at once.
const THRESHOLD = 56; // px past which a swipe counts
const MAX_DRAG = 120;
const FLASH_MS = 900;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function SwipeChip({ on, onAdopt, onRemove, onToggleOff, label, wide = false, disabled = false, children }: {
  on: boolean; // already adopted
  onAdopt: () => void;
  onRemove: () => void;
  onToggleOff?: () => void; // tapping an adopted chip takes it back (topics); leave out where a tap only adopts
  label: string; // what the suggestion is, for screen readers ("#Tech", "Set up a help desk")
  wide?: boolean; // a full-width row (categories, lines) rather than a pill
  disabled?: boolean; // can't be adopted now (the list is full); it can still be removed
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; axis: "" | "x" | "y" } | null>(null);
  const swiped = useRef(false); // the click after a swipe isn't a tap
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const adopt = useCallback(() => {
    if (disabled) return;
    if (!on) onAdopt();
    setFlash(true);
    later(() => setFlash(false), FLASH_MS);
  }, [on, onAdopt, disabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = useCallback(() => {
    if (reduced) { onRemove(); return; }
    setLeaving(true);
    later(onRemove, 180);
  }, [onRemove, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: "" };
    swiped.current = false;
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x, my = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (s.axis === "x") { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDragging(true); }
    }
    if (s.axis !== "x") return;
    e.preventDefault();
    setDx(Math.max(-MAX_DRAG, Math.min(MAX_DRAG, mx)));
  };
  const up = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId || s.axis !== "x") return;
    swiped.current = true;
    setDragging(false);
    const d = dx;
    setDx(0);
    if (d >= THRESHOLD) adopt();
    else if (d <= -THRESHOLD) remove();
  };
  const cancel = () => { start.current = null; setDragging(false); setDx(0); };

  const tap = () => {
    if (swiped.current) { swiped.current = false; return; }
    if (on && onToggleOff) onToggleOff();
    else adopt();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); adopt(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); }
  };

  const past = dx >= THRESHOLD, out = dx <= -THRESHOLD;
  const lit = on || past || flash;
  const shape = wide ? "flex w-full rounded-xl" : "inline-flex rounded-full";
  const motion = reduced || dragging ? "" : "transition-[transform,opacity,background-color] duration-200 ease-out";
  const shift = leaving ? (reduced ? 0 : -160) : flash && !reduced && !dragging ? 6 : dx;
  return (
    <span className={`relative ${wide ? "block" : "inline-block"} max-w-full`} data-swipe-chip="">
      {/* What letting go would do, under the chip */}
      <span aria-hidden className={`pointer-events-none absolute inset-0 ${wide ? "rounded-xl" : "rounded-full"} flex items-center justify-between px-3 font-ui text-[11px] font-bold ${dx > 0 ? "bg-crimson/15 text-crimson" : dx < 0 ? "bg-slate/15 text-slate" : ""}`}>
        <span className={dx > 0 ? "" : "invisible"}>✓ Add</span><span className={dx < 0 ? "" : "invisible"}>Remove ✕</span>
      </span>
      <span
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
        style={{ transform: shift ? `translateX(${shift}px)` : undefined, opacity: leaving ? 0 : out ? 0.6 : 1, touchAction: "pan-y" }}
        className={`relative ${shape} cursor-grab select-none items-center gap-1 font-ui text-[13px] font-semibold focus-within:ring-2 focus-within:ring-crimson focus-within:ring-offset-2 ${motion} ${lit ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"} ${disabled && !on ? "opacity-60" : ""}`}
      >
        <button type="button" onClick={tap} onKeyDown={key} aria-pressed={on} aria-disabled={disabled && !on ? true : undefined}
          aria-label={`${label}${on ? ", added" : ""}. Enter to add, Delete to remove.`}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-3 text-left outline-none ${wide ? "pr-1" : "pr-0.5"}`}>
          {children}
        </button>
        <button type="button" onClick={remove} aria-label={`Remove the suggestion ${label}`}
          className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-crimson ${lit ? "text-paper/80 hover:bg-white/15" : "text-slate hover:bg-rule"}`}>✕</button>
      </span>
      {flash && <span role="status" className={`pointer-events-none absolute -top-2.5 right-1 rounded-full bg-emerald-600 px-2 py-0.5 font-ui text-[10px] font-bold text-white shadow ${reduced ? "" : "animate-[fadeUp_0.9s_ease-out_forwards]"}`}>✓ Added</span>}
    </span>
  );
}

// Suggestions the writer removed, per suggestion list (`scope`: what it's for and the title), kept in this browser so they don't come
// back on a reload; Refresh brings them back (clear). The last one removed can be undone for UNDO_MS.
export const UNDO_MS = 4000;
const STORE_KEY = "nana-removed-suggestions";
const MAX_SCOPES = 60;
function readAll(): Record<string, string[]> {
  try { const v = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function writeScope(scope: string, ids: string[]) {
  try {
    const all = readAll();
    delete all[scope];
    if (ids.length) all[scope] = ids;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_SCOPES))) delete all[k];
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {}
}
export function useDismissed(scope: string) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [last, setLast] = useState<{ id: string; label: string } | null>(null);
  const timer = useRef<number>();
  useEffect(() => { setRemoved(typeof window === "undefined" ? [] : readAll()[scope] ?? []); setLast(null); }, [scope]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const save = (ids: string[]) => { setRemoved(ids); writeScope(scope, ids); };
  return {
    isRemoved: (id: string) => removed.includes(id),
    remove: (id: string, label: string) => {
      save(Array.from(new Set([...removed, id])));
      setLast({ id, label });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLast(null), UNDO_MS);
    },
    undo: () => { if (last) save(removed.filter((x) => x !== last.id)); setLast(null); },
    clear: () => { save([]); setLast(null); },
    last,
  };
}

// "Removed · Undo", for a few seconds after a suggestion is swiped out.
export function UndoBar({ last, onUndo }: { last: { label: string } | null; onUndo: () => void }) {
  if (!last) return null;
  return (
    <p role="status" className="mt-3 flex items-center justify-between gap-3 rounded-full bg-ink px-4 py-2 font-ui text-xs text-paper">
      <span className="min-w-0 truncate">Removed <b>{last.label}</b></span>
      <button type="button" onClick={onUndo} className="shrink-0 font-bold text-[#ffb3c4] underline outline-none focus-visible:ring-2 focus-visible:ring-paper">Undo</button>
    </p>
  );
}

// The one-line hint, the first time someone sees swipeable suggestions (remembered in this browser).
const HINT_KEY = "nana-swipe-hint-seen";
export function SwipeHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      setShow(true);
      window.localStorage.setItem(HINT_KEY, "1");
    } catch { setShow(true); }
  }, []);
  if (!show) return null;
  return <p className="mt-2 rounded-lg bg-crimson/[0.07] px-3 py-1.5 font-ui text-xs font-semibold text-crimson"><span aria-hidden>👉</span> Swipe right to add, left to remove. Or tap to add and ✕ to remove.</p>;
}
