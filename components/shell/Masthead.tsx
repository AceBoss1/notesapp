"use client";

import ThemeQuick from "@/components/theme/ThemeQuick";
import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import NavLinks from "@/components/NavLinks";
import AuthNav from "@/components/AuthNav";
import SearchBar from "@/components/SearchBar";
import NotificationBell from "@/components/NotificationBell";
import Avatar from "@/components/Avatar";
import { useMember } from "@/lib/member-client";
import { isThreadRoute, usesAppFrame } from "@/lib/chrome";
import AccountSheet from "./AccountSheet";
import { MenuIcon, PenIcon } from "./icons";

type L = { href: string; label: string };
const GRADIENT = { backgroundImage: "linear-gradient(100deg, #4E0119 0%, #7A0328 60%, #A6093D 100%)" };
const Logo = ({ wordmark = true }: { wordmark?: boolean }) => (
  <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="#NotesApp home">
    <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={36} height={36} className="h-9 w-9 rounded-lg" />
    {wordmark && <span className="font-ui text-xl font-extrabold tracking-tight text-paper">Notes<span className="text-[#FFB3C6]">App</span></span>}
  </Link>
);

// The masthead (Moda redesign, October 2026).
// Phones: one light bar on every page, as on the journal feed: the mark, a search pill, then the bell and your picture (it opens the
// menu), or Sign in and ☰ for visitors. Gone in an open conversation, which has its own header.
// Computers: the feed pages (and the app address) get the app header (wide search, Write, bell, picture); every other page keeps
// the site masthead with its links.
export default function Masthead({ links, appLinks }: { links: L[]; appLinks: L[] }) {
  const pathname = usePathname();
  const { user, profile, appHost } = useMember();
  const [sheet, setSheet] = useState(false);
  const close = useCallback(() => setSheet(false), []);
  const app = usesAppFrame(pathname, appHost);

  return (
    <header className={`sticky top-0 z-40 ${isThreadRoute(pathname) ? "max-lg:hidden" : ""}`}>
      {/* Phones and small tablets */}
      <div className="border-b border-rule bg-card lg:hidden">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Link href="/" className="shrink-0" aria-label="#NotesApp home">
            <Image src="/images/brand/notesapp-icon.webp" alt="#NotesApp" width={40} height={40} className="h-10 w-10 rounded-xl" />
          </Link>
          <SearchBar className="min-w-0 flex-1" placeholder="Search journals, people, #topics"
            inputClassName="w-full rounded-full border border-transparent bg-field px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-slate/80 outline-none focus:border-crimson focus:bg-card" />
          <ThemeQuick className="bg-field text-crimson" />
          {user ? (
            <>
              <NotificationBell user={user} buttonClassName="relative flex h-10 w-10 items-center justify-center rounded-full bg-field text-lg" panelClassName="fixed inset-x-3 top-[4.25rem]" />
              <button type="button" onClick={() => setSheet(true)} aria-label="Open menu" aria-expanded={sheet} className="shrink-0 rounded-full">
                {profile ? <Avatar src={profile.avatar} alt={profile.displayName} size={40} square={profile.accountKind === "organisation"} /> : <span className="block h-10 w-10 rounded-full bg-crimson" />}
              </button>
            </>
          ) : user === null ? (
            <>
              <Link href="/login" className="shrink-0 rounded-full bg-crimson px-4 py-2 font-ui text-sm font-bold text-paper">Sign in</Link>
              <button type="button" onClick={() => setSheet(true)} aria-label="Open menu" aria-expanded={sheet} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink"><MenuIcon /></button>
            </>
          ) : <span className="h-10 w-[5.5rem] shrink-0" />}
        </div>
      </div>
      <AccountSheet open={sheet} onClose={close} links={appHost ? appLinks : links} />

      {/* Computers */}
      <div className="hidden text-paper shadow-md lg:block" style={GRADIENT}>
        {app ? (
          <div className="mx-auto flex max-w-[90rem] items-center gap-6 px-8 py-3.5">
            <div className="w-[15rem] shrink-0"><Logo /></div>
            <SearchBar className="min-w-0 max-w-2xl flex-1" placeholder="Search journals, people, #topics…"
              inputClassName="w-full rounded-full bg-card px-6 py-3 text-center font-body text-sm text-ink placeholder:text-slate outline-none focus:text-left focus:ring-2 focus:ring-paper/60" />
            <ThemeQuick className="ml-auto bg-paper/15 text-paper hover:bg-paper/25" />
            {user ? (
              <>
                <Link href="/write/new" className="flex shrink-0 items-center gap-2 rounded-full bg-card px-8 py-2.5 font-ui text-sm font-bold text-crimson hover:bg-paper"><PenIcon className="h-4 w-4" /> Write</Link>
                <AuthNav onDark compact />
              </>
            ) : <div className="shrink-0 font-ui text-sm font-semibold"><AuthNav onDark /></div>}
          </div>
        ) : (
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-4">
            <Logo />
            <nav className="flex items-center gap-5 font-ui text-sm font-semibold text-paper xl:gap-7">
              <NavLinks links={links} appLinks={appLinks} />
              <SearchBar className="w-full max-w-[15rem]" />
              <ThemeQuick className="bg-paper/15 text-paper hover:bg-paper/25" />
              <span className="h-4 w-px bg-paper/30" />
              <AuthNav onDark />
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
