"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { HrInbox } from "@/components/HrInbox";
import { jobsApi, useAuthUser } from "@/components/jobs/useAuthUser";
import { JOBS_BRAND } from "@/lib/jobs";
import type { HrInboxRow } from "@/lib/hr-inbox";

// A firm's #Nana-HR inbox, beside Your jobs (/profile/jobs). Owner, 26 Nov 2026: "Notes Jobs: applications to other firms' jobs stay
// with those firms. Who sees it: whoever already reviews firms' job applications, probably owner or admin they appoint with hr
// privilege. Answering: you can reply as HR, as yourself, or ask Nana-HR for a draft that you edit and then send. Nana-HR never sends
// on her own, as now." For a firm, "as yourself" is the firm itself (its name, as owner): a team member's @username never shows to an
// applicant. The organisation account and the team members its owner put in HR see it (jobs-server hiringTeamFor), with the firm chosen
// as on Your jobs (/api/jobs/manage lists the firms you hire for; ?org= picks one, as the bell's link does). Only that firm's threads.

type Firm = { uid: string; name: string; username: string; verified: boolean; role: "owner" | "hr" };
const field = "mt-1 block w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function FirmHrInboxPage() {
  const user = useAuthUser();
  const [firms, setFirms] = useState<Firm[] | null>(null);
  const [org, setOrg] = useState("");

  useEffect(() => {
    if (!user) return;
    jobsApi<{ firms: Firm[] }>(user, "/api/jobs/manage").then((d) => {
      setFirms(d.firms);
      const want = new URLSearchParams(window.location.search).get("org");
      setOrg(d.firms.find((f) => f.uid === want)?.uid ?? d.firms[0]?.uid ?? "");
    }).catch(() => setFirms([]));
  }, [user]);
  const load = useCallback(() => jobsApi<{ rows: HrInboxRow[]; unread: number }>(user, `/api/jobs/hr-inbox?org=${encodeURIComponent(org)}`), [user, org]);
  const fullHref = useCallback((id: string) => `/profile/jobs?org=${encodeURIComponent(org)}&app=${encodeURIComponent(id)}`, [org]);

  if (user === undefined) return <p className="p-8 text-sm text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-sm text-ink"><Link href="/login?next=/profile/jobs/hr-inbox" className="text-crimson underline">Sign in</Link> to read your applicants&apos; replies.</p>;
  const firm = firms?.find((f) => f.uid === org);
  return (
    <>
      <PageHero eyebrow={JOBS_BRAND} title={<>#Nana-HR inbox</>} compact>
        <p>What applicants to your jobs write back, in one place. Answer as HR, as {firm?.name ?? "your organisation"}, or ask Nana-HR for a draft you read, edit and send: she never sends on her own.</p>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Link href={org ? `/profile/jobs?org=${encodeURIComponent(org)}` : "/profile/jobs"} className="font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Your jobs</Link>
          {firms && firms.length > 1 && <label className="text-sm">Organisation<select value={org} onChange={(e) => setOrg(e.target.value)} className={`${field} max-w-sm`}>{firms.map((f) => <option key={f.uid} value={f.uid}>{f.name}</option>)}</select></label>}
        </div>
        {firms === null ? <p className="mt-6 text-sm text-slate">Loading…</p> : firms.length === 0 ? (
          <p className="mt-6 text-sm text-ink">The #Nana-HR inbox is for organisations that hire on {JOBS_BRAND}, and the team members their owner put in HR. <Link href="/profile/jobs" className="text-crimson underline">Your jobs</Link> says how to start.</p>
        ) : (
          <>
            <p className="mt-4 max-w-2xl text-sm text-slate">
              {firm?.name}&apos;s job applications only, for the organisation and its HR team. Opening a conversation marks it read for everyone on the team; the applicant never sees which of you sent a reply.
            </p>
            <HrInbox key={org} kind="job" load={load} endpoint="/api/jobs/hr-inbox" scope={{ org }} fullHref={fullHref} ready={!!org} />
          </>
        )}
      </div>
    </>
  );
}
