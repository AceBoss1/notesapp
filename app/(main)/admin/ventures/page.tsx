"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import {
  CALL_NAME, KIND_LABEL, REGION_LABEL, SECTOR_LABEL, STAGE_LABEL, STATUSES, STATUS_LABEL,
  type Application, type RoundSettings, type Status,
} from "@/lib/ventures";

const btn = "rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";

// Admin → Ventures (lib/ventures-server.ts): every Rewrite the Playbook pitch, newest first within each status. Open one to read it, move
// it on (the member is told in their notifications), keep private notes, and mark perks sent. A super admin opens or closes the round.
// Pitches are kept confidential: don't copy them out of here.
export default function AdminVenturesPage() {
  const { user, loading } = useAdminAuth();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [round, setRound] = useState<RoundSettings | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const token = await user!.getIdToken();
    const res = await fetch("/api/admin/ventures", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    return j;
  }, [user]);
  const load = useCallback(() => call().then((j: { applications: Application[]; round: RoundSettings }) => { setApps(j.applications); setRound(j.round); }, (e) => setError(e.message)), [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  const act = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag); setError("");
    try { await call(body); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  };
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, (apps ?? []).filter((a) => a.status === s).length])) as Record<Status, number>, [apps]);
  const shown = (apps ?? []).filter((a) => filter === "all" || a.status === filter);

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Ventures · {CALL_NAME}</h1>
      <p className="mt-1 text-sm text-slate">Every pitch is kept confidential: read it here, don&apos;t copy it out. Moving a pitch on tells the member in their notifications. <Link href="/ventures" className="text-crimson underline">See the page</Link></p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}

      {round && <RoundBox round={round} busy={busy === "round"} onSave={(r) => act("round", { action: "round", ...r })} />}

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => setFilter("all")} className={`${btn} ${filter === "all" ? "border-crimson text-crimson" : ""}`}>All · {apps?.length ?? 0}</button>
        {STATUSES.map((s) => <button key={s} type="button" onClick={() => setFilter(s)} className={`${btn} ${filter === s ? "border-crimson text-crimson" : ""}`}>{STATUS_LABEL[s]} · {counts[s] ?? 0}</button>)}
      </div>

      {!apps ? <p className="mt-6 text-sm text-slate">Loading…</p> : !shown.length ? <p className="mt-6 text-sm text-slate">No pitches here yet.</p> : (
        <ul className="mt-4 space-y-2">
          {shown.map((a) => (
            <li key={a.id} className="rounded-2xl border border-rule bg-card p-4 text-sm">
              <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="flex w-full flex-wrap items-baseline gap-2 text-left" aria-expanded={open === a.id}>
                <b className="text-ink">{a.title}</b>
                <span className="text-slate">· @{a.username} · {REGION_LABEL[a.region]} · {KIND_LABEL[a.kind]} · {a.round} · {a.createdAt.slice(0, 10)}</span>
                <span className="ml-auto rounded-full bg-field px-2.5 py-0.5 text-xs font-semibold text-ink">{STATUS_LABEL[a.status]}</span>
              </button>
              <p className="mt-1 text-slate">{a.oneLiner}</p>
              {open === a.id && (
                <div className="mt-4 space-y-3 border-t border-rule pt-4">
                  <p className="text-xs text-slate">{SECTOR_LABEL[a.sector]} · {STAGE_LABEL[a.stage]} · {a.countries} · team of {a.teamSize} · by <Link href={`/u/${a.username}`} className="text-crimson underline">{a.name}</Link></p>
                  {([["The problem", a.problem], ["The idea", a.solution], ["Why them", a.whyYou], ["Traction", a.traction || "None given"]] as [string, string][]).map(([h, t]) => (
                    <div key={h}><p className="font-ui text-xs font-bold uppercase tracking-wide text-slate">{h}</p><p className="mt-1 whitespace-pre-wrap text-ink">{t}</p></div>
                  ))}
                  {a.links.length > 0 && <ul className="text-xs">{a.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-crimson underline">{l}</a></li>)}</ul>}
                  <label className="block text-xs font-semibold text-ink">Team notes (never shown to the member)
                    <textarea rows={3} defaultValue={a.notes ?? ""} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} className="mt-1 block w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {notes[a.id] !== undefined && <button type="button" className={btn} disabled={busy === a.id} onClick={() => act(a.id, { action: "decide", id: a.id, notes: notes[a.id] })}>Save notes</button>}
                    {a.status !== "withdrawn" && (["reviewing", "shortlisted", "picked", "not-picked"] as Status[]).filter((s) => s !== a.status).map((s) => (
                      <button key={s} type="button" className={btn} disabled={busy === a.id} onClick={() => { if (s !== "picked" && s !== "not-picked" || confirm(`Mark "${a.title}" as ${STATUS_LABEL[s]}? The member is told.`)) void act(a.id, { action: "decide", id: a.id, status: s }); }}>{STATUS_LABEL[s]}</button>
                    ))}
                    {a.perksSentAt ? <span className="text-xs text-green-700">Perks sent {a.perksSentAt.slice(0, 10)}</span>
                      : <button type="button" className={btn} disabled={busy === a.id} onClick={() => act(a.id, { action: "decide", id: a.id, perksSent: true })}>Mark perks sent</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoundBox({ round, busy, onSave }: { round: RoundSettings; busy: boolean; onSave: (r: { round: string; open: boolean; closesOn: string }) => void }) {
  const [r, setR] = useState({ round: round.round, open: round.open, closesOn: round.closesOn ?? "" });
  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-rule bg-card p-4 text-sm">
      <label className="text-xs font-semibold text-ink">Round<input value={r.round} onChange={(e) => setR({ ...r, round: e.target.value })} className="mt-1 block w-40 border border-rule bg-paper px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold text-ink">Closes on (optional)<input type="date" value={r.closesOn} onChange={(e) => setR({ ...r, closesOn: e.target.value })} className="mt-1 block border border-rule bg-paper px-3 py-2 text-sm" /></label>
      <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-ink"><input type="checkbox" checked={r.open} onChange={(e) => setR({ ...r, open: e.target.checked })} />Open for pitches</label>
      <button type="button" disabled={busy} onClick={() => onSave(r)} className={btn}>Save (super admin)</button>
    </div>
  );
}
