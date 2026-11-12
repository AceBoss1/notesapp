"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useMember } from "@/lib/member-client";

// Shared by the Hotel kit's staff screens (Your hotel, the staff board, the kitchen screen): the signed-in member's calls to /api/hotel,
// and the hotel's pulse (hotelPulse/{id}: a counter the server moves on every change), so screens fetch again the moment something lands.
export function useHotelApi() {
  const { user } = useMember();
  const get = useCallback(async (params: Record<string, string>) => {
    if (!user) throw new Error("Sign in first.");
    const r = await fetch(`/api/hotel?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "Couldn't load that."), { status: r.status });
    return j;
  }, [user]);
  const post = useCallback(async (body: Record<string, unknown>) => {
    if (!user) throw new Error("Sign in first.");
    const r = await fetch("/api/hotel", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Couldn't save that.");
    return j;
  }, [user]);
  return { user, get, post };
}

// Calls `onChange` whenever the hotel's pulse moves, and every `everyMs` anyway (minutes go by on the kitchen screen, and the listener can
// drop on a poor connection).
export function usePulse(hotelId: string | null, onChange: () => void, everyMs = 20_000) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!hotelId) return;
    let first = true;
    const off = onSnapshot(doc(db, "hotelPulse", hotelId), () => { if (first) { first = false; return; } cb.current(); }, () => { /* the timer still runs */ });
    const t = window.setInterval(() => cb.current(), everyMs);
    return () => { off(); window.clearInterval(t); };
  }, [hotelId, everyMs]);
}

export const hotelParam = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("h") ?? "");

// The hotel a screen is for: ?h= in the address, else the first one this person owns or works at.
export function useHotelId(): string | null {
  const { user, get } = useHotelApi();
  const [h, setH] = useState<string | null>(null);
  useEffect(() => {
    const p = hotelParam();
    if (p) { setH(p); return; }
    if (user) get({ view: "mine" }).then((j: { hotels: { id: string }[] }) => setH(j.hotels[0]?.id ?? user.uid)).catch(() => setH(user.uid));
  }, [user, get]);
  return h;
}
