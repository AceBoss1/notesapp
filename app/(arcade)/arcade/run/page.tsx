import type { Metadata } from "next";
import RunGame from "@/components/games/RunGame";
import { ENTRY } from "@/lib/arcade/run.entry";

const game = ENTRY;

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <RunGame />;
}
