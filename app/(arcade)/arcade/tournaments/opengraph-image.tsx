import { CARD_SIZE, tournamentCard } from "@/lib/arcade/tournament-card";

// The tournaments list's share card (owner, 24 Nov 2026: "share cards ... for each tournament"; lib/arcade/tournament-card.tsx). It
// reads nothing from Firestore. twitter-image.tsx beside it draws the same card.
export const runtime = "nodejs";
export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Notes Arcade tournaments: same deal for everyone, best player wins";

export default async function Image() {
  return tournamentCard({
    kicker: "TOURNAMENTS",
    title: "Same deal. Best player wins.",
    lines: ["Free Notes Arcade tournaments", "Every try checked by the server · signed-in members · prize tournaments 18+"],
  });
}
