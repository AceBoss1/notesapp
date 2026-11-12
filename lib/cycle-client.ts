"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { CycleStatus, cycleView } from "./cycle-server";

// The browser side of My Cycle (lib/cycle-server.ts). Requests carry her sign-in; the unlock cookie (httpOnly) goes with them on its own.
export type CycleData = Awaited<ReturnType<typeof cycleView>>;
export class CycleHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export async function cycleApi<T>(user: User, init: { method?: string; body?: Record<string, unknown>; query?: string } = {}): Promise<T> {
  const r = await fetch(`/api/cycle${init.query ? `?${init.query}` : ""}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: init.body ? JSON.stringify({ today: localToday(), ...init.body }) : undefined,
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new CycleHttpError(j.error || "Something went wrong.", r.status);
  return j as T;
}

// Locks My Cycle again (the page calls it when she switches apps or tabs). Works while the page is being hidden or closed.
export function lockNow() {
  try {
    if (navigator.sendBeacon?.("/api/cycle/unlock?lock=1")) return;
  } catch { /* fall through */ }
  fetch("/api/cycle/unlock?lock=1", { method: "POST", keepalive: true }).catch(() => {});
}

// ── The menu item ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Shown to members who may use My Cycle, unless they answered "Not for me". Asked once per visit and kept for the tab.
const KEY = (uid: string) => `cycleMenu:${uid}`;
export const CYCLE_MENU_EVENT = "cycle-menu-changed";
export function cycleMenuChanged(uid: string) {
  try { sessionStorage.removeItem(KEY(uid)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(CYCLE_MENU_EVENT));
}

export async function cycleStatus(user: User): Promise<CycleStatus> {
  return cycleApi<CycleStatus>(user, { query: "status=1" });
}

export function useCycleMenu(user: User | null | undefined, skip = false): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user || skip) { setShow(false); return; }
    let live = true;
    const load = () => {
      try {
        const v = sessionStorage.getItem(KEY(user.uid));
        if (v === "1" || v === "0") { setShow(v === "1"); return; }
      } catch { /* private mode */ }
      cycleStatus(user).then((s) => {
        if (!live) return;
        const on = s.eligible && s.menu;
        setShow(on);
        try { sessionStorage.setItem(KEY(user.uid), on ? "1" : "0"); } catch { /* private mode */ }
      }).catch(() => {});
    };
    load();
    window.addEventListener(CYCLE_MENU_EVENT, load);
    return () => { live = false; window.removeEventListener(CYCLE_MENU_EVENT, load); };
  }, [user, skip]);
  return show;
}
