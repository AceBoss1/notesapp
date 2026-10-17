import type { Metadata } from "next";
import ExplorePageClient from "@/components/ExplorePageClient";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse #NotesApp by topic, and find people and channels to follow.",
};

export default function ExplorePage() {
  return <ExplorePageClient />;
}
