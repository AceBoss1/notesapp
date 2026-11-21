"use client";

import { useEffect, useState } from "react";
// The round buttons at the bottom right of the footer (owner, 19 Nov 2026, after ContiSX's footer): Menu, which opens the masthead's menu
// (components/shell/Masthead.tsx), with Nana beside it. Where Nana's floating chat button is already on the page (components/NanaChat.tsx)
// it sits just above, so the footer shows only Menu; where it isn't, the footer's own Ask Nana goes to her page.
export const OPEN_NANA = "notesapp:open-nana";
export const OPEN_MENU = "notesapp:open-menu";
export const NANA_FLOATING = "notesapp:nana-floating";

export default function FooterActions() {
  const [floating, setFloating] = useState(true);
  // Nana's chat button mounts after the footer, so check once it has had its turn, and again whenever it says it changed.
  useEffect(() => {
    const check = () => setFloating(!!(window as unknown as { __nanaChat?: boolean }).__nanaChat);
    const t = setTimeout(check, 0);
    window.addEventListener(NANA_FLOATING, check);
    return () => { clearTimeout(t); window.removeEventListener(NANA_FLOATING, check); };
  }, []);
  const nana = (e: React.MouseEvent) => {
    if ((window as unknown as { __nanaChat?: boolean }).__nanaChat) { e.preventDefault(); window.dispatchEvent(new Event(OPEN_NANA)); }
  };
  const menu = () => { window.scrollTo({ top: 0, behavior: "smooth" }); window.dispatchEvent(new Event(OPEN_MENU)); };
  return (
    <div className="flex items-center gap-3">
      {!floating && <a href="/nana" onClick={nana} aria-label="Ask Nana" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-paper shadow-lg ring-1 ring-paper/20 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-bright">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/nana/nana-sm.webp" alt="" width={48} height={48} className="h-12 w-12" />
      </a>}
      <button type="button" onClick={menu} aria-label="Open menu" className="flex h-12 w-12 items-center justify-center rounded-full bg-crimson-bright text-paper shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-paper">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>
      </button>
    </div>
  );
}
