"use client";

import ThemeSwitch from "@/components/theme/ThemeSwitch";
import { WALLET_LIVE } from "@/lib/wallet";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { getUserByUid, canPublish, UserProfile } from "@/lib/users";
import NotificationBell from "@/components/NotificationBell";
import Avatar from "@/components/Avatar";
import { MESSAGES_LIVE } from "@/lib/moments-rules";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useGoLive } from "@/components/lives/useGoLive";
import { useCycleMenu } from "@/lib/cycle-client";
import { useCalendarToday } from "@/components/calendar/useCalendarToday";
import MenuGroupList from "@/components/MenuGroupList";
import { accountMenu } from "@/lib/account-menu";

// `onDark`: the desktop masthead is crimson, so the links and buttons are drawn light there. `compact` (the app header):
// the bell in a soft circle and the picture opens the menu, without the @username.
export default function AuthNav({ onDark = false, compact = false }: { onDark?: boolean; compact?: boolean }) {
  const goLive = useGoLive(); // 🔴 Go live: team accounts while the staff test pass is on (Admin → Limits)
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [unreadDms, setUnreadDms] = useState(0);
  const cycle = useCycleMenu(user, profile?.accountKind === "organisation"); // My Cycle: hidden for "Not for me", child profiles and organisations
  const calToday = useCalendarToday(user); // My Calendar: today's count; -1 for a child profile, which has no calendar

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setProfile(u ? await getUserByUid(u.uid) : null);
    });
  }, []);

  // The number beside "Messages", live while signed in (only when messaging is switched on).
  useEffect(() => {
    if (!MESSAGES_LIVE || !user) return;
    const uid = user.uid;
    return onSnapshot(
      query(collection(db, "conversations"), where("participants", "array-contains", uid)),
      (snap) => setUnreadDms(snap.docs.reduce((n, d) => n + ((d.data().unread?.[uid] as number | undefined) ?? 0), 0)),
      () => {}
    );
  }, [user]);

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

  const item = "block px-4 py-2 text-left font-ui text-xs normal-case text-ink hover:bg-paper hover:text-crimson-bright";

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
          <div role="menu" className="absolute right-0 z-50 mt-2 max-h-[80vh] w-64 overflow-y-auto border border-rule bg-card py-1 shadow-lg" onClick={() => setOpen(false)}>
            <MenuGroupList
              links={accountMenu({ username: profile?.username, canPublish: !!profile && canPublish(profile), organisation: profile?.accountKind === "organisation", messages: MESSAGES_LIVE, wallet: WALLET_LIVE, cycle: !!cycle, calendar: calToday !== -1, goLive: !!profile && !!goLive })}
              storageKey="account"
              role="menuitem"
              itemClass={item}
              headerClass="border-t border-rule px-4 py-2 font-mono text-[10px] uppercase tracking-eyebrow text-slate hover:text-crimson"
              extra={(l) =>
                l.href === "/calendar" && !!calToday && calToday > 0 ? <span className="rounded-full bg-crimson/10 px-1.5 py-0.5 text-[10px] font-bold text-crimson">{calToday} today</span>
                : l.href === "/messages" && unreadDms > 0 ? <span className="rounded-full bg-crimson px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadDms}</span>
                : null}
            />
            <div className="border-t border-rule px-3 py-2"><ThemeSwitch compact /></div>
            <button onClick={() => signOut(auth)} className={`${item} w-full border-t border-rule`}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
