"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { BEAT_MS } from "@/lib/social-graph";

// The "I'm here" heartbeat behind online and last seen. While a signed-in member has a tab open and visible it writes presence/<uid>
// about every 3 minutes. Switching online visibility off stops it and clears the record (see VisibilitySettings).
export const VISIBILITY_EVENT = "na-visibility";

export default function PresenceBeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let uid: string | null = null;
    let on = false;
    const beat = () => {
      if (!uid || !on || document.visibilityState !== "visible") return;
      setDoc(doc(db, "presence", uid), { lastSeen: serverTimestamp() }).catch(() => {});
    };
    const start = () => { clearInterval(timer); if (uid && on) { beat(); timer = setInterval(beat, BEAT_MS); } };
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    const onPref = (e: Event) => {
      on = (e as CustomEvent<{ showOnline: boolean }>).detail.showOnline;
      if (!on && uid) deleteDoc(doc(db, "presence", uid)).catch(() => {});
      start();
    };
    const off = onAuthStateChanged(auth, async (u) => {
      uid = u?.uid ?? null;
      on = false;
      clearInterval(timer);
      if (!u) return;
      try { on = (await getDoc(doc(db, "users", u.uid))).data()?.showOnline !== false; } catch { on = false; }
      start();
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(VISIBILITY_EVENT, onPref);
    return () => { off(); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener(VISIBILITY_EVENT, onPref); };
  }, []);
  return null;
}
