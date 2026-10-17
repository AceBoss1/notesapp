"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./moments-client";

// The signed-in member's interests (topic slugs, lib/topics.ts), shared by the picker and the feed in this tab.
// null while unknown or signed out.
let cached: string[] | null = null;
const listeners = new Set<(v: string[] | null) => void>();
export async function saveInterests(list: string[]): Promise<string[]> {
  const r = await api<{ interests: string[] }>("/api/account/interests", { body: { interests: list } });
  cached = r.interests;
  listeners.forEach((f) => f(cached));
  return r.interests;
}
export function useInterests(): { interests: string[] | null; signedIn: boolean } {
  const [interests, setInterests] = useState<string[] | null>(cached);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    listeners.add(setInterests);
    const off = onAuthStateChanged(auth, (u) => {
      setSignedIn(!!u);
      if (!u) { cached = null; setInterests(null); return; }
      if (cached) return setInterests(cached);
      api<{ interests: string[] }>("/api/account/interests").then((r) => { cached = r.interests; setInterests(r.interests); }).catch(() => setInterests([]));
    });
    return () => { listeners.delete(setInterests); off(); };
  }, []);
  return { interests, signedIn };
}
