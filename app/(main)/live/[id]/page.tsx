import type { Metadata } from "next";
import LiveFeed from "@/components/lives/LiveFeed";
import { getAdminDb } from "@/lib/firebase-admin";
import { livePreview, openToGuests } from "@/lib/live-guests";
import { getRoomSettings } from "@/lib/rooms-server";
import type { RoomDoc } from "@/lib/rooms";

// A link to a live shows who is live, the title and a picture in WhatsApp, X, Facebook and iMessage, and says when no account is needed
// to watch (docs/GUEST_LIVES.md). Lives are never listed by search engines.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const base: Metadata = { title: "Live", robots: { index: false } };
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(params.id)) return base;
  try {
    const db = getAdminDb();
    const r = (await db.doc(`communityRooms/${params.id}`).get()).data() as RoomDoc | undefined;
    if (!r || (!r.profile && !r.paid)) return base; // a community's own lives aren't described to the world
    const p = livePreview(r, openToGuests(r, await getRoomSettings(db)));
    const image = r.poster || r.joined?.[r.hostUid]?.avatar || "/images/brand/og-default.jpg";
    return { ...base, title: p.title, description: p.description, openGraph: { title: p.title, description: p.description, images: [image], type: "video.other" }, twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [image] } };
  } catch {
    return base;
  }
}

// /live/[id]: a free live from a member's profile (lib/profile-lives-server.ts), opened in Notes Live's feed at that live: the room for
// members, the guest view for someone not signed in (components/lives/GuestLive.tsx), and the lobby's answers (ended, followers only,
// the host's summary) when it can't play. Swiping moves on to the other lives on now.
export default function Page({ params }: { params: { id: string } }) {
  return <LiveFeed startId={params.id} />;
}
