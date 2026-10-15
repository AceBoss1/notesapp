"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

export type MenuItem = { label: string; icon?: string; href?: string; onClick?: () => void; danger?: boolean; hidden?: boolean; divider?: boolean };

// The top of an open conversation: the picture, the name (with badges beside it), a line under it (online status, or "Group · 12 members"), and a
// chevron that opens a menu of what you can do with this conversation.
export default function ThreadHeader({ back, avatar, title, subtitle, items, actions }: { back?: ReactNode; avatar: ReactNode; title: ReactNode; subtitle?: ReactNode; items: MenuItem[]; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const shown = items.filter((i) => !i.hidden);
  const row = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper";
  return (
    // On phones and tablets the page itself scrolls, so the header sticks under the site's top bar (68px there) and the
    // name, calls and menu stay in reach. On desktop the conversation scrolls inside its own box, so it stays put anyway.
    <header className="sticky top-[68px] z-30 -mx-4 mb-4 shrink-0 border-b border-rule bg-paper px-4 pb-3 pt-3 sm:-mx-6 sm:px-6 lg:relative lg:top-auto lg:mx-0 lg:px-0 lg:pt-0" ref={box}>
      {back && <p className="mb-2 text-xs">{back}</p>}
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-ui text-lg font-bold leading-tight text-ink">{title}</p>
          {subtitle && <div className="mt-0.5 text-xs text-slate">{subtitle}</div>}
        </div>
        {actions}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Conversation options" className="flex h-9 w-9 items-center justify-center rounded-full text-crimson hover:bg-paper">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-72 max-w-full overflow-hidden rounded-2xl border border-rule bg-card py-2 shadow-xl">
          {shown.map((i, n) => (
            <div key={`${i.label}-${n}`}>
              {i.divider && n > 0 && <hr className="my-1 border-rule" />}
              {i.href ? (
                <Link role="menuitem" href={i.href} onClick={() => setOpen(false)} className={`${row} ${i.danger ? "text-red-700" : "text-ink"}`}><span aria-hidden className="w-5 text-center">{i.icon}</span>{i.label}</Link>
              ) : (
                <button role="menuitem" type="button" onClick={() => { setOpen(false); i.onClick?.(); }} className={`${row} ${i.danger ? "text-red-700" : "text-ink"}`}><span aria-hidden className="w-5 text-center">{i.icon}</span>{i.label}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
