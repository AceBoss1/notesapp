"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AccountMenu from "./AccountMenu";
import { CloseIcon } from "./icons";

type L = { href: string; label: string };

// The phone menu, opened from the picture in the header (members) or ☰ (visitors): the account menu (lib/account-menu.ts,
// ./AccountMenu.tsx), the same one the computer's menu shows, with the site's own links under "More from #NotesApp".
export default function AccountSheet({ open, onClose, links }: { open: boolean; onClose: () => void; links: L[] }) {
  const pathname = usePathname();
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="absolute inset-y-0 right-0 flex w-[min(24rem,92vw)] flex-col overflow-y-auto bg-paper pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <p className="font-display text-2xl text-ink">Menu</p>
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-ink hover:bg-rule"><CloseIcon className="h-5 w-5" /></button>
        </div>
        <AccountMenu onNavigate={onClose} siteLinks={links} />
      </div>
    </div>
  );
}
