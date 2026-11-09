"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { jobsApi, useAuthUser } from "@/components/jobs/useAuthUser";
import { JOBS_BRAND, JOB_APP_STATUS_LABEL, type JobApplication } from "@/lib/jobs";
import { APP_STATUS_LABEL, type AppStatus } from "@/lib/careers";
import { ApplicationThread } from "@/components/ApplicationThread";

// Your job search (Notes Jobs): "I need a job" and your city (private: used only to match jobs to you, never shown), and the jobs you
// applied for, with where each one is.
export default function MyApplicationsPage() {
  const user = useAuthUser();
  const [seeker, setSeeker] = useState<{ openToWork: boolean; city: string } | null>(null);
  const [city, setCity] = useState("");
  const [apps, setApps] = useState<JobApplication[] | null>(null);
  const [ours, setOurs] = useState<{ id: string; roleId: string; roleTitle: string; status: string; createdAt: string }[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!user) return;
    jobsApi<{ openToWork: boolean; city: string }>(user, "/api/account/job-seeker").then((s) => { setSeeker(s); setCity(s.city); }).catch(() => setSeeker({ openToWork: false, city: "" }));
    jobsApi<{ applications: JobApplication[] }>(user, "/api/jobs/apply").then((d) => setApps(d.applications)).catch(() => setApps([]));
    jobsApi<{ applications: typeof ours }>(user, "/api/careers/apply").then((d) => setOurs(d.applications)).catch(() => setOurs([]));
  }, [user]);
  async function save(b: Record<string, unknown>, done: string) {
    setMsg("");
    try { const s = await jobsApi<{ openToWork: boolean; city: string }>(user, "/api/account/job-seeker", b); setSeeker(s); setMsg(done); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save"); }
  }
  if (user === undefined) return <p className="p-8 text-sm text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-sm text-ink"><Link href="/login?next=/profile/applications" className="text-crimson underline">Sign in</Link> to see your job applications.</p>;
  return (
    <>
      <PageHero eyebrow={JOBS_BRAND} title={<>Your job search</>} compact>
        <p>Find jobs on <Link href="/explore?tab=jobs">Explore → Jobs</Link>, apply with your NotesApp account, and follow every application here.</p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section className="card p-6">
          <h2 className="font-display text-2xl text-ink">I need a job</h2>
          {seeker === null ? <p className="mt-2 text-sm text-slate">Loading…</p> : (
            <>
              <label className="mt-3 flex items-start gap-3 text-sm text-ink">
                <input type="checkbox" checked={seeker.openToWork} onChange={(e) => void save({ openToWork: e.target.checked }, e.target.checked ? "Switched on. We'll tell you about jobs that fit you." : "Switched off. Firms can't find you, and we won't send job bells.")} className="mt-1" />
                <span><strong>I need a job.</strong> When it&apos;s on, you get a bell (up to {3} a day) for jobs that fit you from Business and Enterprise organisations, and those organisations can see your public profile among suggested candidates and invite you to apply. They never see your email, phone or city. Turn it off any time.</span>
              </label>
              <form className="mt-4 flex flex-wrap items-end gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); void save({ city }, "City saved."); }}>
                <label>Your city (private, only for matching)<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} className="mt-1 block w-60 rounded-xl border border-rule bg-card px-3 py-2 outline-none focus:border-crimson" placeholder="Lagos" /></label>
                <button className="rounded-full border border-rule px-4 py-2 font-ui font-semibold">Save</button>
              </form>
              <p className="mt-3 text-xs text-slate">We match jobs to your <Link href="/profile/edit" className="underline">job title and industry</Link>, the <Link href="/interests" className="underline">topics you follow</Link> and your city.</p>
            </>
          )}
          {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl text-ink">Job applications</h2>
          {apps === null ? <p className="mt-2 text-sm text-slate">Loading…</p> : apps.length === 0 ? <p className="mt-2 text-sm text-slate">None yet. <Link href="/explore?tab=jobs" className="text-crimson underline">Find a job</Link></p> : (
            <ul className="mt-3 space-y-3">{apps.map((a) => (
              <li key={a.id} className="card p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2">
                <div><Link href={`/jobs/${a.jobId}`} className="font-semibold text-crimson">{a.jobTitle}</Link><p className="text-xs text-slate">Applied {new Date(a.createdAt).toLocaleDateString("en-GB")} · {JOB_APP_STATUS_LABEL[a.status]}</p></div>
                {a.status !== "withdrawn" && a.status !== "hired" && a.status !== "declined" && <button className="text-xs text-slate underline" onClick={async () => { if (!confirm("Withdraw this application?")) return; try { await jobsApi(user, "/api/jobs/apply", { withdraw: a.id }); setApps(apps.map((x) => (x.id === a.id ? { ...x, status: "withdrawn" } : x))); } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't withdraw"); } }}>Withdraw</button>}
              </div><ApplicationThread kind="job" applicationId={a.id} /></li>))}</ul>
          )}
        </section>
        {ours.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">Roles at #NotesApp</h2>
            <ul className="mt-3 space-y-3">{ours.map((a) => (
              <li key={a.id} className="card p-4 text-sm">
                <Link href={`/careers/${a.roleId}`} className="font-semibold text-crimson">{a.roleTitle}</Link>
                <p className="text-xs text-slate">Applied {new Date(a.createdAt).toLocaleDateString("en-GB")} · {APP_STATUS_LABEL[a.status as AppStatus] ?? a.status}</p>
                <ApplicationThread kind="career" applicationId={a.id} />
              </li>))}</ul>
          </section>
        )}
      </div>
    </>
  );
}
