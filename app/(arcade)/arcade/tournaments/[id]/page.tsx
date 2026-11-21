import type { Metadata } from "next";
import ArcadeTournament from "@/components/games/ArcadeTournament";

// One Notes Arcade tournament (components/games/ArcadeTournament.tsx): the sponsor, prizes, rules, live leaderboard and Play.
// arcade.<domain>/tournaments/<id> (middleware.ts) or /arcade/tournaments/<id>.
// TODO: the tournament's own name and sponsor in the title and share card (and the sitemap, §2) once the first one is live.
export const metadata: Metadata = {
  title: { absolute: "Tournament · Notes Arcade" },
  description: "A free Notes Arcade tournament: the same deal for everyone, every try checked by the server, and a live leaderboard. Signed-in members; prize tournaments 18+.",
};

export default function Page({ params }: { params: { id: string } }) {
  return <ArcadeTournament id={params.id} />;
}
