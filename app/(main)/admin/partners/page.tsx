"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { APP_STATUSES, APP_STATUS_LABEL, NETWORK_NAME, SERVICE_LABEL, TIERS, TIER_LABEL, TRACK, TRACKS, partnerPath, type AppStatus, type Tier, type Track } from "@/lib/partner-network";
import type { AdminPartners } from "@/lib/partner-network-server";

const btn = "rounded-full border border-rule px-3 py-1 text-xs hover:border-crimson hover:text-crimson disabled:opacity-40";

// Admin → Partners (lib/partner-network-server.ts): applications to the NotesApp Partner Network and the partners approved. Approve an
// application at a tier (the applicant is told and gets a portal), decline it with feedback they read, and keep private notes. For
// partners: change the tier (requests to be Certified come first), pause or reactivate, list or unlist in the directory. Tier shares are
// in Admin → Limits (super admins).
export default function AdminPartnersPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<AdminPartners | null>(null);
  const [tab, setTab] = useState<"apps" | "partners">("apps");
  const [filter, setFilter] = useState<AppStatus | "open" | "all">("open");
  const [track, setTrack] = useState<Track | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { feedback?: string; notes?: string; tier?: Tier }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const res = await fetch("/api/admin/partners", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user!.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Failed");
    return j;
  }, [user]);
  const load = useCallback(() => call().then(setData, (e) => setError(e.message)), [call]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  const act = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag); setError("");
    try { await call(body); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  };
  const apps = useMemo(() => (data?.applications ?? []).filter((a) => (track === "all" || a.track === track) && (filter === "all" || (filter === "open" ? a.status === "received" || a.status === "reviewing" : a.status === filter))), [data, filter, track]);
  const partners = useMemo(() => (data?.partners ?? []).filter((p) => track === "all" || p.track === track), [data, track]);
  const d = (id: string) => draft[id] ?? {};
  const setD = (id: string, x: Partial<{ feedback: string; notes: string; tier: Tier }>) => setDraft({ ...draft, [id]: { ...d(id), ...x } });

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  const requests = (data?.partners ?? []).filter((p) => p.tierRequestedAt).length;
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Partners · {NETWORK_NAME}</h1>
      <p className="mt-1 text-sm text-slate">Approve partners, set their tier, and keep the directory honest. Members&apos; privacy first: partners never see what members book or buy. <Link href="/partners" className="text-crimson underline">See the page</Link> · <Link href="/admin/limits#partners" className="text-crimson underline">Tier shares in Limits</Link></p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => setTab("apps")} className={`${btn} ${tab === "apps" ? "border-crimson text-crimson" : ""}`}>Applications · {(data?.applications ?? []).filter((a) => a.status === "received" || a.status === "reviewing").length} open</button>
        <button type="button" onClick={() => setTab("partners")} className={`${btn} ${tab === "partners" ? "border-crimson text-crimson" : ""}`}>Partners · {data?.partners.length ?? 0}{requests ? ` · ${requests} asking to move up` : ""}</button>
        <select value={track} onChange={(e) => setTrack(e.target.value as Track | "all")} className="ml-auto rounded-full border border-rule px-3 py-1 text-xs" aria-label="Track">
          <option value="all">All tracks</option>
          {TRACKS.map((t) => <option key={t} value={t}>{TRACK[t].label}</option>)}
        </select>
      </div>

      {!data ? <p className="mt-6 text-sm text-slate">Loading…</p> : tab === "apps" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {(["open", "all", ...APP_STATUSES] as const).map((s) => <button key={s} type="button" onClick={() => setFilter(s)} className={`${btn} ${filter === s ? "border-crimson text-crimson" : ""}`}>{s === "open" ? "Open" : s === "all" ? "All" : APP_STATUS_LABEL[s]}</button>)}
          </div>
          {!apps.length ? <p className="mt-6 text-sm text-slate">No applications here.</p> : (
            <ul className="mt-4 space-y-2">
              {apps.map((a) => (
                <li key={a.id} className="rounded-2xl border border-rule bg-card p-4 text-sm">
                  <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="flex w-full flex-wrap items-baseline gap-2 text-left" aria-expanded={open === a.id}>
                    <b className="text-ink">{a.orgName}</b>
                    <span className="text-slate">· {TRACK[a.track].emoji} {TRACK[a.track].short} · @{a.username} · {a.countries} · {a.createdAt.slice(0, 10)}</span>
                    <span className="ml-auto rounded-full bg-field px-2.5 py-0.5 text-xs font-semibold text-ink">{APP_STATUS_LABEL[a.status]}</span>
                  </button>
                  {open === a.id && (
                    <div className="mt-4 space-y-3 border-t border-rule pt-4">
                      <p className="text-xs text-slate">{TRACK[a.track].reachLabel}: {a.reach.toLocaleString()} · by <Link href={`/u/${a.username}`} className="text-crimson underline">{a.name}</Link>{a.website && <> · <a href={a.website} target="_blank" rel="noopener noreferrer nofollow" className="text-crimson underline">{a.website}</a></>}</p>
                      {a.services.length > 0 && <p className="text-xs text-slate">Services: {a.services.map((s) => SERVICE_LABEL[s]).join(", ")}</p>}
                      {([["About", a.about], ["Their plan", a.plan]] as const).map(([h, t]) => <div key={h}><p className="font-ui text-xs font-bold uppercase tracking-wide text-slate">{h}</p><p className="mt-1 whitespace-pre-wrap text-ink">{t}</p></div>)}
                      <label className="block text-xs font-semibold text-ink">Feedback to the applicant (they read it; needed when declining)
                        <textarea rows={3} defaultValue={a.feedback ?? ""} onChange={(e) => setD(a.id, { feedback: e.target.value })} className="mt-1 block w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
                      </label>
                      <label className="block text-xs font-semibold text-ink">Team notes (never shown)
                        <textarea rows={2} defaultValue={a.notes ?? ""} onChange={(e) => setD(a.id, { notes: e.target.value })} className="mt-1 block w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
                      </label>
                      {a.status === "approved" && a.partnerId ? <p className="text-xs text-green-700">Approved: <Link href={partnerPath(a.partnerId)} className="underline">{partnerPath(a.partnerId)}</Link></p> : a.status !== "withdrawn" && (
                        <div className="flex flex-wrap items-center gap-2">
                          {(d(a.id).feedback !== undefined || d(a.id).notes !== undefined) && <button type="button" className={btn} disabled={!!busy} onClick={() => act(a.id, { action: "decide", id: a.id, ...d(a.id) })}>Save</button>}
                          {a.status === "received" && <button type="button" className={btn} disabled={!!busy} onClick={() => act(a.id, { action: "decide", id: a.id, status: "reviewing" })}>Mark reviewing</button>}
                          <select value={d(a.id).tier ?? "registered"} onChange={(e) => setD(a.id, { tier: e.target.value as Tier })} className="rounded-full border border-rule px-2 py-1 text-xs" aria-label="Tier">
                            {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                          </select>
                          <button type="button" className={`${btn} border-green-700 text-green-700`} disabled={!!busy} onClick={() => { if (confirm(`Approve ${a.orgName} as ${TIER_LABEL[d(a.id).tier ?? "registered"]}? They're told, listed in the directory and get a portal.`)) void act(a.id, { action: "decide", id: a.id, status: "approved", tier: d(a.id).tier ?? "registered", ...(d(a.id).feedback !== undefined ? { feedback: d(a.id).feedback } : {}) }); }}>Approve</button>
                          {a.status !== "declined" && <button type="button" className={btn} disabled={!!busy || !(d(a.id).feedback ?? a.feedback)} title="Write feedback first" onClick={() => { if (confirm(`Decline ${a.orgName}? They're told and read your feedback.`)) void act(a.id, { action: "decide", id: a.id, status: "declined", feedback: d(a.id).feedback ?? a.feedback }); }}>Decline</button>}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !partners.length ? <p className="mt-6 text-sm text-slate">No partners yet.</p> : (
        <ul className="mt-4 space-y-2">
          {partners.map((p) => (
            <li key={p.id} className="rounded-2xl border border-rule bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link href={partnerPath(p.id)} className="font-bold text-ink underline">{p.name}</Link>
                <span className="text-slate">· {TRACK[p.track].emoji} {TRACK[p.track].short} · @{p.username} · since {p.createdAt.slice(0, 10)}{TRACK[p.track].members ? ` · ${p.members} member${p.members === 1 ? "" : "s"}${p.pending ? `, ${p.pending} waiting` : ""}` : ""}</span>
                {p.status === "suspended" && <span className="rounded-full bg-crimson/10 px-2 py-0.5 text-xs font-bold text-crimson">Paused</span>}
                {p.tierRequestedAt && <span className="rounded-full bg-[#F4B860]/30 px-2 py-0.5 text-xs font-bold text-ink">Asks to be Certified</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select value={p.tier} disabled={!!busy} onChange={(e) => { if (confirm(`Make ${p.name} ${TIER_LABEL[e.target.value as Tier]}? Their share on new payments changes, and they're told.`)) void act(p.id, { action: "partner", id: p.id, tier: e.target.value }); }} className="rounded-full border border-rule px-2 py-1 text-xs" aria-label="Tier">
                  {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                </select>
                {p.tierRequestedAt && <button type="button" className={btn} disabled={!!busy} onClick={() => act(p.id, { action: "partner", id: p.id, declineTier: true })}>Not yet</button>}
                <button type="button" className={btn} disabled={!!busy} onClick={() => act(p.id, { action: "partner", id: p.id, listed: !p.listed })}>{p.listed ? "Unlist" : "List"} in directory</button>
                <button type="button" className={btn} disabled={!!busy} onClick={() => { if (confirm(p.status === "active" ? `Pause ${p.name}? They leave the directory, their badges go, and new plan payments earn the ordinary referral share.` : `Reactivate ${p.name}?`)) void act(p.id, { action: "partner", id: p.id, status: p.status === "active" ? "suspended" : "active" }); }}>{p.status === "active" ? "Pause" : "Reactivate"}</button>
              </div>
              <label className="mt-3 block text-xs font-semibold text-ink">Team notes
                <textarea rows={2} defaultValue={p.notes ?? ""} onBlur={(e) => { if (e.target.value !== (p.notes ?? "")) void act(p.id, { action: "partner", id: p.id, notes: e.target.value }); }} className="mt-1 block w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
