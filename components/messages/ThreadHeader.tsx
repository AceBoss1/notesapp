"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronIcon, DotsIcon } from "./icons";

export type MenuItem = { label: string; icon?: string; href?: string; onClick?: () => void; danger?: boolean; hidden?: boolean; divider?: boolean };

// The round buttons on the right of the header (calls, the menu): plain icons on a phone, outlined circles on desktop.
export const HEADER_BUTTON = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-crimson hover:bg-paper lg:h-11 lg:w-11 lg:border lg:border-rule lg:bg-card";

// The top of an open conversation: the picture, the name (with badges beside it), a line under it (handle and online status, or
// "Group · 12 members"), and a button that opens a menu of what you can do with this conversation. `back` is where ‹ goes; without
// it (a conversation shown inside another page) there is no back link.
export default function ThreadHeader({ back, avatar, title, subtitle, items, actions }: { back?: string; avatar: ReactNode; title: ReactNode; subtitle?: ReactNode; items: MenuItem[]; actions?: ReactNode }) {
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
    // A full-screen conversation on a phone has no site bar above it, so the header sits at the very top (below the notch). Shown
    // inside another page, it sticks under that page's top bar (68px on phones). On desktop it stays at the top of its card.
    <header className={`z-30 shrink-0 border-b border-rule bg-card lg:relative lg:top-auto lg:rounded-t-xl2 ${back ? "sticky top-0 pt-[env(safe-area-inset-top)] lg:pt-0" : "sticky top-[68px] rounded-t-xl2"}`} ref={box}>
      {back && <Link href={back} className="hidden px-7 pt-5 font-ui text-xs font-semibold text-crimson hover:underline lg:inline-block">← Messages</Link>}
      <div className={`flex items-center gap-3 py-2.5 pr-2 lg:px-7 lg:pb-4 ${back ? "pl-1 lg:pt-2" : "pl-4 lg:pt-5"}`}>
        {back && <Link href={back} aria-label="Back to Messages" className="flex h-10 w-8 shrink-0 items-center justify-center text-ink lg:hidden"><ChevronIcon size={22} dir="left" /></Link>}
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-ui text-[17px] font-bold leading-tight text-ink lg:font-display lg:text-[1.7rem] lg:font-normal">{title}</p>
          {subtitle && <div className="mt-0.5 truncate font-ui text-[13px] text-slate lg:mt-1 lg:text-xs">{subtitle}</div>}
        </div>
        {actions}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Conversation options" className={`${HEADER_BUTTON} !text-ink lg:!text-crimson`}>
          <DotsIcon size={22} className="lg:hidden" />
          <ChevronIcon size={18} className={`hidden transition-transform lg:block ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-2 top-full z-30 mt-1 w-72 max-w-[calc(100%-1rem)] overflow-hidden rounded-2xl border border-rule bg-card py-2 shadow-xl lg:right-7">
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
