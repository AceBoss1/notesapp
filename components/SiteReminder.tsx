"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { effectiveTier, getUserByUid, type UserProfile } from "@/lib/users";
import { meetsTier } from "@/lib/site-themes";
import { missingSitePages, type SitePageId } from "@/lib/site-settings";

// "Your site has no About page yet": what's missing, in words.
export function missingPagesText(missing: SitePageId[]): string {
  if (missing.length === 2) return "Your site has no About or Contact page yet.";
  return `Your site has no ${missing[0] === "about" ? "About" : "Contact"} page yet.`;
}

// Business and Enterprise members who haven't written their site's About or Contact page: a small card that says which, with
// a button to /profile/site. Closing it hides it on this browser until something else is missing. Pass `profile` when the
// page already has it; otherwise it reads the signed-in member's own.
export default function SiteReminder({ profile, className = "" }: { profile?: UserProfile | null; className?: string }) {
  const [p, setP] = useState<UserProfile | null | undefined>(profile);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (profile !== undefined) { setP(profile); return; }
    return onAuthStateChanged(auth, (u) => { if (u) getUserByUid(u.uid).then(setP).catch(() => setP(null)); else setP(null); });
  }, [profile]);

  // Business and Enterprise, whose site is their business's own website (Free Basic and Pro sites aren't nagged about it).
  const missing = p && meetsTier(effectiveTier(p), "business") ? missingSitePages(p) : [];
  const key = p ? `notesapp:site-reminder:${p.uid}:${missing.join(",")}` : "";
  useEffect(() => {
    if (!key || missing.length === 0) return;
    try { setHidden(localStorage.getItem(key) === "1"); } catch { setHidden(false); }
  }, [key, missing.length]);

  if (!p || missing.length === 0 || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(key, "1"); } catch {}
  };
  return (
    <aside className={`card relative border-l-4 border-crimson p-5 ${className}`} aria-label="Your site">
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-1 px-2 text-xl leading-none text-slate hover:text-ink">×</button>
      <p className="pr-6 font-ui text-sm font-bold text-ink">{missingPagesText(missing)}</p>
      <p className="mt-1 text-sm text-slate">Visitors to your site look for who you are and how to reach you. Write {missing.length === 2 ? "them" : "it"} with the same editor as your journals; {missing.length === 2 ? "each page" : "it"} appears in your site&apos;s menu once saved.</p>
      <Link href="/profile/site" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">{missing.length === 2 ? "Write your About and Contact pages" : `Write your ${missing[0] === "about" ? "About" : "Contact"} page`}</Link>
    </aside>
  );
}
