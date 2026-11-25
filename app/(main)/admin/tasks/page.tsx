"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { hasAnyDept } from "@/lib/admin-access";
import { APP_LABEL, CATEGORY_LABEL, TASKS_BRAND, type Task, type TaskApplication } from "@/lib/tasks";

type Row = Task & { removedBy?: string; removedByEmail?: string };
type App = Omit<TaskApplication, "note"> & { hasNote: boolean };
const STATUSES = [["", "All"], ["open", "Open"], ["draft", "Drafts"], ["closed", "Closed"], ["removed", "Removed"]] as const;
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

// Admin → Tasks (lib/tasks-server.ts adminTasks, removeTask): every Notes Tasks task with who really posted it (anonymous ones too), the
// money held and paid, and its applications for disputes. Trust & safety removes a task: what's held goes back to the poster, anyone
// working on it is told, and the reason is shown to the poster.
export default function AdminTasksPage() {
  const { user, access, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/tasks");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [apps, setApps] = useState<Record<string, App[]>>({});
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const canRemove = !!access && hasAnyDept(access, ["moderation"]);

  const load = useCallback(async () => {
    try {
      const j = await call(undefined, `?status=${status}&q=${encodeURIComponent(q.trim())}`);
      setRows(j.tasks); if (j.counts) setCounts(j.counts);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load tasks"); }
  }, [call, status, q]);
  useEffect(() => { if (user) void load(); }, [user, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const expand = async (id: string) => {
    setOpen(open === id ? null : id);
    if (apps[id] || open === id) return;
    try { const j = await call(undefined, `?id=${id}`); setApps((a) => ({ ...a, [id]: j.applications })); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load applications"); }
  };
  const remove = async (t: Row) => {
    if (!confirm(`Remove "${t.title}"? ${t.status === "open" ? `${naira(t.heldKobo)} held goes back to the poster, and anyone working on it is told.` : "It comes down at once."}`)) return;
    setBusy(true); setError(""); setNote("");
    try { await call({ action: "remove", id: t.id, reason }); setNote(`Removed "${t.title}".`); setRemoving(null); setReason(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't remove it"); }
    setBusy(false);
  };

  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Tasks</h1>
      <p className="mt-1 text-sm text-slate">Every {TASKS_BRAND} task, with who really posted it. <Link href="/tasks" className="text-crimson underline">See the public board</Link></p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {STATUSES.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setStatus(id)} className={`rounded-full px-3 py-1.5 font-ui text-xs font-semibold ${status === id ? "bg-ink text-paper" : "border border-rule bg-card text-ink"}`}>
            {label}{counts && id ? <span className="ml-1 font-mono opacity-70">{counts[id] ?? 0}</span> : null}
          </button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="ml-auto flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, @poster or task id" aria-label="Search tasks" className="w-56 rounded-full border border-rule bg-card px-3 py-1.5 text-sm" />
          <button className="rounded-full bg-crimson px-3 py-1.5 font-ui text-xs font-semibold text-paper">Search</button>
        </form>
      </div>
      {(error || note) && <p role="status" className={`mt-3 text-sm ${error ? "text-crimson" : "text-green-700"}`}>{error || note}</p>}
      {!rows ? <p className="mt-6 text-sm text-slate">Loading…</p> : rows.length === 0 ? <p className="mt-6 text-sm text-slate">No tasks here.</p> : (
        <ul className="mt-4 divide-y divide-rule rounded-2xl border border-rule bg-card">
          {rows.map((t) => (
            <li key={t.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/tasks/${t.id}`} className="font-semibold text-ink hover:text-crimson">{t.title}</Link>
                  <p className="mt-0.5 text-xs text-slate">
                    <Link href={`/admin/users?q=${t.posterUsername}`} className="text-crimson">@{t.posterUsername}</Link> ({t.posterName}){t.anonymous ? <> · <b className="text-ink">anonymous</b> as &quot;{t.anonLabel}&quot;</> : null}
                    {" · "}{CATEGORY_LABEL[t.category]} · {naira(t.rewardKobo)} × {t.slots} · created {day(t.createdAt)}{t.status === "open" ? ` · closes ${day(t.closesAt)}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate">{t.applicants} applied · {t.accepted} working · {t.approved} approved · held {naira(t.heldKobo)} · paid {naira(t.paidKobo)}{t.ratingCount ? ` · ★ ${(t.ratingSum / t.ratingCount).toFixed(1)} (${t.ratingCount})` : ""}</p>
                  {t.status === "removed" && <p className="mt-1 text-xs text-crimson">Removed{t.removedByEmail ? ` by ${t.removedByEmail}` : ""}: {t.removedReason}</p>}
                </div>
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{t.status}</span>
                <button type="button" onClick={() => void expand(t.id)} className="text-xs font-semibold text-crimson">{open === t.id ? "Hide people" : "People"}</button>
                {canRemove && t.status !== "removed" && <button type="button" onClick={() => { setRemoving(removing === t.id ? null : t.id); setReason(""); }} className="text-xs font-semibold text-crimson">Remove</button>}
              </div>
              {removing === t.id && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-paper p-3">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Why (shown to the poster, e.g. asks workers to pay, misleading, breaks the content rules)" className="min-w-0 flex-1 rounded-lg border border-rule bg-card px-3 py-2 text-sm" />
                  <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void remove(t)} className="rounded-lg bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper disabled:opacity-50">{busy ? "Removing…" : "Remove task"}</button>
                  <button type="button" onClick={() => setRemoving(null)} className="px-2 text-xs text-slate">Cancel</button>
                </div>
              )}
              {open === t.id && (
                <div className="mt-3 rounded-xl bg-paper p-3">
                  {!apps[t.id] ? <p className="text-xs text-slate">Loading…</p> : apps[t.id].length === 0 ? <p className="text-xs text-slate">Nobody has applied.</p> : (
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate"><tr><th className="py-1">Member</th><th>Status</th><th>Applied</th><th>Submitted</th><th>Ratings</th></tr></thead>
                      <tbody>
                        {apps[t.id].map((a) => (
                          <tr key={a.uid} className="border-t border-rule align-top">
                            <td className="py-1.5"><Link href={`/admin/users?q=${a.username}`} className="text-crimson">@{a.username}</Link></td>
                            <td>{APP_LABEL[a.status]}{a.autoApproved ? " (auto)" : ""}{a.feedback ? <span className="block text-slate">“{a.feedback}”</span> : null}</td>
                            <td>{day(a.appliedAt)}</td>
                            <td>{day(a.submittedAt)}{a.files?.length ? ` · ${a.files.length} file${a.files.length === 1 ? "" : "s"}` : ""}{a.hasNote ? " · note" : ""}</td>
                            <td>{a.workerRating ? `worker ★${a.workerRating}` : ""}{a.posterRating ? ` poster ★${a.posterRating}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
