import type { Metadata } from "next";
import ExplorePageClient from "@/components/ExplorePageClient";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse #NotesApp by topic, find people, channels and communities to follow and upcoming public events to attend, and see the week's most looked-at products in Notes Market and courses in Notes Academy.",
};

export default function ExplorePage() {
  return <ExplorePageClient />;
}
