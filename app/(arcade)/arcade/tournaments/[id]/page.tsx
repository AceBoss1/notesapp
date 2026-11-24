import type { Metadata } from "next";
import ArcadeTournament from "@/components/games/ArcadeTournament";
import { getAdminDb } from "@/lib/firebase-admin";
import { shareTournament, withTimeout } from "@/lib/arcade/tournament-share-server";
import { tournamentShare } from "@/lib/arcade/tournament-text";

// One Notes Arcade tournament (components/games/ArcadeTournament.tsx): the sponsor, prizes, rules, live leaderboard and Play.
// arcade.<domain>/tournaments/<id> (middleware.ts) or /arcade/tournaments/<id>.
// Its title, description and share card carry the tournament's own name, game, sponsor and dates (owner, 24 Nov 2026: "share cards and
// sitemap entries for each tournament"; §2 "The page ... shareable, in the sitemap"). The picture is ./opengraph-image.tsx.
export const revalidate = 300;

const FALLBACK: Metadata = {
  title: { absolute: "Tournament · Notes Arcade" },
  description: "A free Notes Arcade tournament: the same deal for everyone, every try checked by the server, and a live leaderboard. Signed-in members; prize tournaments 18+.",
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // A slow or missing Firestore (a build, a preview without keys) gives the plain title rather than holding the page up.
  const t = await withTimeout((async () => shareTournament(getAdminDb(), params.id))(), 2500);
  if (!t) return FALLBACK; // no noindex: a timeout on a real tournament mustn't drop it from search for the cache's five minutes
  const { title, description } = tournamentShare(t, t.gameName);
  const url = `/arcade/tournaments/${t.id}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url, siteName: "Notes Arcade" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Page({ params }: { params: { id: string } }) {
  return <ArcadeTournament id={params.id} />;
}
