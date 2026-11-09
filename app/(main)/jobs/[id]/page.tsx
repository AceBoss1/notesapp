import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import { JobApplyForm, ReportJob } from "@/components/jobs/JobApply";
import { getAdminDb } from "@/lib/firebase-admin";
import { getJob } from "@/lib/jobs-server";
import { JOBS_BRAND, JOB_TYPE_LABEL, consentText, payText, placeText } from "@/lib/jobs";
import { INDUSTRY_LABEL, isIndustry } from "@/lib/profile-work";

export const revalidate = 60;

const live = (status: string, closesAt: string) => status === "open" && closesAt > new Date().toISOString();

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const j = await getJob(getAdminDb(), params.id).catch(() => null);
  return j && j.status !== "removed" ? { title: `${j.title} at ${j.orgName} · ${JOBS_BRAND}`, description: j.summary } : { title: JOBS_BRAND };
}

// A job on Notes Jobs: what it is, where and what it pays, the requirements, and applying with a NotesApp account.
export default async function JobPage({ params }: { params: { id: string } }) {
  const j = await getJob(getAdminDb(), params.id).catch(() => null);
  if (!j || j.status === "removed") notFound();
  const open = live(j.status, j.closesAt);
  const pay = payText(j);
  return (
    <>
      <PageHero eyebrow={`${JOBS_BRAND} / ${j.orgName}`} title={<>{j.title}</>} compact>
        <p>{j.summary}</p>
      </PageHero>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr,1fr]">
        <article>
          <p className="text-sm text-ink">
            <Link href={`/u/${j.orgUsername}`} className="font-semibold text-crimson">{j.orgName}</Link> · {placeText(j)} · {JOB_TYPE_LABEL[j.type]}
            {pay ? ` · ${pay}` : ""}{isIndustry(j.industry) ? ` · ${INDUSTRY_LABEL[j.industry]}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate">{open ? `Applications close ${new Date(j.closesAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "This job is no longer taking applications."}</p>
          {j.about && <p className="mt-6 whitespace-pre-wrap text-ink">{j.about}</p>}
          {j.responsibilities.length > 0 && (<><h2 className="mt-8 font-display text-2xl text-ink">What you&apos;ll do</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-ink">{j.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul></>)}
          <h2 className="mt-8 font-display text-2xl text-ink">What they&apos;re looking for</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">{j.requirements.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-8 text-sm text-slate">Posted by a CAC-verified organisation. Never pay to apply for a job: report any job that asks you for money. <Link href="/explore?tab=jobs" className="text-crimson underline">All jobs</Link></p>
          <div className="mt-3"><ReportJob jobId={j.id} /></div>
        </article>
        <aside className="card h-fit p-6">
          <h2 className="font-display text-2xl text-ink">Apply</h2>
          {open && j.applyWithNotesApp === false && j.applyUrl ? (
            <div className="mt-3 text-sm text-ink">
              <p>{j.orgName} takes applications for this job on its own site.</p>
              <a href={j.applyUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-primary mt-4 inline-block !px-6 !py-2">Apply on {j.orgName}&apos;s site</a>
              <p className="mt-3 text-xs text-slate">You&apos;re leaving NotesApp. Never pay to apply.</p>
            </div>
          ) : open ? <JobApplyForm jobId={j.id} jobTitle={j.title} consent={consentText(j.orgName)} /> : <p className="mt-3 text-sm text-slate">This job has closed. <Link href="/explore?tab=jobs" className="text-crimson underline">See open jobs</Link></p>}
        </aside>
      </div>
    </>
  );
}
