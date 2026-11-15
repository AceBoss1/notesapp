"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

// A month calendar for picking a day (booking a session, per-minute calls, rescheduling), in the look of My Cycle's calendar:
// month with ‹ ›, Monday-first grid, today outlined, open days tinted, the picked day in crimson. Days before `min`, after `max`
// or not open (`isOpen` says no) can't be picked. Dates are "YYYY-MM-DD" strings, counted as calendar days (no time zone maths).
// Range mode (a hotel stay): pass `rangeEnd` and `onRangeEnd`. The first tap sets the start (check-in), the next tap after it sets
// the end (check-out); a tap on or before the start begins again. The nights between are tinted.
// My Calendar (/calendar) adds `dots` (a coloured dot per kind under a day), `shade` (hotel nights), its own `legend`, and `onMonth`
// (told when the month shown changes, to load it). Without them the calendar is exactly as before.

import { MONTHS, dayLabel, isoDay as iso, monthCells } from "@/lib/month-calendar";
// The grid and labels live in lib/month-calendar.ts (pure, so the server can use them); re-exported for the booking calendars.
export { dayLabel, monthCells };
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };

export default function MonthCalendar({
  value,
  onChange,
  min,
  max,
  isOpen,
  openLabel = "Open for booking",
  label = "Pick a day",
  className = "",
  rangeEnd,
  onRangeEnd,
  startLabel = "Check-in",
  endLabel = "Check-out",
  dots,
  shade,
  legend,
  onMonth,
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  isOpen?: (day: string) => boolean;
  openLabel?: string;
  label?: string;
  className?: string;
  rangeEnd?: string;
  onRangeEnd?: (day: string) => void;
  startLabel?: string;
  endLabel?: string;
  dots?: (day: string) => string[];
  shade?: (day: string) => boolean;
  legend?: ReactNode;
  onMonth?: (year: number, month: number) => void;
}) {
  const range = !!onRangeEnd;
  const [pickingEnd, setPickingEnd] = useState(false);
  const start = value || min || todayIso();
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  // Follow a value set from outside (a shared link with ?date=…).
  useEffect(() => { if (value) setView({ y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 }); }, [value]);
  useEffect(() => { onMonth?.(view.y, view.m); }, [view, onMonth]);
  const today = todayIso();
  const cells = useMemo(() => monthCells(view.y, view.m), [view]);
  const title = `${MONTHS[view.m]} ${view.y}`;
  const firstOf = iso(view.y, view.m, 1);
  const lastOf = iso(view.y, view.m, new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate());
  const canBack = !min || firstOf > min;
  const canNext = !max || lastOf < max;
  const move = (by: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + by, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const pickable = (d: string) => (!min || d >= min) && (!max || d <= max) && (!isOpen || isOpen(d));
  const tap = (d: string) => {
    if (!range) return onChange(d);
    if (pickingEnd && d > value) { onRangeEnd!(d); setPickingEnd(false); return; }
    onChange(d); setPickingEnd(true);
  };

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
          const ok = pickable(d), picked = d === value || (range && d === rangeEnd);
          const between = range && !!rangeEnd && d > value && d < rangeEnd;
          const shaded = !picked && !between && !!shade?.(d);
          const tone = picked ? "bg-crimson font-semibold text-paper" : between ? "bg-crimson/15 text-ink" : shaded ? "bg-[#EADBD2] text-ink hover:ring-1 hover:ring-crimson" : ok ? (isOpen ? "bg-[#D6F0E4] text-[#17694a] hover:ring-2 hover:ring-crimson" : "text-ink hover:bg-paper hover:ring-1 hover:ring-crimson") : "text-slate/40";
          const marks = dots?.(d) ?? [];
          return (
            <button key={d} type="button" disabled={!ok} onClick={() => tap(d)} aria-pressed={picked} aria-label={marks.length ? `${dayLabel(d)}, ${marks.length} ${marks.length === 1 ? "kind" : "kinds"} of plans` : dayLabel(d)}
              className={`rounded-lg py-2 ${tone} ${d === today ? "outline outline-2 outline-ink" : ""} disabled:cursor-not-allowed`}>
              {Number(d.slice(8))}
              {dots && <span className="mt-0.5 flex h-[5px] justify-center gap-0.5" aria-hidden>{marks.slice(0, 4).map((c) => <i key={c} className="block h-[5px] w-[5px] rounded-full" style={{ background: c }} />)}</span>}
            </button>
          );
        })}
      </div>
      {range && <p className="mt-2 text-xs text-slate" aria-live="polite">{pickingEnd ? `Now tap your ${endLabel.toLowerCase()} day.` : `Tap your ${startLabel.toLowerCase()} day.`}</p>}
      {legend ?? <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate">
        {isOpen && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D6F0E4] align-[-1px]" />{openLabel}</span>}
        {range
          ? <><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-crimson align-[-1px]" />{startLabel} and {endLabel.toLowerCase()}</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-crimson/15 align-[-1px]" />Your nights</span></>
          : <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-crimson align-[-1px]" />Your pick</span>}
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm outline outline-2 outline-ink align-[-1px]" />Today</span>
      </div>}
    </div>
  );
}
