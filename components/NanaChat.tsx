"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NANA_NAME } from "@/lib/nana";
import NanaPanel from "./NanaPanel";
import { useBottomTabs } from "@/components/shell/BottomTabs";

// The Nana AI button in the corner of every page; it opens the chat. Hidden in the admin area (the team hub has its own Nana) and on the
// pages where Nana is already on screen (her own page, and Messages, where she is pinned at the top of the list).
export default function NanaChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = useBottomTabs();
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  // Messages has Nana pinned at the top of the list, and the button would sit on the composer's Send.
  if (pathname.startsWith("/admin") || pathname === "/nana" || pathname === "/messages" || pathname.startsWith("/messages/")) return null;
  // On a phone the button sits above the tab bar, on the left (the write button is on the right).
  const spot = tabs ? "bottom-[5.25rem] left-4 lg:left-auto" : "bottom-4";
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Ask ${NANA_NAME}`} className={`fixed ${spot} z-40 flex items-center gap-2 rounded-full border border-rule bg-card py-1.5 pl-1.5 pr-1.5 shadow-lg transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson lg:right-6 lg:bottom-6 lg:pr-4 ${tabs ? "" : "right-4 sm:bottom-6 sm:right-6 sm:pr-4"}`}>
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
