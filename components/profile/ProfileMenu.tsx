"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

// A small menu under a profile button (+ Create, and ⋯ for the rest of what you'd manage on your own profile). Closes on a tap
// outside, on Escape and after choosing.
export type MenuItem = { href: string; label: string; icon?: ReactNode; note?: string };

export default function ProfileMenu({ button, label, items, className = "", align = "left" }: {
  button: ReactNode; label: string; items: MenuItem[]; className?: string; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className="btn-ghost">{button}</button>
      {open && (
        <div role="menu" aria-label={label} className={`absolute z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-rule bg-card py-1 text-left shadow-xl ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it) => (
            <Link key={it.href + it.label} href={it.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 font-ui text-sm text-ink hover:bg-field">
              {it.icon && <span className="shrink-0 text-slate">{it.icon}</span>}
              <span className="min-w-0">{it.label}{it.note && <span className="block text-xs text-slate">{it.note}</span>}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
