"use client";

import { canChooseSiteTheme } from "@/lib/site-themes";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { canPublish } from "@/lib/users";
import { useMember } from "@/lib/member-client";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { WALLET_LIVE } from "@/lib/wallet";
import Avatar from "@/components/Avatar";
import { NameBadgeIcons } from "@/components/PersonName";
import { CloseIcon } from "./icons";

type L = { href: string; label: string };

// The phone menu, opened from the picture in the header (members) or ☰ (visitors): the account links the desktop menu has,
// then the rest of the site, which the phone header has no room for.
export default function AccountSheet({ open, onClose, links }: { open: boolean; onClose: () => void; links: L[] }) {
  const { user, profile, unreadDms } = useMember();
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

  const row = "block px-5 py-3 font-ui text-[15px] font-semibold text-ink hover:bg-paper";
  const account: (L & { badge?: number })[] = profile ? [
    { href: `/u/${profile.username}`, label: "My profile" },
    ...(canPublish(profile) ? [{ href: "/write", label: "My journal (write)" }] : []),
    { href: `/u/${profile.username}/store`, label: "My store" },
    ...(MESSAGES_LIVE ? [{ href: "/messages", label: "Messages", badge: unreadDms }] : []),
    { href: "/bookings", label: "Bookings" },
    { href: "/orders", label: "Orders & parcels" },
    ...(canChooseSiteTheme(profile) ? [{ href: "/shipments", label: "Shipments (logistics)" }] : []),
    ...(WALLET_LIVE ? [{ href: "/profile/wallet", label: "Wallet" }] : []),
    { href: "/saved", label: "Saved" },
    { href: "/interests", label: "Your interests" },
    { href: "/invites", label: "Co-author invites" },
    { href: "/boost", label: "Boost a post" },
    { href: "/profile/boosts", label: "Boost performance" },
    ...(profile.accountKind === "organisation" ? [{ href: "/organisation", label: "Organisation setup" }] : []),
    { href: "/advertise/campaigns", label: "My ad campaigns" },
    { href: "/badges", label: "Verification badges" },
    { href: "/profile/edit", label: "Edit profile" },
    { href: "/profile/account", label: "Account (email, username)" },
    { href: "/profile/publishing", label: canPublish(profile) ? "Rates & payouts" : "Start publishing" },
  ] : [];
  const more: L[] = [...links, { href: "/help", label: "Help centre" }, { href: "/contact", label: "Contact" }, { href: "/terms", label: "Terms of Service" }, { href: "/privacy", label: "Privacy Policy" }];

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          {profile ? (
            <Link href={`/u/${profile.username}`} className="flex min-w-0 items-center gap-3">
              <Avatar src={profile.avatar} alt={profile.displayName} size={44} square={profile.accountKind === "organisation"} />
              <span className="min-w-0">
                <span className="flex items-center gap-1 font-ui text-base font-bold text-ink"><span className="truncate">{profile.displayName}</span><NameBadgeIcons username={profile.username} /></span>
                <span className="block truncate font-mono text-xs text-slate">@{profile.username}</span>
              </span>
            </Link>
          ) : <span className="font-ui text-base font-bold text-ink">Menu</span>}
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper"><CloseIcon className="h-5 w-5" /></button>
        </div>
        {user === null && (
          <div className="grid grid-cols-2 gap-3 border-b border-rule p-5">
            <Link href="/login" className="btn-ghost !py-2.5 text-center text-sm">Sign in</Link>
            <Link href="/signup" className="btn-primary !py-2.5 text-center text-sm">Create account</Link>
          </div>
        )}
        {account.length > 0 && (
          <ul className="border-b border-rule py-2">
            {account.map((l) => (
              <li key={l.href}><Link href={l.href} className={`${row} flex items-center justify-between`}>{l.label}{!!l.badge && <span className="rounded-full bg-crimson px-2 py-0.5 font-mono text-[11px] font-bold text-paper">{l.badge}</span>}</Link></li>
            ))}
          </ul>
        )}
        <p className="px-5 pt-4 font-mono text-[11px] uppercase tracking-eyebrow text-slate">#NotesApp</p>
        <ul className="py-2">{more.map((l) => <li key={l.href}><Link href={l.href} className={row}>{l.label}</Link></li>)}</ul>
        {user && <button type="button" onClick={() => { signOut(auth); onClose(); }} className={`${row} mt-auto w-full border-t border-rule text-left text-crimson`}>Sign out</button>}
      </div>
    </div>
  );
}
