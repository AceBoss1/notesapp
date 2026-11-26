import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import EventDetail from "@/components/events/EventDetail";

export const dynamic = "force-dynamic";

// One event (lib/events.ts). Only public events get a share preview; a members-only event's details stay inside its community.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = (await getAdminDb().doc(`events/${params.id}`).get().catch(() => null))?.data();
  if (!e || e.visibility !== "public") return { title: "Event", robots: { index: false } };
  const description = `${e.communityName || e.hostName}: ${String(e.description || e.place || "").slice(0, 150)}`;
  return { title: e.title, description, openGraph: { title: e.title, description, ...(e.cover ? { images: [e.cover] } : {}) } };
}

export default function Page({ params }: { params: { id: string } }) {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><EventDetail id={params.id} /></div>;
}
