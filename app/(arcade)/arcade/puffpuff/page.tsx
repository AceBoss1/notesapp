import type { Metadata } from "next";
import PuffPuffGame from "@/components/games/PuffPuffGame";
import { ENTRY as game } from "@/lib/arcade/puffpuff.entry";

export const metadata: Metadata = {
  title: { absolute: `${game.name} · Notes Arcade` },
  description: game.description,
  openGraph: { title: `${game.name} · Notes Arcade`, description: game.blurb, images: [`/images/arcade/${game.slug}.png`] },
};

export default function Page() {
  return <PuffPuffGame />;
}
