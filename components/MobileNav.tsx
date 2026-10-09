"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNav from "@/components/AuthNav";
import SearchBar from "@/components/SearchBar";
import { useIsAppHost } from "@/lib/use-app-host";

// The masthead navigation on phones and small tablets (the desktop row is hidden below the md breakpoint): a Menu button that opens the
// same links, search and sign-in / account controls the desktop masthead has.
export default function MobileNav({ links, appLinks }: { links: { href: string; label: string }[]; appLinks?: { href: string; label: string }[] }) {
  const app = useIsAppHost();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]); // going to a page closes the menu

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="btn-primary flex items-center gap-2"
      >
        <span aria-hidden className="text-lg leading-none">{open ? "✕" : "☰"}</span> Menu
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Main" className="absolute inset-x-0 top-full max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b border-rule bg-paper px-4 pb-6 pt-2 shadow-lg">
          <ul className="divide-y divide-rule font-ui text-base font-semibold text-ink">
            {(app && appLinks ? appLinks : links).map((l) => (
              <li key={l.href}><Link href={l.href} className="block py-3 hover:text-crimson">{l.label}</Link></li>
            ))}
          </ul>
          <div className="mt-4 text-sm"><SearchBar /></div>
          <div className="mt-4 border-t border-rule pt-4 font-ui text-sm font-semibold"><AuthNav /></div>
        </nav>
      )}
    </div>
  );
}
