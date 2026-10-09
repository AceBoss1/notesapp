"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import Thread from "@/components/messages/Thread";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { lagosParts, meetingSummary, type Meeting, type TeamItem } from "@/lib/team";

type Person = { uid: string; name: string; email: string };
type Data = { me: string; meeting: Meeting; actions: TeamItem[]; people: Person[] };
const input = "mt-1 block w-full border border-rule bg-card px-2 py-1.5 text-sm";
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// One meeting: the team's room in the group chat on the left, the agenda, decisions and actions beside it. Actions become work items on the team board.
export default function MeetingPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState("");
  const [action, setAction] = useState({ title: "", ownerUid: "", due: "" });
  const [agenda, setAgenda] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const token = await user!.getIdToken();
    const r = await fetch(body ? "/api/admin/team" : `/api/admin/team?meeting=${params.id}`, body ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user, params.id]);
  const load = useCallback(async () => { try { setData(await call()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load"); } }, [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  const send = async (body: Record<string, unknown>) => { try { await call({ ...body, id: params.id }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); } };

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!data) return <div className="px-6 py-24 text-center text-slate">{error ? <span className="text-crimson">{error}</span> : "Loading the meeting…"}</div>;
  const { meeting: m, actions, people } = data;
  const when = lagosParts(m.startsAt);
  const nameOf = (uid: string) => people.find((p) => p.uid === uid)?.name ?? "Someone";
  const btn = "rounded border border-rule px-2 py-1 text-[11px] font-semibold hover:border-crimson hover:text-crimson";

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-sm"><Link href="/admin/team" className="text-crimson underline">← Team hub</Link></p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{m.title}</h1>
          <p className="mt-1 text-sm text-slate">{dayLabel(when.date)}, {when.time} (Lagos time) · {m.status === "live" ? "Live now" : m.status === "done" ? "Done" : "Scheduled"}</p>
        </div>
        <span className="flex flex-wrap gap-2">
          {m.status === "scheduled" && <button onClick={() => send({ action: "updateMeeting", status: "live" })} className="btn-primary !px-4 !py-2 text-xs">Start the meeting</button>}
          {m.status === "live" && <button onClick={() => send({ action: "updateMeeting", status: "done" })} className="btn-primary !px-4 !py-2 text-xs">End the meeting</button>}
          {m.status === "done" && <button onClick={() => send({ action: "updateMeeting", status: "scheduled" })} className={btn}>Reopen</button>}
          <button onClick={async () => { try { await navigator.clipboard.writeText(meetingSummary(m, actions, nameOf)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ } }} className="btn-ghost !px-4 !py-2 text-xs">{copied ? "Copied" : "Copy the summary"}</button>
        </span>
      </div>
      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MessagesBoundary><Thread id={m.conversationId} embedded /></MessagesBoundary>
        </div>
        <aside className="space-y-6 lg:col-span-2">
          <section className="card p-4">
            <h2 className="font-display text-xl">Agenda</h2>
            {agenda === null ? (
              <>
                <p className="mt-2 whitespace-pre-line text-sm text-slate">{m.agenda || "No agenda yet."}</p>
                <button onClick={() => setAgenda(m.agenda)} className={`${btn} mt-2`}>Edit</button>
              </>
            ) : (
              <form className="mt-2" onSubmit={async (e) => { e.preventDefault(); await send({ action: "updateMeeting", agenda }); setAgenda(null); }}>
                <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={4} className={input} />
                <span className="mt-2 flex gap-2"><button className="btn-primary !px-3 !py-1.5 text-xs">Save</button><button type="button" onClick={() => setAgenda(null)} className={btn}>Cancel</button></span>
              </form>
            )}
          </section>

          <section className="card p-4">
            <h2 className="font-display text-xl">Decisions <span className="font-ui text-sm font-normal text-slate">({m.decisions.length})</span></h2>
            <ul className="mt-2 space-y-2">
              {m.decisions.map((d) => (
                <li key={d.at} className="flex items-start justify-between gap-2 text-sm text-ink">
                  <span>✔ {d.text} <span className="text-[11px] text-slate">· {nameOf(d.byUid)}</span></span>
                  <button onClick={() => send({ action: "removeDecision", at: d.at })} aria-label="Remove this decision" className="text-slate">×</button>
                </li>
              ))}
            </ul>
            <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!decision.trim()) return; await send({ action: "addDecision", text: decision }); setDecision(""); }}>
              <input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="What was decided?" className={`${input} mt-0 flex-1`} />
              <button disabled={!decision.trim()} className="btn-primary !px-3 !py-1.5 text-xs">Record</button>
            </form>
          </section>

          <section className="card p-4">
            <h2 className="font-display text-xl">Actions <span className="font-ui text-sm font-normal text-slate">({actions.length})</span></h2>
            <ul className="mt-2 space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="text-sm text-ink">
                  <span className={a.status === "done" ? "text-slate line-through" : ""}>{a.title}</span>{" "}
                  <span className="text-[11px] text-slate">{a.ownerUid ? nameOf(a.ownerUid) : "unassigned"}{a.due ? ` · due ${a.due}` : ""} · {a.status === "done" ? "done" : "on the board"}</span>
                </li>
              ))}
            </ul>
            <form className="mt-2 grid gap-2" onSubmit={async (e) => { e.preventDefault(); if (!action.title.trim()) return; await send({ action: "addMeetingAction", ...action }); setAction({ title: "", ownerUid: "", due: "" }); }}>
              <input value={action.title} onChange={(e) => setAction({ ...action, title: e.target.value })} placeholder="What was agreed?" className={`${input} mt-0`} />
              <span className="flex flex-wrap gap-2">
                <select value={action.ownerUid} onChange={(e) => setAction({ ...action, ownerUid: e.target.value })} className={`${input} mt-0 w-auto flex-1`}>
                  <option value="">Owner…</option>
                  {people.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
                </select>
                <input type="date" value={action.due} onChange={(e) => setAction({ ...action, due: e.target.value })} className={`${input} mt-0 w-auto`} />
                <button disabled={!action.title.trim()} className="btn-primary !px-3 !py-1.5 text-xs">Add action</button>
              </span>
            </form>
          </section>

          <section className="card p-4">
            <h2 className="font-display text-xl">Notes</h2>
            {notes === null ? (
              <>
                <p className="mt-2 whitespace-pre-line text-sm text-slate">{m.notes || "A short summary, written at the end."}</p>
                <button onClick={() => setNotes(m.notes)} className={`${btn} mt-2`}>Edit</button>
              </>
            ) : (
              <form className="mt-2" onSubmit={async (e) => { e.preventDefault(); await send({ action: "updateMeeting", notes }); setNotes(null); }}>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={input} />
                <span className="mt-2 flex gap-2"><button className="btn-primary !px-3 !py-1.5 text-xs">Save</button><button type="button" onClick={() => setNotes(null)} className={btn}>Cancel</button></span>
              </form>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
