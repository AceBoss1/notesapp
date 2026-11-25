import type { Metadata } from "next";
import TaskView from "@/components/tasks/TaskView";
import { getAdminDb } from "@/lib/firebase-admin";
import { TASKS_BRAND, workerNetKobo, type Task } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// A task's link is what posters share, so it carries a proper title and description for previews (never the poster of an anonymous task).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = /^[\w-]{1,64}$/.test(params.id) ? ((await getAdminDb().doc(`tasks/${params.id}`).get().catch(() => null))?.data() as Task | undefined) : undefined;
  if (!t || t.status === "draft" || t.status === "removed") return { title: TASKS_BRAND };
  const pay = `₦${Math.round(workerNetKobo(t.rewardKobo) / 100).toLocaleString("en-NG")}`;
  return { title: `${t.title} · ${TASKS_BRAND}`, description: `${t.summary} · Earn ${pay} · ${t.anonymous ? t.anonLabel : t.posterName}` };
}

export default function TaskPage({ params }: { params: { id: string } }) {
  return <TaskView id={params.id} />;
}
