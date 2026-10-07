"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserByUid, canPublish, UserProfile } from "@/lib/users";
import NotificationBell from "@/components/NotificationBell";
import Avatar from "@/components/Avatar";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export default function AuthNav() {
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
        <Link href="/login" className="text-ink hover:text-crimson-bright">
          Sign In
        </Link>
        <Link
          href="/signup"
          className="bg-ink text-paper px-4 py-1.5 hover:bg-crimson-deep transition-colors"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  const item = "block px-4 py-2 text-left font-ui text-xs normal-case text-ink hover:bg-paper hover:text-crimson-bright";

  return (
    <div className="flex items-center gap-4">
      <NotificationBell user={user} />
      {profile && (
        <Link href={`/u/${profile.username}`} aria-label="My profile" title="My profile" className="flex">
          <Avatar src={profile.avatar} alt={profile.displayName} size={28} />
        </Link>
      )}
      <div className="relative" ref={menuRef}>
        <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="font-mono text-crimson-bright">
          {profile ? `@${profile.username}` : "Account"} ▾
        </button>
        {open && (
          <div role="menu" className="absolute right-0 z-50 mt-2 w-52 border border-rule bg-card py-1 shadow-lg" onClick={() => setOpen(false)}>
            {profile && <Link href={`/u/${profile.username}`} className={item}>My profile</Link>}
            {profile && canPublish(profile) && <Link href="/write" className={item}>My journal (write)</Link>}
            <Link href="/profile/edit" className={item}>Edit profile</Link>
            <Link href="/profile/account" className={item}>Account (email, username)</Link>
            <Link href="/profile/publishing" className={item}>
              {profile && canPublish(profile) ? "Rates & payouts" : "Start publishing"}
            </Link>
            {profile && <Link href={`/u/${profile.username}/store`} className={item}>My store</Link>}
            {profile && <Link href="/invites" className={item}>Co-author invites</Link>}
            {MESSAGES_LIVE && <Link href="/messages" className={item}>Messages</Link>}
            <Link href="/bookings" className={item}>Bookings</Link>
            <Link href="/orders" className={item}>Orders &amp; parcels</Link>
            <Link href="/boost" className={item}>Boost a post</Link>
            <Link href="/profile/boosts" className={item}>Boost performance</Link>
            {profile?.accountKind === "organisation" && <Link href="/organisation" className={item}>Organisation setup</Link>}
            <Link href="/advertise/campaigns" className={item}>My ad campaigns</Link>
            <Link href="/badges" className={item}>Verification badges</Link>
            <button onClick={() => signOut(auth)} className={`${item} w-full border-t border-rule`}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
