import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import { LiveLobby } from "@/components/lives/PaidLives";

export const dynamic = "force-dynamic";

// A paid live's lobby (lib/live-tickets.ts): the ticket, buying one, and the door into the room.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = /^[A-Za-z0-9_-]{1,80}$/.test(params.id) ? (await getAdminDb().doc(`liveEvents/${params.id}`).get().catch(() => null))?.data() : undefined;
  if (!e) return { title: "Paid live", robots: { index: false } };
  return { title: e.title, description: `A paid live with ${e.hostName || `@${e.hostUsername}`} on #NotesApp.` };
}

export default function Page({ params }: { params: { id: string } }) {
  return <LiveLobby id={params.id} />;
}
