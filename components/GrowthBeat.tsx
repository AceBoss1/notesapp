"use client";

import { useEffect } from "react";
import { PING_COOKIE } from "@/lib/growth";

// Growth measurement from the browser (lib/growth.ts, docs/GROWTH.md). Small, first-party reports, each at most once:
//  - a new visitor or a creator's link opened (the middleware's flag cookie), once per flag;
//  - the app installed: the browser's appinstalled event, or the installed app's first open on this device (iPhones never fire the
//    event, so the first open is the signal there), and once more for a signed-in member's own account;
//  - a signed-in member seen today, with what brought them (?r= on the first page of the visit), once a day.
// Nothing here is used for ads or sent anywhere but our own server.
const R_KEY = "na_r";
const DEVICE_KEY = "na_inst_dev";
const store = {
  get: (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } },
  set: (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch { /* private mode: it may count again, which is harmless */ } },
};
export function installedApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true || cap?.isNativePlatform?.() === true;
}
const send = (body: Record<string, unknown>, token?: string) =>
  fetch("/api/growth", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), keepalive: true }).catch(() => null);

export default function GrowthBeat() {
  useEffect(() => {
    let cancelled = false;
    let off: (() => void) | undefined;
    // What brought them back: only the first page of this visit says.
    try {
      const r = new URLSearchParams(window.location.search).get("r");
      if (r && !store.get(sessionStorage, R_KEY)) store.set(sessionStorage, R_KEY, r.slice(0, 20));
      else if (!store.get(sessionStorage, R_KEY)) store.set(sessionStorage, R_KEY, "own");
    } catch { /* no session storage */ }
    const onInstalled = () => {
      if (store.get(localStorage, DEVICE_KEY)) return;
      store.set(localStorage, DEVICE_KEY, "1");
      void send({ action: "install", device: true });
    };
    window.addEventListener("appinstalled", onInstalled);

    const timer = setTimeout(async () => {
      const { auth } = await import("@/lib/firebase");
      const { onAuthStateChanged } = await import("firebase/auth");
      if (cancelled) return;
      off = onAuthStateChanged(auth, async (u) => {
        off?.();
        if (cancelled) return;
        const token = u ? await u.getIdToken().catch(() => undefined) : undefined;
        if (document.cookie.split("; ").some((c) => c.startsWith(`${PING_COOKIE}=`) && c.length > PING_COOKIE.length + 1)) void send({ action: "visit" }, token);
        if (installedApp() && !store.get(localStorage, DEVICE_KEY)) {
          store.set(localStorage, DEVICE_KEY, "1");
          if (u) store.set(localStorage, `na_inst_${u.uid}`, "1");
          void send({ action: "install", device: true }, token);
        } else if (u && installedApp() && !store.get(localStorage, `na_inst_${u.uid}`)) {
          store.set(localStorage, `na_inst_${u.uid}`, "1");
          void send({ action: "install", device: false }, token);
        }
        if (u && token) {
          const day = new Date().toISOString().slice(0, 10);
          const key = `na_seen_${u.uid}`;
          if (store.get(localStorage, key) !== day) {
            store.set(localStorage, key, day);
            const created = Date.parse(u.metadata.creationTime || "");
            const fresh = Number.isFinite(created) && Date.now() - created < 7 * 86_400_000;
            void send({ action: "seen", r: store.get(sessionStorage, R_KEY) || "own", fresh }, token);
          }
        }
      });
    }, 1500);
    return () => { cancelled = true; clearTimeout(timer); off?.(); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}
