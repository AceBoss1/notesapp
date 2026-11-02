"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { askNana } from "@/components/messages/ChatNana";
import { KIND_INFO, timeLeft, type Proposal } from "@/lib/agents/proposals";
import type { JobId } from "@/lib/agents/jobs";
import type { Voice } from "@/lib/agents/voice";
import { Initials, NanaFace, Switch, kindTone } from "./ui";

// Nana's inbox: what Nana (and any assistant the member connected) has prepared and is waiting for them, what was done for them, and
// Nana's jobs. Pinned in Messages (Nana's conversation → /messages/nana/inbox) and at /nana/inbox. On a computer at /nana/inbox it is
// three columns (the views and jobs, the list, the open item); in Messages and on a phone, one column of cards with the reply inline.
type Data = {
  needs: Proposal[]; done: Proposal[]; declined: Proposal[]; now: string;
  plan: { tier: string; label: string; operator: boolean; upsell: string };
  ops: { enabled: boolean; paused: boolean; autoConfirm: boolean; jobs: Record<JobId, boolean>; voice: Voice | null };
  jobs: { id: JobId; label: string; detail: string }[];
  settings: { draftHours: number; undoReplyMinutes: number; undoAutoHours: number; logDays: number };
  ai: { usedPct: number; resetEvery: string } | null;
  me: { name: string; firstName: string };
};
type ViewId = "needs" | "done" | "declined" | "jobs";
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const dayTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const greeting = (now: string) => { const h = Number(new Date(now).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" })); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const who = (p: Proposal) => (p.payload?.toName as string) || p.quote?.from || p.sourceName;
const kindLabel = (p: Proposal) => (p.source !== "nana" && p.kind === "publish_post" ? `From ${p.sourceName}` : p.source !== "nana" ? `${KIND_INFO[p.kind].label} · from ${p.sourceName}` : KIND_INFO[p.kind].label);
const tone = (p: Proposal) => kindTone[p.source !== "nana" ? "agent" : KIND_INFO[p.kind].tone];

export default function NanaInbox({ variant = "full" }: { variant?: "full" | "messages" }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<ViewId>("needs");
  const [openId, setOpenId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [sort, setSort] = useState<"newest" | "expiring">("newest");
  const [voiceEdit, setVoiceEdit] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [, tick] = useState(0);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("view") === "done") setView("done"); if (q.get("p")) setOpenId(q.get("p")!); }, []);

  const call = useCallback(async (method: string, body?: unknown) => {
    const r = await fetch("/api/nana/inbox", { method, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [user]);
  const load = useCallback(async () => { try { setData(await call("GET")); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load Nana's inbox."); } }, [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key); setError(""); setNote("");
    try { const j = await fn(); if (j && typeof j === "object" && "needs" in (j as object)) setData(j as Data); else await load(); if (ok) setNote(ok); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(""); }
  }
  const actOn = (p: Proposal, action: "approve" | "edit" | "decline" | "dismiss" | "undo") =>
    run(`${p.id}:${action}`, () => call("POST", { id: p.id, action, ...(action === "approve" || action === "edit" ? { draft: drafts[p.id] ?? p.draft ?? "" } : {}) }),
      action === "approve" ? (KIND_INFO[p.kind].sends ? `Sent. You can undo it for ${data?.settings.undoReplyMinutes ?? 2} minutes.` : "Done.") : action === "undo" ? "Undone." : action === "edit" ? "Your edits are saved." : undefined);
  const rewrite = async (p: Proposal, task: string, language?: string) => {
    if (!user) return;
    setBusy(`${p.id}:rewrite`); setError("");
    try { const t = await askNana(user, { task, text: drafts[p.id] ?? p.draft ?? "", ...(language ? { language } : {}) }); setDrafts((d) => ({ ...d, [p.id]: t })); }
    catch (e) { setError(e instanceof Error ? e.message : "Nana couldn't do that right now."); }
    finally { setBusy(""); }
  };

  const needs = useMemo(() => {
    const list = [...(data?.needs ?? [])];
    return sort === "expiring" ? list.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)) : list;
  }, [data, sort]);
  const open = useMemo(() => [...(data?.needs ?? []), ...(data?.done ?? []), ...(data?.declined ?? [])].find((p) => p.id === openId) ?? needs[0], [data, openId, needs]);

  if (user === null) return <p className="p-8 text-sm text-slate"><Link href="/login?next=/nana/inbox" className="text-crimson underline">Sign in</Link> to see Nana&apos;s inbox.</p>;
  if (!data) return <p className="p-8 text-sm text-slate" role={error ? "alert" : undefined}>{error || "Loading Nana's inbox…"}</p>;
  const now = new Date();
  const n = data.needs.length;
  const intro = <>{greeting(data.now)}{data.me.firstName ? `, ${data.me.firstName}` : ""}. <b>{n ? `${n <= 10 ? NUM[n] : n} thing${n === 1 ? "" : "s"}` : "Nothing"}</b> {n === 1 ? "is" : "are"} waiting for you{n ? `, about ${Math.max(1, Math.round(n * 0.6))} minute${n > 1 ? "s'" : "'s"} work` : ""}.</>;
  const footer = <p className="text-xs text-slate">Drafts you don&apos;t answer expire after {data.settings.draftHours} hours. Nothing leaves your account until you approve it.</p>;
  const banner = (error || note) && <p className={`rounded-xl border px-4 py-2.5 text-sm ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} role={error ? "alert" : "status"}>{error || note}</p>;

  // ---------- pieces ----------
  const Upsell = () => (!data.plan.operator ? (
    <div className="card border-l-4 border-crimson p-4 text-sm">
      <p className="font-ui font-bold">Let Nana do the routine work</p>
      <p className="mt-1 text-slate">{data.plan.upsell} Requests from assistants you connect still arrive here on {data.plan.label}.</p>
      <Link href="/pricing" className="mt-2 inline-block font-ui text-sm font-bold text-crimson">See Business and Enterprise</Link>
    </div>
  ) : !data.ops.enabled ? (
    <div className="card border-l-4 border-crimson p-4 text-sm">
      <p className="font-ui font-bold">Switch on Nana&apos;s jobs</p>
      <p className="mt-1 text-slate">Nana drafts booking replies and answers in your voice, nudges you about unshipped orders, turns your notes into journal drafts and sends a Monday summary. She asks before anything that matters, never publishes and never moves money.</p>
      <button type="button" className="btn-primary mt-3 !px-4 !py-2 text-xs" disabled={!!busy} onClick={() => run("enable", () => call("PATCH", { enabled: true }), "Nana's jobs are on.")}>Switch on</button>
    </div>
  ) : data.ops.paused ? (
    <div className="card border-l-4 border-amber-400 p-4 text-sm"><p className="font-ui font-bold">All of Nana&apos;s jobs are paused</p><button type="button" className="mt-2 font-ui text-sm font-bold text-crimson" onClick={() => run("resume", () => call("PATCH", { paused: false }), "Nana is working again.")}>Resume</button></div>
  ) : null);

  const Jobs = () => (
    <div className="card p-4">
      <div className="flex items-center justify-between"><p className="font-ui text-sm font-bold">Nana&apos;s jobs</p>{data.plan.operator && data.ops.enabled && <button type="button" className="font-ui text-xs font-bold text-crimson" onClick={() => run("pause", () => call("PATCH", { paused: !data.ops.paused }), data.ops.paused ? "Nana is working again." : "All jobs paused.")}>{data.ops.paused ? "Resume all" : "Pause all"}</button>}</div>
      {data.jobs.map((j, i) => (
        <div key={j.id} className={`flex items-center justify-between gap-3 py-2.5 ${i ? "border-t border-rule" : ""}`}>
          <span><b className="block font-ui text-[13px]">{j.label}</b><span className="text-[11.5px] text-slate">{j.detail}</span></span>
          <Switch on={data.plan.operator && data.ops.enabled && data.ops.jobs[j.id]} disabled={!data.plan.operator || !data.ops.enabled || !!busy} label={j.label} onChange={(v) => run(`job:${j.id}`, () => call("PATCH", { jobs: { [j.id]: v } }))} />
        </div>
      ))}
      {data.plan.operator && data.ops.enabled && (
        <label className="mt-1 flex items-center justify-between gap-3 border-t border-rule pt-2.5 text-[12px] text-slate">Booking confirmations go without asking
          <Switch on={data.ops.autoConfirm} label="Booking confirmations go without asking" disabled={!!busy} onChange={(v) => run("auto", () => call("PATCH", { autoConfirm: v }))} />
        </label>
      )}
    </div>
  );

  const VoiceCard = () => (
    <div className="card p-4">
      <p className="font-ui text-sm font-bold">Writes like you</p>
      {voiceEdit === null ? (
        <>
          <p className="mt-1.5 text-[13px] text-slate">{data.ops.voice?.text || "Nana learns how you write from your own messages and journals when you switch her on."}</p>
          {data.plan.operator && <p className="mt-2 flex gap-4"><button type="button" className="font-ui text-[13px] font-bold text-crimson" onClick={() => setVoiceEdit(data.ops.voice?.text ?? "")}>Edit voice</button><button type="button" className="font-ui text-[13px] font-semibold text-slate" disabled={!!busy} onClick={() => run("relearn", () => call("PATCH", { relearn: true }), "Nana learnt your voice again.")}>Learn again</button></p>}
        </>
      ) : (
        <form className="mt-2" onSubmit={(e) => { e.preventDefault(); void run("voice", () => call("PATCH", { voice: voiceEdit }), "Saved. Nana writes like this now.").then(() => setVoiceEdit(null)); }}>
          <textarea value={voiceEdit} onChange={(e) => setVoiceEdit(e.target.value)} maxLength={400} rows={4} aria-label="How you write" className="w-full rounded-lg border border-rule bg-paper p-2 text-[13px]" />
          <p className="mt-2 flex gap-3"><button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!!busy}>Save</button><button type="button" className="text-xs text-slate" onClick={() => setVoiceEdit(null)}>Cancel</button></p>
        </form>
      )}
      {data.ai && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="flex justify-between text-[12px]"><span className="text-slate">AI used this {data.ai.resetEvery}</span><b className="font-ui">{data.ai.usedPct}% of allowance</b></p>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-field"><span className="block h-full rounded-full bg-crimson" style={{ width: `${data.ai.usedPct}%` }} /></span>
        </div>
      )}
    </div>
  );

  const NotesBox = () => (data.plan.operator && data.ops.enabled && data.ops.jobs.journalDrafts ? (
    <form className="card p-4" onSubmit={(e) => { e.preventDefault(); void run("journal", () => call("POST", { action: "journal", notes }), "Nana drafted it: it's waiting for you in Needs you.").then(() => setNotes("")); }}>
      <p className="font-ui text-sm font-bold">Turn notes into a journal draft</p>
      <p className="mt-1 text-[12px] text-slate">Paste your notes or a voice note&apos;s words. Nana drafts it; approving saves a draft. She never publishes.</p>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={8000} aria-label="Your notes" className="mt-2 w-full rounded-lg border border-rule bg-paper p-2 text-[13px]" />
      <button className="btn-primary mt-2 !px-3 !py-1.5 text-xs" disabled={!!busy || notes.trim().length < 20}>Draft it</button>
    </form>
  ) : null);

  const draftOf = (p: Proposal) => drafts[p.id] ?? p.draft ?? "";
  const Actions = ({ p, compact }: { p: Proposal; compact?: boolean }) => {
    const b = (a: Parameters<typeof actOn>[1]) => busy === `${p.id}:${a}`;
    if (p.kind === "money") return (
      <div className="flex flex-wrap gap-2"><Link href={String(p.payload?.orderHref ?? "/orders")} className="btn-primary !px-5 !py-2.5">Open order</Link><button type="button" className="btn-ghost !px-5 !py-2.5" onClick={() => actOn(p, "dismiss")} disabled={!!busy}>Dismiss</button></div>
    );
    const sends = KIND_INFO[p.kind].sends;
    const approve = p.kind === "publish_post" ? "Approve and publish" : p.kind === "journal_draft" ? "Save as draft" : p.kind === "store_edit" ? "Approve change" : p.kind === "mark_shipped" ? "Mark shipped" : compact ? "Send reply" : "Approve and send";
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary !px-5 !py-2.5" disabled={!!busy} onClick={() => actOn(p, "approve")}>{b("approve") ? "Working…" : approve}</button>
        {p.draft !== undefined && (compact && !editing[p.id] ? <button type="button" className="btn-ghost !px-4 !py-2.5" onClick={() => setEditing((e) => ({ ...e, [p.id]: true }))}>Edit</button> : <button type="button" className="btn-ghost !px-4 !py-2.5" disabled={!!busy || draftOf(p) === p.draft} onClick={() => actOn(p, "edit")}>Save my edits</button>)}
        <button type="button" className="btn-ghost !px-4 !py-2.5" disabled={!!busy} onClick={() => actOn(p, "decline")}>{sends && !compact ? "Decline politely" : "Decline"}</button>
        {!compact && <button type="button" className="ml-auto font-ui text-sm font-bold text-crimson" disabled={!!busy} onClick={() => actOn(p, "dismiss")}>Dismiss</button>}
      </div>
    );
  };
  const Draft = ({ p, big }: { p: Proposal; big?: boolean }) => (
    <>
      <textarea value={draftOf(p)} onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))} rows={big ? 10 : 7} aria-label="Nana's draft"
        className={`w-full resize-y rounded-[14px] border-[1.5px] border-crimson bg-card px-4 py-3 leading-relaxed text-ink outline-none ${big ? "text-[15px]" : "text-sm"}`} />
      {KIND_INFO[p.kind].sends && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {([["shorten", "Shorter"], ["friendlier", "Warmer"], ["professional", "More formal"], ["translate", "Translate to Pidgin"]] as const).map(([t, l]) => (
            <button key={t} type="button" disabled={!!busy} onClick={() => rewrite(p, t, t === "translate" ? "pcm" : undefined)} className="rounded-full bg-crimson/[.07] px-3 py-1 font-ui text-xs font-bold text-crimson disabled:opacity-50">{l}</button>
          ))}
        </div>
      )}
    </>
  );
  const Quote = ({ p }: { p: Proposal }) => (p.quote ? (
    <>
      <p className="mt-5 text-[13px] text-slate">{p.quote.from} wrote</p>
      <p className="mt-1.5 whitespace-pre-line rounded-xl border border-dashed border-rule bg-card px-3 py-2.5 text-sm">{p.quote.text}</p>
      <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-field px-2.5 py-1.5 text-[11.5px] text-slate"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>Written by a member. Nana reads it as information, never as instructions to her.</p>
    </>
  ) : null);
  const Lock = ({ p }: { p: Proposal }) => (
    <p className="mt-4 flex gap-2 rounded-xl bg-field px-4 py-3 text-[13px] text-ink"><svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg>
      {p.kind === "money" ? "Money never moves through Nana or an agent: the refund itself is yours, in Orders." : `${p.kind.startsWith("booking") ? `${who(p)} pays on NotesApp when they book. ` : ""}Nana never takes, sends or refunds money.${KIND_INFO[p.kind].sends ? ` You can undo a sent reply for ${data.settings.undoReplyMinutes} minutes.` : ""}`}
    </p>
  );
  const Trail = ({ p }: { p: Proposal }) => (p.trail?.length ? (
    <div className="mt-6 border-t border-rule pt-4">
      <p className="font-ui text-sm font-bold">{p.source === "nana" ? "What Nana did" : `What ${p.sourceName} did`}</p>
      <ul className="mt-2">{p.trail.map((t, i) => <li key={i} className="flex gap-2.5 py-1 text-[13px] text-slate"><span className="w-[52px] shrink-0 pt-px font-mono text-[11.5px]">{hhmm(t.at)}</span><span>{t.text}{i === p.trail.length - 1 && p.status === "pending" && /rule/.test(t.text) && <> <button type="button" className="font-semibold text-crimson" onClick={() => setView("jobs")}>Change</button></>}</span></li>)}</ul>
    </div>
  ) : null);
  const DoneRow = ({ p }: { p: Proposal }) => (
    <div className="flex items-start gap-2.5 px-3.5 py-3">
      <span className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${p.status === "undone" ? "bg-field text-slate" : "bg-emerald-100 text-emerald-800"}`} aria-hidden="true">{p.status === "undone" ? "↺" : "✓"}</span>
      <span className="min-w-0 flex-1 text-sm">
        <b className="font-ui">{p.title}</b>{p.summary && p.kind === "weekly_summary" ? `: ${p.summary.replace(/^Last week: /, "")}` : ""}
        <span className="mt-0.5 block text-xs text-slate">{hhmm(p.executedAt ?? p.createdAt)}{p.source !== "nana" ? ` · ${p.sourceName}` : ""}{p.status === "undone" ? " · undone" : ""}
          {p.status === "done" && p.undoUntil && new Date(p.undoUntil) > now && <> · <button type="button" className="font-semibold text-crimson" disabled={!!busy} onClick={() => actOn(p, "undo")}>Undo</button> ({timeLeft(p.undoUntil, now)})</>}
          {typeof p.result?.href === "string" && p.status === "done" && <> · <Link href={p.result.href as string} className="font-semibold text-crimson">{p.kind === "journal_draft" ? "Open draft" : "Open"}</Link></>}
        </span>
      </span>
    </div>
  );
  const ListItem = ({ p, selected }: { p: Proposal; selected: boolean }) => (
    <button type="button" onClick={() => setOpenId(p.id)} className={`relative flex w-full gap-3 border-b border-rule px-4 py-3.5 text-left last:border-0 ${selected ? "bg-crimson/[.045] before:absolute before:bottom-2.5 before:left-0 before:top-2.5 before:w-[3px] before:rounded before:bg-crimson" : "hover:bg-paper"}`}>
      {p.source === "nana" && !p.quote && !p.payload?.toName ? <NanaFace size={40} /> : <Initials name={p.source !== "nana" ? p.sourceName : who(p)} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2"><span className={`font-ui text-[11px] font-extrabold uppercase tracking-wide ${tone(p)}`}>{kindLabel(p)}</span><span className="shrink-0 font-mono text-[11px] text-slate">{timeLeft(p.expiresAt, now)}</span></span>
        <b className="mt-0.5 block font-ui text-sm">{p.title}</b>
        <span className="line-clamp-2 text-[13px] text-slate">{p.summary}</span>
      </span>
    </button>
  );

  // ---------- one column: phone, and inside Messages ----------
  const stacked = (
    <div className={variant === "full" ? "lg:hidden" : ""}>
      <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur">
        <Link href={variant === "messages" ? "/messages/nana" : "/messages"} className="text-crimson" aria-label="Back"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 5l-7 7 7 7" /></svg></Link>
        <NanaFace size={44} />
        <span className="min-w-0 flex-1"><b className="block font-ui text-[17px]">Nana&apos;s inbox</b><span className="text-[13px] text-slate">Asks before anything that matters</span></span>
        <button type="button" onClick={() => setView("jobs")} className="flex h-10 w-10 items-center justify-center rounded-full bg-crimson/10 text-crimson" aria-label="Nana's jobs"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></button>
      </div>
      <div className="mx-auto max-w-2xl space-y-3 px-4 pb-10">
        <div className="my-3 flex rounded-full bg-field p-1" role="tablist">
          {([["needs", "Needs you"], ["done", "Done by Nana"], ["jobs", "Jobs"]] as const).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id || (id === "done" && view === "declined")} onClick={() => setView(id)} className={`flex-1 rounded-full py-2 font-ui text-[13px] font-bold ${view === id || (id === "done" && view === "declined") ? "bg-card text-ink shadow" : "text-slate"}`}>
              {l}{id === "needs" && n > 0 && <span className="ml-1 inline-block min-w-[18px] rounded-full bg-crimson px-1.5 text-[10px] leading-[18px] text-paper">{n}</span>}
            </button>
          ))}
        </div>
        {banner}
        {view === "needs" && (<>
          <p className="text-[15px]">{intro} {footer}</p>
          {Upsell()}
          {!needs.length && <p className="card p-6 text-center text-sm text-slate">All clear. Nana will let you know when something needs you.</p>}
          {needs.map((p) => (
            <article key={p.id} className={`card p-3.5 ${p.kind === "money" ? "border-amber-300" : ""}`}>
              <div className="flex items-start gap-2.5">
                {p.source !== "nana" ? <Initials name={p.sourceName} /> : <Initials name={who(p)} />}
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><span className={`font-ui text-[11px] font-extrabold uppercase tracking-wide ${tone(p)}`}>{kindLabel(p)}</span><span className="font-mono text-[11px] text-slate">{timeLeft(p.expiresAt, now).replace(" left", "")}</span></span>
                  <h3 className="mt-0.5 font-ui text-[14.5px] font-bold">{p.title}</h3>
                  <p className="text-[13px] text-slate">{p.summary}</p>
                </span>
              </div>
              {p.draft !== undefined && (KIND_INFO[p.kind].sends || editing[p.id]) && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[12.5px] text-slate">{p.source === "nana" ? "Nana's reply" : `${p.sourceName}'s draft`}</p>
                  {editing[p.id] ? Draft({ p }) : <p className="whitespace-pre-line rounded-xl border border-rule border-l-[3px] border-l-crimson bg-paper px-3.5 py-3 text-sm">{draftOf(p)}</p>}
                </div>
              )}
              {p.quote && editing[p.id] && Quote({ p })}
              <div className="mt-3">{Actions({ p, compact: true })}</div>
            </article>
          ))}
          {data.done.length > 0 && (<>
            <p className="mt-6 flex items-baseline justify-between font-ui text-[13px] font-extrabold">Done by Nana today<button type="button" className="font-bold text-crimson" onClick={() => setView("done")}>See all {data.done.length}</button></p>
            <div className="card divide-y divide-rule">{data.done.slice(0, 3).map((p) => <DoneRow key={p.id} p={p} />)}</div>
          </>)}
          <p className="pt-2 text-xs text-slate">Everything Nana and your connected agents do is in <Link href="/console?tab=agents" className="underline">Console → Connected agents</Link>, kept for {Math.round(data.settings.logDays / 30.4)} months.</p>
        </>)}
        {(view === "done" || view === "declined") && (<>
          <div className="flex gap-2"><button type="button" onClick={() => setView("done")} className={`rounded-full px-3 py-1 font-ui text-xs font-bold ${view === "done" ? "bg-ink text-paper" : "bg-field"}`}>Done {data.done.length}</button><button type="button" onClick={() => setView("declined")} className={`rounded-full px-3 py-1 font-ui text-xs font-bold ${view === "declined" ? "bg-ink text-paper" : "bg-field"}`}>Declined and expired {data.declined.length}</button></div>
          <div className="card divide-y divide-rule">{(view === "done" ? data.done : data.declined).map((p) => <DoneRow key={p.id} p={p} />)}{!(view === "done" ? data.done : data.declined).length && <p className="p-5 text-sm text-slate">Nothing here yet.</p>}</div>
        </>)}
        {view === "jobs" && (<>{Upsell()}{Jobs()}{NotesBox()}{VoiceCard()}</>)}
      </div>
    </div>
  );
  if (variant === "messages") return stacked;

  // ---------- three columns on a computer ----------
  const lists: Record<Exclude<ViewId, "jobs">, Proposal[]> = { needs, done: data.done, declined: data.declined };
  const listView = view === "jobs" ? "needs" : view;
  const shown = lists[listView];
  const sel = shown.find((p) => p.id === openId) ?? (listView === "needs" ? open : shown[0]);
  return (
    <>
      {stacked}
      <div className="mx-auto hidden max-w-[1440px] grid-cols-[260px,400px,1fr] items-start gap-5 px-8 pb-10 pt-6 lg:grid">
        <aside className="sticky top-5 space-y-4">
          <div className="flex items-center gap-3 px-1"><NanaFace size={56} /><span><span className="eyebrow">Nana AI</span><h1 className="font-display text-[26px] leading-tight">Nana&apos;s inbox</h1></span></div>
          <nav className="card p-2" aria-label="Views">
            {([["needs", "Needs you", data.needs.length], ["done", "Done by Nana", data.done.length], ["declined", "Declined and expired", data.declined.length]] as const).map(([id, l, c]) => (
              <button key={id} type="button" onClick={() => { setView(id); setOpenId(""); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-ui text-sm ${listView === id ? "bg-crimson/[.08] font-extrabold text-crimson" : "font-semibold hover:bg-paper"}`}>
                {l}<span className={`font-mono text-[11px] ${listView === id ? "rounded-full bg-crimson px-2 text-paper" : "text-slate"}`}>{c}</span>
              </button>
            ))}
          </nav>
          {Jobs()}
          {VoiceCard()}
        </aside>
        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3 px-1"><p className="text-sm">{listView === "needs" ? <>{greeting(data.now)}{data.me.firstName ? `, ${data.me.firstName}` : ""}. <b>{n}</b> thing{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} you.</> : listView === "done" ? "What Nana and your agents did" : "Declined and expired"}</p>
            {listView === "needs" && <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "expiring")} className="rounded-lg border border-rule bg-card px-2.5 py-1.5 text-[13px]" aria-label="Sort"><option value="newest">Newest first</option><option value="expiring">Expiring first</option></select>}
          </div>
          {banner}
          {Upsell()}
          <div className="card overflow-hidden">
            {listView === "needs" ? shown.map((p) => <ListItem key={p.id} p={p} selected={sel?.id === p.id} />) : <div className="divide-y divide-rule">{shown.map((p) => <DoneRow key={p.id} p={p} />)}</div>}
            {!shown.length && <p className="p-6 text-center text-sm text-slate">{listView === "needs" ? "All clear. Nana will let you know when something needs you." : "Nothing here yet."}</p>}
          </div>
          <div className="px-1">{footer}</div>
          {NotesBox()}
        </section>
        <section className="card min-w-0 px-7 py-6">
          {!sel || listView !== "needs" ? (
            <div className="py-16 text-center text-sm text-slate"><NanaFace size={64} /><p className="mt-3">{listView === "needs" ? "Nothing needs you right now." : "Choose Needs you to see what's waiting."}</p></div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3"><span className={`font-ui text-[11px] font-extrabold uppercase tracking-wide ${tone(sel)}`}>{kindLabel(sel)}{sel.payload?.cid ? " · via messages" : ""}</span><span className="font-mono text-[11px] text-slate">Expires {dayTime(sel.expiresAt)}</span></div>
              <h2 className="mt-1.5 font-display text-[28px] leading-tight">{sel.title}</h2>
              {sel.facts?.length ? <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">{sel.facts.map((f) => <div key={f.label} className="rounded-xl border border-rule bg-paper px-3 py-2.5"><p className="font-ui text-[11px] font-semibold text-slate">{f.label}</p><p className={`mt-0.5 font-ui text-sm font-extrabold ${f.good ? "text-moss" : ""}`}>{f.value}</p></div>)}</div> : <p className="mt-2 text-sm text-slate">{sel.summary}</p>}
              {Quote({ p: sel })}
              {sel.draft !== undefined && (<>
                <p className="mb-2 mt-6 flex justify-between font-ui text-sm font-bold">{sel.source === "nana" ? "Nana's reply, in your voice" : `${sel.sourceName}'s draft`}<span className="font-normal text-slate">{draftOf(sel) !== sel.draft ? "Edited" : "Editing"}</span></p>
                {Draft({ p: sel, big: true })}
              </>)}
              <div className="mt-5">{Actions({ p: sel })}</div>
              {Lock({ p: sel })}
              {Trail({ p: sel })}
            </>
          )}
        </section>
      </div>
    </>
  );
}
