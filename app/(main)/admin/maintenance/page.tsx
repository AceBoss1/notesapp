"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import type { Backfill, BackfillResult, Run, UndoResult } from "@/lib/backfills";

type JobStatus = { checkedAt: string | null; pending: number | null; appliedAt: string | null; applied: number | null; appliedBy: string };
const JOBS: { key: Backfill; title: string; what: string; flags: string }[] = [
  { key: "author-uids", title: "Journal authors by account", what: "Gives every journal the account id and username of its author and co-authors, so renaming never loses a post. Only fills what's missing.", flags: "Names that match more than one account (or none) are left alone for you to check." },
  { key: "topics", title: "File journals under topics", what: "Files every journal that has no topics yet under the topics its categories and tags point to, and tidies its hashtags. Journals that already have topics keep them.", flags: "Journals that match no topic, for their writer or an editor to file from the journal form." },
];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });
const SHOW = 100;
type Bank = { answers: number; hits: number; days: number; top: { q: string; hits: number; gem: string }[] };

// Admin → Maintenance: the one-off fixes for older journals (lib/backfills.ts), each a dry run first (lists what would change,
// touches nothing), then Apply once a backup is ticked. Apply writes only the list the dry run showed, and every run can be undone
// from Recent runs. Owner and super admins only. The same jobs run from the command line (scripts/backfill-*.ts).
export default function AdminMaintenancePage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/maintenance");
  const [jobs, setJobs] = useState<Record<string, JobStatus>>({});
  const [bank, setBank] = useState<Bank | null>(null);
  const [results, setResults] = useState<Partial<Record<Backfill, BackfillResult>>>({});
  const [backup, setBackup] = useState<Partial<Record<Backfill, boolean>>>({});
  const [runs, setRuns] = useState<Run[]>([]);
  const [undone, setUndone] = useState<UndoResult | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(""); }
  }, []);
  useEffect(() => { if (user) void run("load", async () => { const j = await call(); setJobs(j.jobs); setRuns(j.runs); setBank(j.bank); }); }, [user, call, run]);

  const dry = async (job: Backfill) => {
    const r = await call({ job, apply: false });
    setJobs(r.jobs);
    setResults((x) => ({ ...x, [job]: r }));
  };
  const go = (job: Backfill, apply: boolean) => run(`${job}:${apply ? "apply" : "dry"}`, async () => {
    if (!apply) return dry(job);
    try {
      const r = await call({ job, apply: true, planHash: results[job]?.planHash, backupConfirmed: backup[job] === true });
      setJobs(r.jobs); setRuns(r.runs);
      setResults((x) => ({ ...x, [job]: r }));
      setBackup((x) => ({ ...x, [job]: false }));
    } catch (e) {
      // The journals changed since the dry run: show the new list, so the next Apply matches what's on screen.
      if (e instanceof Error && e.message.startsWith("The journals changed")) await dry(job);
      throw e;
    }
  });
  const undo = (r: Run) => run(`undo:${r.id}`, async () => {
    const j = await call({ job: "undo", runId: r.id });
    setRuns(j.runs); setUndone(j.undone);
  });

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-display text-4xl">Maintenance</h1>
      <p className="mt-2 text-sm text-slate">One-off fixes for older journals, and Nana&apos;s answer bank. Run the dry run first: it lists every change and touches nothing. Take a backup, then Apply writes exactly that list, keeping each journal&apos;s old values so the run can be undone below. Both are safe to run again; they only fill what&apos;s missing.</p>
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
            {dryDone && r!.changes.length > 0 && (
              <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-ink">
                <input type="checkbox" className="mt-0.5" checked={backup[j.key] === true} onChange={(e) => setBackup((x) => ({ ...x, [j.key]: e.target.checked }))} />
                <span>I&apos;ve taken a backup of Firestore today (Firebase console → Firestore → Backups or Import/Export) and, where we have one, tried this on staging first.</span>
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={!!busy} onClick={() => go(j.key, false)} className="btn-ghost !px-4 !py-2 text-xs">{busy === `${j.key}:dry` ? "Checking…" : "Dry run"}</button>
              <button
                disabled={!!busy || !dryDone || r!.changes.length === 0 || backup[j.key] !== true}
                title={!dryDone ? "Run the dry run first" : backup[j.key] !== true ? "Tick the backup box first" : undefined}
                onClick={() => { if (confirm(`Apply to ${r!.changes.length} journal${r!.changes.length === 1 ? "" : "s"}? This writes the changes listed below, and keeps the old values so you can undo it.`)) void go(j.key, true); }}
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

      <div className="card mt-6 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">Recent runs</h2>
        <p className="mt-1 text-sm text-slate">Every Apply, from here or the command line. Undo puts back each journal&apos;s old values; a journal edited since the run is left as it is and listed.</p>
        {runs.length === 0 ? <p className="mt-3 text-sm text-slate">No runs yet.</p> : (
          <ul className="mt-3 divide-y divide-rule rounded-xl border border-rule text-sm">
            {runs.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{JOBS.find((j) => j.key === x.job)?.title ?? x.job}</span>
                  <span className="block text-xs text-slate">
                    {x.at ? when(x.at) : "–"}{x.byName ? ` · ${x.byName}` : ""} · {x.written} of {x.count} journal{x.count === 1 ? "" : "s"}{x.backupConfirmed ? " · backup ticked" : ""}
                    {x.status === "applying" && " · cut short"}
                    {x.status === "undone" && ` · undone${x.undoneAt ? ` ${when(x.undoneAt)}` : ""}${x.undoneByName ? ` by ${x.undoneByName}` : ""}: ${x.restored ?? 0} put back${x.kept ? `, ${x.kept} left as edited` : ""}`}
                  </span>
                </span>
                {x.status !== "undone" && (
                  <button disabled={!!busy} onClick={() => { if (confirm(`Undo this run? ${x.written} journal${x.written === 1 ? "" : "s"} get their old values back, unless edited since.`)) void undo(x); }} className="btn-ghost !px-3 !py-1.5 text-xs">{busy === `undo:${x.id}` ? "Undoing…" : "Undo"}</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {undone && (
          <div className="mt-3 text-sm">
            <p className="font-semibold text-emerald-800">Undone: {undone.restored} journal{undone.restored === 1 ? "" : "s"} put back.</p>
            {undone.kept.length > 0 && (
              <ul className="mt-2 max-h-60 divide-y divide-rule overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/50 text-xs">
                {undone.kept.slice(0, SHOW).map((f) => <li key={f.id} className="px-3 py-2"><Title id={f.id} slug={f.slug} title={f.title} /><span className="block text-slate">{f.note}</span></li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="font-ui text-lg font-bold text-ink">Nana&apos;s answer bank</h2>
        <p className="mt-1 text-sm text-slate">General first questions (no names, numbers or links) answered by the AI are kept {bank ? `${bank.days} days` : "a few days"} (NANA_BANK_DAYS) and given again free to the next person who asks. Editing a help article retires the old answers on its own; empty the bank after a bigger change, such as new prices.</p>
        {bank && (
          <>
            <p className="mt-3 text-sm">{bank.days ? `${bank.answers} answer${bank.answers === 1 ? "" : "s"} kept, given again ${bank.hits} time${bank.hits === 1 ? "" : "s"}.` : "Switched off (NANA_BANK_DAYS is 0)."}</p>
            {bank.top.length > 0 && (
              <ul className="mt-2 divide-y divide-rule rounded-xl border border-rule text-xs">
                {bank.top.map((t) => <li key={t.q} className="flex items-start justify-between gap-3 px-3 py-2"><span className="min-w-0 [overflow-wrap:anywhere]">{t.q}</span><span className="shrink-0 text-slate">{t.hits}× · {t.gem}</span></li>)}
              </ul>
            )}
          </>
        )}
        <button disabled={!!busy || !bank?.answers} onClick={() => { if (confirm("Empty Nana's answer bank? Each question is answered by the AI again the next time it's asked.")) void run("bank", async () => { const r = await call({ job: "bank-clear" }); setBank(r.bank); }); }} className="btn-ghost mt-4 !px-4 !py-2 text-xs">{busy === "bank" ? "Emptying…" : "Empty the answer bank"}</button>
      </div>
    </section>
  );
}

function Title({ id, slug, title }: { id: string; slug: string; title: string }) {
  return slug
    ? <Link href={`/journals/${slug}`} target="_blank" className="font-semibold text-crimson-bright hover:text-ink [overflow-wrap:anywhere]">{title}</Link>
    : <span className="font-semibold text-ink [overflow-wrap:anywhere]">{title} <span className="font-mono text-slate">({id})</span></span>;
}
