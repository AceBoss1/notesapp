"use client";

import { useCallback, useEffect, useState } from "react";
import { ApplicationThread } from "@/components/ApplicationThread";
import { api } from "@/lib/moments-client";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { jobsApi, useAuthUser } from "@/components/jobs/useAuthUser";
import { INDUSTRIES } from "@/lib/profile-work";
import { TOPICS } from "@/lib/topics";
import {
  JOBS_BRAND, JOB_APP_STATUS_LABEL, JOB_TYPES, JOB_TYPE_LABEL, MAX_TOPICS, OPEN_DAYS_DEFAULT, OPEN_DAYS_MAX, PAY_PERIODS, PAY_PERIOD_LABEL, WORK_MODES,
  WORK_MODE_LABEL, payText, placeText, type Job, type JobApplication,
} from "@/lib/jobs";

type Firm = { uid: string; name: string; username: string; verified: boolean; role: "owner" | "hr" };
type App = JobApplication & { headline: string; avatar: string };
type Board = { jobs: Job[]; applications: App[]; matching: boolean; canManage: boolean };
type Candidate = { uid: string; username: string; displayName: string; avatar: string; headline: string; reasons: string[]; invited: boolean };

const blank = { title: "", summary: "", about: "", responsibilities: "", requirements: "", type: "full_time", mode: "onsite", city: "", state: "", payMin: "", payMax: "", payPeriod: "month", industry: "", topics: [] as string[], openDays: String(OPEN_DAYS_DEFAULT), applyWithNotesApp: true, applyUrl: "" };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

