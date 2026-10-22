"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LIFE_LIVE } from "@/lib/life/catalog";

// "🎮 Plays Notes Life" on a member's profile, store and course page. Only for a signed-in viewer who follows them and is followed
// back, when they keep "Show that I play Notes Life" on, and never in teen mode (checked by the server, /api/life/social). It opens the
// game with them as the inviter.
export default function PlaysLife({ uid, className = "" }: { uid: string | null | undefined; className?: string }) {
  const [who, setWho] = useState<string | null>(null);
  useEffect(() => {
    if (!LIFE_LIVE || !uid) return;
    return onAuthStateChanged(auth, async (u) => {
      if (!u || u.uid === uid) return setWho(null);
      const token = await u.getIdToken().catch(() => undefined);
      fetch(`/api/life/social?uid=${encodeURIComponent(uid)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => (r.ok ? r.json() : null)).then((d) => setWho(d?.plays ? String(d.username) : null)).catch(() => undefined);
    });
  }, [uid]);
  if (!who) return null;
  return (
    <a href={`/life?ref=${encodeURIComponent(who)}`} className={`inline-flex items-center gap-1 rounded-full bg-crimson/10 px-2.5 py-0.5 font-ui text-xs font-semibold text-crimson hover:bg-crimson/15 ${className}`}>
      🎮 Plays Notes Life
    </a>
  );
}
