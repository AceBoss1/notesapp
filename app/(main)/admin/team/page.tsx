"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { formatNaira } from "@/lib/booking-time";
import {
  HORIZONS, HORIZON_LABEL, METRICS, STATUS_LABEL, addDays, groupItems, isOverdue, lagosParts,
  type Horizon, type Meeting, type MetricKey, type Milestone, type Progress, type Status, type TeamComment, type TeamItem,
} from "@/lib/team";

type Person = { uid: string; name: string; email: string };
type Signal = { id: string; label: string; count: number; href: string; urgent?: boolean };
type MilestoneRow = Milestone & { progress: Progress };
type Data = {
  me: string; today: string; items: TeamItem[]; milestones: MilestoneRow[]; people: Person[]; signals: Signal[]; meetings: Meeting[]; teamRoomId: string; prefs: { morningEmail: boolean; morningBell: boolean };
  snapshot: { registered: number; newLast30Days: number; paidPlans: number; goldBadges: number; processedLast30DaysKobo: number; inEscrowKobo: number; generatedAt: string };
};

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
const input = "mt-1 block w-full border border-rule bg-card px-2 py-1.5 text-sm";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-slate">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}

// One piece of work. Quick buttons for the usual moves; blocking and asking for a decision each ask for the one line that makes them useful.
function ItemCard({ item, people, today, me, send, fetchComments }: { item: TeamItem; people: Person[]; today: string; me: string; send: (body: Record<string, unknown>) => Promise<void>; fetchComments: (id: string) => Promise<TeamComment[]> }) {
  const [mode, setMode] = useState<null | "edit" | "block" | "ask" | "decide">(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const [showC, setShowC] = useState(false);
  const [comments, setComments] = useState<TeamComment[] | null>(null);
  const [cText, setCText] = useState("");
  const loadC = useCallback(() => { fetchComments(item.id).then(setComments).catch(() => setComments([])); }, [fetchComments, item.id]);
  const owner = people.find((p) => p.uid === item.ownerUid)?.name;
  const overdue = isOverdue(item, today);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try { await send({ action: "updateItem", id: item.id, ...body }); setMode(null); setText(""); } finally { setBusy(false); }
  };
  const btn = "rounded border border-rule px-2 py-1 text-[11px] font-semibold text-ink hover:border-crimson hover:text-crimson disabled:opacity-50";

  return (
    <li className={`card p-3 ${item.status === "blocked" ? "border-amber-400" : item.status === "decision" ? "border-crimson" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`font-ui text-sm font-bold ${item.status === "done" ? "text-slate line-through" : "text-ink"}`}>{item.title}</p>
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate">
          {owner ? <span className="rounded bg-card px-1.5 py-0.5 ring-1 ring-rule">{owner}</span> : <span className="italic">unassigned</span>}
          {item.due && <span className={overdue ? "font-bold text-crimson" : ""}>{overdue ? "overdue · " : "due "}{dayLabel(item.due)}</span>}
        </span>
      </div>
      {item.detail && <p className="mt-1 whitespace-pre-line text-xs text-slate">{item.detail}</p>}
      {item.status === "blocked" && <p className="mt-2 text-xs text-amber-900"><strong>Blocked:</strong> {item.blockedReason}</p>}
      {item.status === "decision" && <p className="mt-2 text-xs text-crimson"><strong>Decision needed:</strong> {item.decisionQuestion}</p>}
      {item.status === "done" && item.decidedNote && <p className="mt-2 text-xs text-slate"><strong>Decided:</strong> {item.decidedNote}</p>}

      {mode === null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.status === "todo" && <button disabled={busy} onClick={() => act({ status: "doing" })} className={btn}>Start</button>}
          {item.status !== "done" && item.status !== "decision" && <button disabled={busy} onClick={() => act({ status: "done" })} className={btn}>Done</button>}
          {(item.status === "todo" || item.status === "doing") && <button onClick={() => { setText(""); setMode("block"); }} className={btn}>Blocked</button>}
          {(item.status === "todo" || item.status === "doing") && <button onClick={() => { setText(""); setMode("ask"); }} className={btn}>Needs a decision</button>}
          {item.status === "blocked" && <button disabled={busy} onClick={() => act({ status: "doing" })} className={btn}>Unblocked</button>}
          {item.status === "decision" && <button onClick={() => { setText(""); setMode("decide"); }} className={btn}>Decided</button>}
          {item.status === "done" && <button disabled={busy} onClick={() => act({ status: "todo" })} className={btn}>Reopen</button>}
          <button onClick={() => { setDraft(item); setMode("edit"); }} className={btn}>Edit</button>
          <button onClick={() => { if (!showC) loadC(); setShowC((x) => !x); }} aria-expanded={showC} className={btn}>Comments{item.commentCount ? ` (${item.commentCount})` : ""}</button>
        </div>
      )}
      {showC && (
        <div className="mt-2 border-t border-rule pt-2">
          {comments === null ? <p className="text-xs text-slate">Loading…</p> : comments.length === 0 ? <p className="text-xs text-slate">No comments yet.</p> : (
            <ul className="space-y-1.5">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-ink"><strong>{people.find((p) => p.uid === c.byUid)?.name ?? "Someone"}:</strong> <span className="whitespace-pre-line">{c.text}</span> <span className="text-slate">· {new Date(c.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></span>
                  {c.byUid === me && <button aria-label="Delete this comment" onClick={async () => { await send({ action: "deleteComment", id: item.id, commentId: c.id }); loadC(); }} className="text-slate">×</button>}
                </li>
              ))}
            </ul>
          )}
          <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!cText.trim()) return; await send({ action: "addComment", id: item.id, text: cText }); setCText(""); loadC(); }}>
            <input value={cText} onChange={(e) => setCText(e.target.value)} placeholder="Add a comment" maxLength={1000} className={`${input} mt-0 flex-1`} />
            <button disabled={!cText.trim()} className="btn-primary !px-3 !py-1.5 text-xs">Post</button>
          </form>
        </div>
      )}

      {(mode === "block" || mode === "ask" || mode === "decide") && (
        <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (mode === "block") void act({ status: "blocked", blockedReason: text });
          else if (mode === "ask") void act({ status: "decision", decisionQuestion: text });
          else void act({ status: "done", decidedNote: text });
        }}>
          <label className="min-w-[14rem] flex-1 text-[11px] text-slate">
            {mode === "block" ? "What is it blocked on, and who can unblock it?" : mode === "ask" ? "What has to be decided?" : "What was decided?"}
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={input} />
          </label>
          <button disabled={busy || !text.trim()} className="btn-primary !px-3 !py-1.5 text-xs">Save</button>
          <button type="button" onClick={() => setMode(null)} className={btn}>Cancel</button>
        </form>
      )}

      {mode === "edit" && (
        <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          void act({ title: draft.title, detail: draft.detail, ownerUid: draft.ownerUid, horizon: draft.horizon, due: draft.due, status: draft.status, blockedReason: draft.blockedReason, decisionQuestion: draft.decisionQuestion });
        }}>
          <label className="text-[11px] text-slate sm:col-span-2">Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={input} /></label>
          <label className="text-[11px] text-slate sm:col-span-2">Details<textarea value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} rows={2} className={input} /></label>
          <label className="text-[11px] text-slate">Owner
            <select value={draft.ownerUid} onChange={(e) => setDraft({ ...draft, ownerUid: e.target.value })} className={input}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate">Status
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })} className={input}>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate">When
            <select value={draft.horizon} onChange={(e) => setDraft({ ...draft, horizon: e.target.value as Horizon })} className={input}>
              {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate">Due date<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className={input} /></label>
          {draft.status === "blocked" && <label className="text-[11px] text-slate sm:col-span-2">Blocked on<input value={draft.blockedReason} onChange={(e) => setDraft({ ...draft, blockedReason: e.target.value })} className={input} /></label>}
          {draft.status === "decision" && <label className="text-[11px] text-slate sm:col-span-2">Decision needed<input value={draft.decisionQuestion} onChange={(e) => setDraft({ ...draft, decisionQuestion: e.target.value })} className={input} /></label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button disabled={busy || !draft.title.trim()} className="btn-primary !px-3 !py-1.5 text-xs">Save</button>
            <button type="button" onClick={() => setMode(null)} className={btn}>Cancel</button>
            <button type="button" disabled={busy} onClick={() => { if (confirm("Delete this item?")) void send({ action: "deleteItem", id: item.id }); }} className="ml-auto text-[11px] text-crimson underline">Delete</button>
          </div>
        </form>
      )}
    </li>
  );
}

const STATE_STYLE: Record<Progress["state"], string> = {
  hit: "bg-emerald-100 text-emerald-900", "on-track": "bg-emerald-50 text-emerald-900", behind: "bg-amber-100 text-amber-900",
  missed: "bg-crimson/10 text-crimson", upcoming: "bg-card text-slate ring-1 ring-rule",
};
const STATE_LABEL: Record<Progress["state"], string> = { hit: "Hit", "on-track": "On track", behind: "Behind", missed: "Missed", upcoming: "Starts soon" };

function MilestoneCard({ m, people, send }: { m: MilestoneRow; people: Person[]; send: (body: Record<string, unknown>) => Promise<void> }) {
  const unit = METRICS[m.metric].unit;
  const fmt = (n: number) => (unit === "kobo" ? formatNaira(n) : n.toLocaleString());
  const owner = people.find((p) => p.uid === m.ownerUid)?.name;
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-ui text-sm font-bold text-ink">{m.title}</p>
        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATE_STYLE[m.progress.state]}`}>{STATE_LABEL[m.progress.state]}</span>
      </div>
      <p className="mt-1 text-xs text-slate">{METRICS[m.metric].label} · {m.mode === "gain" ? "growth" : "total"} · {dayLabel(m.startsOn)} to {dayLabel(m.endsOn)}{owner ? ` · ${owner}` : ""}</p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={m.progress.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-crimson" style={{ width: `${m.progress.pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink">{fmt(m.progress.value)} of {fmt(m.target)} ({m.progress.pct}%){m.mode === "gain" ? ` · now ${fmt(m.progress.current)}` : ""}</p>
      {m.note && <p className="mt-1 text-xs text-slate">{m.note}</p>}
      <button onClick={() => { if (confirm("Delete this milestone?")) void send({ action: "deleteMilestone", id: m.id }); }} className="mt-2 text-[11px] text-crimson underline">Delete</button>
    </li>
  );
}

export default function AdminTeamPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [quick, setQuick] = useState({ title: "", horizon: "today" as Horizon, ownerUid: "" });
  const [showMs, setShowMs] = useState(false);
  const [ms, setMs] = useState({ title: "", metric: "registered" as MetricKey, mode: "gain", target: "", startsOn: "", endsOn: "", ownerUid: "", note: "" });
  const [showLater, setShowLater] = useState(false);
  const [prefs, setPrefs] = useState({ morningEmail: true, morningBell: true }); // shown at once, saved in the background
  useEffect(() => { if (data) setPrefs(data.prefs); }, [data]);
  const [showMeet, setShowMeet] = useState(false);
  const [meet, setMeet] = useState({ title: "", date: "", time: "10:00", agenda: "" });

  const call = useCallback(async (init?: { body: Record<string, unknown> }, qs = "") => {
    const token = await user!.getIdToken();
    const r = await fetch(`/api/admin/team${qs}`, init ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(init.body) } : { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);

  const load = useCallback(async () => {
    try { setData(await call()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); }
  }, [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  const send = useCallback(async (body: Record<string, unknown>) => {
    try { await call({ body }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); throw e; }
  }, [call, load]);

  const fetchComments = useCallback(async (id: string) => (await call(undefined, `?comments=${encodeURIComponent(id)}`)).comments as TeamComment[], [call]);
  const visible = useMemo(() => (data ? data.items.filter((i) => !mineOnly || i.ownerUid === data.me) : []), [data, mineOnly]);
  const g = useMemo(() => (data ? groupItems(visible, data.today) : null), [data, visible]);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!data || !g) return <div className="px-6 py-24 text-center text-slate">{error ? <span className="text-crimson">{error}</span> : "Loading the team hub…"}</div>;

  const today = data.today;
  const people = data.people;
  const list = (items: TeamItem[]) => <ul className="mt-3 space-y-2">{items.map((i) => <ItemCard key={i.id} item={i} people={people} today={today} me={data.me} send={send} fetchComments={fetchComments} />)}</ul>;
  const needs = g.decisions.length + g.blocked.length + g.overdue.filter((i) => i.status !== "blocked" && i.status !== "decision").length + data.signals.length;
  const section = (title: string, hint: string, items: TeamItem[]) => (
    <section className="mt-8">
      <h2 className="font-display text-2xl text-ink">{title} <span className="font-ui text-sm font-normal text-slate">({items.length})</span></h2>
      <p className="mt-1 text-xs text-slate">{hint}</p>
      {items.length ? list(items) : <p className="mt-3 text-sm text-slate">Nothing here.</p>}
    </section>
  );

  return (
    <section className="mx-auto max-w-5xl px-4 py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Team hub</h1>
          <p className="mt-1 text-sm text-slate">{dayLabel(today)} · what is moving, what is stuck, and what needs a decision.</p>
        </div>
        <span className="flex flex-wrap items-center gap-3 text-sm text-slate">
          <Link href="/admin/team/review" className="btn-ghost !px-4 !py-2 text-xs">Weekly review →</Link>
          <label className="flex items-center gap-2"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Only mine</label>
        </span>
      </div>
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Members" value={data.snapshot.registered.toLocaleString()} />
        <Tile label="New, 30 days" value={data.snapshot.newLast30Days.toLocaleString()} />
        <Tile label="Paid plans" value={data.snapshot.paidPlans.toLocaleString()} />
        <Tile label="Gold badges" value={data.snapshot.goldBadges.toLocaleString()} />
        <Tile label="Processed, 30 days" value={formatNaira(data.snapshot.processedLast30DaysKobo)} />
        <Tile label="Held in escrow" value={formatNaira(data.snapshot.inEscrowKobo)} />
      </div>
      <p className="mt-1 text-right text-[11px] text-slate">Platform numbers, as of {new Date(data.snapshot.generatedAt).toLocaleTimeString("en-NG")} · <Link href="/admin/traction" className="text-crimson underline">full traction</Link></p>

      <section className="card mt-6 border-crimson p-5" aria-labelledby="needs">
        <h2 id="needs" className="font-display text-2xl text-ink">Needs you {needs > 0 && <span className="font-ui text-sm font-normal text-slate">({needs})</span>}</h2>
        {needs === 0 && <p className="mt-2 text-sm text-slate">Nothing is waiting on a decision, blocked or overdue, and the review queues are empty.</p>}
        {data.signals.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.signals.map((s) => (
              <li key={s.id}><Link href={s.href} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${s.urgent ? "border-crimson bg-crimson/10 text-crimson" : "border-rule text-ink"}`}><span className="font-mono">{s.count}</span> {s.label} →</Link></li>
            ))}
          </ul>
        )}
        {g.decisions.length > 0 && <><p className="mt-4 font-ui text-sm font-bold text-ink">Waiting for a decision</p>{list(g.decisions)}</>}
        {g.blocked.length > 0 && <><p className="mt-4 font-ui text-sm font-bold text-ink">Blocked</p>{list(g.blocked)}</>}
        {g.overdue.filter((i) => i.status !== "blocked" && i.status !== "decision").length > 0 && <p className="mt-4 text-xs text-crimson">{g.overdue.length} item{g.overdue.length === 1 ? " is" : "s are"} overdue; they are at the top of Today.</p>}
      </section>

      <form className="card mt-6 flex flex-wrap items-end gap-2 p-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!quick.title.trim()) return;
        await send({ action: "createItem", title: quick.title, horizon: quick.horizon, ownerUid: quick.ownerUid || data.me, due: quick.horizon === "today" ? today : "" });
        setQuick({ ...quick, title: "" });
      }}>
        <label className="min-w-[14rem] flex-1 text-[11px] text-slate">Add work<input value={quick.title} onChange={(e) => setQuick({ ...quick, title: e.target.value })} placeholder="What needs doing?" className={input} /></label>
        <label className="text-[11px] text-slate">When
          <select value={quick.horizon} onChange={(e) => setQuick({ ...quick, horizon: e.target.value as Horizon })} className={input}>
            {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-slate">Owner
          <select value={quick.ownerUid || data.me} onChange={(e) => setQuick({ ...quick, ownerUid: e.target.value })} className={input}>
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.uid} value={p.uid}>{p.name}{p.uid === data.me ? " (me)" : ""}</option>)}
          </select>
        </label>
        <button disabled={!quick.title.trim()} className="btn-primary !px-4 !py-2 text-xs">Add</button>
      </form>

      {section("Today", "Everything set for today, anything due today and anything overdue. Dated first.", g.today)}
      {section("This week", "Planned for this week or due in the next seven days.", g.week)}

      <section className="mt-8">
        <button onClick={() => setShowLater((s) => !s)} className="font-display text-2xl text-ink">Later <span className="font-ui text-sm font-normal text-slate">({g.later.length}) {showLater ? "▲" : "▼"}</span></button>
        {showLater && (g.later.length ? list(g.later) : <p className="mt-3 text-sm text-slate">Nothing here.</p>)}
      </section>

      <section className="mt-10" aria-labelledby="meet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="meet" className="font-display text-2xl text-ink">Meetings</h2>
          <span className="flex flex-wrap gap-2">
            <Link href={`/messages/${data.teamRoomId}`} className="btn-ghost !px-4 !py-2 text-xs">Open the Team room</Link>
            <button onClick={() => { setMeet({ ...meet, date: meet.date || today }); setShowMeet((x) => !x); }} className="btn-primary !px-4 !py-2 text-xs">{showMeet ? "Close" : "Schedule a meeting"}</button>
          </span>
        </div>
        <p className="mt-1 text-xs text-slate">Each meeting gets its own room in the group chat with the whole team in it. Decisions and actions are written down beside the chat, and actions land on the board above.</p>
        {showMeet && (
          <form className="card mt-3 grid gap-2 p-4 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            await send({ action: "createMeeting", ...meet });
            setShowMeet(false);
            setMeet({ title: "", date: "", time: "10:00", agenda: "" });
          }}>
            <label className="text-[11px] text-slate sm:col-span-2">Title<input value={meet.title} onChange={(e) => setMeet({ ...meet, title: e.target.value })} placeholder="e.g. Weekly review" className={input} /></label>
            <label className="text-[11px] text-slate">Date<input type="date" value={meet.date} onChange={(e) => setMeet({ ...meet, date: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate">Time (Lagos)<input type="time" value={meet.time} onChange={(e) => setMeet({ ...meet, time: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate sm:col-span-2">Agenda<textarea value={meet.agenda} onChange={(e) => setMeet({ ...meet, agenda: e.target.value })} rows={3} className={input} /></label>
            <div className="sm:col-span-2"><button disabled={!meet.title.trim() || !meet.date} className="btn-primary !px-4 !py-2 text-xs">Schedule and invite the team</button></div>
          </form>
        )}
        {data.meetings.length ? (
          <ul className="mt-3 space-y-2">
            {[...data.meetings.filter((x) => x.status !== "done").sort((a, b) => a.startsAt.localeCompare(b.startsAt)), ...data.meetings.filter((x) => x.status === "done").slice(0, 5)].map((x) => {
              const w = lagosParts(x.startsAt);
              return (
                <li key={x.id}>
                  <Link href={`/admin/team/meetings/${x.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-3 hover:border-crimson">
                    <span><span className="font-ui text-sm font-bold text-ink">{x.title}</span> <span className="text-xs text-slate">{dayLabel(w.date)}, {w.time}</span></span>
                    <span className="flex items-center gap-2 text-[11px]">
                      {x.decisions.length > 0 && <span className="text-slate">{x.decisions.length} decision{x.decisions.length === 1 ? "" : "s"}</span>}
                      <span className={`rounded px-2 py-0.5 font-semibold ${x.status === "live" ? "bg-crimson text-white" : x.status === "done" ? "bg-card text-slate ring-1 ring-rule" : "bg-amber-100 text-amber-900"}`}>{x.status === "live" ? "Live now" : x.status === "done" ? "Done" : w.date === today ? "Today" : "Scheduled"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 text-sm text-slate">No meetings yet.</p>}
      </section>

      <section className="mt-10" aria-labelledby="ms">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ms" className="font-display text-2xl text-ink">Milestones <span className="font-ui text-sm font-normal text-slate">({data.milestones.length})</span></h2>
          <button onClick={() => { setMs({ ...ms, startsOn: today, endsOn: addDays(today, 6) }); setShowMs((s) => !s); }} className="btn-ghost !px-4 !py-2 text-xs">{showMs ? "Close" : "New milestone"}</button>
        </div>
        <p className="mt-1 text-xs text-slate">A target on a real platform number, for a day, a week or longer. Progress is read from the same figures as the traction page.</p>
        {showMs && (
          <form className="card mt-3 grid gap-2 p-4 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            const money = METRICS[ms.metric].unit === "kobo";
            await send({ action: "createMilestone", ...ms, target: money ? Math.round(Number(ms.target) * 100) : Number(ms.target) });
            setShowMs(false);
            setMs({ ...ms, title: "", target: "", note: "" });
          }}>
            <label className="text-[11px] text-slate sm:col-span-2">Title<input value={ms.title} onChange={(e) => setMs({ ...ms, title: e.target.value })} placeholder="e.g. 200 new members this week" className={input} /></label>
            <label className="text-[11px] text-slate">Number to track
              <select value={ms.metric} onChange={(e) => setMs({ ...ms, metric: e.target.value as MetricKey })} className={input}>
                {(Object.keys(METRICS) as MetricKey[]).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-slate">Count it as
              <select value={ms.mode} onChange={(e) => setMs({ ...ms, mode: e.target.value })} className={input}>
                <option value="gain">Growth since the start date</option>
                <option value="total">The total number</option>
              </select>
            </label>
            <label className="text-[11px] text-slate">Target{METRICS[ms.metric].unit === "kobo" ? " (₦)" : ""}<input type="number" min="1" value={ms.target} onChange={(e) => setMs({ ...ms, target: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate">Owner
              <select value={ms.ownerUid} onChange={(e) => setMs({ ...ms, ownerUid: e.target.value })} className={input}>
                <option value="">Whole team</option>
                {people.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-slate">Starts<input type="date" value={ms.startsOn} onChange={(e) => setMs({ ...ms, startsOn: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate">Ends<input type="date" value={ms.endsOn} onChange={(e) => setMs({ ...ms, endsOn: e.target.value })} className={input} /></label>
            <label className="text-[11px] text-slate sm:col-span-2">Note<input value={ms.note} onChange={(e) => setMs({ ...ms, note: e.target.value })} className={input} /></label>
            <div className="sm:col-span-2"><button disabled={!ms.title.trim() || !ms.target} className="btn-primary !px-4 !py-2 text-xs">Create milestone</button></div>
          </form>
        )}
        {data.milestones.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">{data.milestones.map((m) => <MilestoneCard key={m.id} m={m} people={people} send={send} />)}</ul>
        ) : <p className="mt-3 text-sm text-slate">No milestones yet. Set one for this week.</p>}
      </section>

      {section("Done this week", "Finished in the last seven days.", g.recentlyDone)}

      <section className="card mt-10 p-5" aria-labelledby="morning">
        <h2 id="morning" className="font-display text-xl text-ink">Your morning summary</h2>
        <p className="mt-1 text-xs text-slate">Every morning from 7:00 (Lagos time): your day, the decisions and blockers waiting on the team, the review queues, milestones and today&apos;s meetings. Nothing is sent when there is nothing to read.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.morningEmail} onChange={(e) => { setPrefs({ ...prefs, morningEmail: e.target.checked }); void send({ action: "setPrefs", morningEmail: e.target.checked }); }} /> By email</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.morningBell} onChange={(e) => { setPrefs({ ...prefs, morningBell: e.target.checked }); void send({ action: "setPrefs", morningBell: e.target.checked }); }} /> In the bell</label>
        </div>
      </section>
    </section>
  );
}
