"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { naira } from "@/lib/hotel";
import { useHotelApi, useHotelId, usePulse } from "./staff";

// The live staff board (Hotel Standard and up; mockup 4): each department's orders moving from Paid to Cooking to Ready to Done, the day's
// takings and occupancy for managers, and payments and bookings as they land. Staff with a department role see only their departments.
export type BoardOrder = { id: string; number: string; deptId: string; deptName: string; target: string; lines: { name: string; qty: number }[]; totalKobo: number; status: string; payMethod: string; note: string; minutes: number; late: boolean; createdAt: string };
type Board = { hotel: { id: string; name: string; branch: string }; role: string; lateMinutes: number; departments: { id: string; name: string }[]; orders: BoardOrder[]; occupancy: { pct: number; tonight: number; total: number } | null; takenKobo: number | null; feed: { at: string; text: string }[] };
const COLS = [
  { id: "paid", title: "Paid", statuses: ["paid", "on_bill"], next: "preparing", label: "Start" },
  { id: "cooking", title: "Cooking", statuses: ["preparing"], next: "ready", label: "Ready" },
  { id: "ready", title: "Ready", statuses: ["ready"], next: "completed", label: "Served" },
] as const;

export default function HotelBoard() {
  const { user, get, post } = useHotelApi();
  const h = useHotelId();
  const [b, setB] = useState<Board | null>(null);
  const [dept, setDept] = useState<string>("all");
  const [err, setErr] = useState("");
  const load = useCallback(() => { if (user && h) get({ view: "board", h }).then((x) => { setB(x); setErr(""); }).catch((e) => setErr(e.message)); }, [user, get, h]);
  useEffect(() => { load(); }, [load]);
  usePulse(b?.hotel.id ?? null, load);
  const move = async (id: string, to: string) => { try { await post({ action: "move", h: b!.hotel.id, id, to }); load(); } catch (e) { setErr((e as Error).message); } };

  if (user === null) return <p className="p-8 text-slate">Sign in to see the staff board.</p>;
  if (err && !b) return <p className="mx-auto max-w-xl p-8 text-slate">{err} <Link href="/profile/hotel" className="font-semibold text-crimson">Your hotel</Link></p>;
  if (!b) return <p className="p-8 text-slate">Loading the board…</p>;
  const orders = b.orders.filter((o) => dept === "all" || o.deptId === dept);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-ink">Staff board · {dept === "all" ? b.hotel.name : b.departments.find((d) => d.id === dept)?.name}</h1>
        <span className="rounded-md bg-[#E0123E] px-2 py-1 font-ui text-xs font-extrabold tracking-wider text-white">LIVE</span>
      </div>
      {err && <p className="mt-2 text-sm text-crimson" role="alert">{err}</p>}
      {(b.occupancy || b.takenKobo !== null) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
          {b.occupancy && <div className="rounded-2xl border border-rule bg-white p-3"><b className="block font-display text-2xl">{b.occupancy.pct}%</b><span className="text-xs text-slate">rooms full tonight ({b.occupancy.tonight} of {b.occupancy.total})</span></div>}
          {b.takenKobo !== null && <div className="rounded-2xl border border-rule bg-white p-3"><b className="block font-display text-2xl">{naira(b.takenKobo)}</b><span className="text-xs text-slate">taken today, all departments</span></div>}
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {COLS.map((c) => {
          const list = orders.filter((o) => (c.statuses as readonly string[]).includes(o.status));
          return (
            <section key={c.id} className="flex flex-col gap-2 rounded-2xl border border-rule bg-white p-3" aria-label={c.title}>
              <h2 className="font-ui text-xs font-bold uppercase tracking-wider text-slate">{c.title} · {list.length}</h2>
              {list.length === 0 && <p className="text-xs text-slate">Nothing here.</p>}
              {list.map((o) => (
                <div key={o.id} className={`rounded-xl border p-2.5 text-sm ${o.late ? "border-[#E0123E] bg-[#fff1f3]" : "border-rule"}`}>
                  <p className="font-bold">{o.number} · {o.target}</p>
                  <p className="text-slate">{o.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</p>
                  {o.note && <p className="text-xs italic text-slate">“{o.note}”</p>}
                  <p className={`text-xs ${o.late ? "font-bold text-[#E0123E]" : "text-slate"}`}>⏱ {o.minutes} min{o.late ? " · late" : ""}{o.payMethod === "room_bill" ? " · room bill" : ""} · {o.deptName}</p>
                  <button onClick={() => move(o.id, c.next)} className="mt-1.5 rounded-full bg-crimson px-3 py-1 font-ui text-xs font-bold text-paper">{c.label}</button>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      {b.feed.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-2xl border border-rule bg-white p-3 text-sm">
          {b.feed.map((f, i) => <li key={i}><b>{f.text.split(" · ")[0]}</b> · {f.text.split(" · ").slice(1).join(" · ")} · <span className="text-slate">{new Date(f.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></li>)}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {b.departments.length > 1 && <button onClick={() => setDept("all")} className={`rounded-full px-3 py-1.5 text-sm ${dept === "all" ? "bg-crimson text-paper" : "border border-rule bg-white"}`}>All</button>}
        {b.departments.map((d) => <button key={d.id} onClick={() => setDept(d.id)} className={`rounded-full px-3 py-1.5 text-sm ${dept === d.id ? "bg-crimson text-paper" : "border border-rule bg-white"}`}>{d.name}</button>)}
        <Link href={`/profile/hotel/kitchen?h=${b.hotel.id}${dept !== "all" ? `&dept=${dept}` : ""}`} className="rounded-full border border-ink px-3 py-1.5 text-sm font-semibold">Kitchen screen →</Link>
      </div>
    </div>
  );
}
