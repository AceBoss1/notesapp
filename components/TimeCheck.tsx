"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { adminAccess } from "@/lib/admin-claims";
import { answerBy, asking, hm, lagosClock, type Timer } from "@/lib/time";

// The "still working?" time check for staff with a timer running (lib/time.ts), on any page. It opens when the check is due, with a short
// sound and a browser notification if they allowed them; the server stops an unanswered timer either way. Nothing shows for anyone else.
const ampm = (iso: string) => { const [h, m] = lagosClock(iso).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* no sound is fine */ }
}

export default function TimeCheck() {
  const [user, setUser] = useState<User | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [due, setDue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const told = useRef("");

  useEffect(() => onAuthStateChanged(auth, async (u) => { setUser(u && (await adminAccess(u)) ? u : null); }), []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await fetch("/api/admin/time?timer=1", { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!r.ok) return;
      const d = await r.json();
      setTimer(d.timer ?? null);
      if (d.stopped) setNotice(d.stopped.flag === "midnight" ? "Your timer ran to midnight and stopped. Check your timesheet." : "Your timer stopped: the time check wasn't answered.");
    } catch { /* try again on the next focus */ }
  }, [user]);

  useEffect(() => {
    if (!user) { setTimer(null); return; }
    void load();
    const again = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("notesapp:timer", again);
    const i = setInterval(again, 5 * 60_000);
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("notesapp:timer", again); clearInterval(i); };
  }, [user, load]);

  // Opens when the check is due, and once per check plays the chime and sends the browser notification.
  useEffect(() => {
    if (!timer) { setDue(false); return; }
    const open = () => {
      setDue(true);
      if (told.current === timer.checkAt) return;
      told.current = timer.checkAt;
      chime();
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("Still working?", { body: `${timer.label}: answer by ${ampm(answerBy(timer))} or the timer stops.`, tag: "notesapp-time" }); } catch { /* not everywhere */ }
    };
    if (asking(timer, new Date().toISOString())) { open(); return; }
    setDue(false);
    const t = setTimeout(open, Math.max(0, Date.parse(timer.checkAt) - Date.now()));
    return () => clearTimeout(t);
  }, [timer]);

  const act = async (action: "confirm" | "stop") => {
    if (!user) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/time", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action }) });
      const d = await r.json().catch(() => ({}));
      if (action === "stop" || d.stopped) { setTimer(null); setNotice(d.stopped || d.flag ? "The timer had already stopped: the time check wasn't answered in time." : "Stopped and saved."); }
      else if (d.timer) setTimer(d.timer);
      window.dispatchEvent(new Event("notesapp:timer-changed"));
    } finally { setBusy(false); }
  };

  if (notice && !due) {
    return (
      <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-card p-4 text-sm shadow-2xl ring-1 ring-rule lg:bottom-6" role="status">
        <p className="text-ink">{notice}</p>
        <div className="mt-2 flex gap-3 font-ui text-xs font-semibold"><Link href="/admin/team/time?tab=sheet" className="text-crimson" onClick={() => setNotice("")}>Open my timesheet</Link><button className="text-slate underline" onClick={() => setNotice("")}>OK</button></div>
      </div>
    );
  }
  if (!timer || !due) return null;
  const ran = Math.floor((Date.now() - Date.parse(timer.startedAt)) / 60000);
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-card p-5 shadow-2xl ring-1 ring-rule lg:bottom-6" role="alertdialog" aria-labelledby="time-check-title">
      <p className="font-mono text-[11px] uppercase tracking-widest text-crimson">⏱ Time check · {ampm(timer.checkAt)}</p>
      <p id="time-check-title" className="mt-2 font-display text-2xl leading-tight text-ink">Still working on {timer.label}?</p>
      <p className="mt-1 text-sm text-slate">Your timer has run {hm(ran)}. If you don&apos;t answer by {ampm(answerBy(timer))}, it stops at {ampm(timer.safeUntil)}{timer.kind === "meeting" && timer.safeUntil === timer.checkAt ? " (the meeting's planned end)" : " and the last half hour isn't counted"}.</p>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-full bg-crimson py-3 font-ui font-bold text-paper disabled:opacity-50" disabled={busy} onClick={() => act("confirm")}>Yes, still working</button>
        <button className="rounded-full border border-rule px-4 py-3 font-ui text-sm font-semibold text-ink disabled:opacity-50" disabled={busy} onClick={() => act("stop")}>Stop now</button>
      </div>
    </div>
  );
}
