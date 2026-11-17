import type { Metadata } from "next";
import SnakeGame from "@/components/games/SnakeGame";

export const metadata: Metadata = {
  title: "Snake Arcade",
  description: "Play Snake in the NotesApp arcade. Eat, grow, and see how high you can score.",
};

export default function SnakePage() {
  return <SnakeGame />;
}
