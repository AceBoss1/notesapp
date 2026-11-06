"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JobCard from "./JobCard";
import { jobsApi, useAuthUser } from "./useAuthUser";
import { JOBS_BRAND, type Job } from "@/lib/jobs";

type CareerCard = { id: string; title: string; dept: string; summary: string; location: string; hours: string; arrangement: string };
type Data = { jobs: Job[]; forYou: (Job & { reasons: string[] })[]; careers?: CareerCard[] };

// Explore → Jobs (Notes Jobs): our own open roles at #NotesApp first (featured, from /careers), "Jobs for you" for a signed-in member (Business and Enterprise jobs that fit their interests, industry,
// job title and city), then every open job, newest first. The search box above Explore filters both.
export default function JobsTab({ query }: { query: string }) {
  const user = useAuthUser();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    if (user === undefined) return;
    jobsApi<Data>(user, "/api/jobs").then(setData).catch(() => setData({ jobs: [], forYou: [], careers: [] }));
  }, [user]);
  const q = query.trim().toLowerCase();
  const hit = (j: Job) => !q || [j.title, j.orgName, j.city, j.summary, j.industry].some((x) => (x || "").toLowerCase().includes(q));
  const forYou = useMemo(() => (data?.forYou ?? []).filter(hit), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => (data?.jobs ?? []).filter(hit), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const careers = useMemo(() => (data?.careers ?? []).filter((r) => !q || [r.title, r.dept, r.summary, r.location, "notesapp"].some((x) => (x || "").toLowerCase().includes(q))), [data, q]);
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
      {careers.length > 0 && (
        <section className="mt-6 rounded-[22px] border border-crimson/30 bg-crimson/[0.04] p-4 sm:p-5" aria-label="Work at #NotesApp">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl text-ink">Work at #NotesApp</h2>
            <Link href="/careers" className="font-ui text-sm font-semibold text-crimson">All our open roles →</Link>
          </div>
          <p className="mt-1 text-sm text-slate">We&apos;re hiring. Remote across Nigeria; apply with your NotesApp account.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {careers.map((r) => (
              <Link key={r.id} href={`/careers/${r.id}`} className="card block p-5 hover:border-crimson">
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-crimson">#NotesApp{r.dept ? ` · ${r.dept}` : ""} <span className="ml-1 rounded-full bg-crimson px-2 py-0.5 text-[10px] text-paper">Featured</span></p>
                <p className="mt-1 font-display text-xl text-ink">{r.title}</p>
                <p className="mt-1 text-sm text-slate">{[r.location, r.hours, r.arrangement].filter(Boolean).join(" · ")}</p>
                {r.summary && <p className="mt-2 line-clamp-2 text-sm text-ink">{r.summary}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
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
