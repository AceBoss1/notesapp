import type { Metadata } from "next";
import ArcadeHome from "@/components/games/ArcadeHome";

export const metadata: Metadata = {
  title: { absolute: "Notes Arcade" },
  description: "Free games on #NotesApp: Ludo, Whot, Ace of Spades, Naija Landlord, Ncho, Chess, Draughts and Snake. Play in your browser.",
};

export default function ArcadePage() {
  return <ArcadeHome />;
}
