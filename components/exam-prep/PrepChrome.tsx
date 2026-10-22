"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AFFILIATION, PREP_NAME } from "@/lib/exam-prep";
import { useMe, useOnline, usePrepHref } from "@/lib/exam-prep-client";
import { PLink } from "./ui";

const PREP_COLOURS = { "--c-crimson": "30 142 90", "--c-crimson-bright": "30 142 90", "--c-crimson-deep": "24 122 77", "--c-ink": "15 39 71", "--c-paper": "255 255 255", "--c-card": "255 255 255", "--c-rule": "221 227 234", "--c-slate": "77 92 112" } as React.CSSProperties;

// Header and footer of every Exam Prep page. The service worker is registered here so saved packs open with no connection.
export default function PrepChrome({ mainUrl, children }: { mainUrl: string; children: React.ReactNode }) {
  const me = useMe();
  const online = useOnline();
  const h = usePrepHref();
  const path = usePathname();
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  const nav = [{ href: "/", label: "Exams" }, { href: "/progress", label: "Progress" }, { href: "/saved", label: "Saved" }];
  const here = (p: string) => (p === "/" ? path === h("/") || path === "/" : path.startsWith(h(p)));
  return (
    // NotesApp's shared pieces inside Exam Prep (the sign-in and sign-up forms) take its colours: green where NotesApp is crimson,
    // navy text, white fields (tailwind.config.ts reads these variables).
    <div style={PREP_COLOURS} className="flex min-h-screen flex-col bg-[#FBF8F2] text-[#0F2747]">
      <header className="sticky top-0 z-30 border-b border-[#0F2747]/10 bg-[#0F2747] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <PLink href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small SVG, no optimising needed */}
            <img src="/images/exam-prep/logo.svg" alt="" width={34} height={34} className="h-[34px] w-[34px]" />
            <span className="font-display text-[17px] font-bold leading-tight">{PREP_NAME}</span>
          </PLink>
          <a href={mainUrl} className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80 hover:bg-white/20 sm:inline">by NotesApp</a>
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {nav.map((n) => <PLink key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm font-semibold ${here(n.href) ? "bg-white/15" : "text-white/80 hover:bg-white/10"}`}>{n.label}</PLink>)}
          </nav>
          <div className="ml-auto sm:ml-2">
            {me === undefined ? null : me ? (
              <button onClick={() => signOut(auth)} className="rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">Sign out</button>
            ) : (
              <PLink href={`/signin?next=${encodeURIComponent(path || "/")}`} className="rounded-lg bg-[#1E8E5A] px-3 py-2 text-sm font-semibold">Sign in</PLink>
            )}
          </div>
        </div>
        {!online && <div className="bg-[#C9A227] px-4 py-1.5 text-center text-xs font-semibold text-[#0F2747]">You're offline. Saved packs still work; progress syncs when you're back.</div>}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 sm:pb-10">{children}</main>
      <footer className="border-t border-[#0F2747]/10 px-4 pb-24 pt-6 text-xs text-[#0F2747]/70 sm:pb-6">
        <div className="mx-auto max-w-5xl space-y-2">
          <p>{AFFILIATION}</p>
          <p>
            {PREP_NAME} is part of <a className="underline" href={mainUrl}>NotesApp</a> by <a className="underline" href="https://adams.com.ng" target="_blank" rel="noopener">Adams Consults</a>. ·{" "}
            <a className="underline" href={`${mainUrl}/terms`}>Terms</a> · <a className="underline" href={`${mainUrl}/privacy`}>Privacy</a>
          </p>
        </div>
      </footer>
      {/* Phone: the three places at the bottom, thumb height */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#0F2747]/10 bg-white sm:hidden">
        {nav.map((n) => <PLink key={n.href} href={n.href} className={`py-3 text-center text-[13px] font-semibold ${here(n.href) ? "text-[#1E8E5A]" : "text-[#0F2747]/70"}`}>{n.label}</PLink>)}
      </nav>
    </div>
  );
}
