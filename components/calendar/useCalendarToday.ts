"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isKidUid } from "@/lib/kids";

// How many things a member has today, for the number beside "📅 My Calendar" in the menus. Kept for 10 minutes in this tab, so opening
// the menu doesn't read every source each time. null while unknown; a child profile has no calendar (-1 hides the entry).
const KEY = (uid: string) => `myCalToday:${uid}`;
export function useCalendarToday(user: User | null | undefined): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!user) { setN(null); return; }
    if (isKidUid(user.uid)) { setN(-1); return; }
    let live = true;
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY(user.uid)) || "null") as { n: number; at: number } | null;
      if (v && Date.now() - v.at < 10 * 60_000) { setN(v.n); return; }
    } catch { /* private mode */ }
    user.getIdToken().then((t) => fetch("/api/calendar?count=today", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }))
      .then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (!live || !j || typeof j.count !== "number") return;
        setN(j.count);
        try { sessionStorage.setItem(KEY(user.uid), JSON.stringify({ n: j.count, at: Date.now() })); } catch { /* private mode */ }
      }).catch(() => {});
    return () => { live = false; };
  }, [user]);
  return n;
}
