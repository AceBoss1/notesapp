"use client";

import { useEffect, useMemo, useState } from "react";

// A month calendar for picking a day (booking a session, per-minute calls, rescheduling), in the look of My Cycle's calendar:
// month with ‹ ›, Monday-first grid, today outlined, open days tinted, the picked day in crimson. Days before `min`, after `max`
// or not open (`isOpen` says no) can't be picked. Dates are "YYYY-MM-DD" strings, counted as calendar days (no time zone maths).

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };

// The cells of a month, Monday first: null for the blanks before the 1st.
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(year, month, i + 1))];
}

export default function MonthCalendar({
  value,
  onChange,
  min,
  max,
  isOpen,
  openLabel = "Open for booking",
  label = "Pick a day",
  className = "",
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  isOpen?: (day: string) => boolean;
  openLabel?: string;
  label?: string;
  className?: string;
}) {
  const start = value || min || todayIso();
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  // Follow a value set from outside (a shared link with ?date=…).
  useEffect(() => { if (value) setView({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 }); }, [value]);
  const today = todayIso();
  const cells = useMemo(() => monthCells(view.y, view.m), [view]);
  const title = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const firstOf = iso(view.y, view.m, 1);
  const lastOf = iso(view.y, view.m, new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate());
  const canBack = !min || firstOf > min;
  const canNext = !max || lastOf < max;
  const move = (by: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + by, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const pickable = (d: string) => (!min || d >= min) && (!max || d <= max) && (!isOpen || isOpen(d));

  return (
    <div className={`rounded-2xl border border-rule bg-card p-4 ${className}`} role="group" aria-label={label}>
      <div className="flex items-center justify-between">
        <p className="font-ui text-base font-semibold text-ink">{title}</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => move(-1)} disabled={!canBack} aria-label="Previous month" className="h-8 w-8 rounded-full text-lg text-ink hover:bg-paper disabled:opacity-30">‹</button>
          <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Next month" className="h-8 w-8 rounded-full text-lg text-ink hover:bg-paper disabled:opacity-30">›</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[13px]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="py-0.5 text-[10px] text-slate">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const ok = pickable(d), picked = d === value;
          const tone = picked ? "bg-crimson font-semibold text-paper" : ok ? (isOpen ? "bg-[#D6F0E4] text-[#17694a] hover:ring-2 hover:ring-crimson" : "text-ink hover:bg-paper hover:ring-1 hover:ring-crimson") : "text-slate/40";
          return (
            <button key={d} type="button" disabled={!ok} onClick={() => onChange(d)} aria-pressed={picked} aria-label={new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
              className={`rounded-lg py-2 ${tone} ${d === today ? "outline outline-2 outline-ink" : ""} disabled:cursor-not-allowed`}>
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate">
        {isOpen && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D6F0E4] align-[-1px]" />{openLabel}</span>}
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-crimson align-[-1px]" />Your pick</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm outline outline-2 outline-ink align-[-1px]" />Today</span>
      </div>
    </div>
  );
}
