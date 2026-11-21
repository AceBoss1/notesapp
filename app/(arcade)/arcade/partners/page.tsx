import type { Metadata } from "next";
import ArcadePartners from "@/components/games/ArcadePartners";

export const metadata: Metadata = {
  title: { absolute: "Partner with Notes Arcade" },
  description: "Put your brand in Notes Arcade's free games: the middle of the Ludo board, the Naija Landlord board, under every game, sponsored squares and tournaments.",
};

export default function Page() {
  return <ArcadePartners />;
}
