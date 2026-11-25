import { Suspense } from "react";
import type { Metadata } from "next";
import TaskForm from "@/components/tasks/TaskForm";
import { TASKS_BRAND } from "@/lib/tasks";

export const metadata: Metadata = { title: `Post a task · ${TASKS_BRAND}`, robots: { index: false } };

export default function NewTaskPage() {
  return <Suspense fallback={<p className="py-16 text-center text-slate">Loading…</p>}><TaskForm /></Suspense>;
}
