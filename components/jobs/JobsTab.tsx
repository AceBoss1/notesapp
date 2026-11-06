"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JobCard from "./JobCard";
import { jobsApi, useAuthUser } from "./useAuthUser";
import { JOBS_BRAND, type Job } from "@/lib/jobs";

// Explore → Jobs (Notes Jobs): "Jobs for you" for a signed-in member (Business and Enterprise jobs that fit their interests, industry,
// job title and city), then every open job, newest first. The search box above Explore filters both.
export default function JobsTab({ query }: { query: string }) {
  const user = useAuthUser();
  const [data, setData] = useState<{ jobs: Job[]; forYou: (Job & { reasons: string[] })[] } | null>(null);
  useEffect(() => {
    if (user === undefined) return;
    jobsApi<{ jobs: Job[]; forYou: (Job & { reasons: string[] })[] }>(user, "/api/jobs").then(setData).catch(() => setData({ jobs: [], forYou: [] }));
  }, [user]);
  const q = query.trim().toLowerCase();
  const hit = (j: Job) => !q || [j.title, j.orgName, j.city, j.summary, j.industry].some((x) => (x || "").toLowerCase().includes(q));
  const forYou = useMemo(() => (data?.forYou ?? []).filter(hit), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => (data?.jobs ?? []).filter(hit), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <p className="py-16 text-center text-sm text-slate">Loading…</p>;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{JOBS_BRAND}: jobs from verified organisations. Apply with your NotesApp account.</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/profile/applications" className="rounded-full border border-rule px-4 py-1.5 font-ui font-semibold hover:border-crimson">I need a job</Link>
          <Link href="/profile/jobs" className="rounded-full bg-crimson px-4 py-1.5 font-ui font-semibold text-paper">Post a job</Link>
        </div>
      </div>
      {forYou.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl text-ink">Jobs for you</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{forYou.map((j) => <JobCard key={j.id} job={j} reasons={j.reasons} />)}</div>
        </section>
      )}
      <section className="mt-6">
        <h2 className="font-display text-2xl text-ink">All jobs</h2>
        {all.length === 0 ? <p className="mt-3 text-sm text-slate">{q ? "No jobs match that search." : "No jobs yet. Verified organisations can post one for free."}</p>
          : <div className="mt-3 grid gap-3 sm:grid-cols-2">{all.map((j) => <JobCard key={j.id} job={j} />)}</div>}
      </section>
    </div>
  );
}
