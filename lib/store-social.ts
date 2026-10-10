"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

// The heart and the view counts, from the browser's side. A member's saved items are read live (they may read only their own);
// the totals come from the public `storeStats` documents. Changing a save goes through /api/store/favorite.
export type StoreStat = { views: number; favs: number };

export function useSavedItems(user: User | null | undefined) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setSaved(new Set()); return; }
    return onSnapshot(
      query(collection(db, "storeFavorites"), where("uid", "==", user.uid)),
      (s) => setSaved(new Set(s.docs.map((d) => String(d.data().itemId)))),
      () => setSaved(new Set())
    );
  }, [user]);
  const toggle = useCallback(async (itemId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: "Sign in to save items." };
    // Show the change at once; the live list confirms (or undoes) it.
    setSaved((cur) => { const n = new Set(cur); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
    try {
      const res = await fetch("/api/store/favorite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ itemId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save that.");
      return { ok: true };
    } catch (e) {
      setSaved((cur) => { const n = new Set(cur); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't save that." };
    }
  }, [user]);
  return { saved, toggle };
}

// views and saves of every item in one seller's store, keyed by item id
export async function getStoreStats(ownerUid: string): Promise<Record<string, StoreStat>> {
  try {
    const s = await getDocs(query(collection(db, "storeStats"), where("ownerUid", "==", ownerUid)));
    return Object.fromEntries(s.docs.map((d) => [d.id, { views: Number(d.data().views) || 0, favs: Number(d.data().favs) || 0 }]));
  } catch {
    return {};
  }
}

// Counts one look at an item, at most once a day per browser. Quiet if anything goes wrong.
export async function countView(itemId: string, user?: User | null) {
  try {
    const key = `na-view-${itemId}`, today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    await fetch("/api/store/look", { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {}) }, body: JSON.stringify({ itemId }) });
  } catch { /* a missed count is fine */ }
}
