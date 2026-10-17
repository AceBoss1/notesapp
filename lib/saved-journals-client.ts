"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// The journals a member bookmarked, live, and a toggle that shows the change at once (POST /api/journals/save confirms it).
export function useSavedJournals(user: User | null | undefined) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setSaved(new Set()); return; }
    return onSnapshot(query(collection(db, "savedJournals"), where("uid", "==", user.uid)), (s) => setSaved(new Set(s.docs.map((d) => String(d.data().noteId)))), () => setSaved(new Set()));
  }, [user]);
  const toggle = useCallback(async (noteId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Sign in to save journals." };
    const flip = () => setSaved((cur) => { const n = new Set(cur); if (n.has(noteId)) n.delete(noteId); else n.add(noteId); return n; });
    flip();
    try {
      const res = await fetch("/api/journals/save", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ noteId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save that.");
      return { ok: true };
    } catch (e) {
      flip();
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't save that." };
    }
  }, [user]);
  return { saved, toggle };
}
