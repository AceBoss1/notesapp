"use client";

// The campus programme in the browser (lib/campus.ts): who you are in it, and calls to /api/campus. UI only: the server decides.
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useMember } from "./member-client";
import type { CampusMember } from "./campus";

export type CampusMe = { lead: boolean; member: CampusMember | null; coordinator: { name: string; username: string } | null };

export async function campusCall<T>(user: User, init: { view?: string; query?: Record<string, string | undefined>; body?: Record<string, unknown> }): Promise<T> {
  const q = new URLSearchParams();
  if (init.view) q.set("view", init.view);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v) q.set(k, v);
  const r = await fetch(`/api/campus${init.body ? "" : `?${q}`}`, {
    method: init.body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j as T;
}

// Who you are in the campus programme: null while loading, { lead: false, member: null } when you're not in it. Kept for ten minutes in
// this tab so the menus don't ask on every page.
const KEY = (uid: string) => `notesapp:campus-me:${uid}`;
export function useCampusMe(): { user: User | null | undefined; me: CampusMe | null; refresh: () => void } {
  const { user } = useMember();
  const [me, setMe] = useState<CampusMe | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!user) { setMe(user === null ? { lead: false, member: null, coordinator: null } : null); return; }
    let live = true;
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY(user.uid)) ?? "null") as { at: number; me: CampusMe } | null;
      if (c && Date.now() - c.at < 600_000 && !tick) { setMe(c.me); return; }
    } catch { /* no storage */ }
    campusCall<CampusMe>(user, { view: "me" })
      .catch(() => ({ lead: false, member: null, coordinator: null }))
      .then((m) => { if (!live) return; setMe(m); try { sessionStorage.setItem(KEY(user.uid), JSON.stringify({ at: Date.now(), me: m })); } catch { /* no storage */ } });
    return () => { live = false; };
  }, [user, tick]);
  return { user, me, refresh: () => setTick((t) => t + 1) };
}
