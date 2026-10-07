"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { REPORT_REASON_LABEL, REPORT_URGENT_HOURS, URGENT_REASONS, type ReportReason } from "@/lib/moments-rules";

type Report = {
  id: string; kind: "moment" | "conversation"; reason: ReportReason; note: string; createdAt: string; status: string;
  reporter: string; target: string; outcome?: string; mediaUrls: string[];
  evidence?: { text?: string | null; kind?: string; ownerUsername?: string; hasVoiceOver?: boolean; messages?: { from: string; text: string; createdAt: string }[] };
};

// Reports on moments and conversations. Each open report holds a copy of what was reported (and a moment's files) until you
// resolve it; resolving deletes that copy. "Actioned" also removes a reported moment that is still live.
export default function AdminReportsPage() {
  const { user, loading } = useAdminAuth();
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(path, { ...init, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => {
    call(`/api/admin/reports?status=${status}`)
      .then((j: { reports: Report[] }) => setReports(status === "open"
        // Urgent ones (nudity, violence) first, then the oldest.
        ? j.reports.slice().sort((a, b) => Number(URGENT_REASONS.includes(b.reason)) - Number(URGENT_REASONS.includes(a.reason)) || (a.createdAt < b.createdAt ? -1 : 1))
        : j.reports))
      .catch((e) => setError(e.message));
  }, [call, status]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function resolve(id: string, outcome: "dismissed" | "actioned") {
    setError("");
    try { await call("/api/admin/reports", { method: "POST", body: JSON.stringify({ id, outcome, note: note[id] ?? "" }) }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  }

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Reports</h1>
      <p className="mt-2 text-sm text-slate">Moments and conversations members have reported. To warn or suspend someone, use <Link href="/admin/users" className="text-crimson underline">Users</Link>, then mark the report actioned.</p>
      <div className="mt-4 flex gap-2">
        {(["open", "resolved"] as const).map((s) => (
          <button key={s} onClick={() => { setReports(null); setStatus(s); }} aria-pressed={status === s} className={`rounded-full border px-4 py-1 text-sm ${status === s ? "border-crimson bg-crimson text-white" : "border-rule"}`}>{s === "open" ? "Open" : "Resolved"}</button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {reports && !reports.length && <p className="mt-6 text-slate">Nothing {status}.</p>}
      <ul className="mt-6 space-y-4">
        {reports?.map((r) => (
          <li key={r.id} className="card p-5">
            {r.status === "open" && URGENT_REASONS.includes(r.reason) && (() => {
              const hrs = (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000;
              return hrs >= REPORT_URGENT_HOURS
                ? <p className="mb-2 inline-block rounded bg-red-700 px-2 py-0.5 text-xs font-bold text-white">OVERDUE · {Math.floor(hrs)}h old, our promise is {REPORT_URGENT_HOURS}h</p>
                : <p className="mb-2 inline-block rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-ink">URGENT · review within {REPORT_URGENT_HOURS}h ({Math.max(0, Math.ceil(REPORT_URGENT_HOURS - hrs))}h left)</p>;
            })()}
            <p className="text-sm"><strong className="text-ink">{r.kind === "moment" ? "Moment" : "Conversation"}</strong> reported by @{r.reporter} against @{r.target} · {REPORT_REASON_LABEL[r.reason] ?? r.reason} · {new Date(r.createdAt).toLocaleString()}</p>
            {r.note && <p className="mt-2 text-sm text-slate">“{r.note}”</p>}
            {r.status === "open" && r.evidence && (
              <div className="mt-3 rounded border border-rule p-3 text-sm">
                {r.kind === "moment" ? (
                  <>
                    <p className="text-slate">{r.evidence.kind} moment by @{r.evidence.ownerUsername}{r.evidence.hasVoiceOver ? " (with a voice-over)" : ""}</p>
                    {r.evidence.text && <p className="mt-1 whitespace-pre-wrap text-ink">{r.evidence.text}</p>}
                    {r.mediaUrls.map((u) =>
                      /\.(mp4|webm)$/.test(u) ? <video key={u} src={u} controls className="mt-2 max-h-64" />
                      : /\.m4a$/.test(u) ? <audio key={u} src={u} controls className="mt-2 w-full" />
                      : /* eslint-disable-next-line @next/next/no-img-element */ <img key={u} src={u} alt="" className="mt-2 max-h-64" />
                    )}
                  </>
                ) : (
                  <ul className="space-y-1">{r.evidence.messages?.map((m, i) => <li key={i}><span className="text-slate">{m.from === r.target ? `@${r.target}` : `@${r.reporter}`}:</span> {m.text}</li>)}</ul>
                )}
              </div>
            )}
            {r.status === "open" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={note[r.id] ?? ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} placeholder="Note (optional)" maxLength={500} className="min-w-0 flex-1 rounded border border-rule px-3 py-1.5 text-sm" />
                <button onClick={() => resolve(r.id, "dismissed")} className="btn-ghost">Dismiss</button>
                <button onClick={() => resolve(r.id, "actioned")} className="btn-primary">Actioned{r.kind === "moment" ? " (removes the moment)" : ""}</button>
              </div>
            ) : <p className="mt-2 text-sm text-slate">Resolved: {r.outcome}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
