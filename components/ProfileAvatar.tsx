"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/moments-client";
import { MESSAGES_LIVE, MOMENTS_LIVE } from "@/lib/moments-rules";
import type { MomentView } from "@/lib/moments-server";
import Avatar from "@/components/Avatar";
import MomentViewer from "@/components/moments/MomentViewer";

// A member's picture that asks what you want to do when you tap it, depending on where you are: see their profile, watch their moments
// (only if they have one up that you're allowed to see), and, away from a conversation, send them a message. Signed out, or on
// your own picture, it just goes to the profile.
export default function ProfileAvatar({ username, src, alt, size, square = false, from, className = "" }: {
  username: string; src: string; alt: string; size: number; square?: boolean; from: "chat" | "journal" | "comment"; className?: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [viewing, setViewing] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const profileHref = `/u/${username}`;
  if (!user) return <Link href={profileHref} className={`flex-shrink-0 ${className}`}><Avatar src={src} alt={alt} size={size} square={square} /></Link>;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && MOMENTS_LIVE && moments === null) api<{ moments: MomentView[] }>(`/api/moments?username=${encodeURIComponent(username)}`).then((r) => setMoments(r.moments)).catch(() => setMoments([]));
  }
  const hasMoments = !!moments && moments.length > 0;
  const item = "block w-full px-4 py-2 text-left font-ui text-xs text-ink hover:bg-paper hover:text-crimson-bright";
  return (
    <span className={`relative flex-shrink-0 ${className}`} ref={box}>
      <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label={`${alt}: profile, moments and more`} className="block">
        <Avatar src={src} alt={alt} size={size} square={square} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-44 border border-rule bg-card py-1 text-left shadow-lg" onClick={() => setOpen(false)}>
          <Link href={profileHref} className={item} role="menuitem">👤 View profile</Link>
          {hasMoments && <button type="button" className={item} role="menuitem" onClick={() => setViewing(true)}>◎ View moments</button>}
          {from !== "chat" && MESSAGES_LIVE && <Link href={`/messages/new?to=${encodeURIComponent(username)}`} className={item} role="menuitem">💬 Send a message</Link>}
        </div>
      )}
      {viewing && moments && <MomentViewer moments={moments} onClose={() => setViewing(false)} />}
    </span>
  );
}
