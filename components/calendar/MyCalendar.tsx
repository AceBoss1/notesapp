"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { capi } from "@/components/community/api";
import MonthCalendar from "@/components/MonthCalendar";
import { dayLabel, isoDay } from "@/lib/month-calendar";
import {
  DEFAULT_PREFS, KIND_COLOUR, KIND_LABEL, addDays, agendaFor, allowedKinds, dotsByDay, filterKinds, lagosToday, reminderText, stayNights, whenText,
  type AgendaItem, type CalEntry, type CalKind, type CalMode, type CalPrefs,
} from "@/lib/my-calendar";
import AddToCalendar from "./AddToCalendar";
import { PlannerTabs } from "@/components/planner/PlannerGate";
import PlannerDay from "@/components/planner/PlannerDay";

// My Calendar (/calendar; docs/MY_CALENDAR.md, mockups 2 and 3): the month in the booking calendar's look with a coloured dot per kind and
// hotel nights shaded, and below it the day's agenda. A tap on a day shows that day; a tap on an entry opens it, with where it came from
// and "Add to my calendar". Everything is read from where it lives, each time (lib/my-calendar-server.ts).
type Data = { entries: CalEntry[]; failed: string[]; mode: CalMode; prefs: CalPrefs; today: string };

export function CalendarHeader({ title, back }: { title: string; back?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        {back && <Link href="/calendar" className="text-xs font-semibold text-crimson">← My Calendar</Link>}
        <h1 className="font-display text-3xl text-ink">{title}</h1>
      </div>
      {!back && (
        <div className="flex gap-2">
          <Link href="/calendar/sync" className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-crimson"><span aria-hidden>🔄</span> Sync with your phone</Link>
          <Link href="/calendar/settings" aria-label="Calendar settings" className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-crimson"><span aria-hidden>⚙️</span><span className="hidden sm:inline">Settings</span></Link>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-start justify-between gap-3 border-t border-rule py-2 text-[13px] first:border-t-0"><span className="text-slate">{k}</span><span className="text-right font-semibold text-ink">{v}</span></div>;
}

function Item({ it, open, onToggle, prefs }: { it: AgendaItem; open: boolean; onToggle: () => void; prefs: CalPrefs }) {
  const e = it.entry;
  return (
    <li className="rounded-2xl border border-rule bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-left">
        <span className="min-w-[3.25rem] font-ui text-[13px] font-bold text-ink">{it.time}</span>
        <i className="block w-1 self-stretch rounded" style={{ background: KIND_COLOUR[e.kind] }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-ui text-[13.5px] font-bold text-ink">{it.label}</span>
          {e.sub && <span className="mt-0.5 block text-xs text-slate">{e.sub}</span>}
        </span>
        <span className="sr-only">{KIND_LABEL[e.kind]}</span>
      </button>
      {open && (
        <div className="border-t border-rule px-3 pb-3 pt-1">
          <p className="pt-2 font-ui text-sm font-bold text-ink">{e.title}</p>
          <div className="mt-1">
            <Row k="When" v={whenText(e)} />
            {e.where && <Row k="Where" v={e.where} />}
            {reminderText(e, prefs) && <Row k="Reminder" v={reminderText(e, prefs)} />}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={e.href} className="btn-primary flex items-center justify-center !rounded-full !py-2.5 text-sm">Open</Link>
            <AddToCalendar entry={e} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate">&quot;Add to my calendar&quot; puts just this one in your phone&apos;s calendar. To keep everything in step, <Link href="/calendar/sync" className="underline">sync with your phone</Link>.</p>
        </div>
      )}
    </li>
  );
}

export default function MyCalendar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [today, setToday] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState<Set<CalKind>>(new Set());
  const [open, setOpen] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => { if (!u) router.replace("/login?next=/calendar"); setUser(u); }), [router]);
  useEffect(() => { const t = lagosToday(); setToday(t); setDay(t); }, []);
  const onMonth = useCallback((y: number, m: number) => setMonth((cur) => (cur && cur.y === y && cur.m === m ? cur : { y, m })), []);
  useEffect(() => {
    if (!user || !month) return;
    let live = true;
    const first = isoDay(month.y, month.m, 1), last = isoDay(month.y, month.m, new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate());
    setError("");
    capi<Data>(`/api/calendar?from=${addDays(first, -7)}&to=${addDays(last, 7)}`)
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : "Couldn't load your calendar."); });
    return () => { live = false; };
  }, [user, month]);

  const shown = useMemo(() => (data ? filterKinds(data.entries, allowedKinds(data.mode).filter((k) => !hidden.has(k))) : []), [data, hidden]);
  const dots = useMemo(() => dotsByDay(shown), [shown]);
  const nights = useMemo(() => stayNights(shown), [shown]);
  const items = useMemo(() => (day ? agendaFor(shown, day) : []), [shown, day]);
  const kinds = data ? allowedKinds(data.mode) : [];

  if (user === undefined || !today) return <p className="px-4 py-16 text-center text-sm text-slate">Opening My Calendar…</p>;
  if (data?.mode.kid) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <CalendarHeader title="My Calendar" back />
        <p className="card mt-6 p-6 text-sm text-slate">Child profiles don&apos;t have a calendar. A parent sees bookings and tickets on their own account.</p>
      </div>
    );
  }

  const legend = (
    <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-[11px]">
      {kinds.map((k) => (
        <button key={k} type="button" onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} aria-pressed={!hidden.has(k)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${hidden.has(k) ? "text-slate/50 line-through" : "text-slate hover:bg-paper"}`} title={hidden.has(k) ? `Show ${KIND_LABEL[k].toLowerCase()}` : `Hide ${KIND_LABEL[k].toLowerCase()}`}>
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOUR[k] }} aria-hidden />{KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <CalendarHeader title="My Calendar" />
      <PlannerTabs active="calendar" />
      <p className="mt-3 text-sm text-slate">Everything you&apos;ve booked, bought or been invited to on #NotesApp, and your plan, in Lagos time (WAT).</p>
      {data?.mode.teen && <p className="mt-2 text-xs text-slate">In teen mode, your calendar shows what teen mode allows.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF1F3] px-3 py-2 text-sm text-crimson">{error}</p>}
      {data && data.failed.length > 0 && <p className="mt-4 rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-xs text-[#5a4300]">We couldn&apos;t load {data.failed.join(", ").toLowerCase()} just now. Everything else is here; try again in a moment.</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <MonthCalendar value={day} onChange={(d) => { setDay(d); setOpen(""); }} label="My Calendar: pick a day" onMonth={onMonth}
          dots={(d) => (dots[d] ?? []).map((k) => KIND_COLOUR[k])} shade={(d) => nights.has(d)} legend={legend} />
        <section aria-live="polite">
          <h2 className="font-ui text-sm font-bold text-ink">{day === today ? `Today · ${dayLabel(day)}` : dayLabel(day)}</h2>
          {user && day && <div className="mt-3"><PlannerDay user={user} day={day} hidden={hidden.has("plan")} /></div>}
          {!data && !error ? <p className="mt-3 text-sm text-slate">Loading…</p> : items.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-rule p-5 text-sm text-slate">Nothing on this day. Book a session, buy a ticket or say you&apos;re going to an event and it shows here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((it) => {
                const key = `${it.entry.id}:${it.at}`;
                return <Item key={key} it={it} open={open === key} onToggle={() => setOpen(open === key ? "" : key)} prefs={data?.prefs ?? DEFAULT_PREFS} />;
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate">Each entry opens where it came from: the booking, the ticket, the job or the stay. <Link href="/help/my-calendar" className="text-crimson underline">How My Calendar works</Link></p>
        </section>
      </div>
    </div>
  );
}
