import type { Metadata } from "next";
import LandlordGame from "@/components/games/LandlordGame";
import { arcadeGame } from "@/lib/arcade/catalogue";

const game = arcadeGame("landlord");

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <LandlordGame />;
}