// Your jobs (Notes Jobs, for a verified organisation and its admins): post a job, see and move on applications, close or delete a job;
// on Business and Enterprise, suggested candidates (members who switched on "I need a job" and fit) and invitations to apply.
export default function FirmJobsPage() {
  const user = useAuthUser();
  const [firms, setFirms] = useState<Firm[] | null>(null);
  const [org, setOrg] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [form, setForm] = useState<typeof blank & { id?: string } | null>(null);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [cands, setCands] = useState<Record<string, Candidate[]>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    jobsApi<{ firms: Firm[] }>(user, "/api/jobs/manage").then((d) => { setFirms(d.firms); if (d.firms[0]) setOrg(d.firms[0].uid); }).catch(() => setFirms([]));
  }, [user]);
  const load = useCallback(async () => {
    if (!user || !org) return;
    const f = firms?.find((x) => x.uid === org);
    if (!f?.verified) { setBoard(null); return; }
    try { setBoard(await jobsApi<Board>(user, `/api/jobs/manage?org=${org}`)); } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't load your jobs"); }
  }, [user, org, firms]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true); setMsg("");
    try { await jobsApi(user, "/api/jobs/manage", body); setMsg(done); await load(); return true; }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't do that"); return false; }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const job = { ...form, responsibilities: form.responsibilities.split("\n"), requirements: form.requirements.split("\n"), openDays: Number(form.openDays) };
    if (await act(form.id ? { action: "update", id: form.id, job } : { action: "post", org, job }, form.id ? "Job updated." : "Job posted. It's live on Explore → Jobs.")) setForm(null);
  }

  if (user === undefined) return <p className="p-8 text-sm text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-sm text-ink"><Link href="/login?next=/profile/jobs" className="text-crimson underline">Sign in</Link> to post jobs.</p>;
  const firm = firms?.find((x) => x.uid === org);
  return (
    <>
      <PageHero eyebrow={JOBS_BRAND} title={<>Your jobs</>} compact>
        <p>Post jobs for free and hire with NotesApp. Only CAC-verified organisations can post, so members can trust what they see.</p>
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {firms === null ? <p className="text-sm text-slate">Loading…</p> : firms.length === 0 ? (
          <p className="text-sm text-ink">Jobs are posted by organisation accounts and their admins. <Link href="/organisation" className="text-crimson underline">Turn an account into an organisation</Link>, verify it with its CAC number, then come back here.</p>
        ) : (
          <>
            {firms.length > 1 && <label className="text-sm">Organisation<select value={org} onChange={(e) => setOrg(e.target.value)} className={`${field} max-w-sm`}>{firms.map((f) => <option key={f.uid} value={f.uid}>{f.name}</option>)}</select></label>}
            {firm && !firm.verified && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-ink">{firm.name} isn&apos;t CAC-verified yet. Only verified organisations can post on {JOBS_BRAND}: verify it under Account → Organisation.</p>}
            {msg && <p className="mt-4 text-sm text-ink" role="status">{msg}</p>}
            {firm?.verified && board && (
              <>
                {!board.matching && <p className="mt-4 text-xs text-slate">On the Business and Enterprise plans your jobs are also matched to members: shown first to those they fit, a bell to members who need a job, and suggested candidates you can invite. <Link href="/pricing" className="underline">Plans</Link></p>}
                {!board.canManage && <p className="mt-4 text-sm text-ink">{firm.name} isn&apos;t CAC-verified yet, so it can&apos;t post jobs. You can still read applications to jobs already posted and reply.</p>}
                {board.canManage && !form && <button onClick={() => setForm({ ...blank })} className="mt-5 rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper">Post a job</button>}
                {form && (
                  <form onSubmit={save} className="card mt-5 grid gap-3 p-6 text-sm sm:grid-cols-2">
                    <h2 className="font-display text-2xl text-ink sm:col-span-2">{form.id ? "Edit job" : "Post a job"}</h2>
                    <label className="sm:col-span-2">Job title<input required maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} /></label>
                    <label className="sm:col-span-2">One-line summary<input required maxLength={200} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className={field} /></label>
                    <label>Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={field}>{JOB_TYPES.map((t) => <option key={t} value={t}>{JOB_TYPE_LABEL[t]}</option>)}</select></label>
                    <label>Where<select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={field}>{WORK_MODES.map((m) => <option key={m} value={m}>{WORK_MODE_LABEL[m]}</option>)}</select></label>
                    <label>City{form.mode === "remote" ? " (optional)" : ""}<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} placeholder="Lagos" /></label>
                    <label>State (optional)<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={field} /></label>
                    <label>Pay from, ₦ (optional)<input inputMode="numeric" value={form.payMin} onChange={(e) => setForm({ ...form, payMin: e.target.value })} className={field} /></label>
                    <label>Pay up to, ₦ (optional)<input inputMode="numeric" value={form.payMax} onChange={(e) => setForm({ ...form, payMax: e.target.value })} className={field} /></label>
                    <label>Pay is<select value={form.payPeriod} onChange={(e) => setForm({ ...form, payPeriod: e.target.value })} className={field}>{PAY_PERIODS.map((p) => <option key={p} value={p}>{PAY_PERIOD_LABEL[p]}</option>)}</select></label>
                    <label>Open for (days)<input type="number" min={7} max={OPEN_DAYS_MAX} value={form.openDays} onChange={(e) => setForm({ ...form, openDays: e.target.value })} className={field} /></label>
                    <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" checked={form.applyWithNotesApp} onChange={(e) => setForm({ ...form, applyWithNotesApp: e.target.checked })} className="mt-1" /> <span><b>Apply with NotesApp</b>: people apply with their NotesApp account, and you reply to them here as HR, Nana-HR or yourself. Switch it off to send applicants to your own page instead.</span></label>
                    {!form.applyWithNotesApp && <label className="sm:col-span-2">Where people apply (https://…)<input value={form.applyUrl} onChange={(e) => setForm({ ...form, applyUrl: e.target.value })} className={field} placeholder="https://yourcompany.com/careers/…" /></label>}
                    <label>Industry<select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={field}><option value="">Choose</option>{INDUSTRIES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select></label>
                    <label>Topics (up to {MAX_TOPICS}; they help us match people)<select multiple value={form.topics} onChange={(e) => setForm({ ...form, topics: Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, MAX_TOPICS) })} className={`${field} h-28`}>{TOPICS.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}</select></label>
                    <label className="sm:col-span-2">About the job<textarea rows={5} maxLength={4000} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} className={field} /></label>
                    <label>What they&apos;ll do (one per line)<textarea rows={5} value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} className={field} /></label>
                    <label>What you&apos;re looking for (one per line)<textarea required rows={5} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className={field} /></label>
                    <p className="text-xs text-slate sm:col-span-2">Never ask applicants for money. Jobs that do are taken down and the organisation may be suspended.</p>
                    <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-full bg-crimson px-5 py-2 font-ui font-semibold text-paper disabled:opacity-50">{form.id ? "Save" : "Post the job"}</button><button type="button" onClick={() => setForm(null)} className="rounded-full border border-rule px-5 py-2 font-ui font-semibold">Cancel</button></div>
                  </form>
                )}
                <ul className="mt-6 space-y-4">
                  {board.jobs.length === 0 && <li className="text-sm text-slate">No jobs yet.</li>}
                  {board.jobs.map((j) => {
                    const apps = board.applications.filter((a) => a.jobId === j.id);
                    const live = j.status === "open" && j.closesAt > new Date().toISOString();
                    return (
                      <li key={j.id} className="card p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-display text-xl text-ink">{j.title}</p>
                            <p className="text-xs text-slate">{placeText(j)} · {JOB_TYPE_LABEL[j.type]}{payText(j) ? ` · ${payText(j)}` : ""} · {j.status === "removed" ? "taken down after a report" : live ? `open until ${new Date(j.closesAt).toLocaleDateString("en-GB")}` : "closed"} · {apps.length} application{apps.length === 1 ? "" : "s"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {live && <Link href={`/jobs/${j.id}`} className="rounded-full border border-rule px-3 py-1.5 font-semibold">View</Link>}
                            {board.canManage && j.status !== "removed" && <button className="rounded-full border border-rule px-3 py-1.5 font-semibold" onClick={() => setForm({ id: j.id, title: j.title, summary: j.summary, about: j.about, responsibilities: j.responsibilities.join("\n"), requirements: j.requirements.join("\n"), type: j.type, mode: j.mode, city: j.city, state: j.state, payMin: j.payMinKobo ? String(j.payMinKobo / 100) : "", payMax: j.payMaxKobo ? String(j.payMaxKobo / 100) : "", payPeriod: j.payPeriod ?? "month", industry: j.industry, topics: j.topics, openDays: String(Math.max(7, Math.round((Date.parse(j.closesAt) - Date.parse(j.createdAt)) / 86_400_000))), applyWithNotesApp: j.applyWithNotesApp !== false, applyUrl: j.applyUrl ?? "" })}>Edit</button>}
                            <button className="rounded-full border border-rule px-3 py-1.5 font-semibold" onClick={() => setOpenJob(openJob === j.id ? null : j.id)}>{openJob === j.id ? "Hide" : "Applications"}</button>
                            {board.canManage && board.matching && live && <button className="rounded-full border border-rule px-3 py-1.5 font-semibold" onClick={async () => { try { const d = await jobsApi<{ candidates: Candidate[] }>(user, "/api/jobs/manage", { action: "suggested", id: j.id }); setCands({ ...cands, [j.id]: d.candidates }); setOpenJob(j.id); } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't load candidates"); } }}>Suggested candidates</button>}
                            {board.canManage && live && <button disabled={busy} className="rounded-full border border-rule px-3 py-1.5 font-semibold" onClick={() => { if (confirm(`Close ${j.title}? It stops taking applications.`)) void act({ action: "close", id: j.id }, "Job closed."); }}>Close</button>}
                            {board.canManage && <button disabled={busy} className="rounded-full border border-rule px-3 py-1.5 font-semibold text-red-700" onClick={() => { if (confirm(`Delete ${j.title} for good? Its applications go with it, and applicants still in the running are told it was withdrawn.`)) void act({ action: "delete", id: j.id }, "Job deleted."); }}>Delete</button>}
                          </div>
                        </div>
                        {openJob === j.id && (
                          <div className="mt-4 space-y-4">
                            {cands[j.id] && (
                              <div>
                                <p className="font-ui text-sm font-semibold text-ink">Suggested candidates (members who need a job and fit)</p>
                                {cands[j.id].length === 0 ? <p className="text-sm text-slate">No strong matches yet.</p> : (
                                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">{cands[j.id].map((c) => (
                                    <li key={c.uid} className="rounded-lg border border-rule p-3 text-sm">
                                      <Link href={`/u/${c.username}`} className="font-semibold text-crimson">{c.displayName}</Link> <span className="text-slate">@{c.username}</span>
                                      {c.headline && <p className="text-xs text-ink">{c.headline}</p>}
                                      <p className="text-xs text-green-800">{c.reasons.join(" · ")}</p>
                                      <button disabled={busy || c.invited} className="mt-2 rounded-full bg-crimson px-3 py-1 text-xs font-semibold text-paper disabled:opacity-50" onClick={async () => { if (await act({ action: "invite", id: j.id, uid: c.uid }, `Invited ${c.displayName} to apply.`)) setCands({ ...cands, [j.id]: cands[j.id].map((x) => (x.uid === c.uid ? { ...x, invited: true } : x)) }); }}>{c.invited ? "Invited" : "Invite to apply"}</button>
                                    </li>))}</ul>
                                )}
                              </div>
                            )}
                            {apps.length === 0 ? <p className="text-sm text-slate">No applications yet.</p> : (
                              <ul className="space-y-3">{apps.map((a) => (
                                <li key={a.id} className="rounded-lg border border-rule p-4 text-sm">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div><Link href={`/u/${a.username}`} className="font-semibold text-crimson">{a.name}</Link> <span className="text-slate">@{a.username}</span>{a.headline && <p className="text-xs text-ink">{a.headline}</p>}<p className="text-xs text-slate">{[a.city, a.phone].filter(Boolean).join(" · ")} · applied {new Date(a.createdAt).toLocaleDateString("en-GB")}</p></div>
                                    <select value={a.status} disabled={busy || a.status === "withdrawn" || !board.canManage} onChange={(e) => void act({ action: "appStatus", id: a.id, status: e.target.value }, "Application updated.")} className="rounded-lg border border-rule bg-card px-2 py-1 text-xs">{Object.entries(JOB_APP_STATUS_LABEL).filter(([k]) => k !== "withdrawn").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                  </div>
                                  <p className="mt-2 whitespace-pre-wrap text-ink">{a.coverNote}</p>
                                  {a.links.length > 0 && <p className="mt-2 text-xs">{a.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" className="mr-3 text-crimson underline">{l.replace(/^https:\/\//, "").slice(0, 40)}</a>)}</p>}
                                  <p className="mt-2 text-xs text-slate">Reply below as HR, Nana-HR or yourself; moving it to Interview, Offer or Not taken forward tells them too. Their profile: <Link href={`/u/${a.username}`} className="underline">@{a.username}</Link></p>
                                  {a.summary ? (
                                    <div className="mt-3 rounded bg-paper p-3"><p className="eyebrow">Nana-HR summary · {new Date(a.summary.at).toLocaleDateString("en-GB")}</p><p className="mt-1 whitespace-pre-wrap text-xs text-ink">{a.summary.text}</p><p className="mt-1 text-[11px] text-slate">Checked against your stated requirements only. A person decides: Nana-HR never ranks or rejects anyone.</p></div>
                                  ) : (
                                    <button disabled={busy} className="mt-3 rounded-full border border-rule px-3 py-1.5 text-xs font-semibold" onClick={async () => { setBusy(true); try { const r = await api<{ summary: { text: string; at: string } }>("/api/applications/replies", { body: { action: "summarise", id: a.id } }); setBoard((b) => (b ? { ...b, applications: b.applications.map((x) => (x.id === a.id ? { ...x, summary: r.summary } : x)) } : b)); } catch (e) { setMsg(e instanceof Error ? e.message : "Nana-HR couldn't summarise that."); } finally { setBusy(false); } }}>Nana-HR: check against the requirements</button>
                                  )}
                                  <ApplicationThread kind="job" applicationId={a.id} />
                                </li>))}</ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
