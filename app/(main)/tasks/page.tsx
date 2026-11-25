import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { getAdminDb } from "@/lib/firebase-admin";
import { listOpen } from "@/lib/tasks-server";
import { CATEGORY_LABEL, REVIEW_DAYS, TASKS_BRAND, TASK_CATEGORIES, isCategory, slotsLeft, workerNetKobo } from "@/lib/tasks";

export const revalidate = 60;
export const metadata: Metadata = {
  title: `${TASKS_BRAND}: paid tasks from verified posters`,
  description: "Paid one-off tasks from verified organisations and members: translation, language data, writing, research, design and more. The reward is held by #NotesApp before you start.",
};

const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

// The task board: every open task with a place left, newest first, by category.
export default async function TasksPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = isCategory(searchParams.category) ? searchParams.category : undefined;
  const tasks = await listOpen(getAdminDb(), { category }).catch(() => []);
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 font-ui text-xs font-semibold ${on ? "bg-ink text-paper" : "border border-rule bg-card text-ink hover:border-crimson"}`;
  return (
    <>
      <PageHero eyebrow={TASKS_BRAND} title={<>Paid tasks, <em>held before you start</em></>} compact
        side={<div className="flex flex-wrap gap-2"><Link href="/tasks/new" className="btn-primary !px-5 !py-2.5">Post a task</Link><Link href="/profile/tasks" className="rounded-full border border-paper/60 px-5 py-2.5 font-ui text-sm font-semibold text-paper hover:bg-paper/10">My tasks</Link></div>}>
        <p>Verified organisations and members post paid tasks. The reward is held by #NotesApp when the task goes up and paid to your bank once your work is approved. Work that isn&apos;t reviewed in {REVIEW_DAYS} days is approved for you.</p>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <nav aria-label="Categories" className="mt-6 flex flex-wrap gap-2">
          <Link href="/tasks" className={chip(!category)}>All</Link>
          {TASK_CATEGORIES.map((c) => <Link key={c.key} href={`/tasks?category=${c.key}`} className={chip(category === c.key)}>{c.label}</Link>)}
        </nav>
        {tasks.length === 0 ? (
          <div className="card mt-8 p-8 text-center">
            <p className="text-ink">No open tasks{category ? ` in ${CATEGORY_LABEL[category]}` : ""} right now.</p>
            <p className="mt-2 text-sm text-slate">Have work that needs doing? <Link href="/tasks/new" className="text-crimson underline">Post a task</Link> and share its link.</p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={`/tasks/${t.id}`} className="card block h-full p-5 transition hover:border-crimson">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-crimson-bright">{CATEGORY_LABEL[t.category]}</p>
                  <h2 className="mt-1 font-display text-xl leading-snug text-ink">{t.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-ink">{t.summary}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
                    <span className="font-display text-lg text-ink">{naira(workerNetKobo(t.rewardKobo))}</span>
                    <span>{slotsLeft(t)} place{slotsLeft(t) === 1 ? "" : "s"} left</span>
                    <span>{t.days} day{t.days === 1 ? "" : "s"} to finish</span>
                    <span>{t.anonymous ? t.anonLabel : t.posterName}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
