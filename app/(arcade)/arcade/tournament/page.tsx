import type { Metadata } from "next";
import TournamentRun from "@/components/games/TournamentRun";
import { DAVIDO_AT_34 } from "@/lib/promos";

// The DAVIDO-at-34 Arcade tournament (lib/tournament-server.ts): Naija Run, same street for everyone, best of 3 tries, live leaderboard.
// arcade.<domain>/tournament (middleware.ts) or /arcade/tournament.
export const metadata: Metadata = {
  title: { absolute: `${DAVIDO_AT_34.tournament!.name} · Notes Arcade` },
  description: "Naija Run, tonight from 10 PM (Lagos time): the same street for everyone, your best of 3 tries counts, and the leaderboard updates live. Free entry for signed-in members aged 18 and over.",
  openGraph: { title: `${DAVIDO_AT_34.tournament!.name} · Notes Arcade`, description: "Tonight from 10 PM: best of 3 tries on Naija Run, live leaderboard.", images: ["/images/arcade/run.png"] },
};

export default function Page() {
  return <TournamentRun code={DAVIDO_AT_34.code} />;
}
