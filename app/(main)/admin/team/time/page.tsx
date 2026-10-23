"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { DEPARTMENTS, DEPT_LABEL, type Dept } from "@/lib/admin-access";
import { naira } from "@/lib/finance";
import InvoicesTab from "@/components/time/InvoicesTab";
import { addDays } from "@/lib/team";
import {
  CHECK_EVERY_MIN, KIND_LABEL, LATE_AFTER, LEAVE_LABEL, MEETING_LENGTHS, WEEK_MINUTES, answerBy, asking, clock, hm, lagosClock, leadsLabel, leaveDays, locked, pct, weekDays,
  type Leave, type LeaveKind, type Project, type Row, type SheetStatus, type TimeEntry, type TimeKind, type Timer, type Timesheet, type WeekSummary,
} from "@/lib/time";

type Choices = { items: { id: string; title: string; mine: boolean; dept: string }[]; projects: Project[]; meetings: { id: string; title: string; startsAt: string }[] };
type Mine = {
  timer: Timer | null; stopped: { entry: TimeEntry | null; flag?: string } | null; now: string; today: string; choices: Choices; leave: Leave[];
  week: { week: string; entries: TimeEntry[]; rows: Row[]; sheet: Timesheet; summary: WeekSummary; hourlyKobo: number; payKobo: number; leave: Leave[] };
  viewer: { uid: string; superAdmin: boolean; leads: string[]; approver: boolean; finance: boolean };
};
type TeamRow = { uid: string; name: string; depts: string[]; summary: WeekSummary; status: SheetStatus; canApprove: boolean; hourlyKobo?: number; payKobo?: number };
type Team = {
  week: string; rows: TeamRow[]; leaveToDecide: (Leave & { name: string; days: number })[]; projects: (Project & { minutes: number; billableMinutes: number })[];
  leads: { uid: string; depts: string[] }[]; people: { uid: string; name: string; depts: string[] }[]; holidays: Leave[];
};
type Tab = "now" | "sheet" | "leave" | "team" | "setup" | "invoices";

