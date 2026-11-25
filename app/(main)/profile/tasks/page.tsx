import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import MyTasks from "@/components/tasks/MyTasks";
import { TASKS_BRAND } from "@/lib/tasks";

export const metadata: Metadata = { title: `My tasks · ${TASKS_BRAND}`, robots: { index: false } };

export default function MyTasksPage() {
  return (
    <>
      <PageHero eyebrow="My account" title={<>My tasks</>} compact><p>Paid tasks you posted on {TASKS_BRAND}, and the ones you&apos;re working on.</p></PageHero>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><MyTasks /></div>
    </>
  );
}
