import type { Metadata } from "next";
import ArcadeTournaments from "@/components/games/ArcadeTournaments";

// Notes Arcade tournaments (owner, 21 Nov 2026: "start tournaments"; docs/ARCADE_TOURNAMENTS.md): playing now, coming up and results.
// arcade.<domain>/tournaments (middleware.ts) or /arcade/tournaments. The one-off DAVIDO tournament keeps /arcade/tournament.
export const metadata: Metadata = {
  title: { absolute: "Tournaments · Notes Arcade" },
  description: "Free Notes Arcade tournaments: everyone plays the same deal, every try is checked by the server, and the best player wins. Signed-in members; prize tournaments 18+.",
  openGraph: { title: "Tournaments · Notes Arcade", description: "Same deal for everyone. Best player wins.", images: ["/images/arcade/whot.png"] },
};

export default function Page() {
  return <ArcadeTournaments />;
}
