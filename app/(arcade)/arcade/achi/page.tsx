import type { Metadata } from "next";
import AchiGame from "@/components/games/AchiGame";
import { ENTRY as game } from "@/lib/arcade/achi.entry";

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <AchiGame />;
}
