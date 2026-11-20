import type { Metadata } from "next";
import NchoGame from "@/components/games/NchoGame";
import { arcadeGame } from "@/lib/arcade/catalogue";

const game = arcadeGame("ncho");

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  icons: { icon: "/images/brand/notesapp-icon-green.svg" },
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <NchoGame />;
}
