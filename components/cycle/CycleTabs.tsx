"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHAT_MAX, MOODS, PHASE_COLOUR, PHASE_LABEL, addDays, daysBetween, type DayKind } from "@/lib/cycle";
import type { CycleData } from "@/lib/cycle-client";

// The four tabs of My Cycle (components/cycle/MyCycle.tsx): Today, Calendar, Insights and Ask Nana. Everything shown comes from the
// server's view (lib/cycle-server.ts cycleView); a teen's view has no ovulation, fertile window or pill mode in it at all.

export type Call = <T>(body: Record<string, unknown>, method?: string) => Promise<T>;
type Advice = { text: string; ai: boolean; notice?: string };

export const fmt = (day: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const card = "rounded-2xl border border-rule bg-card p-3";
const noteBox = "rounded-xl border border-[#F1D48A] bg-[#FFF4D6] px-3 py-2 text-xs leading-relaxed text-[#5a4300]";
export const nanaBox = "rounded-2xl border border-[#f0cbd6] bg-gradient-to-br from-card to-[#fbeff3] px-3 py-2.5 text-[13px] leading-relaxed text-ink";

// ── 3 · Today ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function Ring({ t }: { t: CycleData["today"] }) {
  const total = t.pill ? 28 : t.length;
  const r = 62, c = 2 * Math.PI * r;
  const day = t.day ? Math.min(t.day, total) : null;
  const angle = day ? ((day - 0.5) / total) * 2 * Math.PI - Math.PI / 2 : 0;
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(var(--c-rule, 231 218 211))" strokeWidth="18" />
        {t.ring.map((s, i) => {
          const len = ((s.to - s.from + 1) / total) * c;
          const off = ((s.from - 1) / total) * c;
          return <circle key={i} cx="80" cy="80" r={r} fill="none" stroke={PHASE_COLOUR[s.phase]} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />;
        })}
      </svg>
      {day && <span className="absolute h-4 w-4 rounded-full border-[3px] border-ink bg-white" style={{ left: `calc(50% + ${Math.cos(angle) * 38.75}% - 8px)`, top: `calc(50% + ${Math.sin(angle) * 38.75}% - 8px)` }} aria-hidden />}
      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-paper text-center">
        {t.day ? (
          <>
            <b className="font-display text-3xl leading-none text-ink">Day {t.day}</b>
            <span className="mt-1 text-[11px] text-slate">{t.pill ? "of a 28-day pack" : `of about ${t.length}`}</span>
            {t.phase && <span className="text-[11px] font-bold" style={{ color: t.phase === "menstrual" || t.phase === "break" ? "#A6093D" : "#17694a" }}>{PHASE_LABEL[t.phase]}</span>}
          </>
        ) : <span className="px-2 text-xs text-slate">Log your last period to start</span>}
      </div>
    </div>
  );
}

