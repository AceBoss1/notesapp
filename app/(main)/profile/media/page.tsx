import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ReplaysList from "@/components/replays/ReplaysList";

// The host's Media area. For now it holds the recordings and replays from lives (components/replays/ReplaysList.tsx); the Media studio
// being designed will take this address and reuse that list.
export const metadata: Metadata = { title: "Media", robots: { index: false } };
export default function MediaPage() {
  return (
    <>
      <PageHero eyebrow="My account" title="Media" compact>
        <p>Your recorded lives and the replays you&apos;ve published.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6"><ReplaysList /></div>
    </>
  );
}
