"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { REACTIONS, cleanQuickReactions } from "@/lib/messages-rules";

// Your quick reactions (the row along the top of the message menu): saved on your account (userPrefs, through /api/messages/prefs),
// with a copy on this device so the row is right straight away. One copy for the whole page.
const KEY = "notesapp:quickReactions";
let current: string[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(l: string[]) => void>();
const set = (l: string[]) => { current = l; listeners.forEach((f) => f(l)); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };

function load() {
  if (current === null) { try { current = cleanQuickReactions(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch {} }
  loading ??= api<{ quickReactions: string[] | null }>("/api/messages/prefs").then((r) => set(r.quickReactions ?? [...REACTIONS])).catch(() => { loading = null; });
}

export function useQuickReactions(): [string[], (next: string[] | null) => Promise<void>] {
  const [list, setList] = useState<string[]>(() => current ?? [...REACTIONS]);
  useEffect(() => {
    load();
    if (current) setList(current);
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);
  // null: back to the default set. Shown at once; put back if the save fails.
  async function save(next: string[] | null) {
    const before = current ?? [...REACTIONS];
    set(next ?? [...REACTIONS]);
    try { await api("/api/messages/prefs", { body: { quickReactions: next } }); }
    catch (e) { set(before); throw e; }
  }
  return [list, save];
}
