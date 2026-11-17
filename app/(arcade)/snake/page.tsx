import type { Metadata } from "next";
import SnakeGame from "@/components/games/SnakeGame";

export const metadata: Metadata = {
  title: { absolute: "Notes Arcade" },
  description: "Play Snake in the NotesApp arcade. Eat, grow, and see how high you can score.",
  icons: { icon: "/images/brand/notesapp-icon-green.svg" },
};

export default function SnakePage() {
  return <SnakeGame />;
}
