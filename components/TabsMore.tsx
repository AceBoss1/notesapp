"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// A row of tabs that stays short on a phone (owner, 12 Nov 2026: "reduce tabs in mobile sitewide … use a tab called [More…] to envelope
// when tabs are many"). On a phone it shows the first `mobile` tabs, always including the one that's open, and puts the rest under
// "More ▾"; from the sm breakpoint up every tab shows, as before. A tab either calls onSelect or, with href, is a link.
export type TabItem = { id: string; label: React.ReactNode; href?: string; badge?: React.ReactNode };

const pill = (on: boolean) => `shrink-0 rounded-full px-4 py-2 font-ui text-sm font-semibold ${on ? "bg-crimson-deep text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;

export default function TabsMore({
  tabs, active, onSelect, mobile = 3, className = "", tabClass = pill, label = "Sections",
}: {
  tabs: TabItem[]; active: string; onSelect?: (id: string) => void; mobile?: number; className?: string;
  tabClass?: (active: boolean) => string; label?: string;
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

  // On a phone: the first tabs, with the open one swapped in when it would otherwise be hidden.
  const many = tabs.length > mobile + 1;
  let shown = many ? tabs.slice(0, mobile) : tabs;
  if (many && !shown.some((t) => t.id === active)) {
    const a = tabs.find((t) => t.id === active);
    if (a) shown = [...shown.slice(0, mobile - 1), a];
  }
  const rest = many ? tabs.filter((t) => !shown.includes(t)) : [];
  const one = (t: TabItem, cls: string, after?: () => void) => {
    const inner = <>{t.label}{t.badge}</>;
    return t.href
      ? <Link key={t.id} href={t.href} role="tab" aria-selected={t.id === active} onClick={after} className={cls}>{inner}</Link>
      : <button key={t.id} type="button" role="tab" aria-selected={t.id === active} onClick={() => { onSelect?.(t.id); after?.(); }} className={cls}>{inner}</button>;
  };

  return (
    <div className={className}>
      {/* Phones */}
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap sm:hidden" role="tablist" aria-label={label}>
        {shown.map((t) => one(t, tabClass(t.id === active)))}
        {rest.length > 0 && (
          <div ref={box} className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${tabClass(false)} whitespace-nowrap`}>More ▾</button>
            {open && (
              <div role="menu" className="absolute right-0 z-40 mt-2 min-w-[11rem] overflow-hidden rounded-2xl border border-rule bg-card py-1 shadow-xl">
                {rest.map((t) => one(t, "flex w-full items-center gap-2 px-4 py-2.5 text-left font-ui text-sm font-semibold text-ink hover:bg-field", () => setOpen(false)))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Tablets and computers: every tab, scrolling sideways when needed */}
      <div className="hidden gap-2 overflow-x-auto sm:flex" role="tablist" aria-label={label}>
        {tabs.map((t) => one(t, tabClass(t.id === active)))}
      </div>
    </div>
  );
}
