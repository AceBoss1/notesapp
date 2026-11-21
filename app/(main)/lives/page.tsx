import type { Metadata } from "next";
import LiveFeed from "@/components/lives/LiveFeed";

export const metadata: Metadata = { title: "Notes Live", description: "Who's live on #NotesApp right now: swipe through the lives, comment, send hearts and gifts." };

// Notes Live: the lives on now as a full-screen feed you swipe through, one live per screen (components/lives/LiveFeed.tsx). Paid lives
// with tickets are at /lives/paid; a paid live's own page is still /lives/<id>.
export default function Page() {
  return <LiveFeed />;
}