export function TodayTab({ data, call, onCheckIn }: { data: CycleData; call: Call; onCheckIn: () => void }) {
  const t = data.today;
  const adult = t as typeof t & { ovulation?: string | null; fertileStart?: string | null; fertileEnd?: string | null };
  const [note, setNote] = useState<Advice | null>(data.note ? { text: data.note.text, ai: data.note.ai } : null);
  const [open, setOpen] = useState<"food" | "move" | null>(null);
  useEffect(() => {
    if (note) return;
    let live = true;
    call<Advice>({ action: "note" }).then((n) => { if (live) setNote(n); }).catch(() => {});
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const logged = data.logs.some((l) => l.day === t.today);

  let second: { big: string; small: string } | null = null;
  if (t.pill && t.day) second = t.phase === "active" ? { big: `${21 - t.day + 1} left`, small: `active pill days in this pack` } : { big: "Break", small: `next pack starts ${t.nextPeriod ? fmt(addDays(t.nextPeriod, 7)) : "soon"}` };
  else if (!data.teen && adult.fertileStart && adult.fertileEnd && t.day) {
    const a = daysBetween(t.today, adult.fertileStart), b = daysBetween(t.today, adult.fertileEnd);
    second = a > 0 ? { big: `In ${a} day${a === 1 ? "" : "s"}`, small: `Fertile window starts ${fmt(adult.fertileStart)} (estimate)` }
      : b >= 0 ? { big: "Now", small: `Fertile window until ${fmt(adult.fertileEnd)} (estimate)` }
      : { big: "Done", small: `Fertile window ended ${fmt(adult.fertileEnd)}` };
  } else if (t.setUp) second = { big: `${t.periodDays} days`, small: "your periods usually last" };

  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
      <div className="flex flex-col gap-3">
        <Ring t={t} />
        {t.setUp && t.earlyGuess && <p className="text-center text-[11px] font-semibold text-slate">Early guess: it gets better with each period you log.</p>}
        <div className="grid grid-cols-2 gap-2">
          <div className={card}>
            {t.nextPeriod && t.daysToNext !== null ? (
              t.late > 0 ? <><b className="block font-display text-xl text-ink">{t.late} day{t.late === 1 ? "" : "s"} late</b><span className="text-xs text-slate">than the estimate. Log it when it starts.</span></>
                : <><b className="block font-display text-xl text-ink">{t.daysToNext} day{t.daysToNext === 1 ? "" : "s"}</b><span className="text-xs text-slate">until your {t.pill ? "break" : "next period"} (about {fmt(t.nextPeriod)})</span></>
            ) : <><b className="block font-display text-xl text-ink">–</b><span className="text-xs text-slate">Log your last period to see your next one</span></>}
          </div>
          {second && <div className={card}><b className="block font-display text-xl text-ink">{second.big}</b><span className="text-xs text-slate">{second.small}</span></div>}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {data.flags.length > 0 && <p className="rounded-xl border border-[#E0123E] bg-[#fff1f3] px-3 py-2 text-xs leading-relaxed text-[#8c0026]">You logged {data.flags.join(", ")}. Please see a doctor or clinic{data.teen ? ", and tell a trusted adult" : ""}. In an emergency, go to the nearest hospital.</p>}
        <div className={nanaBox}>
          <b className="text-crimson">Nana · today</b><br />
          {note ? note.text : <span className="text-slate">Nana is thinking…</span>}
          {note && !note.ai && <span className="mt-1 block text-[11px] text-slate">Nana&apos;s tips for this phase.</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOpen(open === "food" ? null : "food")} aria-expanded={open === "food"} className={`${card} text-left`}><span aria-hidden>🥗</span> <b className="font-ui text-sm text-ink">Food for today</b><span className="block text-xs text-slate">Phase-matched ideas</span></button>
          <button type="button" onClick={() => setOpen(open === "move" ? null : "move")} aria-expanded={open === "move"} className={`${card} text-left`}><span aria-hidden>🏃🏾‍♀️</span> <b className="font-ui text-sm text-ink">Move today</b><span className="block text-xs text-slate">{data.tips.moveLevel}</span></button>
        </div>
        {open && (
          <ul className={`${card} list-disc space-y-1 pl-7 text-[13px] text-ink`}>
            {(open === "food" ? data.tips.food : data.tips.move).map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
        <button type="button" onClick={onCheckIn} className="rounded-full bg-crimson py-3 font-ui text-sm font-bold text-white">{logged ? "✓ Edit today's check-in" : "＋ Today's check-in"}</button>
      </div>
    </div>
  );
}

// ── 4 · Calendar ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const KIND_CLASS: Record<DayKind, string> = {
  period: "bg-[#FBD3DC] text-[#8c0026] font-bold",
  predicted: "border-[1.5px] border-dashed border-[#E0123E] text-[#8c0026]",
  fertile: "bg-[#D6F0E4] text-[#17694a]",
  ovulation: "bg-[#F2C14E] text-[#4d3800] font-extrabold",
  active: "bg-[#efe3fa] text-[#4b2a6b]",
  break: "bg-[#FBD3DC] text-[#8c0026]",
};

export function CalendarTab({ data, call, reload, onCheckIn }: { data: CycleData; call: Call; reload: () => Promise<void>; onCheckIn: (day: string) => void }) {
  const today = data.today.today;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const days = daysBetween(first, `${nextMonth(month)}-01`);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  const startedToday = data.periods.some((p) => p.start === today);
  const loggedDays = new Set(data.logs.map((l) => l.day));
  const minMonth = addDays(today, -95).slice(0, 7), maxMonth = addDays(today, 120).slice(0, 7);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try { await call(body); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); } finally { setBusy(false); }
  };
  const periodOf = (d: string) => data.periods.find((p) => daysBetween(p.start, d) >= 0 && daysBetween(p.start, d) < 10);

  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr] lg:gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <b className="font-ui text-base text-ink">{fmt(first, { month: "long", year: "numeric" })}</b>
          <span className="flex gap-1">
            <button type="button" aria-label="Previous month" disabled={month <= minMonth} onClick={() => setMonth(prevMonth(month))} className="h-8 w-8 rounded-full text-slate hover:bg-card disabled:opacity-30">‹</button>
            <button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(nextMonth(month))} className="h-8 w-8 rounded-full text-slate hover:bg-card disabled:opacity-30">›</button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[13px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="py-0.5 text-[10px] text-slate">{d}</span>)}
          {cells.map((d, i) => d ? (
            <button key={d} type="button" onClick={() => setPicked(d)} disabled={daysBetween(d, today) < 0 && !data.calendar[d]}
              className={`relative rounded-lg py-1.5 ${data.calendar[d] ? KIND_CLASS[data.calendar[d] as DayKind] : "text-ink"} ${d === today ? "outline outline-2 outline-ink" : ""} ${picked === d ? "ring-2 ring-crimson" : ""}`}>
              {Number(d.slice(8))}{data.calendar[d] === "ovulation" ? "★" : ""}
              {loggedDays.has(d) && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-crimson" aria-label="checked in" />}
            </button>
          ) : <span key={`b${i}`} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#FBD3DC] align-[-1px]" />Period (logged)</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-[1.5px] border-dashed border-[#E0123E] align-[-1px]" />Period (predicted)</span>
          {!data.teen && !data.today.pill && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#D6F0E4] align-[-1px]" />Fertile window</span>}
          {!data.teen && !data.today.pill && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#F2C14E] align-[-1px]" />Ovulation (estimate)</span>}
          {data.today.pill && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#efe3fa] align-[-1px]" />Active pill days</span>}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {picked && (
          <div className={`${card} text-sm`}>
            <b className="font-ui text-ink">{fmt(picked, { weekday: "long", day: "numeric", month: "long" })}</b>
            {daysBetween(picked, today) >= 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {data.periods.some((p) => p.start === picked)
                  ? <button type="button" disabled={busy} onClick={() => run({ action: "period", op: "remove", day: picked })} className="btn-ghost !py-1.5 text-xs">Not a period start</button>
                  : <button type="button" disabled={busy} onClick={() => run({ action: "period", op: "start", day: picked })} className="btn-primary !py-1.5 text-xs">My period started this day</button>}
                {periodOf(picked) && periodOf(picked)!.start !== picked && <button type="button" disabled={busy} onClick={() => run({ action: "period", op: "end", start: periodOf(picked)!.start, day: picked })} className="btn-ghost !py-1.5 text-xs">It ended this day</button>}
                <button type="button" onClick={() => onCheckIn(picked)} className="btn-ghost !py-1.5 text-xs">{loggedDays.has(picked) ? "Edit check-in" : "Check in for this day"}</button>
              </div>
            ) : <p className="mt-1 text-xs text-slate">A day still to come. Predictions are estimates.</p>}
          </div>
        )}
        <div className={card}>
          <Toggle label="Period started today" on={startedToday} disabled={busy} onChange={(v) => run({ action: "period", op: v ? "start" : "remove", day: today })} />
          {!data.teen && <Toggle label="Taking the pill (shows Active / Break)" on={data.settings.pill} disabled={busy} border onChange={(v) => run({ action: "settings", pill: v, ...(v ? { pillStart: data.settings.pillStart || data.periods[data.periods.length - 1]?.start || today } : {}) })} />}
        </div>
        {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
        <p className={noteBox}>Predictions get better with each period you log. With fewer than 3, they&apos;re marked &quot;early guess&quot;. Not for use as contraception.</p>
      </div>
    </div>
  );
}

const nextMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };
const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };

export function Toggle({ label, on, onChange, disabled, border }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; border?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-2 text-[13px] text-ink ${border ? "border-t border-rule" : ""}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-crimson" : "bg-[#cfc3bc]"} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

// ── 6 · Insights ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function InsightsTab({ data, call }: { data: CycleData; call: Call }) {
  const ins = data.insights;
  const [report, setReport] = useState<Advice | null>(data.report ? { text: data.report.text, ai: data.report.ai } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const max = Math.max(...ins.lengths, 35);
  const curve = useMemo(() => {
    if (ins.moodCurve.length < 2) return null;
    const L = Math.max(data.today.length, ...ins.moodCurve.map((m) => m.day));
    return ins.moodCurve.map((m) => `${((m.day - 1) / (L - 1)) * 300},${35 - m.score * 28}`).join(" ");
  }, [ins.moodCurve, data.today.length]);
  const top = ins.topSymptoms[0]?.count ?? 1;
  const ask = async () => {
    setBusy(true); setError("");
    try { setReport(await call<Advice>({ action: "report", fresh: !!report })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't make the report."); } finally { setBusy(false); }
  };
  const lbl = "mb-2 font-ui text-xs font-bold text-ink";
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <div className="flex flex-col gap-4">
        <section>
          <h2 className={lbl}>Your last {ins.lengths.length > 1 ? `${ins.lengths.length} cycles` : "cycles"}</h2>
          {ins.lengths.length ? (
            <>
              <div className="flex h-24 items-end gap-2 pt-4">
                {ins.lengths.map((n, i) => <div key={i} className="relative flex-1 rounded-t-md bg-crimson/85" style={{ height: `${(n / max) * 100}%` }}><span className="absolute -top-4 inset-x-0 text-center text-[10px] text-slate">{n}</span></div>)}
              </div>
              <p className="mt-1 text-[11px] text-slate">Average {ins.average} days{ins.spread !== null ? ` · spread ${ins.spread} days: ${ins.regular ? "regular" : "a bit irregular, which is common"}` : ""}</p>
            </>
          ) : <p className="text-xs text-slate">Log two periods to see your cycle lengths.</p>}
        </section>
        <section>
          <h2 className={lbl}>Mood across your cycle</h2>
          {curve ? (
            <>
              <svg viewBox="0 0 300 70" className="h-16 w-full" aria-label="Your mood by cycle day"><polyline fill="none" stroke="#A6093D" strokeWidth="3" strokeLinejoin="round" points={curve} /><line x1="0" x2="300" y1="35" y2="35" stroke="#ccc" strokeDasharray="3" /></svg>
              {ins.beforePeriod.length > 0 && <p className="text-[11px] text-slate">You log {ins.beforePeriod.map((m) => `"${MOODS.find((x) => x.id === m)?.label.toLowerCase() ?? m}"`).join(" and ")} most in the 5 days before a period.</p>}
            </>
          ) : <p className="text-xs text-slate">Check in on a few days to see how your mood moves through your cycle.</p>}
        </section>
      </div>
      <div className="flex flex-col gap-4">
        <section>
          <h2 className={lbl}>Top symptoms</h2>
          {ins.topSymptoms.length ? (
            <div className="flex flex-col gap-1.5 text-xs text-ink">
              {ins.topSymptoms.map((s) => <div key={s.name} className="flex items-center gap-2"><span className="w-24 shrink-0">{s.name}</span><i className="h-3.5 rounded bg-crimson/85" style={{ width: `${(s.count / top) * 55}%` }} /><span>{s.count}</span></div>)}
            </div>
          ) : <p className="text-xs text-slate">Nothing logged yet.</p>}
        </section>
        <button type="button" onClick={ask} disabled={busy} className="rounded-full border border-rule bg-card py-2.5 font-ui text-sm font-bold text-ink disabled:opacity-60">📝 {busy ? "Nana is writing…" : report ? "Ask Nana for a fresh report" : "Nana's monthly report"}</button>
        {report && <div className={`${nanaBox} whitespace-pre-line`}><b className="text-crimson">Nana · this month</b><br />{report.text}</div>}
        {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
        <p className={noteBox}>Only your own history, never averages from other women. If you log something that may need a doctor (very heavy flow, a period 3 months late, severe pain), Nana says so plainly.</p>
      </div>
    </div>
  );
}

// ── 7 · Ask Nana ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function AskNanaTab({ data, call }: { data: CycleData; call: Call }) {
  const [chat, setChat] = useState(data.chat);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chat.length, busy]);
  const send = async () => {
    const m = q.trim();
    if (!m || busy) return;
    setBusy(true); setError(""); setQ("");
    setChat((c) => [...c, { role: "user", text: m, at: new Date().toISOString() }]);
    try { const r = await call<{ chat: CycleData["chat"] }>({ action: "chat", message: m }); setChat(r.chat); } catch (e) { setError(e instanceof Error ? e.message : "Nana couldn't answer just now."); setQ(m); setChat((c) => c.slice(0, -1)); } finally { setBusy(false); }
  };
  const starters = data.teen
    ? ["Why do I get cramps?", "Is it normal for my period to change?", "What helps with pimples before my period?"]
    : ["Why do I get pimples before my period?", "What should I eat this week?", "Is my cycle length normal?"];
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col gap-2.5">
      {data.teen && <p className="rounded-xl border border-[#bcd7f5] bg-[#EEF6FF] px-3 py-2 text-xs leading-relaxed text-[#173d66]"><b>Your version (13–17)</b><br />Periods, symptoms, mood, food and movement. Nana answers in plain words, and for anything serious she&apos;ll point you to a trusted adult or a clinic. Your parent never sees what you log here.</p>}
      {!chat.length && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate">Ask Nana anything about your cycle. She knows your phase and what you&apos;ve logged, and nothing else about you. This chat is kept apart from your other Nana chats and is never used for ads.</p>
          <div className="flex flex-wrap gap-2">{starters.map((s) => <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full border border-rule bg-card px-3 py-1.5 text-xs text-ink">{s}</button>)}</div>
        </div>
      )}
      {chat.map((m, i) => m.role === "user"
        ? <div key={i} className="max-w-[85%] self-end rounded-2xl border border-rule bg-card px-3 py-2 text-[13px] text-ink">{m.text}</div>
        : <div key={i} className={`${nanaBox} max-w-[92%] whitespace-pre-line`}><b className="text-crimson">Nana</b><br />{m.text}</div>)}
      {busy && <div className={`${nanaBox} max-w-[60%] text-slate`}>Nana is typing…</div>}
      <div ref={end} />
      {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
      <form className="sticky bottom-[4.5rem] mt-auto flex gap-2 bg-paper py-2 lg:bottom-0" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={CHAT_MAX} placeholder="Ask Nana anything about your cycle…" aria-label="Ask Nana" className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-2.5 text-sm text-ink" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-full bg-crimson px-4 font-ui text-sm font-bold text-white disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
