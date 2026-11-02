"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { ABILITIES, ASK_LABEL, READ_SCOPES, type Ask, type GrantPolicy } from "@/lib/agents/scopes";
import { FILTERS, RESULT_LABEL, matches, type Filter } from "@/lib/agents/activity";
import type { LogResult } from "@/lib/mcp/log";
import type { AgentUrls } from "@/lib/agents/urls";
import { CopyButton, Initials, NanaFace, Switch } from "./ui";

// Console → Connected agents: the assistants a member has let work on their account, what each may do, a week of activity, the full
// activity log (filters, CSV), and Edit permissions / Pause / Disconnect; Nana's own card with Pause all jobs. Drawn to the approved mockup.
type Card = {
  id: string; name: string; maker: string; fromHost: string; status: "active" | "paused" | "expired"; createdAt: string; expiresAt: string; lastActiveAt: string | null; pausedAt: string | null;
  chips: { label: string; write: boolean }[]; policy: GrantPolicy; asks: string; week: number; spark: number[]; today: number;
};
type Row = { id: string; at: string; agent: string; grantId: string; what: string; tool: string; result: LogResult; proposalId: string };
type Data = {
  agents: Card[]; disconnected: { id: string; name: string; revokedAt: string }[];
  stats: { working: number; paused: number; actions7d: number; waiting: number };
  log: Row[]; counts: Record<Filter, number>;
  nana: { operator: boolean; enabled: boolean; paused: boolean; jobsOn: number; week: number; spark: number[] };
  urls: AgentUrls; choices: { accessDays: number[]; actionsPerDay: number[]; discountNaira: number[] }; logDays: number;
};
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric", timeZone: "Africa/Lagos" });
const ago = (iso: string | null) => {
  if (!iso) return "not used yet";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "last active just now";
  if (m < 60) return `last active ${m} min ago`;
  const d = new Date(iso);
  if (m < 48 * 60 && d.getDate() !== new Date().getDate()) return `last active yesterday, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}`;
  return m < 24 * 60 ? `last active ${Math.round(m / 60)} h ago` : `last active ${date(iso)}`;
};
const when = (iso: string) => {
  const d = new Date(iso), today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  return today ? t : `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Africa/Lagos" })} ${t}`;
};
const PILL: Record<LogResult, string> = {
  read: "bg-field text-slate", done: "bg-emerald-100 text-emerald-900", waiting: "bg-amber-100 text-amber-900", blocked: "bg-red-100 text-red-900", failed: "bg-red-100 text-red-900",
  approved: "bg-emerald-100 text-emerald-900", declined: "bg-field text-slate", undone: "bg-field text-slate", expired: "bg-field text-slate",
};
const sel = "rounded-lg border border-rule bg-card px-2.5 py-1.5 font-ui text-xs font-semibold";

function Spark({ bars }: { bars: number[] }) {
  const max = Math.max(1, ...bars);
  return <span className="flex h-6 items-end gap-[3px]" aria-label={`Activity, last 7 days: ${bars.join(", ")}`}>{bars.map((b, i) => <i key={i} className={`block w-[6px] rounded-sm ${i === bars.length - 1 ? "bg-crimson" : "bg-crimson/25"}`} style={{ height: `${Math.max(3, (b / max) * 24)}px` }} />)}</span>;
}

