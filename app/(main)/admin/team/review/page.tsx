"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import { addDays, reviewSummary, type Meeting, type Milestone, type Progress, type Review, type WeekNumbers, type WeekWork } from "@/lib/team";

type Person = { uid: string; name: string; email: string };
type Data = {
  me: string; today: string; weekStart: string; weekEnd: string; isCurrent: boolean; numbers: WeekNumbers[]; review: (Review & { updatedAt: string }) | null; people: Person[];
  work: WeekWork; meetings: Meeting[]; milestones: (Milestone & { progress: Progress })[];
};
const input = "mt-1 block w-full border border-rule bg-card px-2 py-1.5 text-sm";
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

function Stat({ label, value, delta, series, fmt }: { label: string; value: string; delta?: number; series: number[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...series);
  return (
    <div className="card p-4">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
      {delta !== undefined && <p className={`text-xs ${delta > 0 ? "text-emerald-800" : delta < 0 ? "text-crimson" : "text-slate"}`}>{delta === 0 ? "same as last week" : `${delta > 0 ? "▲" : "▼"} ${fmt(Math.abs(delta))} ${delta > 0 ? "more" : "fewer"} than last week`}</p>}
      <div className="mt-3 flex h-10 items-end gap-1" aria-label={`${label} over the last ${series.length} weeks`}>
        {series.map((n, k) => <span key={k} title={fmt(n)} className={`flex-1 rounded-sm ${k === series.length - 1 ? "bg-crimson" : "bg-crimson/30"}`} style={{ height: `${Math.max(6, (n / max) * 100)}%` }} />)}
      </div>
    </div>
  );
}

// The week in numbers and work, with a place for what went well, what was learnt and what next week is about. The focus lines can become
// next week's items, and the whole review can be held as a meeting in the group chat.
export default function WeeklyReviewPage() {
  const { user, loading } = useAdminAuth();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [week, setWeek] = useState("current");
  const [form, setForm] = useState<Review>({ wins: "", lessons: "", nextFocus: "" });
  const [saved, setSaved] = useState("");
  const [copied, setCopied] = useState(false);
  const [meet, setMeet] = useState({ date: "", time: "10:00" });

  const call = useCallback(async (body?: Record<string, unknown>, qs = "") => {
    const token = await user!.getIdToken();
    const r = await fetch(`/api/admin/team${qs}`, body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(async (w: string) => {
    try {
      const d: Data = await call(undefined, `?review=${w}`);
      setData(d); setError(""); setForm({ wins: d.review?.wins ?? "", lessons: d.review?.lessons ?? "", nextFocus: d.review?.nextFocus ?? "" }); setSaved("");
      setMeet((m) => ({ ...m, date: d.isCurrent ? d.today : addDays(d.weekEnd, 1) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); }
  }, [call]);
  useEffect(() => { if (user) void load(week); }, [user, load, week]);

  const nameOf = useCallback((uid: string) => data?.people.find((p) => p.uid === uid)?.name ?? "Someone", [data]);
  const text = useMemo(() => data ? reviewSummary({
    weekStart: data.weekStart, numbers: data.numbers, work: data.work, review: form,
    milestones: data.milestones.map((m) => ({ title: m.title, pct: m.progress.pct, state: m.progress.state })),
    meetings: data.meetings.map((m) => ({ title: m.title, decisions: m.decisions.length })), nameOf, naira: formatNaira,
  }) : "", [data, form, nameOf]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!data) return <div className="px-6 py-24 text-center text-slate">{error ? <span className="text-crimson">{error}</span> : "Building the review…"}</div>;
  const cur = data.numbers[data.numbers.length - 1], prev = data.numbers[data.numbers.length - 2];
  const btn = "rounded border border-rule px-3 py-1.5 text-xs font-semibold hover:border-crimson hover:text-crimson disabled:opacity-50";

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <p className="text-sm"><Link href="/admin/team" className="text-crimson underline">← Team hub</Link></p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Weekly review</h1>
          <p className="mt-1 text-sm text-slate">{day(data.weekStart)} to {day(data.weekEnd)}{data.isCurrent ? " (this week, still running)" : ""}</p>
        </div>
        <span className="flex gap-2">
          <button onClick={() => setWeek(addDays(data.weekStart, -7))} className={btn}>← Earlier week</button>
          <button disabled={data.isCurrent} onClick={() => setWeek(addDays(data.weekStart, 7) > data.today ? "current" : addDays(data.weekStart, 7))} className={btn}>Later week →</button>
        </span>
      </div>
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="New members" value={(cur?.signups ?? 0).toLocaleString()} delta={prev ? (cur?.signups ?? 0) - prev.signups : undefined} series={data.numbers.map((n) => n.signups)} fmt={(n) => n.toLocaleString()} />
        <Stat label="Payments" value={(cur?.payments ?? 0).toLocaleString()} delta={prev ? (cur?.payments ?? 0) - prev.payments : undefined} series={data.numbers.map((n) => n.payments)} fmt={(n) => n.toLocaleString()} />
        <Stat label="Money processed" value={formatNaira(cur?.processedKobo ?? 0)} delta={prev ? (cur?.processedKobo ?? 0) - prev.processedKobo : undefined} series={data.numbers.map((n) => n.processedKobo)} fmt={formatNaira} />
      </div>
      <p className="mt-1 text-[11px] text-slate">Bars show the last {data.numbers.length} weeks; the maroon one is this week. Counted from the days people joined and paid (Lagos dates).</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-2xl">Work</h2>
          <p className="mt-1 text-sm text-slate">{data.work.done.length} done · {data.work.created} added · {data.work.carriedOver.length} carried over · {data.work.overdue} overdue</p>
          {data.work.done.length > 0 && <><p className="mt-3 font-ui text-sm font-bold text-ink">Done</p><ul className="mt-1 space-y-1 text-sm text-ink">{data.work.done.map((x) => <li key={x.id}>✔ {x.title} <span className="text-xs text-slate">{x.ownerUid ? nameOf(x.ownerUid) : ""}</span></li>)}</ul></>}
          {data.work.decisions.length > 0 && <><p className="mt-3 font-ui text-sm font-bold text-crimson">Still waiting for a decision</p><ul className="mt-1 space-y-1 text-sm">{data.work.decisions.map((x) => <li key={x.id}>{x.decisionQuestion || x.title}</li>)}</ul></>}
          {data.work.blocked.length > 0 && <><p className="mt-3 font-ui text-sm font-bold text-amber-900">Still blocked</p><ul className="mt-1 space-y-1 text-sm">{data.work.blocked.map((x) => <li key={x.id}>{x.title}: <span className="text-slate">{x.blockedReason}</span></li>)}</ul></>}
          {data.work.carriedOver.length > 0 && <><p className="mt-3 font-ui text-sm font-bold text-ink">Carried over</p><ul className="mt-1 space-y-1 text-sm text-ink">{data.work.carriedOver.slice(0, 12).map((x) => <li key={x.id}>{x.title} <span className="text-xs text-slate">{x.ownerUid ? nameOf(x.ownerUid) : "unassigned"}{x.due ? `, due ${x.due}` : ""}</span></li>)}</ul></>}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-display text-2xl">Milestones</h2>
            {data.milestones.length ? (
              <ul className="mt-2 space-y-3">
                {data.milestones.map((m) => (
                  <li key={m.id}>
                    <p className="text-sm text-ink">{m.title} <span className="text-xs text-slate">· {m.progress.state === "hit" ? "hit" : m.progress.state === "on-track" ? "on track" : m.progress.state === "behind" ? "behind" : m.progress.state === "missed" ? "missed" : "not started"}</span></p>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-rule"><div className="h-full bg-crimson" style={{ width: `${m.progress.pct}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate">No milestones ran this week.</p>}
          </section>
          <section className="card p-5">
            <h2 className="font-display text-2xl">Meetings</h2>
            {data.meetings.length ? <ul className="mt-2 space-y-1 text-sm">{data.meetings.map((m) => <li key={m.id}><Link href={`/admin/team/meetings/${m.id}`} className="text-crimson underline">{m.title}</Link> <span className="text-xs text-slate">{m.decisions.length} decision{m.decisions.length === 1 ? "" : "s"}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate">No meetings this week.</p>}
          </section>
        </div>
      </div>

      <section className="card mt-8 p-5" aria-labelledby="notes">
        <h2 id="notes" className="font-display text-2xl">Our review</h2>
        <form className="mt-3 grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await call({ action: "saveReview", week: data.weekStart, ...form }); setSaved("Saved."); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't save"); }
        }}>
          <label className="text-[11px] text-slate">What went well<textarea rows={3} value={form.wins} onChange={(e) => { setForm({ ...form, wins: e.target.value }); setSaved(""); }} className={input} /></label>
          <label className="text-[11px] text-slate">What we learnt, and what got in the way<textarea rows={3} value={form.lessons} onChange={(e) => { setForm({ ...form, lessons: e.target.value }); setSaved(""); }} className={input} /></label>
          <label className="text-[11px] text-slate">Next week&apos;s focus (one line each)<textarea rows={4} value={form.nextFocus} onChange={(e) => { setForm({ ...form, nextFocus: e.target.value }); setSaved(""); }} className={input} /></label>
          <span className="flex flex-wrap items-center gap-2">
            <button className="btn-primary !px-4 !py-2 text-xs">Save the review</button>
            <button type="button" disabled={!form.nextFocus.trim()} onClick={async () => { try { const r = await call({ action: "focusToItems", text: form.nextFocus }); setSaved(`${r.created} item${r.created === 1 ? "" : "s"} added to next week on the board.`); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't add them"); } }} className={btn}>Add the focus lines to the board</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ } }} className={btn}>{copied ? "Copied" : "Copy the review"}</button>
            {saved && <span className="text-xs text-slate" role="status">{saved}</span>}
          </span>
        </form>
        <div className="mt-5 border-t border-rule pt-4">
          <p className="font-ui text-sm font-bold text-ink">Hold the review as a meeting</p>
          <p className="mt-1 text-xs text-slate">Opens a room in the group chat with the whole team and this review as the agenda.</p>
          <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
            e.preventDefault();
            try { const r = await call({ action: "createMeeting", title: `Weekly review: ${day(data.weekStart)} to ${day(data.weekEnd)}`, date: meet.date, time: meet.time, agenda: text.slice(0, 2000) }); router.push(`/admin/team/meetings/${r.id}`); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't schedule it"); }
          }}>
            <label className="text-[11px] text-slate">Date<input type="date" value={meet.date} onChange={(e) => setMeet({ ...meet, date: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate">Time (Lagos)<input type="time" value={meet.time} onChange={(e) => setMeet({ ...meet, time: e.target.value })} className={input} /></label>
            <button disabled={!meet.date} className="btn-primary !px-4 !py-2 text-xs">Schedule it</button>
          </form>
        </div>
      </section>
    </section>
  );
}
