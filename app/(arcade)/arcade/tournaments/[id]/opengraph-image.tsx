import { getAdminDb } from "@/lib/firebase-admin";
import { shareTournament, withTimeout } from "@/lib/arcade/tournament-share-server";
import { CARD_SIZE, tournamentCard } from "@/lib/arcade/tournament-card";
import { lagosDates, prizesHeadline, whoLine } from "@/lib/arcade/tournament-text";

// The tournament's share card (owner, 24 Nov 2026: "share cards ... for each tournament"; lib/arcade/tournament-card.tsx): its name, the
// game, "Sponsored by …", the dates in Lagos time and the prizes headline. A draft, an unlisted tournament or a bad id is a 404, so a
// draft's name never leaks through a guessed link. twitter-image.tsx beside it draws the same card.
export const runtime = "nodejs";
export const revalidate = 300;
export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "A Notes Arcade tournament";

export default async function Image({ params }: { params: { id: string } }) {
  const t = await withTimeout((async () => shareTournament(getAdminDb(), params.id))(), 4000);
  if (!t) return new Response("Not found", { status: 404 });
  return tournamentCard({
    kicker: `${t.gameName.toUpperCase()} TOURNAMENT`,
    title: t.name,
    ...(t.sponsor ? { sponsor: `Sponsored by ${t.sponsor.name}` } : {}),
    lines: [`${lagosDates(t.playFrom, t.playUntil)} (Lagos time)`, t.prize ? `Prizes: ${prizesHeadline(t.prizes)}` : "", `${whoLine(t)} · same deal for everyone`],
  });
}