const field = "mt-1 block w-full rounded-lg border border-rule bg-card px-3 py-2 text-sm";
const btn = "rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule bg-card px-4 py-2 font-ui text-xs font-semibold text-ink hover:border-crimson disabled:opacity-50";
const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-ui text-xs font-semibold ${on ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" });
const longDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "long" });
const ampm = (hhmm: string) => { if (!hhmm) return ""; const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
const STATUS_PILL: Record<SheetStatus, string> = { draft: "bg-amber-50 text-amber-800", submitted: "bg-sky-50 text-sky-800", approved: "bg-emerald-50 text-emerald-700" };
const STATUS_TEXT: Record<SheetStatus, string> = { draft: "Draft", submitted: "Submitted", approved: "Approved" };
const kindOf = (r: Pick<Row, "kind" | "dept">) => `${KIND_LABEL[r.kind]}${r.dept ? ` · ${DEPT_LABEL[r.dept as Dept] ?? r.dept}` : ""}`;

function Tile({ label, value, sub, tone = "text-slate" }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="card p-4"><p className="text-xs text-slate">{label}</p><p className="mt-1 font-display text-3xl text-ink">{value}</p>{sub && <p className={`text-xs ${tone}`}>{sub}</p>}</div>;
}

function Elapsed({ from, now }: { from: string; now: number }) {
  const s = Math.max(0, Math.floor((now - Date.parse(from)) / 1000));
  return <>{`${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}</>;
}

// What the time is for: my work items, projects, meetings or other (unassigned) work.
function TargetPicker({ choices, value, onChange }: { choices: Choices; value: { kind: TimeKind; refId: string; label: string }; onChange: (v: { kind: TimeKind; refId: string; label: string }) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(["item", "project", "meeting", "other"] as TimeKind[]).map((k) => (
          <button key={k} type="button" className={chip(value.kind === k)} onClick={() => onChange({ kind: k, refId: "", label: "" })}>{k === "item" ? "My work items" : k === "project" ? "Projects" : k === "meeting" ? "Meetings" : "Other (unassigned)"}</button>
        ))}
      </div>
      {value.kind === "other" ? (
        <input className={field} placeholder="What are you working on? For example: support inbox" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} aria-label="What you're working on" />
      ) : (
        <select className={field} value={value.refId} onChange={(e) => onChange({ ...value, refId: e.target.value })} aria-label="Choose one">
          <option value="">{value.kind === "item" ? "Choose a work item" : value.kind === "project" ? "Choose a project" : "Choose a meeting"}</option>
          {value.kind === "item" && (
            <>
              <optgroup label="Assigned to me">{choices.items.filter((i) => i.mine).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</optgroup>
              <optgroup label="Other open work">{choices.items.filter((i) => !i.mine).map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</optgroup>
            </>
          )}
          {value.kind === "project" && choices.projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}{p.billable ? " · billable" : ""}</option>)}
          {value.kind === "meeting" && choices.meetings.map((m) => <option key={m.id} value={m.id}>{m.title} · {longDay(m.startsAt.slice(0, 10))}</option>)}
        </select>
      )}
      {value.kind === "project" && !choices.projects.length && <p className="mt-1 text-xs text-slate">No projects yet. Team leads and super admins add them under Setup.</p>}
    </div>
  );
}

// Time in the team hub: the timer, my week's timesheet, leave, and for team leads and super admins the team report and setup.
// The rules are in lib/time.ts; the server (/api/admin/time) decides.
export default function TimePage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/time");
  const [tab, setTab] = useState<Tab>("now");
  const [week, setWeek] = useState("");
  const [mine, setMine] = useState<Mine | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [target, setTarget] = useState<{ kind: TimeKind; refId: string; label: string }>({ kind: "item", refId: "", label: "" });
  const [billable, setBillable] = useState(false);
  const [timerNote, setTimerNote] = useState("");
  const [planned, setPlanned] = useState(60);
  const [manual, setManual] = useState<{ open: boolean; day: string; duration: string; note: string; kind: TimeKind; refId: string; label: string; billable: boolean }>({ open: false, day: "", duration: "", note: "", kind: "item", refId: "", label: "", billable: false });
  const [cell, setCell] = useState<{ key: string; day: string; value: string } | null>(null);
  const [leaveForm, setLeaveForm] = useState<{ kind: LeaveKind; from: string; to: string; counts: boolean; note: string }>({ kind: "annual", from: "", to: "", counts: true, note: "" });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("tab"), w = sp.get("week");
    if (t && ["now", "sheet", "leave", "team", "setup", "invoices"].includes(t)) setTab(t as Tab);
    if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) setWeek(w);
  }, []);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const loadMine = useCallback(async (w = week) => {
    try { const d: Mine = await call(undefined, `?view=me${w ? `&week=${w}` : ""}`); setMine(d); if (!w) setWeek(d.week.week); setError(""); } catch (e) { setError((e as Error).message); }
  }, [call, week]);
  const loadTeam = useCallback(async (w = week) => {
    try { setTeam(await call(undefined, `?view=team&week=${w}`)); } catch (e) { setError((e as Error).message); }
  }, [call, week]);
  useEffect(() => { if (user) void loadMine(week); }, [user, week]); // eslint-disable-line react-hooks/exhaustive-deps
  // The time check (components/TimeCheck.tsx) answered or stopped the timer: show it here too.
  useEffect(() => { const again = () => void loadMine(week); window.addEventListener("notesapp:timer-changed", again); return () => window.removeEventListener("notesapp:timer-changed", again); }, [loadMine, week]);
  useEffect(() => { if (user && mine?.viewer.approver && week && (tab === "team" || tab === "setup")) void loadTeam(week); }, [user, mine?.viewer.approver, week, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (body: Record<string, unknown>, ok = "", alsoTeam = false) => {
    setBusy(true); setError(""); setNote("");
    try {
      const r = await call(body);
      if (ok) setNote(ok);
      await loadMine(week);
      if (alsoTeam) await loadTeam(week);
      window.dispatchEvent(new Event("notesapp:timer"));
      return r ?? {};
    } catch (e) { setError((e as Error).message); return null; } finally { setBusy(false); }
  };

  const timer = mine?.timer ?? null;
  const today = mine?.today ?? "";
  const todayEntries = useMemo(() => (mine?.week.entries ?? []).filter((e) => e.day === today), [mine, today]);
  const todayMinutes = todayEntries.reduce((s, e) => s + e.minutes, 0) + (timer ? Math.floor((now - Date.parse(timer.startedAt)) / 60000) : 0);
  const firstIn = mine?.week.summary.days.find((d) => d.day === today)?.firstIn || (timer && timer.startedAt.slice(0, 10) <= today ? lagosClock(timer.startedAt) : "");
  const sheet = mine?.week.sheet;
  const isLocked = locked(sheet?.status);
  const viewer = mine?.viewer;
  const tabs: { id: Tab; label: string }[] = [{ id: "now", label: "Timer" }, { id: "sheet", label: "Timesheet" }, { id: "leave", label: "Leave" }, ...(viewer?.approver ? [{ id: "team" as Tab, label: "Team" }, { id: "setup" as Tab, label: "Setup" }] : []), ...(viewer?.finance ? [{ id: "invoices" as Tab, label: "Invoices" }] : [])];

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;

  // Starting is a tap, so the browser lets us ask once to show the time check as a notification.
  const startNow = () => { try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* fine without */ } return run({ action: "start", ...target, billable, note: timerNote, plannedMinutes: planned }, "Timer started.").then((r) => { if (r) setTimerNote(""); }); };
  const csv = async () => {
    const r = await fetch(`/api/admin/time?view=team&week=${week}&csv=1`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    if (!r.ok) { setError("Couldn't export the CSV."); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = `team-time-${week}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const WeekNav = () => (
    <div className="flex items-center gap-2">
      <button className={ghost} onClick={() => setWeek(addDays(week, -7))}>‹ Week before</button>
      <span className="font-ui text-sm font-semibold text-ink">Week of {week ? longDay(week) : ""}</span>
      <button className={ghost} disabled={!today || addDays(week, 7) > today} onClick={() => setWeek(addDays(week, 7))}>Next ›</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin/team" className="font-ui text-xs font-semibold text-crimson">← Team hub</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Time</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        Track your hours on work items, projects, meetings or other work. The week is {WEEK_MINUTES / 60} hours: 4 a day, Monday to Friday. Hours are what count:
        approved hours are paid at your hourly rate. Your team lead or a super admin approves your timesheet. No screenshots, no keystrokes: only the hours you log.
      </p>
      <div role="tablist" className="mt-5 flex gap-2 overflow-x-auto">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-5 py-2 font-ui text-sm font-semibold ${tab === t.id ? "bg-crimson-deep text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`}>{t.label}</button>)}
      </div>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {mine?.stopped && <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink" role="status">{mine.stopped.flag === "midnight" ? "Your timer was still running at midnight, so it stopped then. Check the time below." : "Your timer stopped because the time check wasn't answered; the unanswered half hour isn't counted."}</p>}
      {!mine ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          {tab === "now" && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                {timer ? (
                  <div className="rounded-2xl bg-ink p-5 text-paper">
                    <p className="font-mono text-[11px] uppercase tracking-widest opacity-70">Tracking now</p>
                    <p className="mt-1 font-mono text-5xl font-bold"><Elapsed from={timer.startedAt} now={now} /></p>
                    <p className="mt-2 text-sm"><b>{timer.label}</b> · {KIND_LABEL[timer.kind]}{timer.dept ? ` · ${DEPT_LABEL[timer.dept as Dept] ?? timer.dept}` : ""}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {timer.billable && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-200">Billable</span>}
                      <span className="opacity-70">started {ampm(lagosClock(timer.startedAt))} · {asking(timer, new Date(now).toISOString()) ? `answer the time check by ${ampm(lagosClock(answerBy(timer)))}` : `next check-in ${ampm(lagosClock(timer.checkAt))}`}</span>
                    </p>
                    {timer.note && <p className="mt-1 text-xs opacity-80">{timer.note}</p>}
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 rounded-full bg-paper py-3 font-ui font-bold text-crimson disabled:opacity-50" disabled={busy} onClick={() => run({ action: "stop" }, "Stopped and saved.")}>■ Stop</button>
                      {asking(timer, new Date(now).toISOString()) && <button className="rounded-full border border-white/40 px-4 py-3 text-sm font-semibold" disabled={busy} onClick={() => run({ action: "confirm" }, "Thanks. Still tracking.")}>Yes, still working</button>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rule bg-card p-5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-slate">No timer running</p>
                    <p className="mt-1 font-display text-2xl text-ink">What are you working on?</p>
                  </div>
                )}
                <div className="rounded-2xl border border-rule bg-card p-4">
                  <p className="font-ui text-sm font-bold text-ink">{timer ? "Switch to something else" : "Start the timer"}</p>
                  <div className="mt-2"><TargetPicker choices={mine.choices} value={target} onChange={setTarget} /></div>
                  {target.kind === "meeting" && (
                    <div className="mt-3">
                      <p className="text-xs text-slate">How long is it planned for? The timer won&apos;t ask &quot;still working?&quot; until then.</p>
                      <div className="mt-2 flex flex-wrap gap-2">{MEETING_LENGTHS.map((m) => <button key={m} type="button" className={chip(planned === m)} onClick={() => setPlanned(m)}>{m < 60 ? `${m} min` : m === 60 ? "1 hour" : m === 90 ? "1½ hours" : `${m / 60} hours`}</button>)}</div>
                    </div>
                  )}
                  <input className={field} placeholder="Note (optional)" value={timerNote} onChange={(e) => setTimerNote(e.target.value)} aria-label="Note" />
                  {target.kind !== "project" && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable to a client</label>}
                  <button className={`${btn} mt-3 w-full`} disabled={busy || isLocked || (target.kind === "other" ? !target.label.trim() : !target.refId)} onClick={startNow}>▶ {timer ? "Switch" : "Start"}</button>
                  {isLocked && <p className="mt-2 text-xs text-slate">This week is {sheet?.status}. Ask your team lead to return it to add time.</p>}
                  <p className="mt-2 text-xs text-slate">One timer at a time: starting another stops the first. Every {CHECK_EVERY_MIN} minutes it asks if you&apos;re still working; no answer in 10 minutes stops it and the last half hour isn&apos;t counted. A timer still running at midnight stops itself.</p>
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between"><h2 className="font-display text-2xl text-ink">Today</h2><p className="text-sm"><b>{hm(todayMinutes)}</b>{firstIn && <span className="text-slate"> · in at {ampm(firstIn)}{firstIn > LATE_AFTER ? " (after 9)" : ""}</span>}</p></div>
                <ul className="mt-2 space-y-2 text-sm">
                  {todayEntries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-rule">
                      <span className="min-w-0"><span className="block truncate">{e.label}</span><span className="text-xs text-slate">{KIND_LABEL[e.kind]}{e.startedAt ? ` · ${ampm(lagosClock(e.startedAt))}–${ampm(lagosClock(e.endedAt))}` : e.source === "adjust" ? " · correction" : " · added by hand"}{e.billable ? " · billable" : ""}{e.flag ? ` · ${e.flag === "midnight" ? "stopped at midnight: check it" : "stopped: no answer"}` : ""}</span></span>
                      <span className="flex items-center gap-2"><b>{clock(e.minutes)}</b>{!isLocked && <button className="text-xs text-slate underline" disabled={busy} onClick={() => { if (confirm(`Delete ${hm(e.minutes)} on “${e.label}”?`)) void run({ action: "deleteEntry", id: e.id }, "Deleted."); }}>Delete</button>}</span>
                    </li>
                  ))}
                  {timer && <li className="flex justify-between rounded-xl bg-card p-3 ring-1 ring-rule"><span>{timer.label} <span className="text-xs text-emerald-700">· running</span></span><b>{clock(Math.floor((now - Date.parse(timer.startedAt)) / 60000))}</b></li>}
                  {!todayEntries.length && !timer && <li className="rounded-xl border border-dashed border-rule p-3 text-slate">Nothing tracked yet today.</li>}
                  <li>
                    {!manual.open ? (
                      <button className="w-full rounded-xl border border-dashed border-rule p-3 text-left text-slate hover:border-crimson" disabled={isLocked} onClick={() => setManual({ ...manual, open: true, day: today })}>＋ Add time by hand</button>
                    ) : (
                      <form className="rounded-xl border border-rule bg-card p-3" onSubmit={async (ev) => { ev.preventDefault(); const r = await run({ action: "manual", ...manual }, "Added."); if (r) setManual({ ...manual, open: false, duration: "", note: "" }); }}>
                        <TargetPicker choices={mine.choices} value={manual} onChange={(v) => setManual({ ...manual, ...v })} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="text-xs">Day<input className={field} type="date" max={today} value={manual.day} onChange={(e) => setManual({ ...manual, day: e.target.value })} required /></label>
                          <label className="text-xs">How long<input className={field} placeholder="1:30, 1h30 or 90m" value={manual.duration} onChange={(e) => setManual({ ...manual, duration: e.target.value })} required /></label>
                        </div>
                        <input className={field} placeholder="Note (optional)" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} aria-label="Note" />
                        {manual.kind !== "project" && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={manual.billable} onChange={(e) => setManual({ ...manual, billable: e.target.checked })} /> Billable to a client</label>}
                        <div className="mt-3 flex gap-2"><button className={btn} disabled={busy}>Add</button><button type="button" className={ghost} onClick={() => setManual({ ...manual, open: false })}>Cancel</button></div>
                      </form>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {tab === "sheet" && sheet && (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <WeekNav />
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[sheet.status]}`}>{STATUS_TEXT[sheet.status].toUpperCase()}</span>
                  {sheet.status === "draft" && <button className={btn} disabled={busy} onClick={() => { if (confirm("Submit this week for approval? It locks until it's approved or returned.")) void run({ action: "submit", week }, "Submitted. Your team lead has been told."); }}>Submit for approval</button>}
                </div>
              </div>
              {sheet.returnNote && sheet.status === "draft" && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">Returned to you: {sheet.returnNote}</p>}
              <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile label="Tracked" value={hm(mine.week.summary.tracked)} sub={`of a ${WEEK_MINUTES / 60} h week (${pct(mine.week.summary.tracked, WEEK_MINUTES)}%)`} />
                <Tile label="Billable" value={hm(mine.week.summary.billable)} sub={`${pct(mine.week.summary.billable, mine.week.summary.tracked)}% of tracked`} tone="text-emerald-700" />
                <Tile label="On assigned work" value={`${pct(mine.week.summary.assigned, mine.week.summary.tracked)}%`} sub={`${100 - pct(mine.week.summary.assigned, mine.week.summary.tracked)}% unassigned`} />
                <Tile label="Attendance" value={`${mine.week.summary.daysPresent} of ${mine.week.summary.daysDue} days`} sub={[mine.week.summary.firstInAvg && `first in ${ampm(mine.week.summary.firstInAvg)} avg`, mine.week.summary.leaveDays && `${mine.week.summary.leaveDays} on leave`].filter(Boolean).join(" · ") || "no days due yet"} />
              </div>
              {mine.week.hourlyKobo > 0 && <p className="mt-3 text-sm text-slate">Pay: {sheet.status === "approved" ? <b className="text-ink">{naira(mine.week.payKobo)}</b> : "once approved,"} at {naira(mine.week.hourlyKobo)} an hour, in the month&apos;s payroll run.</p>}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="text-xs text-slate"><th className="py-2 text-left">Work</th>{weekDays(week).map((d) => <th key={d} className="px-1">{dayLabel(d)}</th>)}<th>Total</th><th>Billable</th></tr></thead>
                  <tbody>
                    {mine.week.rows.map((r) => (
                      <tr key={r.key} className="border-t border-rule">
                        <td className="py-3 pr-3"><b className="font-ui">{r.label}</b><br /><span className="text-xs text-slate">{kindOf(r)}</span></td>
                        {weekDays(week).map((d) => {
                          const m = r.days[d] ?? 0;
                          const editing = cell?.key === r.key && cell.day === d;
                          return (
                            <td key={d} className="px-1 text-center">
                              {editing ? (
                                <form onSubmit={async (ev) => { ev.preventDefault(); const ok = await run({ action: "cell", kind: r.kind, refId: r.refId, label: r.label, billable: r.billable, day: d, duration: cell.value }, "Saved."); if (ok) setCell(null); }}>
                                  <input autoFocus className="w-16 rounded border border-crimson px-1 py-0.5 text-center text-sm" value={cell.value} onChange={(e) => setCell({ ...cell, value: e.target.value })} onBlur={() => setCell(null)} aria-label={`Time on ${d}`} />
                                </form>
                              ) : (
                                <button className={`w-16 rounded py-1 ${m ? "" : "text-slate"} ${isLocked || d > today ? "cursor-default" : "hover:bg-paper"}`} disabled={isLocked || d > today} onClick={() => setCell({ key: r.key, day: d, value: m ? clock(m) : "" })}>{m ? clock(m) : "–"}</button>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center font-bold">{clock(r.total)}</td>
                        <td className="text-center">{r.billable ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Billable</span> : <span className="text-xs text-slate">No</span>}</td>
                      </tr>
                    ))}
                    {!mine.week.rows.length && <tr><td colSpan={10} className="py-6 text-center text-slate">No time this week yet. Start the timer, or add time by hand.</td></tr>}
                    <tr className="border-t-2 border-ink font-bold">
                      <td className="py-3">Each day</td>
                      {mine.week.summary.days.map((d) => <td key={d.day} className="text-center">{d.minutes ? clock(d.minutes) : d.leave ? <span className="text-xs font-normal text-slate">{LEAVE_LABEL[d.leave].split(" ")[0]}</span> : <span className="text-slate">–</span>}</td>)}
                      <td className="text-center">{clock(mine.week.summary.tracked)}</td><td />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-slate">Tap a cell to change it (the difference is kept as a correction). After you submit, your team lead or a super admin approves it and the week locks; changes after that need them to return it. Friday 4 pm: a reminder if the week isn&apos;t submitted.</p>
            </div>
          )}

          {tab === "leave" && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <form className="rounded-2xl border border-rule bg-card p-4" onSubmit={async (ev) => { ev.preventDefault(); const r = await run({ action: "leave", ...leaveForm }, "Sent to your team lead."); if (r) setLeaveForm({ ...leaveForm, from: "", to: "", note: "" }); }}>
                <p className="font-ui text-sm font-bold text-ink">Ask for leave</p>
                <div className="mt-2 flex flex-wrap gap-2">{(["annual", "sick", "holiday", "other"] as LeaveKind[]).map((k) => <button key={k} type="button" className={chip(leaveForm.kind === k)} onClick={() => setLeaveForm({ ...leaveForm, kind: k })}>{LEAVE_LABEL[k].replace(" leave", "")}</button>)}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs">From<input className={field} type="date" required value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value, to: leaveForm.to || e.target.value })} /></label>
                  <label className="text-xs">To<input className={field} type="date" required min={leaveForm.from} value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} /></label>
                </div>
                <input className={field} placeholder="Note (optional)" value={leaveForm.note} onChange={(e) => setLeaveForm({ ...leaveForm, note: e.target.value })} aria-label="Note" />
                <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={leaveForm.counts} onChange={(e) => setLeaveForm({ ...leaveForm, counts: e.target.checked })} /><span><b>Counts towards attendance</b><br /><span className="text-xs text-slate">These days count as present, not absent. Leave isn&apos;t paid hours unless finance adds it to the run.</span></span></label>
                <button className={`${btn} mt-3 w-full`} disabled={busy}>Send to my team lead</button>
              </form>
              <div>
                <h2 className="font-display text-2xl text-ink">My leave</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {mine.leave.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-rule">
                      <span><b>{l.uid === "*" ? `${l.note || "Public holiday"} (everyone)` : LEAVE_LABEL[l.kind]}</b><br /><span className="text-xs text-slate">{longDay(l.from)}{l.to !== l.from ? ` to ${longDay(l.to)}` : ""} · {leaveDays(l).length} day{leaveDays(l).length === 1 ? "" : "s"} · {l.counts ? "counts towards attendance" : "doesn't count towards attendance"}</span></span>
                      <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${l.status === "approved" ? "bg-emerald-50 text-emerald-700" : l.status === "declined" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{l.status}</span>{l.status === "pending" && l.uid !== "*" && <button className="text-xs text-slate underline" onClick={() => run({ action: "cancelLeave", id: l.id }, "Cancelled.")}>Cancel</button>}</span>
                    </li>
                  ))}
                  {!mine.leave.length && <li className="rounded-xl border border-dashed border-rule p-3 text-slate">No leave yet.</li>}
                </ul>
              </div>
            </div>
          )}

          {tab === "team" && viewer?.approver && (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3"><WeekNav /><button className={ghost} onClick={csv}>Export CSV</button></div>
              {!team ? <p className="mt-6 text-slate">Loading…</p> : (
                <>
                  {team.leaveToDecide.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                      <p className="font-ui text-sm font-bold text-ink">Leave to decide</p>
                      <ul className="mt-2 space-y-2 text-sm">{team.leaveToDecide.map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span><b>{l.name}</b>: {LEAVE_LABEL[l.kind]}, {longDay(l.from)}{l.to !== l.from ? ` to ${longDay(l.to)}` : ""} ({l.days} day{l.days === 1 ? "" : "s"}){l.note ? ` · ${l.note}` : ""} · {l.counts ? "counts towards attendance" : "doesn't count"}</span>
                          <span className="flex gap-2"><button className={ghost} disabled={busy} onClick={() => run({ action: "decideLeave", id: l.id, decision: "approve" }, "Approved.", true)}>Approve</button><button className={ghost} disabled={busy} onClick={() => run({ action: "decideLeave", id: l.id, decision: "approve", counts: !l.counts }, "Approved.", true)}>Approve, {l.counts ? "not counting" : "counting"}</button><button className={ghost} disabled={busy} onClick={() => run({ action: "decideLeave", id: l.id, decision: "decline" }, "Declined.", true)}>Decline</button></span>
                        </li>
                      ))}</ul>
                    </div>
                  )}
                  <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                    <div className="card overflow-x-auto p-5">
                      <p className="font-ui font-bold">People</p>
                      <table className="mt-2 w-full min-w-[560px] text-sm">
                        <thead><tr className="text-xs text-slate"><th className="py-2 text-left">Name</th><th>Tracked</th><th>Billable</th><th>Assigned</th><th>Days</th>{viewer.finance && <th>Pay</th>}<th>Timesheet</th></tr></thead>
                        <tbody>{team.rows.map((r) => (
                          <tr key={r.uid} className="border-t border-rule">
                            <td className="py-2.5"><b className="font-ui">{r.name}</b><br /><span className="text-xs text-slate">{leadsLabel(r.depts) || "No department"}</span></td>
                            <td className="text-center">{clock(r.summary.tracked)}<div className="mx-auto mt-1 h-1.5 w-16 rounded bg-rule"><div className="h-1.5 rounded bg-crimson" style={{ width: `${Math.min(100, pct(r.summary.tracked, WEEK_MINUTES))}%` }} /></div></td>
                            <td className="text-center">{pct(r.summary.billable, r.summary.tracked)}%</td>
                            <td className="text-center">{pct(r.summary.assigned, r.summary.tracked)}%</td>
                            <td className="text-center">{r.summary.daysPresent}/{r.summary.daysDue}{r.summary.leaveDays ? <><br /><span className="text-[10px] text-slate">{r.summary.leaveDays} leave</span></> : null}{r.summary.late ? <><br /><span className="text-[10px] text-slate">{r.summary.late} after 9</span></> : null}</td>
                            {viewer.finance && <td className="text-center">{r.payKobo ? <>{naira(r.payKobo)}<br /><span className="text-[10px] text-slate">{clock(r.summary.tracked)} × {naira(r.hourlyKobo ?? 0)}</span></> : r.hourlyKobo ? <span className="text-xs text-slate">on approval</span> : <span className="text-xs text-slate">no rate</span>}</td>}
                            <td className="text-center">
                              {r.status === "submitted" && r.canApprove ? (
                                <span className="flex flex-col items-center gap-1">
                                  <button className="rounded-full bg-crimson px-3 py-1 text-xs font-bold text-paper" disabled={busy} onClick={() => run({ action: "decide", uid: r.uid, week, decision: "approve" }, `${r.name}'s week is approved.`, true)}>Approve</button>
                                  <button className="text-[11px] text-slate underline" disabled={busy} onClick={() => { const n = prompt("Why are you returning it? (They'll see this.)") ?? null; if (n !== null) void run({ action: "decide", uid: r.uid, week, decision: "return", note: n }, "Returned.", true); }}>Return</button>
                                </span>
                              ) : (
                                <span className="flex flex-col items-center gap-1">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_PILL[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                                  {r.status === "approved" && r.canApprove && <button className="text-[11px] text-slate underline" disabled={busy} onClick={() => { const n = prompt("Reopen this week? Say why (they'll see this).") ?? null; if (n !== null) void run({ action: "decide", uid: r.uid, week, decision: "return", note: n }, "Reopened.", true); }}>Reopen</button>}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="card p-5">
                      <p className="font-ui font-bold">Projects</p>
                      <div className="mt-3 space-y-4 text-sm">
                        {team.projects.filter((p) => p.active).map((p) => {
                          const used = p.minutes / 60, over = p.budgetHours > 0 && used > p.budgetHours, share = p.budgetHours ? Math.min(100, (used / p.budgetHours) * 100) : 0;
                          return (
                            <div key={p.id}>
                              <div className="flex justify-between gap-2"><b>{p.name}</b><span>{Math.round(used)}h{p.budgetHours ? ` / ${p.budgetHours}h` : ""}</span></div>
                              {p.budgetHours > 0 && <div className="mt-1 h-2 rounded bg-rule"><div className={`h-2 rounded ${over ? "bg-red-600" : share > 85 ? "bg-amber-500" : "bg-crimson"}`} style={{ width: `${share}%` }} /></div>}
                              <p className={`mt-1 text-xs ${over ? "text-red-700" : "text-slate"}`}>{over ? `Over budget by ${Math.round(used - p.budgetHours)}h · ` : ""}{p.billable ? `${p.client ? `Client: ${p.client} · ` : ""}${naira(p.rateKobo)}/h · ${naira(Math.round((p.billableMinutes * p.rateKobo) / 60))} billable` : "Internal · not billed"}</p>
                            </div>
                          );
                        })}
                        {!team.projects.some((p) => p.active) && <p className="text-slate">No projects yet. Add them under Setup.</p>}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate">Team leads see their own departments; super admins see everyone; staff see only their own time. Productivity is hours against the {WEEK_MINUTES / 60}-hour week and the share on assigned work, never screenshots or keystrokes. {viewer.finance ? "Pay shows for approved weeks." : ""}</p>
                </>
              )}
            </div>
          )}

          {tab === "invoices" && viewer?.finance && <InvoicesTab user={user} today={today} />}

          {tab === "setup" && viewer?.approver && (
            <SetupTab team={team} viewer={viewer} busy={busy} run={(b, ok) => run(b, ok, true)} />
          )}
        </>
      )}
    </div>
  );
}

function SetupTab({ team, viewer, busy, run }: { team: Team | null; viewer: Mine["viewer"]; busy: boolean; run: (b: Record<string, unknown>, ok: string) => Promise<unknown> }) {
  const blank = { id: "", name: "", client: "", clientEmail: "", dept: viewer.superAdmin ? "" : viewer.leads[0] ?? "", billable: true, rate: "", budgetHours: "" };
  const [p, setP] = useState(blank);
  const [lead, setLead] = useState<{ uid: string; depts: string[] }>({ uid: "", depts: [] });
  const [hol, setHol] = useState({ from: "", to: "", note: "" });
  if (!team) return <p className="mt-6 text-slate">Loading…</p>;
  const depts = viewer.superAdmin ? DEPARTMENTS.map((d) => d.key as string) : viewer.leads;
  const leadOf = (uid: string) => team.leads.find((l) => l.uid === uid)?.depts ?? [];
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-rule bg-card p-4">
        <p className="font-ui text-sm font-bold text-ink">{p.id ? "Edit project" : "Add a project"}</p>
        <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const r = await run({ action: "project", ...p }, p.id ? "Saved." : "Project added."); if (r) setP(blank); }}>
          <label className="text-xs sm:col-span-2">Name<input className={field} required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
          <label className="text-xs">Client<input className={field} value={p.client} onChange={(e) => setP({ ...p, client: e.target.value })} /></label>
          <label className="text-xs">Client&apos;s email <span className="text-slate">(for invoices)</span><input className={field} type="email" value={p.clientEmail} onChange={(e) => setP({ ...p, clientEmail: e.target.value })} /></label>
          <label className="text-xs">Department<select className={field} value={p.dept} onChange={(e) => setP({ ...p, dept: e.target.value })} required={!viewer.superAdmin}>{viewer.superAdmin && <option value="">Whole team</option>}{depts.map((d) => <option key={d} value={d}>{DEPT_LABEL[d as Dept] ?? d}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={p.billable} onChange={(e) => setP({ ...p, billable: e.target.checked })} /> Billable to the client</label>
          {p.billable && <label className="text-xs">Hourly rate to the client, ₦<input className={field} inputMode="decimal" required value={p.rate} onChange={(e) => setP({ ...p, rate: e.target.value })} /></label>}
          <label className="text-xs">Budget, hours <span className="text-slate">(0 for none)</span><input className={field} inputMode="numeric" value={p.budgetHours} onChange={(e) => setP({ ...p, budgetHours: e.target.value })} /></label>
          <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{p.id ? "Save" : "Add project"}</button>{p.id && <button type="button" className={ghost} onClick={() => setP(blank)}>Cancel</button>}</div>
        </form>
        <ul className="mt-4 divide-y divide-rule text-sm">
          {team.projects.map((x) => (
            <li key={x.id} className={`flex items-center justify-between gap-2 py-2 ${x.active ? "" : "opacity-60"}`}>
              <span><b>{x.name}</b><br /><span className="text-xs text-slate">{x.dept ? DEPT_LABEL[x.dept as Dept] : "Whole team"} · {x.billable ? `${naira(x.rateKobo)}/h` : "internal"}{x.budgetHours ? ` · ${x.budgetHours}h budget` : ""} · {hm(x.minutes)} logged</span></span>
              <span className="flex gap-2">
                <button className={ghost} onClick={() => setP({ id: x.id, name: x.name, client: x.client, clientEmail: x.clientEmail ?? "", dept: x.dept, billable: x.billable, rate: x.rateKobo ? String(x.rateKobo / 100) : "", budgetHours: String(x.budgetHours || "") })}>Edit</button>
                <button className={ghost} disabled={busy} onClick={() => run({ action: "project", id: x.id, name: x.name, client: x.client, clientEmail: x.clientEmail ?? "", dept: x.dept, billable: x.billable, rate: x.rateKobo / 100, budgetHours: x.budgetHours, active: !x.active }, x.active ? "Closed." : "Reopened.")}>{x.active ? "Close" : "Reopen"}</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {viewer.superAdmin && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-rule bg-card p-4">
            <p className="font-ui text-sm font-bold text-ink">Team leads</p>
            <p className="mt-1 text-xs text-slate">A team lead approves timesheets and leave for the departments they lead, and sets up their projects, but never approves their own.</p>
            <ul className="mt-2 space-y-1 text-sm">{team.leads.map((l) => <li key={l.uid} className="flex justify-between"><span>{team.people.find((x) => x.uid === l.uid)?.name ?? l.uid}</span><span className="text-slate">{leadsLabel(l.depts)}</span></li>)}{!team.leads.length && <li className="text-slate">No team leads yet: super admins approve everything.</li>}</ul>
            <form className="mt-3 space-y-2" onSubmit={async (e) => { e.preventDefault(); const r = await run({ action: "lead", ...lead }, lead.depts.length ? "Team lead saved." : "No longer a team lead."); if (r) setLead({ uid: "", depts: [] }); }}>
              <select className={field} value={lead.uid} required onChange={(e) => setLead({ uid: e.target.value, depts: leadOf(e.target.value) })} aria-label="Person"><option value="">Choose a person</option>{team.people.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}</select>
              {lead.uid && <div className="flex flex-wrap gap-x-4 gap-y-1">{DEPARTMENTS.map((d) => <label key={d.key} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={lead.depts.includes(d.key)} onChange={(e) => setLead({ ...lead, depts: e.target.checked ? [...lead.depts, d.key] : lead.depts.filter((x) => x !== d.key) })} /> {d.label}</label>)}</div>}
              <button className={btn} disabled={busy || !lead.uid}>Save</button>
            </form>
          </div>
          <div className="rounded-2xl border border-rule bg-card p-4">
            <p className="font-ui text-sm font-bold text-ink">Public holidays</p>
            <p className="mt-1 text-xs text-slate">For everyone on the team; they count towards attendance.</p>
            <ul className="mt-2 space-y-1 text-sm">{team.holidays.map((h) => <li key={h.id} className="flex justify-between"><span>{h.note} · {longDay(h.from)}{h.to !== h.from ? ` to ${longDay(h.to)}` : ""}</span><button className="text-xs text-slate underline" onClick={() => run({ action: "removeHoliday", id: h.id }, "Removed.")}>Remove</button></li>)}</ul>
            <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await run({ action: "holiday", ...hol, counts: true }, "Holiday added."); if (r) setHol({ from: "", to: "", note: "" }); }}>
              <label className="col-span-2 text-xs">Holiday<input className={field} required placeholder="Independence Day" value={hol.note} onChange={(e) => setHol({ ...hol, note: e.target.value })} /></label>
              <label className="text-xs">From<input className={field} type="date" required value={hol.from} onChange={(e) => setHol({ ...hol, from: e.target.value, to: hol.to || e.target.value })} /></label>
              <label className="text-xs">To<input className={field} type="date" required value={hol.to} onChange={(e) => setHol({ ...hol, to: e.target.value })} /></label>
              <button className={`${btn} col-span-2`} disabled={busy}>Add holiday</button>
            </form>
                      </div>
        </div>
      )}
    </div>
  );
}
