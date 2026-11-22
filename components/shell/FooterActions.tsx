"use client";

import { useEffect, useState } from "react";
// Ask Nana at the bottom right of the footer, only where Nana's floating chat button isn't on the page (components/NanaChat.tsx); it goes
// to her page. The round Menu button that sat behind Nana is gone (owner, 22 Nov 2026): it only scrolled up to the masthead's own menu.
export const OPEN_NANA = "notesapp:open-nana";
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
  if (floating) return null;
  return (
    <div className="flex items-center gap-3">
      <a href="/nana" onClick={nana} aria-label="Ask Nana" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-paper shadow-lg ring-1 ring-paper/20 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-bright">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/nana/nana-sm.webp" alt="" width={48} height={48} className="h-12 w-12" />
      </a>
    </div>
  );
}
