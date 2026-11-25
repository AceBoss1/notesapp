"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/components/jobs/useAuthUser";
import { APP_LABEL, slotsLeft, type Task, type TaskApplication } from "@/lib/tasks";
import { dateText, naira, tasksApi } from "./shared";

type Mine = { posted: Task[]; working: { app: TaskApplication; task: Task }[] };
const STATUS: Record<Task["status"], string> = { draft: "Draft", open: "Open", closed: "Closed", removed: "Removed" };

// My tasks (/profile/tasks): the tasks you posted and the ones you applied to or are working on.
export default function MyTasks() {
  const user = useAuthUser();
  const [m, setM] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (user) tasksApi<Mine>(user, "?mine=1").then(setM).catch((e) => setError(e.message)); }, [user]);
  if (user === null) return <p className="py-10 text-ink">Sign in to see your tasks. <Link href="/login?next=%2Fprofile%2Ftasks" className="text-crimson underline">Sign in</Link></p>;
  if (error) return <p className="py-10 text-crimson">{error}</p>;
  if (!m) return <p className="py-10 text-slate">Loading…</p>;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2"><Link href="/tasks/new" className="btn-primary !px-5 !py-2">Post a task</Link><Link href="/tasks" className="btn-ghost !px-5 !py-2">Find tasks</Link></div>
      <section>
        <h2 className="font-display text-2xl text-ink">Working on</h2>
        {m.working.length === 0 ? <p className="mt-2 text-sm text-slate">You haven&apos;t applied to any task yet.</p> : (
          <ul className="mt-3 space-y-2">
            {m.working.map(({ app, task }) => (
              <li key={task.id}><Link href={`/tasks/${task.id}`} className="card flex flex-wrap items-center gap-3 p-4 hover:border-crimson">
                <span className="min-w-0 flex-1"><b className="block truncate text-ink">{task.title}</b><span className="text-xs text-slate">{task.anonymous ? task.anonLabel : task.posterName} · {naira(task.rewardKobo)}{app.dueAt && (app.status === "accepted" || app.status === "changes") ? ` · due ${dateText(app.dueAt)}` : ""}</span></span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{APP_LABEL[app.status]}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="font-display text-2xl text-ink">Posted by you</h2>
        {m.posted.length === 0 ? <p className="mt-2 text-sm text-slate">You haven&apos;t posted a task yet.</p> : (
          <ul className="mt-3 space-y-2">
            {m.posted.map((t) => (
              <li key={t.id}><Link href={`/tasks/${t.id}`} className="card flex flex-wrap items-center gap-3 p-4 hover:border-crimson">
                <span className="min-w-0 flex-1"><b className="block truncate text-ink">{t.title}</b><span className="text-xs text-slate">{naira(t.rewardKobo)} × {t.slots} · {t.applicants} applied · {t.accepted} working · {t.approved} approved{t.status === "open" ? ` · ${slotsLeft(t)} places left` : ""}{t.anonymous ? " · anonymous" : ""}</span></span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-slate">{STATUS[t.status]}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
