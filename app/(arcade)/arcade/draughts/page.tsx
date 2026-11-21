import type { Metadata } from "next";
import DraughtsGame from "@/components/games/DraughtsGame";
import { arcadeGame } from "@/lib/arcade/catalogue";

const game = arcadeGame("draughts");

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <DraughtsGame />;
}
