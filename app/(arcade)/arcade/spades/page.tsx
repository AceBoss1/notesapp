import type { Metadata } from "next";
import SpadesGame from "@/components/games/SpadesGame";
import { arcadeGame } from "@/lib/arcade/catalogue";

const game = arcadeGame("spades");

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <SpadesGame />;
}