export default function ConnectedAgents({ user }: { user: User }) {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [days, setDays] = useState(7);
  const [focus, setFocus] = useState(""); // the agent whose activity is shown
  const [editing, setEditing] = useState<string>("");
  const [draft, setDraft] = useState<GrantPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [howTo, setHowTo] = useState(false);
  const [shown, setShown] = useState(12); // log rows on screen; "Show more" adds more (the CSV has them all)

  const call = useCallback(async (url: string, init: RequestInit = {}) => {
    const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [user]);
  const query = `days=${days}${focus ? `&agent=${focus}` : ""}`;
  const load = useCallback(async () => { try { setData(await call(`/api/console/agents?${query}`)); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your agents."); } }, [call, query]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (data && !focus && data.agents[0]) setFocus(data.agents[0].id); }, [data, focus]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(""); setMsg("");
    try { await fn(); setMsg(ok); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }
  async function csv() {
    const r = await fetch(`/api/console/agents?${query}&filter=${filter}&format=csv`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = `agent-activity-${days}d.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!data) return <p className="mt-8 text-sm text-slate" role={error ? "alert" : undefined}>{error || "Loading your connected agents…"}</p>;
  const current = data.agents.find((a) => a.id === focus);
  const focusName = focus === "nana" ? "Nana" : current?.name ?? "your agents";
  const rows = data.log.filter((r) => matches({ result: r.result, ok: true, tool: r.tool }, filter));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-slate">AI assistants and apps you&apos;ve let work on your account. See what each one did, change what it may do, pause it or disconnect it. Money never moves through an agent.</p>
        <button type="button" className="btn-primary shrink-0" onClick={() => setHowTo((v) => !v)}><span aria-hidden="true">＋</span> Connect an agent</button>
      </div>
      {howTo && (
        <div className="card mt-4 p-5 text-sm">
          <p className="font-ui font-bold">Connect an assistant (Claude, ChatGPT and others)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate">
            <li>In your assistant, add a connector (some call it an MCP server) with the address <span className="font-mono text-ink">{data.urls.mcp}</span> <CopyButton value={data.urls.mcp} />.</li>
            <li>It sends you to the Connect NotesApp page, or shows an 8-character code.</li>
            <li>Got a code? Type it at <a href={data.urls.link} className="font-mono text-crimson">{data.urls.linkLabel}</a>. You choose what it may see and do.</li>
          </ol>
        </div>
      )}
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p>}
      {msg && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{msg}</p>}

      {/* ---- the numbers ---- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <div className="card p-4"><b className="block font-display text-[32px] font-medium leading-none">{data.stats.working}</b><span className="mt-2 block text-[13px] text-slate">working now</span></div>
        <div className="card p-4"><b className="block font-display text-[32px] font-medium leading-none">{data.stats.paused}</b><span className="mt-2 block text-[13px] text-slate">paused</span></div>
        <div className="card p-4"><b className="block font-display text-[32px] font-medium leading-none">{data.stats.actions7d.toLocaleString("en-GB")}</b><span className="mt-2 block text-[13px] text-slate">actions, last 7 days</span></div>
        <Link href="/nana/inbox" className={`card p-4 ${data.stats.waiting ? "border-crimson/40 bg-crimson/[.05]" : ""}`}><b className="block font-display text-[32px] font-medium leading-none text-crimson">{data.stats.waiting}</b><span className="mt-2 block text-[13px] text-slate">waiting for you · <span className="font-semibold text-crimson">Nana&apos;s inbox</span></span></Link>
        <div className="card col-span-2 p-4 lg:col-span-1"><span className="block text-[13px] text-slate">Server address for any agent</span><span className="mt-2 flex flex-wrap items-center gap-x-2"><span className="break-all font-mono text-[13px]">{data.urls.mcp}</span><CopyButton value={data.urls.mcp} /></span></div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[400px,1fr] lg:items-start">
        {/* ---- the agents ---- */}
        <div className="space-y-3">
          {!data.agents.length && <div className="card p-5 text-sm text-slate">No assistants connected yet. Press <b>Connect an agent</b> to see how.</div>}
          {data.agents.map((a) => (
            <article key={a.id} className={`card p-4 ${focus === a.id ? "border-2 border-crimson" : ""}`} onClick={() => setFocus(a.id)}>
              <div className="flex items-start gap-3">
                <Initials name={a.name} size={44} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2"><b className="font-ui text-[15px]">{a.name}</b>
                    <span className={`rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${a.status === "active" ? "bg-emerald-100 text-emerald-900" : a.status === "paused" ? "bg-field text-slate" : "bg-amber-100 text-amber-900"}`}>{a.status === "active" ? "● Working" : a.status === "paused" ? "❙❙ Paused" : "Access ended"}</span></p>
                  <p className="text-[13px] text-slate">{[a.maker, a.fromHost && `from ${a.fromHost}`, a.status === "paused" && a.pausedAt ? `paused by you on ${date(a.pausedAt)}` : ago(a.lastActiveAt)].filter(Boolean).join(" · ")}</p>
                </div>
                {a.status !== "paused" && <Spark bars={a.spark} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.chips.map((c) => <span key={c.label} className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${c.write ? "bg-crimson/[.07] text-crimson" : "bg-field text-ink"}`}>{c.label}</span>)}</div>
              {a.status === "active" && new Date(a.expiresAt).getTime() - Date.now() < 14 * 86_400_000 ? (
                <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-[13px] text-amber-900">Access ends in {Math.max(0, Math.ceil((new Date(a.expiresAt).getTime() - Date.now()) / 86_400_000))} days ({date(a.expiresAt)}). <button type="button" className="font-semibold underline" disabled={busy} onClick={(e) => { e.stopPropagation(); void act(() => call("/api/console/agents", { method: "PATCH", body: JSON.stringify({ id: a.id, action: "renew" }) }), `${a.name} renewed.`); }}>Renew</button></p>
              ) : a.status !== "paused" && <p className="mt-3 text-[13px] text-slate">Connected {date(a.createdAt)} by you · access until {date(a.expiresAt)} · {a.week} action{a.week === 1 ? "" : "s"} this week</p>}
              {editing === a.id && draft ? (
                <div className="mt-3 space-y-3 rounded-xl border border-rule bg-paper p-3" onClick={(e) => e.stopPropagation()}>
                  <p className="font-ui text-xs font-bold uppercase tracking-wide text-slate">What it can see</p>
                  {READ_SCOPES.map((s) => <label key={s.id} className="flex items-center justify-between gap-2 text-[13px]">{s.label}<Switch on={draft.scopes.includes(s.id)} label={s.label} onChange={(v) => setDraft({ ...draft, scopes: v ? [...draft.scopes, s.id] : draft.scopes.filter((x) => x !== s.id) })} /></label>)}
                  <p className="pt-1 font-ui text-xs font-bold uppercase tracking-wide text-slate">What it can do</p>
                  {ABILITIES.map((ab) => { const r = draft.abilities[ab.id]; return (
                    <div key={ab.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]"><span className="min-w-0 flex-1">{ab.label}</span>
                      {r.on && <select className={sel} value={r.ask} disabled={ab.choices.length < 2} onChange={(e) => setDraft({ ...draft, abilities: { ...draft.abilities, [ab.id]: { ...r, ask: e.target.value as Ask } } })} aria-label={`${ab.label}: asks first?`}>{ab.choices.map((c) => <option key={c} value={c}>{ASK_LABEL[c]}</option>)}</select>}
                      <Switch on={r.on} label={ab.label} onChange={(v) => setDraft({ ...draft, abilities: { ...draft.abilities, [ab.id]: { ...r, on: v } } })} /></div>); })}
                  <p className="pt-1 font-ui text-xs font-bold uppercase tracking-wide text-slate">Limits</p>
                  <label className="flex items-center justify-between text-[13px]">Actions a day<select className={sel} value={draft.limits.actionsPerDay} onChange={(e) => setDraft({ ...draft, limits: { ...draft.limits, actionsPerDay: Number(e.target.value) } })}>{data.choices.actionsPerDay.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                  <label className="flex items-center justify-between text-[13px]">Biggest discount<select className={sel} value={draft.limits.discountCapKobo / 100} onChange={(e) => setDraft({ ...draft, limits: { ...draft.limits, discountCapKobo: Number(e.target.value) * 100 } })}>{data.choices.discountNaira.map((n) => <option key={n} value={n}>{n ? `Up to ₦${n.toLocaleString("en-NG")}` : "None"}</option>)}</select></label>
                  <label className="flex items-center justify-between text-[13px]">Access lasts<select className={sel} value={draft.limits.accessDays} onChange={(e) => setDraft({ ...draft, limits: { ...draft.limits, accessDays: Number(e.target.value) } })}>{data.choices.accessDays.map((n) => <option key={n} value={n}>{n} days</option>)}</select></label>
                  <p className="flex gap-2 pt-1"><button type="button" className="btn-primary !px-4 !py-2 text-xs" disabled={busy} onClick={() => act(() => call("/api/console/agents", { method: "PATCH", body: JSON.stringify({ id: a.id, action: "edit", policy: draft }) }), "Permissions saved.").then(() => setEditing(""))}>Save</button><button type="button" className="btn-ghost !px-4 !py-2 text-xs" onClick={() => setEditing("")}>Cancel</button></p>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {a.status === "paused" ? (
                    <button type="button" className="rounded-full bg-crimson/10 px-4 py-2 font-ui text-[13px] font-bold text-crimson" disabled={busy} onClick={() => act(() => call("/api/console/agents", { method: "PATCH", body: JSON.stringify({ id: a.id, action: "resume" }) }), `${a.name} is working again.`)}>Resume</button>
                  ) : (<>
                    <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-[13px] font-semibold" onClick={() => { setEditing(a.id); setDraft(a.policy); }}>Edit permissions</button>
                    <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-[13px] font-semibold" disabled={busy} onClick={() => act(() => call("/api/console/agents", { method: "PATCH", body: JSON.stringify({ id: a.id, action: "pause" }) }), `${a.name} is paused.`)}>Pause</button>
                  </>)}
                  <button type="button" className="rounded-full border border-crimson/40 px-4 py-2 font-ui text-[13px] font-semibold text-crimson" disabled={busy} onClick={() => confirm(`Disconnect ${a.name}? It stops working at once, and its waiting requests are dismissed.`) && act(() => call(`/api/console/agents?id=${a.id}`, { method: "DELETE" }), `${a.name} is disconnected.`)}>Disconnect</button>
                </div>
              )}
            </article>
          ))}
          {/* Nana: built in, the same rules and log as outside agents */}
          <article className={`card p-4 ${focus === "nana" ? "border-2 border-crimson" : ""}`} onClick={() => setFocus("nana")}>
            <div className="flex items-start gap-3"><NanaFace size={44} />
              <div className="min-w-0 flex-1"><p className="flex items-center gap-2"><b className="font-ui text-[15px]">Nana</b><span className="rounded-full bg-crimson/10 px-2 py-0.5 font-ui text-[11px] font-bold text-crimson">Built in</span></p>
                <p className="text-[13px] text-slate">{!data.nana.operator ? "Nana's jobs come with Business and Enterprise" : !data.nana.enabled ? "Jobs not switched on yet" : data.nana.paused ? "All jobs paused" : `${data.nana.jobsOn} jobs on`} · same rules and log as outside agents</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              <Link href="/nana/inbox" className="rounded-full border border-rule px-4 py-2 font-ui text-[13px] font-semibold">Nana&apos;s jobs</Link>
              {data.nana.operator && data.nana.enabled && <button type="button" className="rounded-full border border-rule px-4 py-2 font-ui text-[13px] font-semibold" disabled={busy} onClick={() => act(() => call("/api/console/agents", { method: "PATCH", body: JSON.stringify({ nana: data.nana.paused ? "resume" : "pause" }) }), data.nana.paused ? "Nana is working again." : "All of Nana's jobs are paused.")}>{data.nana.paused ? "Resume all jobs" : "Pause all jobs"}</button>}
              {!data.nana.operator && <Link href="/pricing" className="rounded-full bg-crimson/10 px-4 py-2 font-ui text-[13px] font-bold text-crimson">See plans</Link>}
            </div>
          </article>
          {data.disconnected.length > 0 && <p className="px-1 text-[13px] text-slate">Disconnected: {data.disconnected.map((d) => `${d.name} (${date(d.revokedAt)})`).join(", ")}. <button type="button" className="font-semibold text-crimson" onClick={() => { setFocus(""); setDays(90); }}>See history</button></p>}
        </div>

        {/* ---- the activity ---- */}
        <section className="card min-w-0 p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow">Activity</p><h2 className="mt-1 font-display text-[28px] leading-tight">What {focusName} did</h2></div>
            <div className="flex gap-2">
              <select className={sel} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">{[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d === 365 ? "Last 12 months" : `Last ${d} days`}</option>)}</select>
              <button type="button" className="rounded-full border border-rule px-3.5 py-1.5 font-ui text-xs font-semibold" onClick={csv}>Download CSV</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`rounded-full px-3 py-1 font-ui text-xs font-bold ${filter === f.id ? "bg-ink text-paper" : "bg-field text-ink"}`}>{f.label} {data.counts[f.id] ?? 0}</button>)}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead><tr className="border-b border-rule font-ui text-[11px] uppercase tracking-wide text-slate"><th className="py-2 pr-3 font-semibold">When</th><th className="py-2 pr-3 font-semibold">What it did</th><th className="py-2 pr-3 font-semibold">Tool</th><th className="py-2 font-semibold">Result</th></tr></thead>
              <tbody>
                {rows.slice(0, shown).map((r) => (
                  <tr key={r.id} className="border-b border-rule align-top">
                    <td className="py-3 pr-3 font-mono text-xs text-slate">{when(r.at)}</td>
                    <td className="py-3 pr-3">{r.what}{!focus || focus === "" ? <span className="block text-xs text-slate">{r.agent}</span> : null}</td>
                    <td className="py-3 pr-3 font-mono text-xs text-slate">{r.tool}</td>
                    <td className="py-3"><span className={`inline-block rounded-full px-2 py-0.5 font-ui text-[11px] font-bold ${PILL[r.result]}`}>{RESULT_LABEL[r.result]}</span>
                      {r.result === "waiting" && r.proposalId && <Link href={`/nana/inbox?p=${r.proposalId}`} className="mt-1 block font-ui text-xs font-bold text-crimson">Decide</Link>}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} className="py-8 text-center text-sm text-slate">Nothing in this period.</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > shown && <button type="button" className="mt-3 font-ui text-sm font-bold text-crimson" onClick={() => setShown((n) => n + 25)}>Show more ({rows.length - shown} left)</button>}
          {current && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-rule bg-paper p-3.5 text-[13px]"><b className="font-ui">Always asks you</b><p className="mt-1">{current.asks}</p></div>
              <div className="rounded-xl border border-rule bg-paper p-3.5 text-[13px]"><b className="font-ui">Limits</b><p className="mt-1">{current.policy.limits.actionsPerDay} actions a day ({current.today} used today) · discounts up to ₦{(current.policy.limits.discountCapKobo / 100).toLocaleString("en-NG")} · spends ₦0, fixed</p></div>
            </div>
          )}
          <p className="mt-4 text-xs text-slate">We keep this log for {Math.round(data.logDays / 30.4)} months. It records what was asked and what happened, never the full content an agent was given. Text from members is labelled to agents as information, not instructions.</p>
        </section>
      </div>
    </div>
  );
}
