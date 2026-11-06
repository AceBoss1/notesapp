"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jobsApi, useAuthUser } from "./useAuthUser";
import { REPORT_REASONS, REPORT_REASON_LABEL } from "@/lib/moments-rules";
import { JOB_APP_STATUS_LABEL, type JobApplication } from "@/lib/jobs";

// Applying for a Notes Jobs job with your NotesApp account, and reporting a job that looks wrong.
export function JobApplyForm({ jobId, jobTitle, consent }: { jobId: string; jobTitle: string; consent: string }) {
  const user = useAuthUser();
  const [coverNote, setCoverNote] = useState("");
  const [links, setLinks] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<JobApplication | null | undefined>(undefined); // this member's application to this job, if any
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setMine(null); return; }
    jobsApi<{ applications: JobApplication[] }>(user, "/api/jobs/apply").then((d) => setMine(d.applications.find((a) => a.jobId === jobId) ?? null)).catch(() => setMine(null));
  }, [user, jobId]);
  const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";
  if (user === undefined) return <p className="mt-4 text-sm text-slate">Loading…</p>;
  if (!user) {
    const next = encodeURIComponent(`/jobs/${jobId}`);
    return (
      <div className="mt-4 text-sm text-ink">
        <p>You apply with your NotesApp account: the organisation sees your answers and your public profile, and replies to you on NotesApp.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/login?next=${next}`} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper">Sign in to apply</Link>
          <Link href={`/signup?next=${next}`} className="rounded-full border border-rule px-5 py-2 font-ui text-sm font-semibold">Create an account</Link>
        </div>
      </div>
    );
  }
  if (mine === undefined) return <p className="mt-4 text-sm text-slate">Loading…</p>;
  if (mine) return <p className="mt-4 text-sm text-ink" role="status">You applied on {new Date(mine.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}: <strong>{JOB_APP_STATUS_LABEL[mine.status]}</strong>. You&apos;ll get a bell when it moves on; see all yours under <Link href="/profile/applications" className="underline">Job applications</Link>.</p>;
  if (done) return <p className="mt-4 text-sm text-green-700" role="status">Your application for {jobTitle} is in. You&apos;ll get a bell when it moves on; see it any time under <Link href="/profile/applications" className="underline">Job applications</Link>.</p>;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await jobsApi(user, "/api/jobs/apply", { jobId, coverNote, links: links.split("\n"), phone, city, consent: agree });
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't send your application"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 text-sm">
      <label>Why this job, and what would you bring to it?<textarea required rows={7} minLength={40} maxLength={4000} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} className={field} /></label>
      <label>Links to your work or CV (one per line, https)<textarea rows={3} value={links} onChange={(e) => setLinks(e.target.value)} className={field} placeholder="https://…" /></label>
      <label>Phone (optional; shared with this organisation)<input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} /></label>
      <label>City (optional)<input value={city} onChange={(e) => setCity(e.target.value)} className={field} /></label>
      <label className="flex items-start gap-2 text-xs text-slate"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" required /> <span>{consent}</span></label>
      {error && <p className="text-red-700" role="alert">{error}</p>}
      <button disabled={busy || !agree} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper disabled:opacity-50">{busy ? "Sending…" : "Send my application"}</button>
    </form>
  );
}

export function ReportJob({ jobId }: { jobId: string }) {
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("scam");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  if (!user) return null;
  if (msg) return <p className="text-xs text-slate" role="status">{msg}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs text-slate underline">Report this job</button>;
  return (
    <form className="grid gap-2 text-xs" onSubmit={async (e) => { e.preventDefault(); try { await jobsApi(user, "/api/jobs/report", { jobId, reason, note }); setMsg("Thank you. Trust & safety will look at it."); } catch (err) { setMsg(err instanceof Error ? err.message : "Couldn't send the report"); } }}>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-rule bg-card px-2 py-1">{REPORT_REASONS.map((r) => <option key={r} value={r}>{REPORT_REASON_LABEL[r]}</option>)}</select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? (optional)" className="rounded-lg border border-rule bg-card px-2 py-1" />
      <div className="flex gap-2"><button className="rounded-full bg-crimson px-3 py-1 font-semibold text-paper">Report</button><button type="button" onClick={() => setOpen(false)} className="underline">Cancel</button></div>
    </form>
  );
}
