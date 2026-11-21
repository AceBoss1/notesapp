import type { Metadata } from "next";
import ArcadeInstall from "@/components/games/ArcadeInstall";

export const metadata: Metadata = {
  title: { absolute: "Install Notes Arcade" },
  description: "Install Notes Arcade from your browser on a phone, tablet or computer: the green [na] icon on your home screen, every game a tap away. No store needed.",
};

// arcade.<domain>/install (middleware.ts) and /arcade/install on the main site.
export default function Page() {
  return <ArcadeInstall />;
}
