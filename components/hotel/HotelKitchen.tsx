"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { spoken, type TargetKind } from "@/lib/hotel";
import { useHotelApi, useHotelId, usePulse } from "./staff";

// The kitchen screen (Hotel Standard and up; mockup 5): big tickets for one department, oldest first, with how long each has waited; late
// ones (past the hotel's late time, from Manage or Admin) in red. A new order plays a sound and is read out ("New order, table four") with
// the browser's own speech, once sound is on (browsers need a tap first). Tapping a ticket starts it (Cooking); Ready sends it to the waiter
// or room service; Bump clears it from the screen as served.
type Ticket = { id: string; number: string; target: string; targetKind: TargetKind; targetValue: string; lines: { name: string; qty: number }[]; note: string; minutes: number; late: boolean; status: string };
type View = { hotelId: string; dept: { id: string; name: string }; departments: { id: string; name: string }[]; lateMinutes: number; orders: Ticket[] };

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1320].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.4); });
  } catch { /* no sound on this device */ }
}

export default function HotelKitchen() {
  const { user, get, post } = useHotelApi();
  const h = useHotelId();
  const [dept, setDept] = useState("");
  const [v, setV] = useState<View | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const [err, setErr] = useState("");
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => { setDept(new URLSearchParams(window.location.search).get("dept") ?? ""); }, []);
  const load = useCallback(() => {
    if (!user || !h) return;
    get({ view: "kitchen", h, ...(dept ? { dept } : {}) }).then((x: View) => {
      setV(x); setErr("");
      const fresh = x.orders.filter((o) => seen.current && !seen.current.has(o.id));
      if (fresh.length && sound) {
        chime();
        try { for (const o of fresh) window.speechSynthesis?.speak(new SpeechSynthesisUtterance(spoken({ kind: o.targetKind, value: o.targetValue }))); } catch { /* no speech */ }
      }
      seen.current = new Set(x.orders.map((o) => o.id));
    }).catch((e) => setErr(e.message));
  }, [user, get, h, dept, sound]);
  useEffect(() => { load(); }, [load]);
  usePulse(v?.hotelId ?? null, load, 15_000);
  const act = async (id: string | null, to: string) => {
    if (!id || !v) return;
    const o = v.orders.find((x) => x.id === id);
    try {
      const steps = to === "preparing" ? ["preparing"] : to === "ready" ? ["preparing", "ready"] : ["preparing", "ready", "completed"];
      for (const s of steps.slice(o?.status === "preparing" ? 1 : 0)) await post({ action: "move", h: v.hotelId, id, to: s });
      setSel(null); load();
    } catch (e) { setErr((e as Error).message); }
  };
  if (user === null) return <p className="p-8 text-slate">Sign in to open the kitchen screen.</p>;
  if (err && !v) return <p className="mx-auto max-w-xl p-8 text-slate">{err} <Link href="/profile/hotel" className="font-semibold text-crimson">Your hotel</Link></p>;
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#141010] px-4 py-5 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <h1 className="font-ui text-lg font-bold">Kitchen screen · {v?.dept.name ?? "…"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {v && v.departments.length > 1 && <select aria-label="Department" value={v.dept.id} onChange={(e) => { setDept(e.target.value); seen.current = null; }} className="rounded-lg bg-white/10 px-2 py-1.5 text-sm">{v.departments.map((d) => <option key={d.id} value={d.id} className="text-ink">{d.name}</option>)}</select>}
          <button onClick={() => { setSound(!sound); if (!sound) { chime(); try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("Sound on")); } catch { /* fine */ } } }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${sound ? "bg-[#2FA37A]" : "bg-white/15"}`} aria-pressed={sound}>{sound ? "🔊 Sound on" : "🔈 Tap for sound"}</button>
        </div>
      </div>
      {err && <p className="mx-auto mt-2 max-w-6xl text-sm text-[#ff8da5]" role="alert">{err}</p>}
      <div className="mx-auto mt-4 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {v?.orders.length === 0 && <p className="text-white/60">No orders waiting. New ones appear here by themselves.</p>}
        {v?.orders.map((o) => (
          <button key={o.id} onClick={() => { const on = sel !== o.id; setSel(on ? o.id : null); if (on && o.status !== "preparing") act(o.id, "preparing").then(() => setSel(o.id)); }} className={`rounded-2xl border-2 p-4 text-left ${o.late ? "border-[#E0123E] bg-[#3a0c16]" : "border-white/10 bg-[#241b19]"} ${sel === o.id ? "ring-4 ring-white/70" : ""}`} aria-pressed={sel === o.id}>
            <p className="font-ui text-xl font-extrabold">{o.number} · {o.target} <span className={`ml-1 text-sm font-semibold ${o.late ? "text-[#ff8da5]" : "text-white/70"}`}>⏱ {o.minutes} min{o.late ? ` (over ${v.lateMinutes})` : o.minutes < 2 ? " · NEW" : ""}</span></p>
            <p className="mt-1 text-lg">{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</p>
            {o.note && <p className="mt-1 text-white/80">{o.note}</p>}
            {o.status === "preparing" && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#F2C14E]">Cooking</p>}
          </button>
        ))}
      </div>
      <div className="sticky bottom-16 mx-auto mt-6 grid max-w-6xl grid-cols-2 gap-3 bg-[#141010] py-3 lg:bottom-0">
        <button disabled={!sel} onClick={() => act(sel, "ready")} className="rounded-full bg-[#2FA37A] py-3 font-ui font-bold disabled:opacity-40">Ready ✓</button>
        <button disabled={!sel} onClick={() => act(sel, "completed")} className="rounded-full bg-white/15 py-3 font-ui font-bold disabled:opacity-40">Bump</button>
      </div>
      <p className="mx-auto max-w-6xl text-center text-xs text-white/50">Tap a ticket to start cooking it. Ready when it&apos;s done: the waiter or room service sees it on the board. Bump clears one that has gone out.</p>
    </div>
  );
}
