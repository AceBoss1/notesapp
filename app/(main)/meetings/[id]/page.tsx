import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { MeetingPage } from "@/components/meetings/Meetings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = (await getAdminDb().doc(`meetings/${params.id}`).get().catch(() => null))?.data();
  if (!m) return { title: "Meeting", robots: { index: false } };
  return { title: m.title, description: `${m.hostName}: a meeting on #NotesApp. ${String(m.description || "").slice(0, 140)}`, ...(m.visibility === "unlisted" ? { robots: { index: false } } : {}) };
}

// One meeting (lib/meetings.ts).
export default function Page({ params }: { params: { id: string } }) {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><MeetingPage id={params.id} /></div>;
}
