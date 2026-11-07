import type { Metadata } from "next";
import { LiveLobby } from "@/components/lives/ProfileLive";

export const metadata: Metadata = { title: "Live", robots: { index: false } };

// /live/[id]: a free live from a member's profile (lib/profile-lives-server.ts): its lobby, then the room.
export default function Page({ params }: { params: { id: string } }) {
  return <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6"><LiveLobby id={params.id} /></div>;
}
