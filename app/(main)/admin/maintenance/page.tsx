"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import type { Backfill, BackfillResult } from "@/lib/backfills";

type JobStatus = { checkedAt: string | null; pending: number | null; appliedAt: string | null; applied: number | null; appliedBy: string };
const JOBS: { key: Backfill; title: string; what: string; flags: string }[] = [
  { key: "author-uids", title: "Journal authors by account", what: "Gives every journal the account id and username of its author and co-authors, so renaming never loses a post. Only fills what's missing.", flags: "Names that match more than one account (or none) are left alone for you to check." },
  { key: "topics", title: "File journals under topics", what: "Files every journal that has no topics yet under the topics its categories and tags point to, and tidies its hashtags. Journals that already have topics keep them.", flags: "Journals that match no topic, for their writer or an editor to file from the journal form." },
];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const SHOW = 100;

// Admin → Maintenance: the one-off fixes for older journals (lib/backfills.ts), each a dry run first (lists what would change,
// touches nothing), then Apply. Owner and super admins only. The same jobs run from the command line (scripts/backfill-*.ts).
export default function AdminMaintenancePage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/maintenance");
  const [jobs, setJobs] = useState<Record<string, JobStatus>>({});
  const [results, setResults] = useState<Partial<Record<Backfill, BackfillResult>>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  useEffect(() => { if (user) void run("load", async () => setJobs((await call()).jobs)); }, [user, call, run]);

  const go = (job: Backfill, apply: boolean) => run(`${job}:${apply ? "apply" : "dry"}`, async () => {
    const r = await call({ job, apply });
    setJobs(r.jobs);
    setResults((x) => ({ ...x, [job]: r }));
  });

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Maintenance</h1>
      <p className="mt-2 text-sm text-slate">One-off fixes for older journals. Run the dry run first: it lists every change and touches nothing. Apply writes exactly that list. Both are safe to run again; they only fill what&apos;s missing.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}

      {JOBS.map((j) => {
        const s = jobs[j.key];
        const r = results[j.key];
        const dryDone = r && !r.applied;
        return (
          <div key={j.key} className="card mt-6 p-5">
            <h2 className="font-ui text-lg font-bold text-ink">{j.title}</h2>
            <p className="mt-1 text-sm text-slate">{j.what}</p>
            <ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">
              <li>{s?.appliedAt ? `✓ Applied ${when(s.appliedAt)}${s.appliedBy ? ` by ${s.appliedBy}` : ""}: ${s.applied} journal${s.applied === 1 ? "" : "s"} updated` : "Not applied yet"}</li>
              {s?.checkedAt && <li className="text-slate">Last checked {when(s.checkedAt)}: {s.pending ? `${s.pending} to update` : "nothing to update"}</li>}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={!!busy} onClick={() => go(j.key, false)} className="btn-ghost !px-4 !py-2 text-xs">{busy === `${j.key}:dry` ? "Checking…" : "Dry run"}</button>
              <button
                disabled={!!busy || !dryDone || r!.changes.length === 0}
                title={dryDone ? undefined : "Run the dry run first"}
                onClick={() => { if (confirm(`Apply to ${r!.changes.length} journal${r!.changes.length === 1 ? "" : "s"}? This writes the changes listed below.`)) void go(j.key, true); }}
                className="btn-primary !px-4 !py-2 text-xs"
              >
                {busy === `${j.key}:apply` ? "Applying…" : dryDone && r!.changes.length ? `Apply to ${r!.changes.length}` : "Apply"}
              </button>
            </div>
            {r && (
              <div className="mt-4">
                <p className={`text-sm font-semibold ${r.applied ? "text-emerald-800" : "text-ink"}`}>
                  {r.applied ? `Done: ${r.changes.length} of ${r.total} journals updated.` : `${r.total} journals checked: ${r.changes.length} to update, ${r.flags.length} to check by hand.`}
                </p>
                {r.changes.length > 0 && (
                  <ul className="mt-2 max-h-80 divide-y divide-rule overflow-y-auto rounded-xl border border-rule text-xs">
                    {r.changes.slice(0, SHOW).map((c) => (
                      <li key={c.id} className="px-3 py-2">
                        <Title id={c.id} slug={c.slug} title={c.title} />
                        <code className="mt-0.5 block break-all font-mono text-[11px] text-slate">{JSON.stringify(c.set)}</code>
                      </li>
                    ))}
                    {r.changes.length > SHOW && <li className="px-3 py-2 text-slate">…and {r.changes.length - SHOW} more</li>}
                  </ul>
                )}
                {r.flags.length > 0 && (
                  <>
                    <p className="mt-4 text-sm font-semibold text-ink">To check by hand ({r.flags.length})</p>
                    <p className="text-xs text-slate">{j.flags}</p>
                    <ul className="mt-2 max-h-60 divide-y divide-rule overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/50 text-xs">
                      {r.flags.slice(0, SHOW).map((f, i) => (
                        <li key={`${f.id}-${i}`} className="px-3 py-2"><Title id={f.id} slug={f.slug} title={f.title} /><span className="block text-slate">{f.note}</span></li>
                      ))}
                      {r.flags.length > SHOW && <li className="px-3 py-2 text-slate">…and {r.flags.length - SHOW} more</li>}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Title({ id, slug, title }: { id: string; slug: string; title: string }) {
  return slug
    ? <Link href={`/journals/${slug}`} target="_blank" className="font-semibold text-crimson-bright hover:text-ink [overflow-wrap:anywhere]">{title}</Link>
    : <span className="font-semibold text-ink [overflow-wrap:anywhere]">{title} <span className="font-mono text-slate">({id})</span></span>;
}
