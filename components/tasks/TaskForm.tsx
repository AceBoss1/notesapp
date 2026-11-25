"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthUser } from "@/components/jobs/useAuthUser";
import { ANON_FEE_KOBO, DAYS_MAX, OPEN_DAYS_MAX, SLOTS_MAX, TASKS_BRAND, TASK_CATEGORIES, anonIncluded, workerNetKobo, type Task, type TaskFile } from "@/lib/tasks";
import { FilePicker, field, naira, tasksApi } from "./shared";

// Posting a task (/tasks/new, or ?id=<draft> to edit one): saved as a draft first, then published from the task's page, which holds the
// rewards from your NotesApp Credit.
export default function TaskForm() {
  const user = useAuthUser();
  const router = useRouter();
  const draftId = useSearchParams().get("id") ?? "";
  const [can, setCan] = useState<{ ok: boolean; reason?: string; tier?: string } | null>(null);
  const [f, setF] = useState({ title: "", summary: "", details: "", category: "language", rewardNaira: "5000", slots: "1", days: "3", openDays: "14", anonymous: false, brief: "", terms: "" });
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!user) return;
    tasksApi<{ ok: boolean; reason?: string; tier?: string }>(user, "?canPost=1").then(setCan).catch((e) => setCan({ ok: false, reason: e.message }));
    if (draftId) {
      tasksApi<{ task: Task; brief: { brief: string; files: TaskFile[] } | null }>(user, `?id=${draftId}`).then(({ task: t, brief }) => {
        setF({ title: t.title, summary: t.summary, details: t.details, category: t.category, rewardNaira: String(t.rewardKobo / 100), slots: String(t.slots), days: String(t.days), openDays: String(t.openDays), anonymous: t.anonymous, brief: brief?.brief ?? "", terms: t.terms });
        setFiles(brief?.files ?? []);
      }).catch((e) => setError(e.message));
    }
  }, [user, draftId]);

  if (user === undefined) return <p className="py-16 text-center text-slate">Loading…</p>;
  if (user === null) return <p className="py-16 text-center text-ink">Sign in to post a task. <Link href="/login?next=%2Ftasks%2Fnew" className="text-crimson underline">Sign in</Link></p>;
  if (can && !can.ok) return <div className="mx-auto max-w-xl py-16 text-center"><p className="text-ink">{can.reason}</p><p className="mt-3 text-sm"><Link href="/badges" className="text-crimson underline">Get verified</Link> · <Link href="/organisation" className="text-crimson underline">Verify your organisation</Link></p></div>;

  const reward = Math.round(Number(f.rewardNaira) * 100) || 0, slots = Number(f.slots) || 0;
  const included = anonIncluded(can?.tier as never);
  const save = async () => {
    setBusy(true); setError("");
    try {
      const r = await tasksApi<{ id: string }>(user, "", { action: "save", id: draftId || undefined, ...f, rewardNaira: Number(f.rewardNaira), slots: Number(f.slots), days: Number(f.days), openDays: Number(f.openDays), fileIds: files.map((x) => x.id) });
      router.push(`/tasks/${r.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save it."); setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-crimson-bright"><Link href="/tasks">{TASKS_BRAND}</Link> / {draftId ? "Edit draft" : "Post a task"}</p>
      <h1 className="mt-2 font-display text-[2rem] text-ink">{draftId ? "Edit your task" : "Post a paid task"}</h1>
      <p className="mt-2 text-sm text-slate">Save it as a draft, check it, then publish. Publishing holds the rewards from your NotesApp Credit, so workers know they&apos;ll be paid.</p>
      <div className="mt-6 space-y-5">
        <label className="block text-sm text-ink">Title<input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="e.g. Translate 500 English sentences into Hausa" className={field} /></label>
        <label className="block text-sm text-ink">One-line summary (shows on the task board)<input value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={280} className={field} /></label>
        <label className="block text-sm text-ink">Category
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className={field}>{TASK_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        </label>
        <label className="block text-sm text-ink">The task (public): what&apos;s needed, who it suits, how the work will be checked
          <textarea value={f.details} onChange={(e) => set("details", e.target.value)} rows={7} maxLength={6000} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-ink">Reward per person (₦)<input type="number" min={1000} step={500} value={f.rewardNaira} onChange={(e) => set("rewardNaira", e.target.value)} className={field} />
            <span className="mt-1 block text-[11px] text-slate">They receive {naira(workerNetKobo(reward))} after the 10% fee.</span></label>
          <label className="block text-sm text-ink">How many people<input type="number" min={1} max={SLOTS_MAX} value={f.slots} onChange={(e) => set("slots", e.target.value)} className={field} /></label>
          <label className="block text-sm text-ink">Days to finish once accepted<input type="number" min={1} max={DAYS_MAX} value={f.days} onChange={(e) => set("days", e.target.value)} className={field} /></label>
          <label className="block text-sm text-ink">Applications stay open (days)<input type="number" min={1} max={OPEN_DAYS_MAX} value={f.openDays} onChange={(e) => set("openDays", e.target.value)} className={field} /></label>
        </div>
        <label className="block text-sm text-ink">Terms or NDA (public, so people agree before applying; optional)
          <textarea value={f.terms} onChange={(e) => set("terms", e.target.value)} rows={5} maxLength={10000} placeholder="e.g. Keep everything confidential. All work belongs to us. No AI or translation tools." className={field} />
        </label>
        <fieldset className="rounded-2xl border border-rule bg-card p-4">
          <legend className="px-1 font-ui text-sm font-semibold text-ink">Private brief (only for people you accept)</legend>
          <textarea value={f.brief} onChange={(e) => set("brief", e.target.value)} rows={5} maxLength={10000} placeholder="Instructions, links, guides: whatever workers need once they're on the task." className={field} />
          <FilePicker user={user} purpose="brief" value={files} onChange={setFiles} />
        </fieldset>
        <label className="flex items-start gap-3 rounded-2xl border border-rule bg-card p-4 text-sm text-ink">
          <input type="checkbox" checked={f.anonymous} onChange={(e) => set("anonymous", e.target.checked)} className="mt-1 h-4 w-4 accent-crimson" />
          <span><b>Post anonymously.</b> The task shows &quot;Verified organisation&quot; (or &quot;Verified member&quot;) and your industry instead of your name. #NotesApp still knows who you are, and workers are still paid through us.
            <span className="mt-1 block text-xs text-slate">{included ? "Included on your plan." : `${naira(ANON_FEE_KOBO)} per task, or included on Business and Enterprise.`}</span></span>
        </label>
        <div className="rounded-2xl bg-paper p-4 text-sm text-ink">
          Publishing will hold <b>{naira(reward * slots)}</b> ({naira(reward)} × {slots}){f.anonymous && !included ? <> and take <b>{naira(ANON_FEE_KOBO)}</b> for posting anonymously</> : null} from your NotesApp Credit. What isn&apos;t paid out comes back when you close the task.
        </div>
        {error && <p className="text-sm text-crimson">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void save()} className="btn-primary !px-6 !py-2.5 disabled:opacity-50">{busy ? "Saving…" : "Save draft and preview"}</button>
      </div>
    </div>
  );
}
