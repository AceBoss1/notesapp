import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import ApplyForm from "@/components/careers/ApplyForm";
import { getAdminDb } from "@/lib/firebase-admin";
import { openRole } from "@/lib/careers-server";
import { ARRANGEMENT_LABEL, CONSENT_TEXT, FUTURE_TEXT } from "@/lib/careers";
import { DEPT_LABEL } from "@/lib/admin-access";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await openRole(getAdminDb(), params.id).catch(() => null);
  return r ? { title: `${r.title} · Careers`, description: r.summary } : { title: "Careers" };
}

export default async function RolePage({ params }: { params: { id: string } }) {
  const r = await openRole(getAdminDb(), params.id).catch(() => null);
  if (!r) notFound();
  return (
    <>
      <PageHero eyebrow={`Careers / ${DEPT_LABEL[r.dept]}`} title={<>{r.title}</>} compact>
        <p>{r.summary}</p>
      </PageHero>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr,1fr]">
        <article>
          <p className="text-sm text-ink">{r.location} · {r.hours} · {ARRANGEMENT_LABEL[r.arrangement]}{r.reportsTo ? ` · reports to ${r.reportsTo}` : ""}</p>
          {r.about && <p className="mt-6 whitespace-pre-wrap text-ink">{r.about}</p>}
          {r.responsibilities.length > 0 && (<><h2 className="mt-8 font-display text-2xl text-ink">What you&apos;ll do</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-ink">{r.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul></>)}
          <h2 className="mt-8 font-display text-2xl text-ink">What we&apos;re looking for</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-ink">{r.requirements.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-8 text-sm text-slate">Pay and any stock options are discussed at offer. <Link href="/careers" className="text-crimson underline">All open roles</Link></p>
        </article>
        <aside className="card h-fit p-6">
          <h2 className="font-display text-2xl text-ink">Apply</h2>
          <ApplyForm roleId={r.id} roleTitle={r.title} consentText={CONSENT_TEXT} futureText={FUTURE_TEXT} />
        </aside>
      </div>
    </>
  );
}
