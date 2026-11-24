import type { Metadata } from "next";
import ArcadeTournaments from "@/components/games/ArcadeTournaments";
import { LIST_DESCRIPTION, LIST_TITLE } from "@/lib/arcade/tournament-text";

// Notes Arcade tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md): playing now, coming up and results.
// arcade.<domain>/tournaments (middleware.ts) or /arcade/tournaments. The one-off DAVIDO tournament keeps /arcade/tournament.
// The share card is ./opengraph-image.tsx (owner, 24 Nov 2026: "share cards and sitemap entries for each tournament").
export const metadata: Metadata = {
  title: { absolute: LIST_TITLE },
  description: LIST_DESCRIPTION,
  alternates: { canonical: "/arcade/tournaments" },
  openGraph: { type: "website", title: LIST_TITLE, description: "Same deal for everyone. Best player wins. Free entry for signed-in members.", url: "/arcade/tournaments", siteName: "Notes Arcade" },
  twitter: { card: "summary_large_image", title: LIST_TITLE, description: "Same deal for everyone. Best player wins. Free entry for signed-in members." },
};

export default function Page() {
  return <ArcadeTournaments />;
}
