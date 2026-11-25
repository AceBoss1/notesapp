"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/components/jobs/useAuthUser";
import { APP_LABEL, CATEGORY_LABEL, REVIEW_DAYS, TASKS_BRAND, budgetKobo, slotsLeft, workerNetKobo, type Task, type TaskApplication, type TaskFile } from "@/lib/tasks";
import { FileLinks, FilePicker, RateForm, Stars, dateText, field, naira, tasksApi } from "./shared";

type Stats = { rating: number | null; count: number; done: number };
type View = {
  role: "poster" | "worker" | "visitor";
  task: Task;
  me: TaskApplication | null;
  brief: { brief: string; files: TaskFile[] } | null;
  posterStats: Stats | null;
  applications?: (TaskApplication & { stats: Stats })[];
};

// One task (/tasks/<id>): what it is and pays, and what you can do on it — apply, work and submit, or, as the poster, publish, choose
// people, review their work and close it.
export default function TaskView({ id }: { id: string }) {
  const user = useAuthUser();
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try { setV(await tasksApi<View>(user, `?id=${id}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load it."); }
  }, [user, id]);
  useEffect(() => { if (user !== undefined) void load(); }, [user, load]);
  const act = async (body: Record<string, unknown>, done?: string) => {
    setError(""); setNote("");
    try { const r = await tasksApi<Record<string, unknown>>(user, "", { id, ...body }); if (done) setNote(done); await load(); return r; } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); return null; }
  };

  if (error && !v) return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-slate">{error} <Link href="/tasks" className="text-crimson underline">All tasks</Link></p>;
  if (!v) return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-slate">Loading…</p>;
  const t = v.task;
  const open = t.status === "open" && Date.parse(t.closesAt) > Date.now();
  const shareUrl = typeof window === "undefined" ? `/tasks/${t.id}` : `${window.location.origin}/tasks/${t.id}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-crimson-bright"><Link href="/tasks">{TASKS_BRAND}</Link> / {CATEGORY_LABEL[t.category]}</p>
      <h1 className="mt-2 font-display text-[2rem] leading-tight text-ink">{t.title}</h1>
      <p className="mt-2 text-ink">{t.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
        {t.anonymous || !t.posterUsername ? <span className="font-semibold text-ink">{t.anonymous ? t.anonLabel : t.posterName}</span> : <Link href={`/u/${t.posterUsername}`} className="font-semibold text-crimson">{t.posterName}</Link>}
        {v.posterStats && <Stars value={v.posterStats.rating} count={v.posterStats.count} />}
        {t.anonymous && <span className="rounded-full bg-paper px-2 py-0.5 text-[11px]">Anonymous poster, verified by #NotesApp</span>}
      </div>

      {(error || note) && <p role="status" className={`mt-4 rounded-xl px-4 py-2 text-sm ${error ? "bg-crimson/10 text-crimson" : "bg-green-50 text-green-800"}`}>{error || note}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr,1fr]">
        <article className="min-w-0">
          <h2 className="font-display text-xl text-ink">The task</h2>
          <p className="mt-2 whitespace-pre-wrap text-ink">{t.details}</p>
          {t.terms && (
            <details className="mt-6 rounded-xl border border-rule bg-card p-4">
              <summary className="cursor-pointer font-ui text-sm font-semibold text-ink">Terms you agree to when you apply</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{t.terms}</p>
            </details>
          )}
          {v.brief && (
            <section className="mt-6 rounded-xl border border-crimson/30 bg-crimson/5 p-4" aria-label="Private brief">
              <h2 className="font-ui text-sm font-bold text-ink">Private brief {v.role === "poster" ? "(only you and accepted workers see this)" : ""}</h2>
              {v.brief.brief ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{v.brief.brief}</p> : <p className="mt-2 text-sm text-slate">No private notes.</p>}
              <FileLinks user={user} taskId={t.id} files={v.brief.files} />
            </section>
          )}
          <p className="mt-6 text-xs text-slate">
            Rewards are held by #NotesApp when the task is published and paid to the worker&apos;s bank account once their work is approved (less {TASKS_BRAND}&apos; 10% fee). Work not reviewed in {REVIEW_DAYS} days is approved automatically. Never pay to take a task. <Link href="/contact" className="text-crimson underline">Report a problem</Link>
          </p>
        </article>

        <aside className="order-first space-y-4 lg:order-none">
          <div className="card p-5">
            <p className="font-display text-3xl text-ink">{naira(t.rewardKobo)}</p>
            <p className="text-xs text-slate">per person · you receive {naira(workerNetKobo(t.rewardKobo))} after the 10% fee</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-slate">Places left</dt><dd className="text-ink">{slotsLeft(t)} of {t.slots}</dd></div>
              <div><dt className="text-xs text-slate">Time to finish</dt><dd className="text-ink">{t.days} day{t.days === 1 ? "" : "s"}</dd></div>
              <div><dt className="text-xs text-slate">Applications close</dt><dd className="text-ink">{t.status === "draft" ? "When published" : dateText(t.closesAt)}</dd></div>
              <div><dt className="text-xs text-slate">Status</dt><dd className="text-ink">{t.status === "draft" ? "Draft" : open ? "Open" : t.status === "removed" ? "Removed" : "Closed"}</dd></div>
            </dl>
            {t.status !== "draft" && (
              <button type="button" onClick={async () => { try { if (navigator.share) await navigator.share({ title: t.title, url: shareUrl }); else { await navigator.clipboard.writeText(shareUrl); setNote("Link copied. Share it anywhere."); } } catch { /* cancelled */ } }} className="btn-ghost mt-4 w-full !py-2 text-sm">Share this task</button>
            )}
          </div>
          {v.role === "poster" ? <PosterPanel v={v} act={act} /> : <WorkerPanel v={v} user={user} act={act} open={open} />}
        </aside>
      </div>

      {v.role === "poster" && t.status !== "draft" && <Applications v={v} user={user} act={act} />}
    </div>
  );
}

type Act = (body: Record<string, unknown>, done?: string) => Promise<Record<string, unknown> | null>;

function PosterPanel({ v, act }: { v: View; act: Act }) {
  const t = v.task;
  if (t.status === "draft") {
    return (
      <div className="card p-5">
        <h2 className="font-ui text-sm font-bold text-ink">Ready to publish?</h2>
        <p className="mt-1 text-sm text-ink">Publishing holds {naira(budgetKobo(t))} ({naira(t.rewardKobo)} × {t.slots}) from your NotesApp Credit{t.anonymous ? ", plus the anonymous-posting fee unless your plan includes it" : ""}. What isn&apos;t paid out comes back when you close the task.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void act({ action: "publish" }, "Published. Share the link to find people.")} className="btn-primary !px-4 !py-2 text-sm">Publish</button>
          <Link href={`/tasks/new?id=${t.id}`} className="btn-ghost !px-4 !py-2 text-sm">Edit</Link>
          <button type="button" onClick={() => { if (confirm("Delete this draft?")) void act({ action: "delete" }).then(() => { window.location.href = "/profile/tasks"; }); }} className="px-2 text-sm text-crimson">Delete</button>
        </div>
        <p className="mt-2 text-xs text-slate">Not enough credit? <Link href="/profile/wallet" className="text-crimson underline">Top up your wallet</Link>.</p>
      </div>
    );
  }
  const apps = v.applications ?? [];
  return (
    <div className="card p-5 text-sm">
      <h2 className="font-ui text-sm font-bold text-ink">Your task</h2>
      <p className="mt-1 text-ink">{apps.filter((a) => a.status === "applied").length} waiting for an answer · {t.accepted} working · {t.approved} approved</p>
      <p className="mt-1 text-xs text-slate">Held: {naira(t.heldKobo)} · Paid out: {naira(t.paidKobo)}</p>
      {t.status === "open" && <button type="button" onClick={() => { if (confirm("Close this task? Nobody new can apply, and what isn't paid out comes back to your NotesApp Credit.")) void act({ action: "close" }, "Closed. What wasn't paid out is back in your NotesApp Credit."); }} className="btn-ghost mt-3 !px-4 !py-1.5 text-xs">Close task</button>}
    </div>
  );
}

function WorkerPanel({ v, user, act, open }: { v: View; user: ReturnType<typeof useAuthUser>; act: Act; open: boolean }) {
  const t = v.task, me = v.me;
  const [pitch, setPitch] = useState("");
  const [agree, setAgree] = useState(false);
  const [workNote, setWorkNote] = useState(me?.note ?? "");
  const [files, setFiles] = useState<TaskFile[]>(me?.files ?? []);
  if (user === null) return <div className="card p-5 text-sm"><p className="text-ink">Sign in to apply.</p><Link href={`/login?next=${encodeURIComponent(`/tasks/${t.id}`)}`} className="btn-primary mt-3 inline-block !px-5 !py-2">Sign in</Link></div>;
  if (!user) return null;
  if (!me) {
    if (!open || slotsLeft(t) <= 0) return <div className="card p-5 text-sm text-slate">This task isn&apos;t taking applications. <Link href="/tasks" className="text-crimson underline">See open tasks</Link></div>;
    return (
      <div className="card p-5">
        <h2 className="font-ui text-sm font-bold text-ink">Apply</h2>
        <label className="mt-2 block text-sm text-ink">Why you&apos;re right for it
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={4} maxLength={1000} placeholder="Your experience, when you can start, anything the poster should know." className={field} />
        </label>
        {t.terms && <label className="mt-2 flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-crimson" />I&apos;ve read the task&apos;s terms and agree to them if I&apos;m accepted.</label>}
        <button type="button" disabled={pitch.trim().length < 20 || (!!t.terms && !agree)} onClick={() => void act({ action: "apply", pitch, agree }, "Applied. You'll get a notification when the poster answers.")} className="btn-primary mt-3 !px-5 !py-2 text-sm disabled:opacity-50">Apply</button>
      </div>
    );
  }
  const working = me.status === "accepted" || me.status === "changes";
  return (
    <div className="card p-5 text-sm">
      <p className="font-ui font-bold text-ink">{APP_LABEL[me.status]}</p>
      {me.dueAt && working && <p className="text-xs text-slate">Submit by {new Date(me.dueAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
      {me.feedback && (me.status === "changes" || me.status === "rejected") && <p className="mt-2 rounded-lg bg-paper p-2 text-ink"><b>From the poster:</b> {me.feedback}</p>}
      {working && (
        <div className="mt-3">
          <label className="block text-sm text-ink">Your work
            <textarea value={workNote} onChange={(e) => setWorkNote(e.target.value)} rows={5} maxLength={6000} placeholder="A note, links, or the work itself." className={field} />
          </label>
          <FilePicker user={user} purpose="work" taskId={t.id} value={files} onChange={setFiles} />
          <button type="button" disabled={!workNote.trim() && !files.length} onClick={() => void act({ action: "submit", note: workNote, fileIds: files.map((f) => f.id) }, "Submitted. The poster has 5 days to review it.")} className="btn-primary mt-3 !px-5 !py-2 text-sm disabled:opacity-50">Submit work</button>
        </div>
      )}
      {(me.status === "submitted" || me.status === "approved" || me.status === "rejected") && (me.note || (me.files?.length ?? 0) > 0) && (
        <div className="mt-3"><p className="text-xs text-slate">What you sent{me.submittedAt ? ` on ${dateText(me.submittedAt)}` : ""}</p>{me.note && <p className="mt-1 whitespace-pre-wrap text-ink">{me.note}</p>}<FileLinks user={user} taskId={t.id} files={me.files ?? []} worker={me.uid} /></div>
      )}
      {(me.status === "applied" || working) && <button type="button" onClick={() => { if (confirm("Withdraw from this task?")) void act({ action: "withdraw" }, "Withdrawn."); }} className="mt-3 text-xs font-semibold text-crimson">Withdraw</button>}
      {(me.status === "approved" || me.status === "rejected") && !me.posterRating && <RateForm label={`Rate ${t.anonymous ? "this poster" : t.posterName}`} onRate={async (stars, comment) => { await act({ action: "rate", stars, comment }, "Thanks for rating."); }} />}
    </div>
  );
}

function Applications({ v, user, act }: { v: View; user: ReturnType<typeof useAuthUser>; act: Act }) {
  const [fb, setFb] = useState<Record<string, string>>({});
  const apps = v.applications ?? [];
  const order: TaskApplication["status"][] = ["submitted", "applied", "changes", "accepted", "approved", "rejected", "declined", "expired", "withdrawn"];
  const sorted = [...apps].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <section className="mt-10" aria-label="Applications">
      <h2 className="font-display text-2xl text-ink">People ({apps.length})</h2>
      {apps.length === 0 && <p className="mt-2 text-sm text-slate">Nobody has applied yet. Share the link to find people.</p>}
      <ul className="mt-4 space-y-3">
        {sorted.map((a) => (
          <li key={a.uid} className="card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/u/${a.username}`} className="font-semibold text-crimson">{a.name}</Link><span className="text-xs text-slate">@{a.username}</span>
              <Stars value={a.stats.rating} count={a.stats.count} /><span className="text-xs text-slate">· {a.stats.done} task{a.stats.done === 1 ? "" : "s"} done</span>
              <span className="ml-auto rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{APP_LABEL[a.status]}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-ink">{a.pitch}</p>
            {a.status === "applied" && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void act({ action: "decide", worker: a.uid, accept: true }, `${a.name} is on the task.`)} className="btn-primary !px-4 !py-1.5 text-xs">Accept</button>
                <button type="button" onClick={() => void act({ action: "decide", worker: a.uid, accept: false })} className="btn-ghost !px-4 !py-1.5 text-xs">Decline</button>
              </div>
            )}
            {(a.status === "submitted" || a.status === "approved" || a.status === "rejected") && (a.note || (a.files?.length ?? 0) > 0) && (
              <div className="mt-3 rounded-xl bg-paper p-3">
                <p className="text-xs text-slate">Their work{a.submittedAt ? `, sent ${dateText(a.submittedAt)}` : ""}</p>
                {a.note && <p className="mt-1 whitespace-pre-wrap text-ink">{a.note}</p>}
                <FileLinks user={user} taskId={v.task.id} files={a.files ?? []} worker={a.uid} />
              </div>
            )}
            {a.status === "submitted" && (
              <div className="mt-3">
                <textarea value={fb[a.uid] ?? ""} onChange={(e) => setFb({ ...fb, [a.uid]: e.target.value })} rows={2} maxLength={1000} placeholder="Feedback (needed to ask for changes or reject)" className={field} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { if (confirm(`Approve and pay ${a.name} ${naira(v.task.rewardKobo)}?`)) void act({ action: "review", worker: a.uid, decision: "approve", feedback: fb[a.uid] ?? "" }, "Approved. They're paid after a 24-hour check."); }} className="btn-primary !px-4 !py-1.5 text-xs">Approve and pay</button>
                  <button type="button" onClick={() => void act({ action: "review", worker: a.uid, decision: "changes", feedback: fb[a.uid] ?? "" }, "Changes asked.")} className="btn-ghost !px-4 !py-1.5 text-xs">Ask for changes</button>
                  <button type="button" onClick={() => { if (confirm("Reject this work? They won't be paid, and the place opens again.")) void act({ action: "review", worker: a.uid, decision: "reject", feedback: fb[a.uid] ?? "" }); }} className="px-2 text-xs font-semibold text-crimson">Reject</button>
                </div>
              </div>
            )}
            {(a.status === "approved" || a.status === "rejected") && !a.workerRating && <RateForm label={`Rate ${a.name}`} onRate={async (stars, comment) => { await act({ action: "rate", worker: a.uid, stars, comment }, "Thanks for rating."); }} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
