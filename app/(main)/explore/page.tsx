import type { Metadata } from "next";
import ExplorePageClient from "@/components/ExplorePageClient";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse #NotesApp by topic, find people and channels to follow, and see the week's most looked-at products in Notes Market and courses in Notes Academy.",
};

export default function ExplorePage() {
  return <ExplorePageClient />;
}
