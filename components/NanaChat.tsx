"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NANA_NAME } from "@/lib/nana";
import NanaPanel from "./NanaPanel";
import { useBottomTabs } from "@/components/shell/BottomTabs";
import { NANA_FLOATING, OPEN_NANA } from "@/components/shell/FooterActions";

// The Nana AI button in the corner of every page; it opens the chat. Hidden in the admin area (the team hub has its own Nana) and on the
// pages where Nana is already on screen (her own page, and Messages, where she is pinned at the top of the list).
export default function NanaChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = useBottomTabs();
  // The footer's Ask Nana button opens this chat (components/shell/FooterActions.tsx); where the chat isn't shown, it goes to /nana.
  // Hidden where the page fills the screen with its own controls: the studio (its Leave button), the Notes Live feed and a live.
  const hidden = pathname.startsWith("/admin") || pathname === "/nana" || pathname === "/cycle" || pathname === "/messages" || pathname.startsWith("/messages/")
    || pathname === "/studio" || pathname === "/lives" || pathname.startsWith("/live/");
  useEffect(() => {
    const w = window as unknown as { __nanaChat?: boolean };
    w.__nanaChat = !hidden;
    window.dispatchEvent(new Event(NANA_FLOATING));
    const show = () => setOpen(true);
    window.addEventListener(OPEN_NANA, show);
    return () => { window.removeEventListener(OPEN_NANA, show); w.__nanaChat = false; window.dispatchEvent(new Event(NANA_FLOATING)); };
  }, [hidden]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  // Messages has Nana pinned at the top of the list, and the button would sit on the composer's Send.
  // My Cycle has its own private Nana, kept apart from this one.
  if (hidden) return null;
  // On a phone the button sits above the tab bar, on the left (the write button is on the right).
  const spot = tabs ? "bottom-[5.25rem] left-4 lg:left-auto" : "bottom-4";
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Ask ${NANA_NAME}`} className={`nana-fab fixed ${spot} z-40 flex items-center gap-2 rounded-full border border-rule bg-card py-1.5 pl-1.5 pr-1.5 shadow-lg transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson lg:right-6 lg:bottom-6 lg:pr-4 ${tabs ? "" : "right-4 sm:bottom-6 sm:right-6 sm:pr-4"}`}>
          <Image src="/images/nana/nana-sm.webp" alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
          <span className={`hidden font-ui text-sm font-bold text-ink ${tabs ? "lg:inline" : "sm:inline"}`}>Ask Nana</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-label={NANA_NAME} className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-rule bg-paper shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[390px] sm:rounded-2xl">
          <NanaPanel context="site" onClose={() => setOpen(false)} className="h-full" />
        </div>
      )}
    </>
  );
}
