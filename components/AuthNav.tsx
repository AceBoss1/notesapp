"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, UserProfile } from "@/lib/users";
import NotificationBell from "@/components/NotificationBell";
import AccountMenu from "@/components/shell/AccountMenu";
import Avatar from "@/components/Avatar";

// `onDark`: the desktop masthead is crimson, so the links and buttons are drawn light there. `compact` (the app header):
// the bell in a soft circle and the picture opens the menu, without the @username.
export default function AuthNav({ onDark = false, compact = false }: { onDark?: boolean; compact?: boolean }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setProfile(u ? await getUserByUid(u.uid) : null);
    });
  }, []);


  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (user === undefined) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className={`whitespace-nowrap ${onDark ? "rounded-full border border-paper/50 px-4 py-1.5 text-paper hover:bg-paper/10" : "text-ink hover:text-crimson-bright"}`}>
          Sign In
        </Link>
        <Link
          href="/signup"
          className={`whitespace-nowrap ${onDark ? "rounded-full bg-paper px-4 py-1.5 text-crimson-deep hover:opacity-90" : "bg-ink text-paper px-4 py-1.5 hover:bg-crimson-deep transition-colors"}`}
        >
          {onDark ? "Create account" : "Sign Up"}
        </Link>
      </div>
    );
  }


  return (
    <div className="flex items-center gap-4">
      <NotificationBell user={user} buttonClassName={onDark ? "relative flex h-10 w-10 items-center justify-center rounded-full bg-paper/15 text-paper hover:bg-paper/25" : undefined} />
      {profile && !compact && (
        <Link href={`/u/${profile.username}`} aria-label="My profile" title="My profile" className="flex">
          <Avatar src={profile.avatar} alt={profile.displayName} size={28} square={profile.accountKind === "organisation"} />
        </Link>
      )}
      <div className="relative" ref={menuRef}>
        {compact ? (
          <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="flex rounded-full ring-2 ring-paper/40">
            {profile ? <Avatar src={profile.avatar} alt={profile.displayName} size={40} square={profile.accountKind === "organisation"} /> : <span className="h-10 w-10 rounded-full bg-paper/20" />}
          </button>
        ) : (
          <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={`font-mono ${onDark ? "rounded-full bg-paper/15 px-4 py-2 text-paper hover:bg-paper/25" : "text-crimson-bright"}`}>
            <span className="inline-block max-w-[10rem] truncate align-bottom">{profile ? `@${profile.username}` : "Account"}</span> ▾
          </button>
        )}
        {open && (
          // The account menu (lib/account-menu.ts), the same one the phone sheet shows.
          <div role="menu" className="absolute right-0 z-50 mt-2 max-h-[min(80vh,46rem)] w-[23rem] overflow-y-auto rounded-2xl border border-rule bg-paper text-left normal-case shadow-2xl">
            <AccountMenu onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
